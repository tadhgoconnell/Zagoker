/**
 * Preset avatars. The key is what is stored in profiles.avatar; the database
 * has a matching CHECK constraint, so the two lists must stay in sync.
 */
export const avatarKeys = [
  "spade",
  "heart",
  "diamond",
  "club",
  "crown",
  "star",
  "flame",
  "bolt",
  "gem",
  "rocket",
  "ghost",
  "cat",
] as const;

export type AvatarKey = (typeof avatarKeys)[number];

export const defaultAvatar: AvatarKey = "spade";

export function isAvatarKey(value: unknown): value is AvatarKey {
  return typeof value === "string" && avatarKeys.includes(value as AvatarKey);
}
