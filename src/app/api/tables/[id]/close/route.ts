import type { NextRequest } from "next/server";
import { api, tableIdFrom, unwrap } from "@/lib/api/http";

/** Host only: close the table and cash everyone out. */
export function POST(request: NextRequest, ctx: RouteContext<"/api/tables/[id]/close">) {
  return api(request, async ({ supabase }) => {
    const tableId = tableIdFrom((await ctx.params).id);
    unwrap(await supabase.rpc("close_table", { p_table_id: tableId }));
  });
}
