import type { Metadata } from "next";
import { Suspense } from "react";
import { LobbyClient } from "@/components/lobby/lobby-client";
import { DailyBonus } from "@/components/social/daily-bonus";
import { Container } from "@/components/ui/container";
import { routes } from "@/config/site";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Lobby" };

export default function LobbyPage() {
  return (
    <Container className="py-10 sm:py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Lobby</h1>
      <p className="mt-2 mb-8 text-mist">Join a public table, or create your own and invite friends.</p>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-ink-800" aria-busy="true" />}>
        <Lobby />
      </Suspense>
    </Container>
  );
}

async function Lobby() {
  const user = await requireUser(routes.lobby);
  const supabase = await createClient();
  const { data: bonusNextAt } = await supabase.rpc("daily_bonus_next_at");
  return (
    <div className="space-y-6">
      <DailyBonus nextAt={(bonusNextAt as string | null) ?? null} />
      <LobbyClient chips={user.chips} />
    </div>
  );
}
