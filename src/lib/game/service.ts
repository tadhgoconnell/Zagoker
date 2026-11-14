import "server-only";
import {
  applyAction,
  getTimeoutAction,
  nextDealerSeat,
  PokerError,
  startHand,
  toPlayerView,
  type HandState,
  type HandView,
  type PlayerAction,
} from "@/lib/poker";
import { secureRandomInt } from "@/lib/poker/secure-random";
import {
  abortHand,
  loadTable,
  saveHand,
  saveNewHand,
  setSittingOut,
  type LoadedTable,
} from "./db";
import { GameError } from "./errors";
import { PAUSE_AFTER_FOLD_MS, TURN_SECONDS } from "./timing";

/** A hand nobody has touched for this long is cancelled and chips restored. */
const ABANDONED_AFTER_MS = 3 * 60 * 1000;
/** Allowance for clock differences before a timeout is accepted. */
const TIMEOUT_GRACE_MS = 500;

const deadlineFor = (state: HandState) =>
  state.result ? null : new Date(Date.now() + TURN_SECONDS * 1000).toISOString();

/** What everyone at the table may see: no deck, no hole cards. */
const publicView = (state: HandState) => toPlayerView(state, null);

async function mustLoad(tableId: string): Promise<LoadedTable> {
  const data = await loadTable(tableId);
  if (!data || data.table.status !== "open") {
    throw new GameError("table_not_found", 404, "This table does not exist or has closed.");
  }
  return data;
}

/**
 * Players who are still in the hand but are no longer playing (they left the
 * table, or their timer ran out and they are sitting out) act automatically:
 * check when free, otherwise fold. `alsoAway` adds seats that became absent
 * during this very request.
 */
function autoActForAbsent(state: HandState, data: LoadedTable, alsoAway: number[] = []): HandState {
  const absent = new Set([
    ...data.seats.filter((s) => s.status !== "active").map((s) => s.seat_no),
    ...alsoAway,
  ]);
  let s = state;
  while (s.toActSeat !== null && absent.has(s.toActSeat)) {
    s = applyAction(s, s.toActSeat, getTimeoutAction(s, s.toActSeat));
  }
  return s;
}

/** Cancels the hand if it has been abandoned. Returns true if it did. */
async function abortIfAbandoned(data: LoadedTable): Promise<boolean> {
  if (!data.hand) return false;
  const idle = Date.now() - new Date(data.hand.updated_at).getTime();
  if (idle < ABANDONED_AFTER_MS) return false;
  await abortHand(data.hand.id);
  return true;
}

async function save(data: LoadedTable, next: HandState): Promise<void> {
  const hand = data.hand!;
  await saveHand({
    handId: hand.id,
    expectedVersion: hand.version,
    state: next,
    view: publicView(next),
    newActions: next.actions.slice(hand.state.actions.length),
    deadline: deadlineFor(next),
  });
}

/**
 * Shuffles, deals and stores a new hand.
 *
 * The first hand at a private table is started by its host. After that, and
 * at public tables, any seated player's browser may ask for the next deal;
 * the server enforces a short pause so everyone sees the previous result,
 * and the database guarantees only one request wins.
 */
export async function startHandAtTable(tableId: string, userId: string): Promise<void> {
  let data = await mustLoad(tableId);
  if (await abortIfAbandoned(data)) data = await mustLoad(tableId);

  if (!data.seats.some((s) => s.user_id === userId && s.status === "active")) {
    throw new GameError("not_seated", 409, "Sit down at the table first.");
  }
  if (data.hand) {
    throw new GameError("hand_in_progress", 409, "A hand is already being played.");
  }
  if (data.table.hand_number === 0 && data.table.is_private && data.table.owner_id !== userId) {
    throw new GameError("host_starts", 403, "Waiting for the host to start the game.");
  }
  if (data.last_hand_ended_at && data.now) {
    const since = new Date(data.now).getTime() - new Date(data.last_hand_ended_at).getTime();
    if (since < PAUSE_AFTER_FOLD_MS) {
      throw new GameError("too_soon", 409, "The next hand starts in a moment.");
    }
  }

  const players = data.seats
    .filter((s) => s.status === "active" && s.stack > 0)
    .map((s) => ({ seat: s.seat_no, id: s.user_id, stack: Number(s.stack) }));
  if (players.length < 2) {
    throw new GameError("not_enough_players", 409, "At least two players with chips are needed.");
  }

  const state = startHand({
    smallBlind: Number(data.table.small_blind),
    bigBlind: Number(data.table.big_blind),
    dealerSeat: nextDealerSeat(players.map((p) => p.seat), data.table.dealer_seat),
    players,
    randomInt: secureRandomInt,
  });

  await saveNewHand({
    tableId,
    expectedHandNumber: data.table.hand_number,
    state,
    view: publicView(state),
    deadline: deadlineFor(state),
  });
}

