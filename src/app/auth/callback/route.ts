import { NextResponse, type NextRequest } from "next/server";
import { routes } from "@/config/site";
import { safeNextPath } from "@/lib/auth/schemas";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for links in Supabase emails (password reset, email
 * confirmation). Exchanges the one-time code for a session cookie, then
 * forwards to `next` (same-site paths only).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"), routes.profile);

  if (code && isSupabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}${routes.login}?error=link`);
}
