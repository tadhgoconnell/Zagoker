import { crownedUsernames, nicknameRules } from "@/config/players";

/** The name to show for a player. */
export function displayName(username: string | null | undefined): string {
  if (!username) return "Player";
  const lower = username.toLowerCase();
  for (const rule of nicknameRules) if (lower.includes(rule.contains.toLowerCase())) return rule.show;
  return username;
}

/** Whether this player gets the gold name and the crown. */
export function isCrowned(username: string | null | undefined): boolean {
  return !!username && crownedUsernames.includes(username.toLowerCase());
}

/** Class for a crowned player's name. */
export const crownedNameClass = "text-gold";
