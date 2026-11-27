import type { NextRequest } from "next/server";
import { api, body } from "@/lib/api/http";
import { storeFor } from "@/lib/casino/live";
import { rouletteRequestSchema, rouletteSpin } from "@/lib/casino/service";
import { secureRandomInt } from "@/lib/poker/secure-random";

/** Place bets and spin. The server spins the wheel and pays out in one step. */
export function POST(request: NextRequest) {
  return api(request, async (ctx) => {
    const input = await body(request, rouletteRequestSchema);
    return rouletteSpin(storeFor(ctx), ctx.user.id, input, secureRandomInt);
  });
}
