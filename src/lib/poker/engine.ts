/**
 * No-Limit Texas Hold'em hand engine.
 *
 * Pure and deterministic: the only randomness is the shuffle performed in
 * startHand(), using the RandomInt it is given. After that, the same state and
 * the same action always produce the same next state. Nothing here touches
 * the network, the database, the clock or the UI.
 *
 * The full HandState contains the deck and every player's hole cards. It must
 * stay on the server. Use toPlayerView() to produce what a client may see.
 */
import { createShuffledDeck, type Card, type RandomInt } from "./cards";
import { compareHands, evaluateHand, type EvaluatedHand } from "./evaluator";
import { buildPots, splitPot, uncalledBet, type Pot } from "./pots";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type Street = "preflop" | "flop" | "turn" | "river";

export type ActionType = "fold" | "check" | "call" | "bet" | "raise" | "allin";

/**
 * What a player asks to do. For "bet" and "raise", `amount` is the total the
 * player will have put in on this street after the action ("raise to").
 */
export type PlayerAction =
  | { type: "fold" | "check" | "call" | "allin" }
  | { type: "bet" | "raise"; amount: number };

export type PlayerState = {
  seat: number;
  /** Opaque player identifier (the user id). */
  id: string;
  /** Chips behind, not yet committed. */
  stack: number;
  holeCards: Card[];
  /** Chips committed on the current street. */
  streetBet: number;
  /** Chips committed over the whole hand. */
  totalBet: number;
  folded: boolean;
  allIn: boolean;
  /** Has acted voluntarily on the current street. */
  hasActed: boolean;
  /**
   * True once the player has acted since the last full raise. Such a player
   * may call or fold but not raise again until someone makes a full raise.
   */
  raiseClosed: boolean;
};

export type ActionRecord = {
  seat: number;
  street: Street;
  /** Normalised action: "allin" is recorded as the bet/raise/call it was. */
  type: "post_sb" | "post_bb" | "fold" | "check" | "call" | "bet" | "raise";
  /** Chips added by this action. */
  added: number;
  /** Player's street total after the action. */
  streetBet: number;
  allIn: boolean;
};

export type PotResult = Pot & {
  winners: { seat: number; amount: number }[];
};

export type HandResult = {
  endedBy: "fold" | "showdown";
  pots: PotResult[];
  /** Unmatched chips returned to a player before the pots were formed. */
  returned: { seat: number; amount: number } | null;
  /** Chips won from pots per seat (excludes returned chips). */
  winnings: Record<number, number>;
  /** Net result per seat for the hand: final stack minus starting stack. */
  net: Record<number, number>;
  /** Hands shown at showdown. Empty when the hand ended by everyone folding. */
  shown: { seat: number; holeCards: Card[]; hand: EvaluatedHand }[];
};

export type HandState = {
  smallBlind: number;
  bigBlind: number;
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  /** Players in the hand, ordered by seat number. */
  players: PlayerState[];
  /** Remaining deck. SECRET: never send to clients. */
  deck: Card[];
  board: Card[];
  street: Street;
  /** Highest street commitment that must be matched. */
  currentBet: number;
  /** Minimum size of the next raise (the last full bet or raise). */
  minRaise: number;
  /** currentBet as of the last full bet or raise. */
  lastFullBet: number;
  /** Seat whose turn it is, or null when the hand is over. */
  toActSeat: number | null;
  actions: ActionRecord[];
  /** Stacks at the start of the hand, for computing net results. */
  startingStacks: Record<number, number>;
  result: HandResult | null;
  /** Incremented on every applied action. Used to reject stale requests. */
  version: number;
};

export type LegalActions = {
  canFold: boolean;
  canCheck: boolean;
  /** Chips needed to call (capped at the player's stack). 0 if nothing to call. */
  callAmount: number;
  /** "bet" when no one has bet this street, otherwise "raise". Null if neither is allowed. */
  raise: {
    type: "bet" | "raise";
    /** Smallest legal "raise to" total. Equals `max` when only all-in is possible. */
    min: number;
    /** Largest legal "raise to" total (all-in). */
    max: number;
  } | null;
};

export type PokerErrorCode =
  | "hand_over"
  | "not_your_turn"
  | "not_in_hand"
  | "invalid_action"
  | "invalid_amount"
  | "invalid_setup";

export class PokerError extends Error {
  constructor(
    public code: PokerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PokerError";
  }
}

