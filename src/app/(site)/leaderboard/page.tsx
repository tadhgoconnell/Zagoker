import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { winRate } from "@/components/social/stat-cards";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { Container } from "@/components/ui/container";
import { Panel } from "@/components/ui/panel";
import { defaultAvatar, isAvatarKey } from "@/config/avatars";
import { routes } from "@/config/site";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { cn, formatChips } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "The top players ranked by virtual chips, hands won and biggest pot.",
};

const sorts = [
  { key: "chips", label: "Most chips", column: "Chips" },
  { key: "hands_won", label: "Hands won", column: "Hands won" },
  { key: "biggest_pot", label: "Biggest pot", column: "Biggest pot" },
] as const;
type SortKey = (typeof sorts)[number]["key"];

type Row = {
  rank: number; username: string; avatar: string; chips: number;
  hands_played: number; hands_won: number; total_won: number; biggest_pot: number;
};

export default function LeaderboardPage(props: PageProps<"/leaderboard">) {
  return (
    <Container className="py-10 sm:py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Leaderboard</h1>
      <p className="mt-2 mb-8 text-mist">
        The top 50 players. Chips at a table count towards a player&apos;s total.
      </p>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-ink-800" aria-busy="true" />}>
        <Board searchParams={props.searchParams} />
      </Suspense>
    </Container>
  );
}

async function Board({ searchParams }: { searchParams: PageProps<"/leaderboard">["searchParams"] }) {
  // Rankings change all the time: always render for the incoming request.
  await connection();
  const requested = (await searchParams).sort;
  const sort: SortKey = sorts.find((s) => s.key === requested)?.key ?? "chips";
  const active = sorts.find((s) => s.key === sort)!;

  if (!isSupabaseConfigured()) {
    return <Panel className="p-8 text-center text-mist">The leaderboard is not available yet.</Panel>;
  }

  const [me, supabase] = await Promise.all([getCurrentUser(), createClient()]);
  const { data, error } = await supabase.rpc("get_leaderboard", { p_sort: sort, p_limit: 50 });
  const rows = (data ?? []) as Row[];

  const value = (r: Row) =>
    sort === "hands_won" ? r.hands_won : sort === "biggest_pot" ? Number(r.biggest_pot) : Number(r.chips);

  return (
    <>
      <nav aria-label="Ranking" className="mb-5 flex flex-wrap gap-2">
        {sorts.map((s) => (
          <Link
            key={s.key}
            href={s.key === "chips" ? routes.leaderboard : `${routes.leaderboard}?sort=${s.key}`}
            aria-current={s.key === sort ? "page" : undefined}
            className={cn(
              "rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
              s.key === sort
                ? "border-accent-400 bg-accent-400 text-ink-950"
                : "border-ink-500 text-mist hover:border-ink-500 hover:text-cream",
            )}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <Panel className="p-8 text-center text-mist">The leaderboard could not be loaded. Please try again.</Panel>
      ) : rows.length === 0 ? (
        <Panel className="p-10 text-center">
          <p className="font-semibold">No players yet</p>
          <p className="mt-2 text-sm text-mist">Be the first on the board.</p>
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-600 text-left font-mono text-xs tracking-wide text-slate uppercase">
                <th scope="col" className="w-14 py-3 pl-4 font-medium sm:pl-6">#</th>
                <th scope="col" className="py-3 font-medium">Player</th>
                <th scope="col" className="py-3 pr-4 text-right font-medium sm:pr-6">{active.column}</th>
                <th scope="col" className="hidden py-3 pr-6 text-right font-medium sm:table-cell">Hands</th>
                <th scope="col" className="hidden py-3 pr-6 text-right font-medium md:table-cell">Win rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {rows.map((r) => {
                const isMe = me?.username.toLowerCase() === r.username.toLowerCase();
                return (
                  <tr key={r.username} className={cn(isMe && "bg-accent-400/8")}>
                    <td className="py-3 pl-4 sm:pl-6">
                      <span
                        className={cn(
                          "grid size-8 place-items-center rounded-md font-mono text-sm font-semibold tabular-nums",
                          r.rank === 1 ? "bg-accent-400 text-ink-950"
                            : r.rank <= 3 ? "border border-accent-400/60 text-accent-300"
                            : "text-mist",
                        )}
                      >
                        {r.rank}
                      </span>
                    </td>
                    <td className="py-3">
                      <Link href={routes.player(r.username)} className="flex min-w-0 items-center gap-3 hover:text-accent-200">
                        <Avatar avatar={isAvatarKey(r.avatar) ? r.avatar : defaultAvatar} size="sm" />
                        <span className="truncate font-semibold">{r.username}</span>
                        {isMe && <span className="rounded-md bg-accent-400 px-1.5 text-[11px] font-semibold text-ink-950">You</span>}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold tabular-nums sm:pr-6">
                      <span className="inline-flex items-center gap-1.5">
                        {sort !== "hands_won" && <Chip className="size-4" />}
                        {formatChips(value(r))}
                      </span>
                    </td>
                    <td className="hidden py-3 pr-6 text-right text-mist tabular-nums sm:table-cell">
                      {formatChips(r.hands_played)}
                    </td>
                    <td className="hidden py-3 pr-6 text-right text-mist tabular-nums md:table-cell">
                      {winRate(r.hands_played, r.hands_won)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      )}
    </>
  );
}
