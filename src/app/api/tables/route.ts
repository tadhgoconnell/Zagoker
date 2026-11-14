import type { NextRequest } from "next/server";
import { api, body, unwrap } from "@/lib/api/http";
import { createTableSchema } from "@/lib/game/schemas";

/** Create a table. The caller becomes its host. */
export function POST(request: NextRequest) {
  return api(request, async ({ supabase }) => {
    const input = await body(request, createTableSchema);
    const table = unwrap(
      await supabase
        .rpc("create_table", {
          p_name: input.name,
          p_max_players: input.maxPlayers,
          p_small_blind: input.smallBlind,
          p_big_blind: input.bigBlind,
          p_buy_in: input.buyIn,
          p_is_private: input.isPrivate,
        })
        .single(),
    );
    return { table };
  });
}

/** Open public tables for the lobby, with how many players are seated. */
export function GET(request: NextRequest) {
  return api(request, async ({ user, supabase }) => {
    const [tables, mine] = await Promise.all([
      supabase
        .from("poker_tables")
        .select("id, name, max_players, small_blind, big_blind, buy_in, hand_number, created_at, table_seats(count)")
        .eq("status", "open")
        .eq("is_private", false)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("table_seats").select("table_id").eq("user_id", user.id).maybeSingle(),
    ]);
    return {
      tables: (unwrap(tables) ?? []).map(({ table_seats, ...t }) => ({
        ...t,
        seated: table_seats[0]?.count ?? 0,
      })),
      myTableId: unwrap(mine)?.table_id ?? null,
    };
  });
}
