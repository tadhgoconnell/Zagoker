import type { NextRequest } from "next/server";
import { api, tableIdFrom, unwrap } from "@/lib/api/http";
import { GameError } from "@/lib/game/errors";
import { cancelHandForClose } from "@/lib/game/service";

/**
 * Host only: close the table and cash everyone out. Works mid-hand too: the
 * hand is cancelled first and every bet returned.
 */
export function POST(request: NextRequest, ctx: RouteContext<"/api/tables/[id]/close">) {
  return api(request, async ({ user, supabase }) => {
    const tableId = tableIdFrom((await ctx.params).id);

    // Ownership is checked here, before cancelling anything. The database
    // checks it again when closing.
    const table = unwrap(
      await supabase.from("poker_tables").select("owner_id, status").eq("id", tableId).maybeSingle(),
    );
    if (!table || table.status !== "open") {
      throw new GameError("table_not_found", 404, "This table does not exist or has closed.");
    }
    if (table.owner_id !== user.id) {
      throw new GameError("not_table_owner", 403, "Only the host can do that.");
    }

    // Another browser may deal a new hand between the cancel and the close;
    // the short pause enforced after a hand makes that rare, and retrying
    // settles it.
    for (let attempt = 0; ; attempt++) {
      await cancelHandForClose(tableId);
      const { error } = await supabase.rpc("close_table", { p_table_id: tableId });
      if (!error) return;
      if (!error.message.includes("hand_in_progress") || attempt >= 2) unwrap({ data: null, error });
    }
  });
}
