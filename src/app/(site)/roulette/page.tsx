import type { Metadata } from "next";
import { Suspense } from "react";
import { RouletteClient } from "@/components/casino/roulette-client";
import { Container } from "@/components/ui/container";
import { routes } from "@/config/site";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Roulette",
  description: "European roulette with your Zagoker chips. Virtual chips only.",
};

export default function RoulettePage() {
  return (
    <Container className="py-8 sm:py-12">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Roulette</h1>
      <p className="mt-2 mb-6 max-w-2xl text-mist">
        European wheel, single zero. A number pays 35 to 1, dozens and columns 2 to 1, red/black, odd/even and
        high/low 1 to 1. Same chips as the poker tables.
      </p>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-ink-800" aria-busy="true" />}>
        <Game />
      </Suspense>
    </Container>
  );
}

async function Game() {
  const user = await requireUser(routes.roulette);
  return <RouletteClient initialBalance={user.chips} />;
}