// --------------------------------------------------------------------------
// Seating helpers
// --------------------------------------------------------------------------

/** Seats in clockwise order starting with the first seat after `fromSeat`. */
function seatsAfter(seats: readonly number[], fromSeat: number): number[] {
  const sorted = seats.slice().sort((a, b) => a - b);
  const after = sorted.filter((s) => s > fromSeat);
  const before = sorted.filter((s) => s <= fromSeat);
  return [...after, ...before];
}

/**
 * The button moves to the next occupied seat clockwise. Works when players
 * have joined or left between hands: `previousDealer` need not be occupied.
 */
export function nextDealerSeat(
  seats: readonly number[],
  previousDealer: number | null,
): number {
  if (seats.length === 0) throw new PokerError("invalid_setup", "No players");
  if (previousDealer === null) return Math.min(...seats);
  return seatsAfter(seats, previousDealer)[0];
}

const isPositiveInt = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n > 0;

// --------------------------------------------------------------------------
// Starting a hand
// --------------------------------------------------------------------------

export type StartHandInput = {
  smallBlind: number;
  bigBlind: number;
  /** Seat holding the dealer button. Must be one of the players' seats. */
  dealerSeat: number;
  /** Everyone dealt in. Each needs a positive stack. */
  players: { seat: number; id: string; stack: number }[];
  randomInt: RandomInt;
};

export function startHand(input: StartHandInput): HandState {
  const { smallBlind, bigBlind, dealerSeat, randomInt } = input;

  if (!isPositiveInt(smallBlind) || !isPositiveInt(bigBlind) || smallBlind > bigBlind) {
    throw new PokerError("invalid_setup", "Blinds must be positive whole numbers with small blind <= big blind");
  }
  if (input.players.length < 2 || input.players.length > 9) {
    throw new PokerError("invalid_setup", "A hand needs 2 to 9 players");
  }
  const seats = input.players.map((p) => p.seat);
  if (new Set(seats).size !== seats.length || !seats.every((s) => Number.isInteger(s) && s >= 0)) {
    throw new PokerError("invalid_setup", "Seats must be unique non-negative integers");
  }
  if (new Set(input.players.map((p) => p.id)).size !== input.players.length) {
    throw new PokerError("invalid_setup", "A player cannot hold two seats");
  }
  if (!input.players.every((p) => isPositiveInt(p.stack))) {
    throw new PokerError("invalid_setup", "Every player needs a positive whole-number stack");
  }
  if (!seats.includes(dealerSeat)) {
    throw new PokerError("invalid_setup", "The dealer seat must be occupied");
  }

  const players: PlayerState[] = input.players
    .slice()
    .sort((a, b) => a.seat - b.seat)
    .map((p) => ({
      seat: p.seat,
      id: p.id,
      stack: p.stack,
      holeCards: [],
      streetBet: 0,
      totalBet: 0,
      folded: false,
      allIn: false,
      hasActed: false,
      raiseClosed: false,
    }));

  const order = seatsAfter(seats, dealerSeat); // first seat left of the button first
  const headsUp = players.length === 2;
  // Heads-up the button posts the small blind; otherwise it is the next seat.
  const smallBlindSeat = headsUp ? dealerSeat : order[0];
  const bigBlindSeat = headsUp ? order[0] : order[1];

  const state: HandState = {
    smallBlind,
    bigBlind,
    dealerSeat,
    smallBlindSeat,
    bigBlindSeat,
    players,
    deck: createShuffledDeck(randomInt),
    board: [],
    street: "preflop",
    currentBet: bigBlind,
    minRaise: bigBlind,
    lastFullBet: bigBlind,
    toActSeat: null,
    actions: [],
    startingStacks: Object.fromEntries(players.map((p) => [p.seat, p.stack])),
    result: null,
    version: 0,
  };

  // Deal one card at a time, starting left of the button, twice round.
  for (let round = 0; round < 2; round++) {
    for (const seat of order) {
      player(state, seat).holeCards.push(state.deck.pop()!);
    }
  }

  // A short stack posts what it has and is all-in.
  commit(state, player(state, smallBlindSeat), smallBlind, "post_sb");
  commit(state, player(state, bigBlindSeat), bigBlind, "post_bb");

  // First to act pre-flop is left of the big blind (the button heads-up).
  advance(state, bigBlindSeat);
  return state;
}

// --------------------------------------------------------------------------
// Internal helpers (mutate a working copy)
// --------------------------------------------------------------------------

