import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { StatCards } from "@/components/social/stat-cards";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Container } from "@/components/ui/container";
import { Panel } from "@/components/ui/panel";
import { defaultAvatar, isAvatarKey } from "@/config/avatars";
import { routes } from "@/config/site";
import { getCurrentUser } from "@/lib/auth/session";
import { usernamePattern } from "@/lib/auth/schemas";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { formatChips } from "@/lib/utils";

export const metadata: Metadata = { title: "Player" };

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

type Profile = {
  username: string; avatar: string; chips: number; created_at: string;
  hands_played: number; hands_won: number; total_won: number; biggest_pot: number; chip_rank: number;
};

/** Public profile: anyone can view a player's avatar, chips and statistics. */
export default function PlayerPage(props: PageProps<"/players/[username]">) {
  return (
    <Container className="py-10 sm:py-14">
      <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-ink-800" aria-busy="true" />}>
        <Player params={props.params} />
      </Suspense>
    </Container>
  );
}

async function Player({ params }: { params: PageProps<"/players/[username]">["params"] }) {
  // Rankings change all the time: always render for the incoming request.
  await connection();
  const username = decodeURIComponent((await params).username);
  if (!usernamePattern.test(username) || !isSupabaseConfigured()) notFound();

  const [me, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const { data } = await supabase.rpc("get_player_profile", { p_username: username }).maybeSingle<Profile>();
  if (!data) notFound();
  const isMe = me?.username.toLowerCase() === data.username.toLowerCase();

  return (
    <div className="animate-fade-up space-y-6">
      <Panel className="flex flex-col items-center gap-6 p-6 text-center sm:flex-row sm:p-8 sm:text-left">
        <Avatar avatar={isAvatarKey(data.avatar) ? data.avatar : defaultAvatar} size="xl" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{data.username}</h1>
          <p className="mt-1 text-sm text-mist">
            Member since {dateFormat.format(new Date(data.created_at))} · Ranked #{data.chip_rank} by chips
          </p>
          {isMe && (
            <ButtonLink href={routes.profile} variant="secondary" size="sm" className="mt-4">
              Edit your profile
            </ButtonLink>
          )}
        </div>
        <div className="rounded-xl border border-ink-600 bg-ink-950 px-6 py-4 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-accent-400 uppercase">Virtual chips</p>
          <p className="mt-1 flex items-center justify-center gap-2 font-display text-3xl font-extrabold tracking-tight text-accent-200 tabular-nums">
            <Chip className="size-6" />
            {formatChips(Number(data.chips))}
          </p>
        </div>
      </Panel>
      <StatCards stats={data} />
      <ButtonLink href={routes.leaderboard} variant="ghost" size="sm">
        ← Back to the leaderboard
      </ButtonLink>
    </div>
  );
}
