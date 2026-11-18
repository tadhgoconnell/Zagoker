"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { HandView, PlayerAction } from "@/lib/poker";
import { formatChips } from "@/lib/utils";

type Props = {
  hand: HandView;
  mySeat: number;
  disabled: boolean;
  onAction: (action: PlayerAction) => void;
};

/**
 * The player's controls on their turn. The options and limits come from the
 * server (hand.legalActions); the server validates again when the action is
 * sent, so nothing here is trusted.
 */
export function ActionBar({ hand, mySeat, disabled, onAction }: Props) {
  const legal = hand.legalActions!;
  const me = hand.players.find((p) => p.seat === mySeat)!;
  const raise = legal.raise;
  const [amount, setAmount] = useState(raise?.min ?? 0);

  const clamp = (n: number) => (raise ? Math.min(raise.max, Math.max(raise.min, Math.round(n))) : 0);
  // "Pot" means: call first, then raise by the size of the pot after calling.
  const potAfterCall = hand.pot + legal.callAmount;
  const allPresets = raise
    ? [
        { label: "Min", value: raise.min },
        { label: "½ pot", value: clamp(hand.currentBet + potAfterCall / 2) },
        { label: "Pot", value: clamp(hand.currentBet + potAfterCall) },
        { label: "All-in", value: raise.max },
      ]
    : [];
  // Drop presets that come out the same as an earlier one (e.g. ½ pot = min).
  const presets = allPresets.filter((p, i) => allPresets.findIndex((q) => q.value === p.value) === i);

  const isAllIn = raise !== null && amount === raise.max;
  const raiseLabel = !raise
    ? ""
    : isAllIn
      ? `All-in ${formatChips(raise.max)}`
      : raise.type === "bet"
        ? `Bet ${formatChips(amount)}`
        : `Raise to ${formatChips(amount)}`;
  const callIsAllIn = legal.callAmount > 0 && legal.callAmount === me.stack;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
      {raise && raise.max > raise.min && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                disabled={disabled}
                onClick={() => setAmount(p.value)}
                className={`h-9 rounded-full border px-3 text-xs font-semibold transition-colors ${
                  amount === p.value
                    ? "border-gold-400 bg-gold-500/15 text-gold-200"
                    : "border-white/12 text-mist hover:border-white/25 hover:text-cream"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="range"
            aria-label="Bet amount"
            min={raise.min}
            max={raise.max}
            step={Math.max(1, hand.smallBlind)}
            value={amount}
            disabled={disabled}
            onChange={(e) => setAmount(clamp(Number(e.target.value)))}
            className="h-9 min-w-24 flex-1 accent-gold-400"
          />
          <input
            type="number"
            inputMode="numeric"
            aria-label="Bet amount in chips"
            min={raise.min}
            max={raise.max}
            value={amount}
            disabled={disabled}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            onBlur={() => setAmount(clamp(amount))}
            className="h-9 w-24 rounded-full border border-white/12 bg-ink-900 px-3 text-right text-sm font-semibold text-cream tabular-nums focus:border-gold-400 focus:outline-none"
          />
        </div>
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
          <Button
            size="lg"
            disabled={disabled || amount < raise.min || amount > raise.max}
            onClick={() => onAction(isAllIn ? { type: "allin" } : { type: raise.type, amount })}
            className="px-2"
          >
            {raiseLabel}
          </Button>
        ) : (
          <span className="grid place-items-center text-center text-xs text-slate">No raise available</span>
        )}
      </div>
    </div>
  );
}
