"use client";

import { ChipFace } from "@/components/table/chip-token";
import { casinoChips } from "@/lib/casino/limits";
import { cn } from "@/lib/utils";

/**
 * A row of chips. In "add" mode each tap adds that chip; in "select" mode the
 * tapped chip becomes the current one (roulette: then tap the board).
 */
export function ChipPicker({
  onPick,
  selected,
  disabledAbove,
  label,
}: {
  onPick: (value: number) => void;
  selected?: number;
  /** Chips larger than this are greyed out (not enough room or balance). */
  disabledAbove: number;
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label={label}>
      {casinoChips.map((v) => {
        const off = v > disabledAbove;
        return (
          <button
            key={v}
            type="button"
            disabled={off}
            onClick={() => onPick(v)}
            aria-label={`${selected === undefined ? "Add" : "Use"} ${v} chip`}
            aria-pressed={selected === undefined ? undefined : selected === v}
            className={cn(
              "rounded-full transition-transform active:scale-95 disabled:opacity-30",
              selected === v && "ring-2 ring-accent-400 ring-offset-2 ring-offset-ink-900",
            )}
          >
            <ChipFace value={v} className="size-12 sm:size-14" />
          </button>
        );
      })}
    </div>
  );
}
