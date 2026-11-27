"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlayingCard } from "@/components/cards/playing-card";
import { ChipFace } from "@/components/table/chip-token";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Facets } from "@/components/ui/facets";
import type { BjAction, HandOutcome } from "@/lib/casino/blackjack";
import { casinoLimits } from "@/lib/casino/limits";
import type { BlackjackResponse } from "@/lib/casino/service";
import { apiCall } from "@/lib/game/client";
import type { Card } from "@/lib/poker/cards";
import { cardParts } from "@/lib/poker/display";
import { cn, formatChips } from "@/lib/utils";
import { ChipPicker } from "./chip-picker";

type Round = NonNullable<BlackjackResponse["round"]>;

const outcomeText: Record<HandOutcome, string> = {
  blackjack: "Blackjack!",
  win: "Win",
  push: "Push",
  lose: "Lose",
  bust: "Bust",
};

const actionLabel: Record<BjAction, string> = { hit: "Hit", stand: "Stand", double: "Double", split: "Split" };

/** Seconds between dealer cards being shown at the end of a hand. */
const DEALER_STEP = 0.45;

/** Cards overlapping in a row. Cards from index `shown` on are dealt one after another. */
function CardRow({ cards, shown = cards.length, label }: { cards: (Card | null)[]; shown?: number; label: string }) {
  return (
    <div className="flex justify-center" aria-label={label}>
      {cards.map((c, i) => (
        <div key={`${i}:${c ?? "down"}`} className={cn(i > 0 && "-ml-5 sm:-ml-6")}>
          <PlayingCard
            {...(c ? cardParts(c) : { faceDown: true })}
            size="lg"
            className="animate-deal"
            style={{ animationDelay: `${Math.max(0, i - shown) * DEALER_STEP}s` }}
          />
        </div>
      ))}
    </div>
  );
}