function player(state: HandState, seat: number): PlayerState {
  const p = state.players.find((x) => x.seat === seat);
  if (!p) throw new PokerError("not_in_hand", `Seat ${seat} is not in this hand`);
  return p;
}

/** Moves up to `amount` chips from a stack into the pot and records it. */
function commit(
  state: HandState,
  p: PlayerState,
  amount: number,
  type: ActionRecord["type"],
): number {
  const added = Math.min(amount, p.stack);
  p.stack -= added;
  p.streetBet += added;
  p.totalBet += added;
  if (p.stack === 0) p.allIn = true;
  state.actions.push({
    seat: p.seat,
    street: state.street,
    type,
    added,
    streetBet: p.streetBet,
    allIn: p.allIn,
  });
  return added;
}

const canAct = (p: PlayerState) => !p.folded && !p.allIn;

/**
 * After an action (or the blinds), work out what happens next: another
 * player's turn, the next street, a showdown, or a win by everyone folding.
 */
function advance(state: HandState, lastSeat: number): void {
  const remaining = state.players.filter((p) => !p.folded);
  if (remaining.length === 1) {
    finishByFold(state, remaining[0]);
    return;
  }

  const needsTurn = (p: PlayerState) =>
    canAct(p) && (!p.hasActed || p.streetBet < state.currentBet);

  let actors = state.players.filter(canAct);
  // A lone player with nothing to call has no one left to bet against.
  const loneAndSquare = actors.length === 1 && actors[0].streetBet >= state.currentBet;
  const next = loneAndSquare
    ? undefined
    : seatsAfter(state.players.map((p) => p.seat), lastSeat)
        .map((seat) => player(state, seat))
        .find(needsTurn);

  if (next) {
    state.toActSeat = next.seat;
    return;
  }

  // Betting round complete. Deal streets until someone can act, or showdown.
  for (;;) {
    if (state.street === "river") {
      finishByShowdown(state);
      return;
    }
    dealNextStreet(state);
    actors = state.players.filter(canAct);
    if (actors.length >= 2) {
      // Post-flop, first to act is the first live player left of the button.
      state.toActSeat = seatsAfter(state.players.map((p) => p.seat), state.dealerSeat)
        .map((seat) => player(state, seat))
        .find(canAct)!.seat;
      return;
    }
    // Zero or one player can still act: everyone else is all-in, so the
    // remaining cards are simply dealt out.
  }
}

function dealNextStreet(state: HandState): void {
  const nextStreet: Record<Street, Street> = {
    preflop: "flop",
    flop: "turn",
    turn: "river",
    river: "river",
  };
  state.street = nextStreet[state.street];
  state.deck.pop(); // burn
  const count = state.street === "flop" ? 3 : 1;
  for (let i = 0; i < count; i++) state.board.push(state.deck.pop()!);

  state.currentBet = 0;
  state.minRaise = state.bigBlind;
  state.lastFullBet = 0;
  for (const p of state.players) {
    p.streetBet = 0;
    p.hasActed = false;
    p.raiseClosed = false;
  }
}

function contributions(state: HandState) {
  return state.players.map((p) => ({ seat: p.seat, amount: p.totalBet, folded: p.folded }));
}

/** Returns any unmatched bet to its owner. Call before building pots. */
function returnUncalled(state: HandState): HandResult["returned"] {
  const returned = uncalledBet(contributions(state));
  if (returned) {
    const p = player(state, returned.seat);
    p.stack += returned.amount;
    p.totalBet -= returned.amount;
    p.streetBet = Math.max(0, p.streetBet - returned.amount);
    if (p.stack > 0) p.allIn = false;
  }
  return returned;
}

function finish(
  state: HandState,
  endedBy: HandResult["endedBy"],
  returned: HandResult["returned"],
  pots: PotResult[],
  shown: HandResult["shown"],
): void {
  const winnings: Record<number, number> = {};
  for (const pot of pots) {
    for (const w of pot.winners) {
      winnings[w.seat] = (winnings[w.seat] ?? 0) + w.amount;
      player(state, w.seat).stack += w.amount;
    }
  }
  const net: Record<number, number> = {};
  for (const p of state.players) net[p.seat] = p.stack - state.startingStacks[p.seat];

  state.toActSeat = null;
  state.result = { endedBy, pots, returned, winnings, net, shown };
}

