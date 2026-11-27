import "server-only";
import type { ApiContext } from "@/lib/api/http";
import { unwrap } from "@/lib/api/http";
import { databaseStore } from "./db";

/** The live store for one request: rounds via the game server, balance via the player's session. */
export function storeFor({ supabase }: ApiContext) {
  return databaseStore(async (userId) => {
    const profile = unwrap(await supabase.from("profiles").select("chips").eq("id", userId).single());
    return Number(profile?.chips ?? 0);
  });
}
