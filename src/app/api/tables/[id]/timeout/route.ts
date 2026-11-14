import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, tableIdFrom, unwrap } from "@/lib/api/http";
import { GameError } from "@/lib/game/errors";
import { timeoutTurn } from "@/lib/game/service";

const schema = z.object({ version: z.number().int().min(0) });

/**
 * Report that the current player's time has run out. Anyone who can see the
 * table may call this; the server decides whether the deadline really passed.
 */
export function POST(request: NextRequest, ctx: RouteContext<"/api/tables/[id]/timeout">) {
  return api(request, async ({ supabase }) => {
    const tableId = tableIdFrom((await ctx.params).id);
    const input = await body(request, schema);
    // Row Level Security: only people allowed to see the table get a row back.
    const visible = unwrap(
      await supabase.from("poker_tables").select("id").eq("id", tableId).maybeSingle(),
    );
    if (!visible) {
      throw new GameError("table_not_found", 404, "This table does not exist or has closed.");
    }
    await timeoutTurn(tableId, input.version);
  });
}