function finishByFold(state: HandState, winner: PlayerState): void {
  const returned = returnUncalled(state);
  const amount = state.players.reduce((sum, p) => sum + p.totalBet, 0);
  finish(
    state,
    "fold",
    returned,
    [{ amount, eligibleSeats: [winner.seat], winners: [{ seat: winner.seat, amount }] }],
    [],
  );
}

function finishByShowdown(state: HandState): void {
  const returned = returnUncalled(state);
  const contenders = state.players.filter((p) => !p.folded);
  const hands = new Map<number, EvaluatedHand>(
    contenders.map((p) => [p.seat, evaluateHand([...p.holeCards, ...state.board])]),
  );
  // Odd chips go to the first winner left of the button.
  const oddChipOrder = seatsAfter(state.players.map((p) => p.seat), state.dealerSeat);

  const pots: PotResult[] = buildPots(contributions(state)).map((pot) => {
    let best: EvaluatedHand | null = null;
    let winners: number[] = [];
    for (const seat of pot.eligibleSeats) {
      const hand = hands.get(seat)!;
      const cmp = best ? compareHands(hand, best) : 1;
      if (cmp > 0) {
        best = hand;
        winners = [seat];
      } else if (cmp === 0) {
        winners.push(seat);
      }
    }
    const shares = splitPot(pot.amount, winners, oddChipOrder);
    return {
      ...pot,
      winners: winners.map((seat) => ({ seat, amount: shares.get(seat)! })),
    };
  });

  finish(
    state,
    "showdown",
    returned,
    pots,
    contenders.map((p) => ({ seat: p.seat, holeCards: p.holeCards, hand: hands.get(p.seat)! })),
  );
}

// --------------------------------------------------------------------------
// Legal actions
// --------------------------------------------------------------------------

/** What the given seat may do right now. All false/null if it is not their turn. */
export function getLegalActions(state: HandState, seat: number): LegalActions {
  const none: LegalActions = { canFold: false, canCheck: false, callAmount: 0, raise: null };
  if (state.result || state.toActSeat !== seat) return none;
  const p = state.players.find((x) => x.seat === seat);
  if (!p || !canAct(p)) return none;

  const toCall = Math.max(0, state.currentBet - p.streetBet);
  const maxTotal = p.streetBet + p.stack; // all-in

  let raise: LegalActions["raise"] = null;
  // Raising needs more chips than a call, the right to raise, and at least
  // one opponent who is not already all-in to raise against.
  const opponentsCanRespond = state.players.some((o) => o.seat !== seat && canAct(o));
  if (maxTotal > state.currentBet && !p.raiseClosed && opponentsCanRespond) {
    const type = state.currentBet === 0 ? "bet" : "raise";
    const fullMin = state.currentBet === 0 ? state.bigBlind : state.currentBet + state.minRaise;
    raise = { type, min: Math.min(fullMin, maxTotal), max: maxTotal };
  }

  return {
    canFold: true,
    canCheck: toCall === 0,
    callAmount: Math.min(toCall, p.stack),
    raise,
  };
}

/** The action applied when a player's turn timer runs out: check if free, otherwise fold. */
export function getTimeoutAction(state: HandState, seat: number): PlayerAction {
  return getLegalActions(state, seat).canCheck ? { type: "check" } : { type: "fold" };
}

// --------------------------------------------------------------------------
// Applying an action
// --------------------------------------------------------------------------

/**
 * Validates and applies one action, returning the new state. The input state
 * is not modified. Throws PokerError if the action is not legal; in that case
 * nothing has changed.
 */
