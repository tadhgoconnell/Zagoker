import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { GameError, fromDatabaseError } from "@/lib/game/errors";
import type { ActiveRound, CasinoGame, CasinoStore } from "./service";

/**
 * The live CasinoStore: the casino_* database functions, called with the game
 * server key (no user session), plus the player's balance.
 */
function client() {
  return createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(fn, { p_key: serverEnv.gameServerKey, ...args });
  if (error) {
    const e = fromDatabaseError(error);
    // Same database error as a poker buy-in, different words.
    if (e.code === "insufficient_chips") {
      throw new GameError(e.code, e.status, "You do not have enough chips for that bet.");
    }
    throw e;
  }
  return data as T;
}

export function databaseStore(readBalance: (userId: string) => Promise<number>): CasinoStore {
  return {
    balance: readBalance,
    loadBlackjack: (userId) => rpc<ActiveRound | null>("casino_load", { p_user_id: userId }),
    start: (userId: string, game: CasinoGame, stake: number, state: unknown, payout: number | null) =>
      rpc<string>("casino_start", {
        p_user_id: userId,
        p_game: game,
        p_stake: stake,
        p_state: state,
        p_payout: payout,
      }),
    update: (roundId, version, state, extraStake) =>
      rpc<number>("casino_update", { p_round_id: roundId, p_version: version, p_state: state, p_extra: extraStake }),
    settle: (roundId, version, state, payout) =>
      rpc<void>("casino_settle", { p_round_id: roundId, p_version: version, p_state: state, p_payout: payout }),
  };
}
