/**
 * Blackjack and roulette rounds: validates what the player asks for, runs the
 * rules and moves chips through a store. The live store is the database
 * (`./db.ts`); tests use an in-memory one. Chips always come from and go back
 * to the player's one balance, shared with the poker tables.
 */
import { z } from "zod";
import { GameError } from "@/lib/game/errors";
import type { RandomInt } from "@/lib/poker/cards";
import * as bj from "./blackjack";
import { casinoLimits } from "./limits";
import * as roulette from "./roulette";

export type CasinoGame = "blackjack" | "roulette";

export type ActiveRound = { id: string; version: number; state: bj.BjState };

/** Storage for rounds and balances. Every method is atomic. */
export interface CasinoStore {
  balance(userId: string): Promise<number>;
  /** The player's unfinished blackjack round, if any. */
  loadBlackjack(userId: string): Promise<ActiveRound | null>;
  /** Takes `stake` from the balance and stores a new round (settled or not). */
  start(userId: string, game: CasinoGame, stake: number, state: unknown, payout: number | null): Promise<string>;
  /** Takes `extraStake` and saves the state, if `version` is still current. */
  update(roundId: string, version: number, state: unknown, extraStake: number): Promise<number>;
  /** Pays `payout` and closes the round, if `version` is still current. */
  settle(roundId: string, version: number, state: unknown, payout: number): Promise<void>;
}

const checkBet = (amount: number) => {
  if (!Number.isInteger(amount) || amount < casinoLimits.minBet || amount > casinoLimits.maxBet) {
    throw new GameError(
      "invalid_bet",
      400,
      `Bets must be between ${casinoLimits.minBet} and ${casinoLimits.maxBet.toLocaleString("en-US")} chips.`,
    );
  }
};

/** A finished round is kept for the record without the rest of the shoe. */
const finished = (state: bj.BjState): bj.BjState => ({ ...state, shoe: [] });

export const blackjackRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("deal"), bet: z.number().int() }),
  z.object({ action: z.enum(["hit", "stand", "double", "split"]), version: z.number().int().nonnegative() }),
]);

export type BlackjackResponse = { round: (bj.BjView & { version: number }) | null; balance: number };

export async function blackjackStatus(store: CasinoStore, userId: string): Promise<BlackjackResponse> {
  const [round, balance] = await Promise.all([store.loadBlackjack(userId), store.balance(userId)]);
  return { round: round ? { ...bj.toView(round.state), version: round.version } : null, balance };
}

export async function blackjackAction(
  store: CasinoStore,
  userId: string,
  request: z.infer<typeof blackjackRequestSchema>,
  randomInt: RandomInt,
): Promise<BlackjackResponse> {
  if (request.action === "deal") {
    checkBet(request.bet);
    if (await store.loadBlackjack(userId)) {
      throw new GameError("round_in_progress", 409, "Finish the hand you are playing first.");
    }
    const state = bj.deal(request.bet, bj.newShoe(randomInt));
    const settled = state.phase === "settled";
    await store.start(userId, "blackjack", request.bet, settled ? finished(state) : state, settled ? bj.totalPayout(state) : null);
    return { round: { ...bj.toView(state), version: 0 }, balance: await store.balance(userId) };
  }

  const round = await store.loadBlackjack(userId);
  if (!round) throw new GameError("no_round", 409, "There is no hand in play. Place a bet to deal.");
  if (round.version !== request.version) throw new GameError("stale", 409, "The game has moved on. Refreshing.");
  let next: bj.BjState;
  try {
    next = bj.act(round.state, request.action);
  } catch (e) {
    if (e instanceof bj.IllegalAction) throw new GameError("illegal_action", 409, "You cannot do that now.");
    throw e;
  }
  const extra = bj.extraStake(round.state, request.action);
  let version = round.version;
  if (extra > 0 || next.phase !== "settled") {
    version = await store.update(round.id, round.version, next, extra);
  }
  if (next.phase === "settled") await store.settle(round.id, version, finished(next), bj.totalPayout(next));
  return { round: { ...bj.toView(next), version }, balance: await store.balance(userId) };
}

export const rouletteRequestSchema = z.object({ bets: z.array(roulette.betSchema).min(1).max(60) });

export type RouletteResponse = { result: roulette.SpinResult; balance: number };

export async function rouletteSpin(
  store: CasinoStore,
  userId: string,
  request: z.infer<typeof rouletteRequestSchema>,
  randomInt: RandomInt,
): Promise<RouletteResponse> {
  const bets = roulette.combineBets(request.bets as roulette.RouletteBet[]);
  checkBet(bets.reduce((a, b) => a + b.amount, 0));
  const result = roulette.settleSpin(bets, roulette.spin(randomInt));
  await store.start(userId, "roulette", result.staked, result, result.payout);
  return { result, balance: await store.balance(userId) };
}
