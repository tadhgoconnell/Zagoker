import "server-only";
import type { User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { isGameServerConfigured } from "@/lib/env.server";
import { isSupabaseConfigured } from "@/lib/env";
import { fromDatabaseError, GameError } from "@/lib/game/errors";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ApiContext = { user: User; supabase: Supabase };

export const uuidSchema = z.uuid();

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const fail = (e: GameError) =>
  json({ error: { code: e.code, message: e.message } }, e.status);

/**
 * Browsers attach an Origin header to every state-changing request. If it is
 * present and names another site, the request did not come from our pages.
 */
function isCrossSite(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.headers.get("host");
  } catch {
    return true;
  }
}

/**
 * Wraps an API route: rejects cross-site requests, requires a signed-in user
 * (verified with Supabase, not just read from a cookie), and turns expected
 * failures into `{ error: { code, message } }` responses.
 */
export async function api(
  request: NextRequest,
  handler: (ctx: ApiContext) => Promise<unknown>,
): Promise<Response> {
  try {
    if (!isSupabaseConfigured() || !isGameServerConfigured()) {
      throw new GameError("not_configured", 503, "The game server is not configured yet.");
    }
    if (request.method !== "GET" && isCrossSite(request)) {
      throw new GameError("forbidden", 403, "Cross-site request refused.");
    }
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new GameError("not_authenticated", 401, "Please log in.");

    return json((await handler({ user, supabase })) ?? { ok: true });
  } catch (e) {
    if (e instanceof GameError) return fail(e);
    console.error(e);
    return fail(new GameError("server_error", 500, "Something went wrong. Please try again."));
  }
}

/** Parses and validates a JSON body. Throws a 400 GameError if it is not valid. */
export async function body<T>(request: NextRequest, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new GameError("invalid_request", 400, "The request was not valid.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new GameError("invalid_request", 400, parsed.error.issues[0]?.message ?? "The request was not valid.");
  }
  return parsed.data;
}

export function tableIdFrom(value: string): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new GameError("table_not_found", 404, "This table does not exist or has closed.");
  }
  return parsed.data;
}

/** Unwraps a Supabase result, converting database errors into GameErrors. */
export function unwrap<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw fromDatabaseError(result.error);
  return result.data;
}
