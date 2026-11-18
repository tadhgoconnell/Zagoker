import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { isAvatarKey, defaultAvatar, type AvatarKey } from "@/config/avatars";
import { routes } from "@/config/site";
import { isSupabaseConfigured } from "@/lib/env";
import { photoUrl } from "@/lib/photos";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
  /** True for a guest who has not saved their account with an email and password. */
  isGuest: boolean;
  username: string;
  avatar: AvatarKey;
  /** URL of the player's uploaded photo, if they have one. */
  photo: string | null;
  /** Storage path of that photo (to replace or remove it). */
  photoPath: string | null;
  chips: number;
  createdAt: string;
};

/**
 * The signed-in user with their profile, or null. The token is verified with
 * Supabase on every request (never trusted from the cookie alone). Wrapped in
 * React cache() so several components in one request share a single lookup.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!isSupabaseConfigured()) return null;

  // Checking a session depends on the current time (token expiry), so it can
  // only happen for a real incoming request, never while prerendering.
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar, avatar_path, chips, created_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? null,
    isGuest: user.is_anonymous === true,
    username: profile.username,
    avatar: isAvatarKey(profile.avatar) ? profile.avatar : defaultAvatar,
    photo: photoUrl(profile.avatar_path),
    photoPath: profile.avatar_path ?? null,
    chips: Number(profile.chips),
    createdAt: profile.created_at,
  };
});

/** For pages that need a player. Sends visitors to the guest entry page otherwise. */
export async function requireUser(nextPath: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`${routes.play}?next=${encodeURIComponent(nextPath)}`);
  return user;
}
