import "server-only";

/**
 * Server-only secrets. The `server-only` import makes the build fail if this
 * module is ever pulled into a client bundle, so the service-role key can
 * never reach the browser.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing server environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const serverEnv = {
  /** Bypasses Row Level Security. Used only by the authoritative game server code. */
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
};
