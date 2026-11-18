import type { NextConfig } from "next";

/**
 * Content Security Policy: the browser may only load scripts, styles and
 * fonts from this site, and may only connect to this site and the Supabase
 * project. Blocks injected third-party scripts, data being sent elsewhere,
 * the site being framed, and plugins.
 *
 * Inline scripts are allowed because Next.js uses them for hydration and the
 * nonce alternative would force every page to render on request, losing the
 * fast prerendered shells. Nothing a player types is ever rendered as HTML,
 * which is the main defence against injected scripts.
 */
function contentSecurityPolicy(): string {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let connect = "'self'";
  try {
    const host = new URL(supabase).host;
    connect += ` https://${host} wss://${host}`;
  } catch {
    // Not configured yet: same-origin only.
  }
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connect}`,
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    // Development tools need eval and hot-reload connections, so the policy
    // is applied to production builds only.
    const headers =
      process.env.NODE_ENV === "production"
        ? [...securityHeaders, { key: "Content-Security-Policy", value: contentSecurityPolicy() }]
        : securityHeaders;
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