/**
 * Validates and applies one player action.
 *
 * `clientVersion` is the hand version the player was looking at. If the hand
 * has moved on (a double click, a second tab, a slow connection) the request
 * is rejected rather than applied to a situation the player never saw. The
 * database repeats the check when saving, which settles any remaining race.
 */
export async function playerAction(
  tableId: string,
  userId: string,
  action: PlayerAction,
  clientVersion: number,
): Promise<void> {
  const data = await mustLoad(tableId);
  if (await abortIfAbandoned(data)) {
    throw new GameError("hand_aborted", 409, "That hand was cancelled. Chips have been returned.");
  }
  const hand = data.hand;
  if (!hand) throw new GameError("no_hand", 409, "There is no hand in progress.");
  if (hand.version !== clientVersion) {
    throw new GameError("stale", 409, "The game has moved on. Refreshing.");
  }

  const me = hand.state.players.find((p) => p.id === userId);
  if (!me) throw new GameError("not_in_hand", 403, "You are not in this hand.");

  let next: HandState;
  try {
    next = applyAction(hand.state, me.seat, action);
    next = autoActForAbsent(next, data);
  } catch (e) {
    if (e instanceof PokerError) throw new GameError(e.code, 400, e.message);
    throw e;
  }
  await save(data, next);
}

/**
 * Enforces the turn timer. Any connected browser may report that the
 * deadline has passed; the server checks the stored deadline itself, so a
 * client cannot time an opponent out early. The player is checked or folded
 * and marked as sitting out until they come back.
 */
export async function timeoutTurn(tableId: string, clientVersion: number): Promise<void> {
  const data = await mustLoad(tableId);
  const hand = data.hand;
  if (!hand || hand.state.toActSeat === null) {
    throw new GameError("no_hand", 409, "There is no hand in progress.");
  }
  if (hand.version !== clientVersion) {
    throw new GameError("stale", 409, "The game has moved on. Refreshing.");
  }
  if (!data.turn_deadline || Date.now() + TIMEOUT_GRACE_MS < new Date(data.turn_deadline).getTime()) {
    throw new GameError("not_timed_out", 409, "That player still has time.");
  }

  const seat = hand.state.toActSeat;
  const player = hand.state.players.find((p) => p.seat === seat)!;
  let next = applyAction(hand.state, seat, getTimeoutAction(hand.state, seat));
  next = autoActForAbsent(next, data, [seat]);
  await save(data, next);
  await setSittingOut(tableId, player.id);
}

/**
 * Called after a player leaves: if it is (or becomes) their turn, act for
 * them so the table is not left waiting.
 */
export async function resolveAbsent(tableId: string): Promise<void> {
  const data = await loadTable(tableId);
  const hand = data?.hand;
  if (!data || !hand) return;
  const next = autoActForAbsent(hand.state, data);
  if (next.version === hand.version) return;
  try {
    await save(data, next);
  } catch (e) {
    // Someone else acted in the meantime; their request handles the absentee.
    if (!(e instanceof GameError && e.code === "stale")) throw e;
  }
}

/**
 * The hand as this particular user may see it: their own hole cards and, on
 * their turn, their legal actions. Null if no hand is in progress or the user
 * is not in it (they then rely on the public view).
 */
export async function personalHandView(
  tableId: string,
  userId: string,
): Promise<HandView | null> {
  const data = await loadTable(tableId);
  const me = data?.hand?.state.players.find((p) => p.id === userId);
  if (!data?.hand || !me) return null;
  return toPlayerView(data.hand.state, me.seat);
}

