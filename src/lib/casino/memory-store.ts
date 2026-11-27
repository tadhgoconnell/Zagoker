/**
 * An in-memory CasinoStore with the same rules as the database functions:
 * for tests. Not used by the live site.
 */
import { GameError } from "@/lib/game/errors";
import type { BjState } from "./blackjack";
import { casinoLimits } from "./limits";
import type { ActiveRound, CasinoGame, CasinoStore } from "./service";

type Round = {
  id: string;
  userId: string;
  game: CasinoGame;
  staked: number;
  payout: number;
  version: number;
  state: unknown;
  active: boolean;
};

export class MemoryStore implements CasinoStore {
  balances = new Map<string, number>();
  rounds: Round[] = [];
  /** Every balance change, like the chip_transactions ledger. */
  ledger: { userId: string; amount: number; kind: "casino_bet" | "casino_payout" }[] = [];
  private nextId = 1;

  private move(userId: string, amount: number, kind: "casino_bet" | "casino_payout") {
    const after = (this.balances.get(userId) ?? 0) + amount;
    if (after < 0) throw new GameError("insufficient_chips", 409, "You do not have enough chips for that bet.");
    this.balances.set(userId, after);
    this.ledger.push({ userId, amount, kind });
  }

  private round(id: string, version: number) {
    const r = this.rounds.find((x) => x.id === id);
    if (!r || !r.active) throw new GameError("no_round", 409, "There is no hand in play. Place a bet to deal.");
    if (r.version !== version) throw new GameError("stale", 409, "The game has moved on. Refreshing.");
    return r;
  }

  async balance(userId: string) {
    return this.balances.get(userId) ?? 0;
  }

  async loadBlackjack(userId: string): Promise<ActiveRound | null> {
    const r = this.rounds.find((x) => x.userId === userId && x.game === "blackjack" && x.active);
    return r ? { id: r.id, version: r.version, state: structuredClone(r.state) as BjState } : null;
  }

  async start(userId: string, game: CasinoGame, stake: number, state: unknown, payout: number | null) {
    if (stake < casinoLimits.minBet || stake > casinoLimits.maxBet) throw new GameError("invalid_bet", 400, "Bad bet.");
    if (payout === null && this.rounds.some((x) => x.userId === userId && x.game === game && x.active)) {
      throw new GameError("round_in_progress", 409, "Finish the hand you are playing first.");
    }
    this.move(userId, -stake, "casino_bet");
    const id = `r${this.nextId++}`;
    this.rounds.push({ id, userId, game, staked: stake, payout: payout ?? 0, version: 0, state: structuredClone(state), active: payout === null });
    if (payout) this.move(userId, payout, "casino_payout");
    return id;
  }

  async update(roundId: string, version: number, state: unknown, extraStake: number) {
    const r = this.round(roundId, version);
    if (extraStake > 0) {
      this.move(r.userId, -extraStake, "casino_bet");
      r.staked += extraStake;
    }
    r.state = structuredClone(state);
    return ++r.version;
  }

  async settle(roundId: string, version: number, state: unknown, payout: number) {
    const r = this.round(roundId, version);
    if (payout > r.staked * 36) throw new Error("payout too large");
    r.state = structuredClone(state);
    r.payout = payout;
    r.version++;
    r.active = false;
    if (payout > 0) this.move(r.userId, payout, "casino_payout");
  }
}
