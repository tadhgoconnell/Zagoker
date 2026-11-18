/**
 * Betting with chips: the player builds a bet by tapping chips of different
 * values. Pure logic, shared by the action bar and its tests.
 */
import type { LegalActions } from "@/lib/poker";

/** Standard casino denominations, smallest first. */
const STANDARD = [
  1, 5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000,
  1_000_000,
];

/**
 * Five chip values that suit the table: starting from the largest standard
 * chip no bigger than the small blind. Blinds 10/20 give 10, 25, 50, 100, 250.
 */
export function chipDenominations(smallBlind: number): number[] {
  let start = 0;
  for (let i = 0; i < STANDARD.length; i++) if (STANDARD[i] <= smallBlind) start = i;
  return STANDARD.slice(start, start + 5);
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * Splits an amount into the fewest chips that add up to it exactly. When no
 * combination is exact (possible after an odd all-in), the largest amount
 * that can be made is used plus one chip of exactly the remainder.
 */
export function chipsFor(amount: number, denominations: readonly number[]): number[] {
  const want = Math.max(0, Math.floor(amount));
  const ds = [...denominations].sort((a, b) => a - b);
  if (want === 0 || ds.length === 0) return want > 0 ? [want] : [];
  const unit = ds.reduce(gcd);
  const n = Math.floor(want / unit);
  // fewest[i] = fewest chips making i * unit; from[i] = last chip used.
  const fewest = new Int32Array(n + 1).fill(-1);
  const from = new Int32Array(n + 1);
  fewest[0] = 0;
  for (let i = 1; i <= n; i++) {
    for (const d of ds) {
      const j = i - d / unit;
      if (j >= 0 && fewest[j] >= 0 && (fewest[i] < 0 || fewest[j] + 1 < fewest[i])) {
        fewest[i] = fewest[j] + 1;
        from[i] = d;
      }
    }
  }
  let best = n;
  while (best > 0 && fewest[best] < 0) best--;
  const out: number[] = [];
  for (let i = best; i > 0; i -= from[i] / unit) out.push(from[i]);
  out.sort((a, b) => b - a);
  const rest = want - best * unit;
  if (rest > 0) out.push(rest);
  return out;
}

export type ChipBet =
  | { kind: "empty" }
  /** Not enough for a legal bet or raise; `missing` more chips are needed. */
  | { kind: "short"; target: number; min: number; missing: number }
  | { kind: "bet" | "raise"; target: number }
  | { kind: "allin"; target: number };

/**
 * What the selected chips amount to. Chips are what the player pushes in now,
 * on top of anything already in front of them this street, so the bet or
 * raise is to `streetBet + chips`.
 */
export function chipBet(selected: number, streetBet: number, stack: number, legal: LegalActions): ChipBet {
  if (selected <= 0 || !legal.raise) return { kind: "empty" };
  const target = streetBet + selected;
  if (selected >= stack) return { kind: "allin", target: streetBet + stack };
  if (target < legal.raise.min) {
    return { kind: "short", target, min: legal.raise.min, missing: legal.raise.min - target };
  }
  return { kind: legal.raise.type, target: Math.min(target, legal.raise.max) };
}
