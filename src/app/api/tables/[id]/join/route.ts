import type { NextRequest } from "next/server";
import { api, body, tableIdFrom, unwrap } from "@/lib/api/http";
import { joinTableSchema } from "@/lib/game/schemas";

/** Sit down. The buy-in moves from the caller's balance to the table. */
export function POST(request: NextRequest, ctx: RouteContext<"/api/tables/[id]/join">) {
  return api(request, async ({ supabase }) => {
    const tableId = tableIdFrom((await ctx.params).id);
    const input = await body(request, joinTableSchema);
    const seat = unwrap(
      await supabase.rpc("join_table", {
        p_table_id: tableId,
        p_seat_no: input.seat ?? null,
        p_room_code: input.roomCode ?? null,
      }),
    );
    return { seat };
  });
}
