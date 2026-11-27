"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { casinoChips, casinoLimits } from "@/lib/casino/limits";
import { colourOf, spotKey, type RouletteBet, type Spot } from "@/lib/casino/roulette";
import type { RouletteResponse } from "@/lib/casino/service";
import { apiCall } from "@/lib/game/client";
import { cn, formatChips } from "@/lib/utils";
import { ChipPicker } from "./chip-picker";
import { RouletteBoard } from "./roulette-board";
import { POCKET_FILL, RouletteWheel, restingAngle } from "./roulette-wheel";

const SPIN_MS = 4500;

type Placed = { spot: Spot; amount: number };

export function RouletteClient({ initialBalance }: { initialBalance: number }) {
  const router = useRouter();
  const [balance, setBalance] = useState(initialBalance);
  const [chip, setChip] = useState<number>(casinoChips[0]);
  /** Every chip placed, in order, so the last one can be taken back. */
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [lastBets, setLastBets] = useState<Placed[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<RouletteResponse["result"] | null>(null);
  const [recent, setRecent] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  const stakes = new Map<string, number>();
  for (const p of placed) stakes.set(spotKey(p.spot), (stakes.get(spotKey(p.spot)) ?? 0) + p.amount);
  const total = placed.reduce((a, p) => a + p.amount, 0);
  const room = Math.min(casinoLimits.maxBet, balance) - total;

  const bet = (spot: Spot) => {
    if (spinning) return;
    if (chip > room) {
      setError(
        total + chip > casinoLimits.maxBet
          ? `A spin can have at most ${formatChips(casinoLimits.maxBet)} chips on the table.`
          : "You do not have enough chips for that.",
      );
      return;
    }
    setError(null);
    if (result) setResult(null); // new bets clear the last result's highlights
    setPlaced((p) => [...p, { spot, amount: chip }]);
  };

  const spin = async (bets: Placed[]) => {
    const amount = bets.reduce((a, p) => a + p.amount, 0);
    if (amount < casinoLimits.minBet) {
      setError(`Put at least ${casinoLimits.minBet} chips on the table.`);
      return;
    }
    setError(null);
    setSpinning(true);
    setResult(null);
    const res = await apiCall<RouletteResponse>("/api/casino/roulette", {
      bets: bets.map((b) => ({ ...b.spot, amount: b.amount }) as RouletteBet),
    });
    if (!res.ok) {
      setSpinning(false);
      setError(res.message);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // On upright screens the wheel is above the board: bring it into view.
    const wheel = wheelRef.current?.getBoundingClientRect();
    if (wheel && (wheel.top < 0 || wheel.bottom > window.innerHeight)) {
      wheelRef.current!.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
    // Several full turns, then stop with the winning pocket under the marker.
    setRotation((r) => {
      const target = restingAngle(res.data.result.number);
      const base = r - (((r - target) % 360) + 360) % 360;
      return base - 360 * 5;
    });
    setLastBets(bets);
    timer.current = setTimeout(
      () => {
        setSpinning(false);
        setResult(res.data.result);
        setBalance(res.data.balance);
        setRecent((list) => [res.data.result.number, ...list].slice(0, 12));
        setPlaced([]);
        router.refresh(); // the balance in the header
      },
      reduce ? 50 : SPIN_MS,
    );
  };

  const net = result ? result.payout - result.staked : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
      <div ref={wheelRef} className="scroll-mt-20 space-y-5 lg:sticky lg:top-20">
        {/* Wheel with a fixed marker at the top. */}
        <div className="relative mx-auto aspect-square w-full max-w-[26rem] lg:max-w-[min(26rem,calc(100dvh-14rem))]">
          <div
            className="size-full"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.72, 0.2, 1)` : "none",
            }}
            data-wheel
            data-rotation={rotation}
          >
            <RouletteWheel highlight={result?.number ?? null} />
          </div>
          <svg viewBox="0 0 20 20" className="absolute top-0 left-1/2 size-6 -translate-x-1/2 -translate-y-1" aria-hidden="true">
            <polygon points="2,2 18,2 10,16" fill="#5ded51" stroke="#0a0c0b" strokeWidth="1" />
          </svg>
        </div>

        <div className="min-h-20 text-center" aria-live="polite">
          {spinning ? (
            <p className="pt-6 text-sm tracking-[0.2em] text-mist uppercase">No more bets</p>
          ) : result ? (
            <div className="animate-fade-up space-y-1" data-result={result.number}>
              <p className="flex items-center justify-center gap-3 font-display text-3xl font-extrabold">
                <span
                  className="flex size-12 items-center justify-center rounded-full text-cream"
                  style={{ background: POCKET_FILL[result.colour] }}
                >
                  {result.number}
                </span>
                <span className="capitalize">{result.colour}</span>
              </p>
              <p className={cn("font-semibold", net > 0 ? "text-accent-300" : "text-mist")} data-net={net}>
                {result.payout > 0
                  ? `You win ${formatChips(result.payout)}${net > 0 ? ` (+${formatChips(net)})` : ""}`
                  : "No win this time"}
              </p>
            </div>
          ) : (
            <p className="pt-6 text-sm text-mist">Pick a chip, tap the board to bet, then spin.</p>
          )}
        </div>

        {recent.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5" aria-label="Recent numbers">
            {recent.map((n, i) => (
              <span
                key={`${i}:${n}`}
                className="flex size-8 items-center justify-center rounded-full font-mono text-xs font-bold text-cream"
                style={{ background: POCKET_FILL[colourOf(n)] }}
              >
                {n}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <ChipPicker label="Choose a chip" selected={chip} disabledAbove={Infinity} onPick={setChip} />
        <RouletteBoard stakes={stakes} result={result?.number ?? null} disabled={spinning} onBet={bet} />
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="ghost" size="sm" disabled={spinning || placed.length === 0} onClick={() => setPlaced((p) => p.slice(0, -1))}>
            Undo
          </Button>
          <Button variant="ghost" size="sm" disabled={spinning || placed.length === 0} onClick={() => setPlaced([])}>
            Clear
          </Button>
          {placed.length === 0 && lastBets.length > 0 && (
            <Button variant="secondary" size="sm" disabled={spinning} onClick={() => void spin(lastBets)}>
              Same again ({formatChips(lastBets.reduce((a, p) => a + p.amount, 0))})
            </Button>
          )}
          <Button size="lg" disabled={spinning || total < casinoLimits.minBet} onClick={() => void spin(placed)} className="min-w-36">
            {spinning ? "Spinning…" : `Spin${total ? ` · ${formatChips(total)}` : ""}`}
          </Button>
        </div>
        <p className="text-center text-xs text-slate">
          Single zero · Bets {formatChips(casinoLimits.minBet)} to {formatChips(casinoLimits.maxBet)} a spin · Balance{" "}
          <span className="font-mono text-cream" data-balance>{formatChips(balance - total)}</span>
          {total > 0 && <> + {formatChips(total)} on the table</>}
        </p>
      </div>
    </div>
  );
}
