/**
 * European roulette (single zero) against the house. Pure functions: the
 * server spins with a secure random source; the browser only draws the wheel
 * and the board.
 *
 * Bets: a single number (35 to 1), red/black, odd/even, 1-18/19-36 (1 to 1),
 * dozens and columns (2 to 1). Zero loses every outside bet.
 */
import { z } from "zod";
import type { RandomInt } from "@/lib/poker/cards";

/** Pocket order around the wheel, clockwise from zero. */
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7,
  28, 12, 35, 3, 26,
] as const;

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type Colour = "red" | "black" | "green";
export const colourOf = (n: number): Colour => (n === 0 ? "green" : RED.has(n) ? "red" : "black");

export const OUTSIDE = ["red", "black", "odd", "even", "low", "high"] as const;
export type OutsideBet = (typeof OUTSIDE)[number];

/** Where a bet sits. Each spot is one place on the board. */
export type Spot =
  | { type: "number"; n: number }
  | { type: OutsideBet }
  | { type: "dozen"; n: 1 | 2 | 3 }
  | { type: "column"; n: 1 | 2 | 3 };

export type RouletteBet = Spot & { amount: number };

export const spotSchema = z.union([
  z.object({ type: z.literal("number"), n: z.number().int().min(0).max(36) }),
  z.object({ type: z.enum(OUTSIDE) }),
  z.object({ type: z.enum(["dozen", "column"]), n: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
]);

export const betSchema = z.intersection(spotSchema, z.object({ amount: z.number().int().positive().max(1_000_000) }));

/** A stable key for a spot, e.g. "number:17", "red", "dozen:2". */
export function spotKey(spot: Spot): string {
  return "n" in spot ? `${spot.type}:${spot.n}` : spot.type;
}

/** Does the spot win when the ball lands on `n`? */
export function covers(spot: Spot, n: number): boolean {
  switch (spot.type) {
    case "number":
      return spot.n === n;
    case "red":
    case "black":
      return colourOf(n) === spot.type;
    case "odd":
      return n > 0 && n % 2 === 1;
    case "even":
      return n > 0 && n % 2 === 0;
    case "low":
      return n >= 1 && n <= 18;
    case "high":
      return n >= 19 && n <= 36;
    case "dozen":
      return n > 0 && Math.ceil(n / 12) === spot.n;
    case "column":
      return n > 0 && ((n - 1) % 3) + 1 === spot.n;
  }
}

/** Winnings per chip staked, not counting the stake itself. */
export function odds(spot: Spot): number {
  if (spot.type === "number") return 35;
  if (spot.type === "dozen" || spot.type === "column") return 2;
  return 1;
}

/** Chips returned for one bet, stake included (0 if it lost). */
export const payoutFor = (bet: RouletteBet, n: number) => (covers(bet, n) ? bet.amount * (odds(bet) + 1) : 0);

export function spin(randomInt: RandomInt): number {
  return randomInt(37);
}

export type SpinResult = {
  number: number;
  colour: Colour;
  bets: (RouletteBet & { payout: number })[];
  staked: number;
  payout: number;
};

export function settleSpin(bets: readonly RouletteBet[], n: number): SpinResult {
  const settled = bets.map((b) => ({ ...b, payout: payoutFor(b, n) }));
  return {
    number: n,
    colour: colourOf(n),
    bets: settled,
    staked: bets.reduce((a, b) => a + b.amount, 0),
    payout: settled.reduce((a, b) => a + b.payout, 0),
  };
}

/** Merges bets on the same spot, so a spot is listed once. */
export function combineBets(bets: readonly RouletteBet[]): RouletteBet[] {
  const map = new Map<string, RouletteBet>();
  for (const b of bets) {
    const key = spotKey(b);
    const prev = map.get(key);
    map.set(key, prev ? { ...prev, amount: prev.amount + b.amount } : { ...b });
  }
  return [...map.values()];
}
