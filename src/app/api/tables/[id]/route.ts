import type { NextRequest } from "next/server";
import { api, tableIdFrom, unwrap } from "@/lib/api/http";
import { GameError } from "@/lib/game/errors";
import { personalHandView } from "@/lib/game/service";

/**
 * Everything the caller may see about a table. Row Level Security decides
 * whether they can see it at all; hole cards and legal actions are added
 * only for the caller's own seat.
 */
export function GET(request: NextRequest, ctx: RouteContext<"/api/tables/[id]">) {
  return api(request, async ({ user, supabase }) => {
    const tableId = tableIdFrom((await ctx.params).id);

    const table = unwrap(
      await supabase.from("poker_tables").select("*").eq("id", tableId).maybeSingle(),
    );
    if (!table || table.status !== "open") {
      throw new GameError("table_not_found", 404, "This table does not exist or has closed.");
    }

    const [seats, state] = await Promise.all([
      supabase
        .from("table_seats")
        .select("seat_no, user_id, stack, status, profiles(username, avatar)")
        .eq("table_id", tableId)
        .order("seat_no"),
      supabase
        .from("table_state")
        .select("hand_id, hand_number, version, view, turn_deadline")
        .eq("table_id", tableId)
        .maybeSingle(),
    ]);

    const seatRows = unwrap(seats) ?? [];
    const stateRow = unwrap(state);
    const mySeat = seatRows.find((s) => s.user_id === user.id) ?? null;
    // Only seated players can have cards, so only they need the private view.
    const mine = mySeat ? await personalHandView(tableId, user.id) : null;

    return {
      table,
      seats: seatRows,
      mySeat: mySeat?.seat_no ?? null,
      hand: mine ?? stateRow?.view ?? null,
      handNumber: stateRow?.hand_number ?? 0,
      turnDeadline: stateRow?.turn_deadline ?? null,
      /** Server clock, so the browser can correct for its own clock being off. */
      serverNow: new Date().toISOString(),
    };
  });
}
