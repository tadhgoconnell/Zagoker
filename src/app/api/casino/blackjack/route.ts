import type { NextRequest } from "next/server";
import { api, body } from "@/lib/api/http";
import { storeFor } from "@/lib/casino/live";
import { blackjackAction, blackjackRequestSchema, blackjackStatus } from "@/lib/casino/service";
import { secureRandomInt } from "@/lib/poker/secure-random";

/** The player's hand in play (if any) and their balance. */
export function GET(request: NextRequest) {
  return api(request, async (ctx) => blackjackStatus(storeFor(ctx), ctx.user.id));
}

/** Deal (with a bet), or hit / stand / double / split. The server deals the cards. */
export function POST(request: NextRequest) {
  return api(request, async (ctx) => {
    const input = await body(request, blackjackRequestSchema);
    return blackjackAction(storeFor(ctx), ctx.user.id, input, secureRandomInt);
  });
}
