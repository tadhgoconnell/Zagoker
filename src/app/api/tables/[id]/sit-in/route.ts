import type { NextRequest } from "next/server";
import { api, tableIdFrom, unwrap } from "@/lib/api/http";

/** "I'm back": a player who was sitting out rejoins from the next hand. */
export function POST(request: NextRequest, ctx: RouteContext<"/api/tables/[id]/sit-in">) {
  return api(request, async ({ supabase }) => {
    const tableId = tableIdFrom((await ctx.params).id);
    unwrap(await supabase.rpc("sit_in", { p_table_id: tableId }));
  });
}
