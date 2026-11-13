import type { NextRequest } from "next/server";
import { api, tableIdFrom, unwrap } from "@/lib/api/http";
import { resolveLeavers } from "@/lib/game/service";

/**
 * Stand up. Between hands the stack is paid back at once. During a hand the
 * player is folded when their turn comes and paid out when the hand ends.
 */
export function POST(request: NextRequest, ctx: RouteContext<"/api/tables/[id]/leave">) {
  return api(request, async ({ supabase }) => {
    const tableId = tableIdFrom((await ctx.params).id);
    const result = unwrap(await supabase.rpc("leave_table", { p_table_id: tableId }));
    if (result === "leaving") await resolveLeavers(tableId);
    return { result };
  });
}