export function BlackjackClient({ initialBalance }: { initialBalance: number }) {
  const router = useRouter();
  const [round, setRound] = useState<Round | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [balance, setBalance] = useState(initialBalance);
  const [bet, setBet] = useState(0);
  const [lastBet, setLastBet] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Dealer cards already on show before the hand ended (for the reveal delay). */
  const [dealerShown, setDealerShown] = useState(1);

  const roundRef = useRef<Round | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(refreshTimer.current ?? undefined), []);

  const apply = useCallback(
    (res: BlackjackResponse) => {
      const prev = roundRef.current;
      const next = res.round;
      setBalance(res.balance);
      if (next?.phase === "settled" && prev?.phase !== "settled") {
        // Cards the player had already seen stay put; the rest are turned one by one.
        const shown = prev?.phase === "player" ? 1 : next.dealer.length;
        setDealerShown(shown);
        // Update the balance in the header once the dealer has finished.
        clearTimeout(refreshTimer.current ?? undefined);
        refreshTimer.current = setTimeout(() => router.refresh(), ((next.dealer.length - shown) * DEALER_STEP + 0.6) * 1000);
      }
      roundRef.current = next;
      setRound(next);
    },
    [router],
  );

  useEffect(() => {
    void apiCall<BlackjackResponse>("/api/casino/blackjack").then((res) => {
      if (res.ok) apply(res.data);
      else setError(res.message);
      setLoaded(true);
    });
  }, [apply]);

  const send = async (body: object) => {
    setBusy(true);
    setError(null);
    const res = await apiCall<BlackjackResponse>("/api/casino/blackjack", body);
    setBusy(false);
    if (res.ok) apply(res.data);
    else {
      setError(res.message);
      if (res.code === "stale" || res.code === "no_round") {
        const again = await apiCall<BlackjackResponse>("/api/casino/blackjack");
        if (again.ok) apply(again.data);
      }
    }
  };

  const deal = (amount: number) => {
    setLastBet(amount);
    setDealerShown(1);
    void send({ action: "deal", bet: amount });
  };

  const playing = round?.phase === "player";
  const settled = round?.phase === "settled";
  const activeHand = playing ? round.hands[round.active] : null;
  const net = settled ? round.payout - round.staked : 0;
  // Results appear once the last dealer card is down.
  const revealDelay = settled ? Math.max(0, round.dealer.length - dealerShown) * DEALER_STEP : 0;
  const maxBet = Math.min(casinoLimits.maxBet, balance);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-[2rem] border border-ink-600 bg-felt-700 px-3 py-6 sm:px-8 sm:py-8">
        <Facets seed={11} cols={8} rows={6} strength={0.08} />
        <div className="relative flex min-h-[26rem] flex-col items-center justify-between gap-6">
          {/* Dealer */}
          <div className="flex flex-col items-center gap-2" data-dealer>
            <p className="text-xs font-semibold tracking-[0.2em] text-cream/70 uppercase">
              Dealer
              {round && (
                <span className="ml-2 font-mono tracking-normal text-cream">
                  {settled ? round.dealerTotal : null}
                </span>
              )}
            </p>
            {round ? (
              <CardRow cards={round.dealer} shown={settled ? dealerShown : round.dealer.length} label="Dealer's cards" />
            ) : (
              <div className="h-23" />
            )}
          </div>

          <p className="text-center text-[11px] tracking-[0.15em] text-cream/50 uppercase">
            Blackjack pays 3 to 2 · Dealer stands on 17
          </p>

          {/* Player hands */}
          <div className="flex flex-wrap items-end justify-center gap-6" data-hands>
            {round ? (
              round.hands.map((h, i) => (
                <div
                  key={i}
                  data-hand={i}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl p-2 transition-colors",
                    playing && i === round.active && round.hands.length > 1 && "bg-ink-950/30 ring-2 ring-accent-400/70",
                  )}
                >
                  <CardRow cards={h.cards} label={`Your hand ${i + 1}`} />
                  <div className="flex items-center gap-2 text-sm">
                    <span className="rounded-md bg-ink-950/70 px-2 py-0.5 font-mono font-semibold text-cream">
                      {h.soft && h.total < 21 && !settled ? `${h.total - 10}/${h.total}` : h.total}
                    </span>
                    <span className="flex items-center gap-1 text-cream/80">
                      <ChipFace value={h.bet >= 1000 ? 1000 : h.bet >= 100 ? 100 : 10} className="size-5" />
                      {formatChips(h.bet)}
                    </span>
                    {h.outcome && (
                      <span
                        className={cn(
                          "animate-fade-up rounded-md px-2 py-0.5 text-xs font-bold uppercase",
                          h.outcome === "win" || h.outcome === "blackjack"
                            ? "bg-accent-400 text-ink-950"
                            : h.outcome === "push"
                              ? "bg-ink-600 text-cream"
                              : "bg-danger/20 text-danger",
                        )}
                        style={{ animationDelay: `${revealDelay}s` }}
                        data-outcome={h.outcome}
                      >
                        {outcomeText[h.outcome]}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="py-10 text-center text-cream/70">{loaded ? "Place your bet to deal." : "Shuffling…"}</p>
            )}
          </div>
        </div>
      </div>

      {settled && (
        <p
          className="animate-fade-up text-center font-display text-2xl font-extrabold tracking-tight"
          style={{ animationDelay: `${revealDelay}s` }}
          aria-live="polite"
          data-result={net}
        >
          {net > 0 ? (
            <span className="text-accent-300">You win {formatChips(net)}</span>
          ) : net === 0 ? (
            <span className="text-cream">Push: your bet is back</span>
          ) : (
            <span className="text-mist">Dealer wins</span>
          )}
        </p>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {/* Controls */}
      {playing && activeHand ? (
        <div className="flex flex-wrap justify-center gap-3" role="group" aria-label="Your move">
          {(["hit", "stand", "double", "split"] as const).map((a) => {
            const allowed = round.actions.includes(a);
            const extra = a === "double" || a === "split" ? activeHand.bet : 0;
            return (
              <Button
                key={a}
                size="lg"
                variant={a === "hit" || a === "stand" ? "primary" : "secondary"}
                disabled={busy || !allowed || extra > balance}
                onClick={() => void send({ action: a, version: round.version })}
                className="min-w-28"
              >
                {actionLabel[a]}
                {extra > 0 && allowed && <span className="text-xs opacity-70">+{formatChips(extra)}</span>}
              </Button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <ChipPicker
            label="Add chips to your bet"
            disabledAbove={Math.max(0, maxBet - bet)}
            onPick={(v) => setBet((b) => b + v)}
          />
          <div className="flex flex-wrap items-center justify-center gap-3">
            <p className="min-w-32 text-center text-sm text-mist">
              Bet <span className="font-mono text-lg font-semibold text-cream" data-bet>{formatChips(bet)}</span>
            </p>
            <Button variant="ghost" size="sm" onClick={() => setBet(0)} disabled={bet === 0}>
              Clear
            </Button>
            {lastBet > 0 && lastBet <= maxBet && (
              <Button variant="secondary" disabled={busy || !loaded} onClick={() => deal(lastBet)}>
                Same bet ({formatChips(lastBet)})
              </Button>
            )}
            <Button
              size="lg"
              disabled={busy || !loaded || bet < casinoLimits.minBet || bet > maxBet}
              onClick={() => {
                deal(bet);
                setBet(0);
              }}
              className="min-w-32"
            >
              Deal
            </Button>
          </div>
          <p className="text-center text-xs text-slate">
            Bets {formatChips(casinoLimits.minBet)} to {formatChips(casinoLimits.maxBet)} · Balance{" "}
            <span className="font-mono text-cream" data-balance>{formatChips(balance)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
