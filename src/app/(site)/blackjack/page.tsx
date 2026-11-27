import type { Metadata } from "next";
import { Suspense } from "react";
import { BlackjackClient } from "@/components/casino/blackjack-client";
import { Container } from "@/components/ui/container";
import { routes } from "@/config/site";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Blackjack",
  description: "Play blackjack against the dealer with your Zagoker chips. Virtual chips only.",
};

export default function BlackjackPage() {
  return (
    <Container className="py-8 sm:py-12">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Blackjack</h1>
      <p className="mt-2 mb-6 max-w-2xl text-mist">
        Get closer to 21 than the dealer without going over. Same chips as the poker tables. Six decks, shuffled
        every hand. Double on any two cards, split pairs up to four hands.
      </p>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[2rem] bg-ink-800" aria-busy="true" />}>
        <Game />
      </Suspense>
    </Container>
  );
}

async function Game() {
  const user = await requireUser(routes.blackjack);
  return <BlackjackClient initialBalance={user.chips} />;
}
