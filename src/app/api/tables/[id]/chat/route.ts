import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, tableIdFrom, unwrap } from "@/lib/api/http";

const schema = z.object({
  body: z.string().trim().min(1, "Type a message first.").max(500, "Messages can be up to 500 characters."),
});

/** Post a chat message at a table. The text is stored exactly as written. */
export function POST(request: NextRequest, ctx: RouteContext<"/api/tables/[id]/chat">) {
  return api(request, async ({ supabase }) => {
    const tableId = tableIdFrom((await ctx.params).id);
    const input = await body(request, schema);
    const id = unwrap(
      await supabase.rpc("send_chat_message", { p_table_id: tableId, p_body: input.body }),
    );
    return { id };
  });
}
