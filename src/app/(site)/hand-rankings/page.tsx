import type { Metadata } from "next";
import { PlayingCard } from "@/components/cards/playing-card";
import { Container } from "@/components/ui/container";
import type { Card } from "@/lib/poker";
import { cardParts } from "@/lib/poker/display";
import { handRankings, oneIn, percent } from "@/lib/poker/rankings";

export const metadata: Metadata = {
  title: "Hand rankings",
  description: "Every Texas Hold'em hand from Royal Flush to High Card, with examples and how often each comes up.",
};

export default function HandRankingsPage() {
  return (
    <Container className="py-10 sm:py-14">
      <p className="font-mono text-xs tracking-widest text-accent-400 uppercase">Texas Hold&apos;em</p>
      <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Hand rankings</h1>
      <p className="mt-3 max-w-2xl text-mist">
        Your hand is the best five cards from your two hole cards and the five on the board. Higher on this list
        beats lower. Suits never break a tie: equal hands split the pot.
      </p>

      <ol className="mt-10 divide-y divide-ink-700 overflow-hidden rounded-xl border border-ink-600 bg-ink-900">
        {handRankings.map((r, i) => (
          <li key={r.name} className="grid gap-4 p-5 sm:grid-cols-[3rem_1fr_auto] sm:items-center sm:gap-6 sm:p-6">
            <span className="font-mono text-sm text-accent-400">{String(i + 1).padStart(2, "0")}</span>
            <div className="min-w-0">
              <h2 className="font-display text-xl font-extrabold tracking-tight">{r.name}</h2>
              <p className="mt-1 text-sm leading-relaxed text-mist">{r.description}</p>
              <p className="mt-2 text-xs text-slate">
                By the river: <span className="font-semibold text-cream tabular-nums">{percent(r.sevenCardCount)}</span> of
                hands ({oneIn(r.sevenCardCount)})
              </p>
            </div>
            <div className="flex gap-1 sm:gap-1.5" aria-label={`Example: ${r.example}`}>
              {r.example.split(" ").map((c) => (
                <PlayingCard key={c} {...cardParts(c as Card)} size="md" className="max-sm:h-15 max-sm:w-11" />
              ))}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-slate">
        Odds are for the best five of seven cards (two hole cards and a full board), counted over all 133,784,560
        possible combinations.
      </p>
    </Container>
  );
}