export function applyAction(
  current: HandState,
  seat: number,
  action: PlayerAction,
): HandState {
  if (current.result) throw new PokerError("hand_over", "This hand is over");
  if (!current.players.some((p) => p.seat === seat)) {
    throw new PokerError("not_in_hand", "You are not in this hand");
  }
  if (current.toActSeat !== seat) throw new PokerError("not_your_turn", "It is not your turn");

  const legal = getLegalActions(current, seat);
  const state = structuredClone(current);
  const p = player(state, seat);
  const maxTotal = p.streetBet + p.stack;

  // Resolve "allin" into the concrete action it amounts to.
  let type = action.type;
  let target = "amount" in action ? action.amount : 0;
  if (type === "allin") {
    if (legal.raise) {
      type = legal.raise.type;
      target = maxTotal;
    } else if (legal.callAmount > 0 && legal.callAmount === p.stack) {
      type = "call";
    } else {
      throw new PokerError("invalid_action", "You cannot go all-in here: call or fold");
    }
  }

  switch (type) {
    case "fold":
      p.folded = true;
      state.actions.push({ seat, street: state.street, type: "fold", added: 0, streetBet: p.streetBet, allIn: false });
      break;

    case "check":
      if (!legal.canCheck) throw new PokerError("invalid_action", "You cannot check: there is a bet to call");
      state.actions.push({ seat, street: state.street, type: "check", added: 0, streetBet: p.streetBet, allIn: false });
      break;

    case "call":
      if (legal.callAmount === 0) throw new PokerError("invalid_action", "There is nothing to call");
      commit(state, p, legal.callAmount, "call");
      break;

    case "bet":
    case "raise": {
      if (!legal.raise) {
        throw new PokerError("invalid_action", "You cannot bet or raise here");
      }
      if (type !== legal.raise.type) {
        throw new PokerError(
          "invalid_action",
          legal.raise.type === "bet" ? "There is no bet to raise: bet instead" : "There is already a bet: raise instead",
        );
      }
      if (!Number.isSafeInteger(target)) {
        throw new PokerError("invalid_amount", "Amount must be a whole number of chips");
      }
      if (target > legal.raise.max) {
        throw new PokerError("invalid_amount", "You do not have that many chips");
      }
      if (target < legal.raise.min) {
        throw new PokerError("invalid_amount", `The minimum is ${legal.raise.min}`);
      }

      const raiseSize = target - state.currentBet;
      commit(state, p, target - p.streetBet, type);
      state.currentBet = target;

      const isFull = raiseSize >= state.minRaise;
      if (isFull) {
        state.minRaise = raiseSize;
      }
      // A full raise reopens the betting for everyone else. So does a series
      // of short all-ins that together amount to a full raise.
      if (isFull || target - state.lastFullBet >= state.minRaise) {
        state.lastFullBet = target;
        for (const other of state.players) {
          if (other.seat !== seat) other.raiseClosed = false;
        }
      }
      break;
    }
  }

  p.hasActed = true;
  p.raiseClosed = true;
  state.version += 1;
  advance(state, seat);
  return state;
}

// --------------------------------------------------------------------------
// Client-safe view
// --------------------------------------------------------------------------

export type PlayerView = {
  seat: number;
  id: string;
  stack: number;
  streetBet: number;
  totalBet: number;
  folded: boolean;
  allIn: boolean;
  /** Only present for the viewer's own seat, or once shown at showdown. */
  holeCards: Card[] | null;
};

export type HandView = {
  smallBlind: number;
  bigBlind: number;
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  players: PlayerView[];
  board: Card[];
  street: Street;
  /** All chips committed so far. */
  pot: number;
  currentBet: number;
  toActSeat: number | null;
  actions: ActionRecord[];
  result: HandResult | null;
  version: number;
  /** The viewer's options, when it is their turn. */
  legalActions: LegalActions | null;
};

/**
 * The hand as one particular viewer is allowed to see it. The deck is never
 * included. Hole cards are included only for the viewer's own seat and for
 * hands shown at showdown. Pass null for a spectator.
 */
export function toPlayerView(state: HandState, viewerSeat: number | null): HandView {
  const shownSeats = new Set(state.result?.shown.map((s) => s.seat) ?? []);
  return {
    smallBlind: state.smallBlind,
    bigBlind: state.bigBlind,
    dealerSeat: state.dealerSeat,
    smallBlindSeat: state.smallBlindSeat,
    bigBlindSeat: state.bigBlindSeat,
    players: state.players.map((p) => ({
      seat: p.seat,
      id: p.id,
      stack: p.stack,
      streetBet: p.streetBet,
      totalBet: p.totalBet,
      folded: p.folded,
      allIn: p.allIn,
      holeCards:
        p.seat === viewerSeat || shownSeats.has(p.seat) ? p.holeCards.slice() : null,
    })),
    board: state.board.slice(),
    street: state.street,
    pot: state.players.reduce((sum, p) => sum + p.totalBet, 0),
    currentBet: state.currentBet,
    toActSeat: state.toActSeat,
    actions: state.actions.slice(),
    result: state.result ? structuredClone(state.result) : null,
    version: state.version,
    legalActions:
      viewerSeat !== null && state.toActSeat === viewerSeat
        ? getLegalActions(state, viewerSeat)
        : null,
  };
}
