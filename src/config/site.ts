/**
 * Single source of truth for branding and product-wide constants.
 * Change the brand name here and it updates everywhere.
 */
export const siteConfig = {
  name: "ZAGPOKER",
  /** Two-part wordmark used by the logo: "ZAG" + "POKER". */
  wordmark: { lead: "ZAG", tail: "POKER" },
  tagline: "Texas Hold'em with friends. Free chips, real competition.",
  description:
    "ZAGPOKER is a free online multiplayer Texas Hold'em platform. Create a private room, share the code and play with friends in real time using virtual chips only.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

/** Game-wide rules that both the server and the UI need to agree on. */
export const gameConfig = {
  /** Virtual chips granted exactly once at registration. */
  startingChips: 10_000,
  minPlayers: 2,
  maxPlayers: 9,
} as const;

export const routes = {
  home: "/",
  login: "/login",
  register: "/register",
  lobby: "/lobby",
  leaderboard: "/leaderboard",
} as const;

export const mainNav = [
  { label: "Lobby", href: routes.lobby },
  { label: "Leaderboard", href: routes.leaderboard },
  { label: "How it works", href: "/#how-it-works" },
] as const;
