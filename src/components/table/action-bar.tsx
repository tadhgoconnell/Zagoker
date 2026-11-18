"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { chipBet, chipDenominations, chipsFor } from "@/lib/game/bet-chips";
import type { HandView, PlayerAction } from "@/lib/poker";
import { cn, formatChips } from "@/lib/utils";
import { ChipFace } from "./chip-token";

type Props = {
  hand: HandView;
  mySeat: number;
  disabled: boolean;
  onAction: (action: PlayerAction) => void;
};

/**
 * The player's controls on their turn. Bets are built from chips: tap chips
 * to add them, tap a chip in your pile to take it back. The options and
 * limits come from the server (hand.legalActions), and the server checks the
 * final amount again, so nothing here is trusted.
 */
export function ActionBar({ hand, mySeat, disabled, onAction }: Props) {
  const legal = hand.legalActions!;
  const me = hand.players.find((p) => p.seat === mySeat)!;
  const raise = legal.raise;
  const denominations = chipDenominations(hand.smallBlind);
  const [pile, setPile] = useState<number[]>([]);

  const selected = pile.reduce((a, b) => a + b, 0);
  const bet = chipBet(selected, me.streetBet, me.stack, legal);
  const room = me.stack - selected; // chips still available to add
  const callIsAllIn = legal.callAmount > 0 && legal.callAmount === me.stack;

  const add = (value: number) => setPile((p) => [...p, value].sort((a, b) => b - a));
  const removeAt = (i: number) => setPile((p) => p.filter((_, j) => j !== i));
  const setTo = (chipsIn: number) => setPile(chipsFor(chipsIn, denominations));

  let betLabel = "";
  if (raise) {
    const word = raise.type === "bet" ? "Bet" : "Raise to";
    if (bet.kind === "empty") betLabel = raise.type === "bet" ? "Bet" : "Raise";
    else if (bet.kind === "allin") betLabel = `All-in ${formatChips(bet.target)}`;
    else if (bet.kind === "short") betLabel = `${word} ${formatChips(bet.target)}`;
    else betLabel = `${word} ${formatChips(bet.target)}`;
  }
  const canBet = bet.kind === "bet" || bet.kind === "raise" || bet.kind === "allin";

  const send = () => {
    if (bet.kind === "allin") onAction({ type: "allin" });
    else if (bet.kind === "bet" || bet.kind === "raise") onAction({ type: bet.kind, amount: bet.target });
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2.5">
      {raise && (
        <>
          {/* Chips to tap */}
          <div className="flex items-center gap-1.5 sm:gap-2" role="group" aria-label="Add chips to your bet">
            {denominations.map((d) => (
              <button
                key={d}
                type="button"
                disabled={disabled || d > room}
                onClick={() => add(d)}
                aria-label={`Add ${formatChips(d)}`}
                className="rounded-full transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-30"
              >
                <ChipFace value={d} className="size-9 min-[380px]:size-10 sm:size-11" />
              </button>
            ))}
            <div className="ml-auto flex gap-1.5">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setTo(raise.min - me.streetBet)}
                className="h-9 rounded-lg border border-ink-600 px-2.5 text-xs font-semibold text-mist hover:border-ink-500 hover:text-cream"
              >
                Min
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setTo(me.stack)}
                className="h-9 rounded-lg border border-ink-600 px-2.5 text-xs font-semibold text-mist hover:border-ink-500 hover:text-cream"
              >
                All-in
              </button>
            </div>
          </div>

          {/* The pile being built */}
          <div className="flex h-8 items-center gap-2" aria-live="polite">
            {pile.length === 0 ? (
              <p className="text-xs text-slate">Tap chips to build your bet.</p>
            ) : (
              <>
                <div className="flex min-w-0 items-center overflow-hidden">
                  {pile.slice(0, 14).map((v, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => removeAt(i)}
                      aria-label={`Remove ${formatChips(v)}`}
                      className={cn("shrink-0 rounded-full", i > 0 && "-ml-2")}
                    >
                      <ChipFace value={v} className="size-7" />
                    </button>
                  ))}
                  {pile.length > 14 && <span className="ml-1 text-xs text-mist">+{pile.length - 14}</span>}
                </div>
                <span className="text-sm font-semibold text-cream tabular-nums" data-chip-total>
                  {formatChips(selected)}
                </span>
                {bet.kind === "short" && (
                  <span className="truncate text-xs text-mist">
                    Add {formatChips(bet.missing)} more (minimum {formatChips(bet.min)})
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setPile([])}
                  className="ml-auto shrink-0 text-xs font-semibold text-mist hover:text-cream"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Button variant="danger" size="lg" disabled={disabled} onClick={() => onAction({ type: "fold" })} className="px-2">
          Fold
        </Button>
        {legal.canCheck ? (
          <Button variant="secondary" size="lg" disabled={disabled} onClick={() => onAction({ type: "check" })} className="px-2">
            Check
          </Button>
        ) : (
          <Button variant="secondary" size="lg" disabled={disabled} onClick={() => onAction({ type: "call" })} className="px-2">
            {callIsAllIn ? "Call all-in" : "Call"} {formatChips(legal.callAmount)}
          </Button>
        )}
        {raise ? (
          <Button size="lg" disabled={disabled || !canBet} onClick={send} className="px-2">
            {betLabel}
          </Button>
        ) : (
          <span className="grid place-items-center text-center text-xs text-slate">No raise available</span>
        )}
      </div>
    </div>
  );
}
