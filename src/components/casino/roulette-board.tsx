"use client";

import { ChipFace } from "@/components/table/chip-token";
import { casinoChips } from "@/lib/casino/limits";
import { colourOf, covers, spotKey, type Spot } from "@/lib/casino/roulette";
import { cn, formatChipsCompact } from "@/lib/utils";
import { POCKET_FILL } from "./roulette-wheel";

type Props = {
  /** Chips on each spot, by spotKey. */
  stakes: ReadonlyMap<string, number>;
  /** The winning number of the last spin, to light up winning spots. */
  result: number | null;
  disabled: boolean;
  onBet: (spot: Spot) => void;
};

/** The chip shown on a spot: the largest standard chip in the stake. */
function StakeChip({ amount }: { amount: number }) {
  const face = [...casinoChips].reverse().find((c) => c <= amount) ?? casinoChips[0];
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="relative">
        <ChipFace value={face} className="size-7" />
        <span className="absolute -right-3 -bottom-1 rounded bg-ink-950/90 px-1 font-mono text-[10px] font-semibold text-cream">
          {formatChipsCompact(amount)}
        </span>
      </span>
    </span>
  );
}

function Cell({
  spot,
  label,
  vertical = false,
  className,
  style,
  props,
}: {
  spot: Spot;
  label: string;
  /** Label written top to bottom (the dozens beside the numbers). */
  vertical?: boolean;
  className?: string;
  style?: React.CSSProperties;
  props: Props;
}) {
  const key = spotKey(spot);
  const amount = props.stakes.get(key) ?? 0;
  const won = props.result !== null && covers(spot, props.result);
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={() => props.onBet(spot)}
      aria-label={`Bet on ${label}${amount ? `, ${amount} chips placed` : ""}`}
      data-spot={key}
      className={cn(
        "relative flex h-10 items-center justify-center border border-cream/25 text-sm font-bold text-cream transition-colors disabled:cursor-default sm:h-11",
        won && "z-10 outline-2 -outline-offset-2 outline-accent-400",
        className,
      )}
      style={style}
    >
      <span className={cn(vertical && "[writing-mode:vertical-rl]")}>{label}</span>
      {amount > 0 && <StakeChip amount={amount} />}
    </button>
  );
}

/**
 * The betting layout, upright: 0 across the top, numbers 1-36 in three
 * columns, then columns (2 to 1), dozens and the even-money bets.
 */
export function RouletteBoard(props: Props) {
  const numbers = Array.from({ length: 36 }, (_, i) => i + 1);
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-600 bg-felt-700 p-2 sm:p-3" data-board>
      <div className="grid grid-cols-[1fr_1fr_1fr_3.5rem] gap-0">
        <Cell
          spot={{ type: "number", n: 0 }}
          label="0"
          className="col-span-3 rounded-t-lg"
          style={{ background: POCKET_FILL.green }}
          props={props}
        />
        <div className="row-span-[13] flex flex-col">
          {/* Dozens run alongside the numbers they cover. */}
          <div className="h-10 sm:h-11" />
          {([1, 2, 3] as const).map((d) => (
            <Cell
              key={d}
              spot={{ type: "dozen", n: d }}
              label={`${["1st", "2nd", "3rd"][d - 1]} 12`}
              vertical
              className="flex-1 text-xs"
              style={{ height: "auto" }}
              props={props}
            />
          ))}
        </div>
        {numbers.map((n) => (
          <Cell key={n} spot={{ type: "number", n }} label={String(n)} style={{ background: POCKET_FILL[colourOf(n)] }} props={props} />
        ))}
        {([1, 2, 3] as const).map((c) => (
          <Cell key={c} spot={{ type: "column", n: c }} label="2 to 1" className="text-xs" props={props} />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-0">
        <Cell spot={{ type: "low" }} label="1–18" props={props} />
        <Cell spot={{ type: "even" }} label="Even" props={props} />
        <Cell spot={{ type: "red" }} label="Red" style={{ background: POCKET_FILL.red }} props={props} />
        <Cell spot={{ type: "black" }} label="Black" style={{ background: POCKET_FILL.black }} props={props} />
        <Cell spot={{ type: "odd" }} label="Odd" props={props} />
        <Cell spot={{ type: "high" }} label="19–36" props={props} />
      </div>
    </div>
  );
}
