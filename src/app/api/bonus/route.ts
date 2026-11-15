import type { NextRequest } from "next/server";
import { api, unwrap } from "@/lib/api/http";

/** Claim the daily free chips. The database enforces the 24-hour limit. */
export function POST(request: NextRequest) {
  return api(request, async ({ supabase }) => {
    return unwrap(await supabase.rpc("claim_daily_bonus"));
  });
}
