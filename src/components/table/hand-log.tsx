"use client";

import { useEffect, useRef } from "react";
import type { HandView } from "@/lib/poker";
import { describeAction } from "@/lib/poker/display";
import { formatChips } from "@/lib/utils";

/** Running commentary of the current hand. */
export function HandLog({
  hand,
  handNumber,
  nameOf,
}: {
  hand: HandView | null;
  handNumber: number;
  nameOf: (seat: number) => string;
}) {
  const end = useRef<HTMLLIElement>(null);
  const count = hand?.actions.length ?? 0;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [count, hand?.result]);

  if (!hand) {
    return <p className="p-4 text-sm text-slate">The hand history appears here once cards are dealt.</p>;
  }

  return (
    <ol className="space-y-1 p-4 text-sm">
      <li className="pb-1 text-xs font-semibold tracking-[0.2em] text-accent-400 uppercase">Hand #{handNumber}</li>
      {hand.actions.map((a, i) => {
        const heading = i === 0 || hand.actions[i - 1].street !== a.street ? a.street : null;
        return (
          <li key={i}>
            {heading && heading !== "preflop" && (
              <p className="pt-2 pb-1 text-[11px] tracking-[0.2em] text-slate uppercase">{heading}</p>
            )}
            <span className="font-medium text-cream">{nameOf(a.seat)}</span>{" "}
            <span className="text-mist">{describeAction(a, formatChips)}</span>
          </li>
        );
      })}
      {hand.result?.pots.map((pot, i) => (
        <li key={`pot-${i}`} className="pt-2 font-semibold text-accent-200">
          {pot.winners.map((w) => nameOf(w.seat)).join(" & ")} {pot.winners.length > 1 ? "split" : "wins"}{" "}
          {formatChips(pot.amount)}
        </li>
      ))}
      {hand.result?.shown.map((s) => (
        <li key={`shown-${s.seat}`} className="text-mist">
          <span className="font-medium text-cream">{nameOf(s.seat)}</span> shows {s.hand.name}
        </li>
      ))}
      <li ref={end} />
    </ol>
  );
}
