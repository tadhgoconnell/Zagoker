import type { Metadata } from "next";
import { Suspense } from "react";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import { DailyBonus } from "@/components/social/daily-bonus";
import { StatCards } from "@/components/social/stat-cards";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { Container } from "@/components/ui/container";
import { Panel } from "@/components/ui/panel";
import { gameConfig, routes } from "@/config/site";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatChips } from "@/lib/utils";

export const metadata: Metadata = { title: "Your profile" };

const kindLabels: Record<string, string> = {
  signup_bonus: "Welcome bonus",
  daily_bonus: "Daily bonus",
  table_buy_in: "Table buy-in",
  table_cash_out: "Table cash-out",
  adjustment: "Adjustment",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export default function ProfilePage(props: PageProps<"/profile">) {
  return (
    <Container className="py-10 sm:py-14">
      <Suspense fallback={<ProfileSkeleton />}>
        <Profile searchParams={props.searchParams} />
      </Suspense>
    </Container>
  );
}

async function Profile({
  searchParams,
}: {
  searchParams: PageProps<"/profile">["searchParams"];
}) {
  const [user, params] = await Promise.all([
    requireUser(routes.profile),
    searchParams,
  ]);

  const supabase = await createClient();
  const [{ data: stats }, { data: bonusNextAt }, { data: seat }, { data: transactions }] = await Promise.all([
    supabase
      .from("player_stats")
      .select("hands_played, hands_won, total_won, biggest_pot")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.rpc("daily_bonus_next_at"),
    supabase.from("table_seats").select("table_id, stack").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("chip_transactions")
      .select("id, amount, balance_after, kind, created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(10),
  ]);

  const handsPlayed = stats?.hands_played ?? 0;

  return (
    <div className="animate-fade-up space-y-6">
      {params.welcome === "1" && (
        <Alert tone="success">
          Welcome to the table, {user.username}. Your{" "}
          {formatChips(gameConfig.startingChips)} free chips have been added.
        </Alert>
      )}
      {params.password === "updated" && (
        <Alert tone="success">Your password has been updated.</Alert>
      )}

      <Panel className="flex flex-col items-center gap-6 p-6 text-center sm:flex-row sm:p-8 sm:text-left">
        <Avatar avatar={user.avatar} size="xl" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl font-bold sm:text-4xl">
            {user.username}
          </h1>
          <p className="mt-1 text-sm text-mist">
            Member since {dateFormat.format(new Date(user.createdAt))}
            {user.email && <> · {user.email}</>}
          </p>
        </div>
        <div className="rounded-2xl border border-gold-500/30 bg-ink-900/60 px-6 py-4 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-gold-400 uppercase">
            Virtual chips
          </p>
          <p className="mt-1 flex items-center justify-center gap-2 font-display text-3xl font-bold text-gold-200 tabular-nums">
            <Chip className="size-6" />
            {formatChips(user.chips)}
          </p>
        </div>
      </Panel>

      {seat && (
        <Panel className="flex flex-col items-start gap-3 border-gold-500/40 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            <span className="font-semibold text-gold-200">
              {formatChips(Number(seat.stack))} more chips are at your table.
            </span>{" "}
            <span className="text-mist">They return to your balance when you leave it.</span>
          </p>
          <ButtonLink href={`/table/${seat.table_id}`} size="sm">
            Return to your table
          </ButtonLink>
        </Panel>
      )}

      <DailyBonus nextAt={(bonusNextAt as string | null) ?? null} />

      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Statistics
        </h2>
        <StatCards stats={stats} />
        {handsPlayed === 0 && (
          <p className="mt-3 text-sm text-slate">
            Your statistics will fill in once you have played some hands.
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Avatar</h2>
          <p className="mt-1 mb-5 text-sm text-mist">
            Pick how you appear at the table. Changes save straight away.
          </p>
          <AvatarPicker current={user.avatar} />
        </Panel>

        <Panel className="p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Chip history</h2>
          <p className="mt-1 mb-4 text-sm text-mist">
            Your most recent chip changes.
          </p>
          {transactions && transactions.length > 0 ? (
            <ul className="divide-y divide-white/6">
              {transactions.map((t) => {
                const amount = Number(t.amount);
                return (
                  <li key={t.id} className="flex items-center gap-3 py-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {kindLabels[t.kind] ?? t.kind}
                      </span>
                      <span className="text-xs text-slate">
                        {dateTimeFormat.format(new Date(t.created_at))} UTC
                      </span>
                    </span>
                    <span className="text-right tabular-nums">
                      <span
                        className={
                          amount > 0
                            ? "block font-semibold text-success"
                            : "block font-semibold text-danger"
                        }
                      >
                        {amount > 0 ? "+" : "−"}
                        {formatChips(Math.abs(amount))}
                      </span>
                      <span className="text-xs text-slate">
                        Balance {formatChips(Number(t.balance_after))}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-slate">No chip activity yet.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading profile">
      <div className="h-40 rounded-2xl bg-white/5" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/5" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-64 rounded-2xl bg-white/5" />
        <div className="h-64 rounded-2xl bg-white/5" />
      </div>
    </div>
  );
}
