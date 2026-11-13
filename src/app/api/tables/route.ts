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
