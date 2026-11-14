import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { HandState } from "@/lib/poker";
import { fromDatabaseError } from "./errors";

/**
 * Database access for the game server. Calls carry the game server key and
 * no user session, so they can only reach the game_* functions.
 */
function client() {
  return createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function gameRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(fn, { p_key: serverEnv.gameServerKey, ...args });
  if (error) throw fromDatabaseError(error);
  return data as T;
}

export type TableRow = {
  id: string;
  name: string;
  owner_id: string;
  is_private: boolean;
  max_players: number;
  small_blind: number;
  big_blind: number;
  buy_in: number;
  status: "open" | "closed";
  dealer_seat: number | null;
  hand_number: number;
};

export type SeatRow = {
  seat_no: number;
  user_id: string;
  stack: number;
  status: "active" | "sitting_out" | "leaving";
};

export type LoadedTable = {
  /** Database clock at the time of loading. */
  now?: string;
  /** When the current player's turn runs out. */
  turn_deadline?: string | null;
  /** When the most recent hand finished, if no hand is running. */
  last_hand_ended_at?: string | null;
  table: TableRow;
  seats: SeatRow[];
  hand: {
    id: string;
    hand_number: number;
    version: number;
    state: HandState;
    updated_at: string;
  } | null;
};

export async function loadTable(tableId: string): Promise<LoadedTable | null> {
  return gameRpc<LoadedTable | null>("game_load", { p_table_id: tableId });
}

export async function saveNewHand(input: {
  tableId: string;
  expectedHandNumber: number;
  state: HandState;
  view: unknown;
  deadline: string | null;
}): Promise<string> {
  return gameRpc<string>("game_start_hand", {
    p_table_id: input.tableId,
    p_expected_hand_number: input.expectedHandNumber,
    p_state: input.state,
    p_view: input.view,
    p_deadline: input.deadline,
  });
}

export async function saveHand(input: {
  handId: string;
  expectedVersion: number;
  state: HandState;
  view: unknown;
  newActions: unknown[];
  deadline: string | null;
}): Promise<number> {
  return gameRpc<number>("game_commit", {
    p_hand_id: input.handId,
    p_expected_version: input.expectedVersion,
    p_state: input.state,
    p_view: input.view,
    p_new_actions: input.newActions,
    p_deadline: input.deadline,
  });
}

export async function abortHand(handId: string): Promise<boolean> {
  return gameRpc<boolean>("game_abort_hand", { p_hand_id: handId });
}

export async function setSittingOut(tableId: string, userId: string): Promise<void> {
  await gameRpc<null>("game_set_sitting_out", { p_table_id: tableId, p_user_id: userId });
}
