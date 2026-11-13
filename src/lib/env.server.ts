import "server-only";

/**
 * Server-only secrets. The `server-only` import makes the build fail if this
 * module is ever pulled into a client bundle.
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
  /**
   * Proves to the database that a request comes from the game server. It
   * unlocks only the game_* functions (deal, record an action, settle a
   * hand). The database stores just its SHA-256 hash.
   */
  get gameServerKey() {
    return required("GAME_SERVER_KEY");
  },
};

export function isGameServerConfigured(): boolean {
  return Boolean(process.env.GAME_SERVER_KEY);
}
