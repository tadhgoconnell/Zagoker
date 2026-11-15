import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = ["/profile", "/reset-password", "/lobby", "/table", "/join"];
const signedOutOnly = ["/play", "/login", "/register", "/forgot-password"];

/**
 * Runs before every page request. Refreshes the Supabase session cookie so it
 * never expires mid-visit, and does coarse routing: signed-out visitors are
 * sent to /play for protected pages, signed-in users skip the auth pages.
 * This is a convenience layer only. Every page and action re-checks the user.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() validates the token with Supabase and refreshes it if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const redirectTo = (path: string, params?: Record<string, string>) => {
    const target = request.nextUrl.clone();
    target.pathname = path;
    target.search = "";
    for (const [k, v] of Object.entries(params ?? {})) {
      target.searchParams.set(k, v);
    }
    const redirect = NextResponse.redirect(target);
    // Keep any refreshed session cookies on the redirect response.
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  };

  if (!user && protectedPrefixes.some((p) => pathname.startsWith(p))) {
    // Visitors pick a name and play; an account is optional.
    return redirectTo("/play", { next: pathname });
  }
  // A guest may still open /login or /register to switch to a real account.
  const isGuest = user?.is_anonymous === true;
  if (user && signedOutOnly.includes(pathname) && !(isGuest && pathname !== "/play")) {
    return redirectTo("/lobby");
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
