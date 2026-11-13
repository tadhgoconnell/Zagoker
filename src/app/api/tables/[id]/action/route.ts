import type { NextRequest } from "next/server";
import { api, body, tableIdFrom } from "@/lib/api/http";
import { actionSchema } from "@/lib/game/schemas";
import { playerAction } from "@/lib/game/service";

/** Fold, check, call, bet, raise or go all-in. */
export function POST(request: NextRequest, ctx: RouteContext<"/api/tables/[id]/action">) {
  return api(request, async ({ user }) => {
    const tableId = tableIdFrom((await ctx.params).id);
    const input = await body(request, actionSchema);
    await playerAction(tableId, user.id, input.action, input.version);
  });
}
