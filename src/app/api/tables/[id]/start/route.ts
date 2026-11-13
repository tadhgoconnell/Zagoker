import type { NextRequest } from "next/server";
import { api, tableIdFrom } from "@/lib/api/http";
import { startHandAtTable } from "@/lib/game/service";

/** Deal the next hand. */
export function POST(request: NextRequest, ctx: RouteContext<"/api/tables/[id]/start">) {
  return api(request, async ({ user }) => {
    await startHandAtTable(tableIdFrom((await ctx.params).id), user.id);
  });
}
