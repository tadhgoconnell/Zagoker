/**
 * Pot construction and distribution. Pure arithmetic on whole chips.
 */
export type Contribution = {
  seat: number;
  /** Total chips this player put in during the hand. */
  amount: number;
  folded: boolean;
};

export type Pot = {
  amount: number;
  /** Seats that can win this pot (contributed to it and did not fold). */
  eligibleSeats: number[];
};

/**
 * If one player put in more than anyone else could match, the unmatched part
 * was never really at risk and goes straight back to them.
 */
export function uncalledBet(
  contributions: readonly Contribution[],
): { seat: number; amount: number } | null {
  const sorted = contributions.slice().sort((a, b) => b.amount - a.amount);
  if (sorted.length < 2) return null;
  const [top, second] = sorted;
  const excess = top.amount - second.amount;
  if (excess <= 0 || top.folded) return null;
  return { seat: top.seat, amount: excess };
}

/**
 * Splits the chips into a main pot and side pots.
 *
 * Each distinct all-in amount among the players still in the hand creates a
 * level. A pot holds what every player (including those who folded) put in
 * between two levels, and can be won only by players who reached that level.
 */
export function buildPots(contributions: readonly Contribution[]): Pot[] {
  const live = contributions.filter((c) => !c.folded && c.amount > 0);
  const levels = [...new Set(live.map((c) => c.amount))].sort((a, b) => a - b);

  const pots: Pot[] = [];
  let previous = 0;
  for (const level of levels) {
    let amount = 0;
    for (const c of contributions) {
      amount += Math.max(0, Math.min(c.amount, level) - previous);
    }
    const eligibleSeats = live.filter((c) => c.amount >= level).map((c) => c.seat);
    if (amount > 0) {
      const last = pots[pots.length - 1];
      // Same contenders as the previous pot: it is the same pot.
      if (last && sameSeats(last.eligibleSeats, eligibleSeats)) last.amount += amount;
      else pots.push({ amount, eligibleSeats });
    }
    previous = level;
  }

  // Chips a folded player put in above the highest live level (dead money)
  // belong to the last pot.
  let dead = 0;
  for (const c of contributions) dead += Math.max(0, c.amount - previous);
  if (dead > 0 && pots.length > 0) pots[pots.length - 1].amount += dead;

  return pots;
}

function sameSeats(a: readonly number[], b: readonly number[]) {
  return a.length === b.length && a.every((s) => b.includes(s));
}

/**
 * Splits one pot between its winners. Chips that do not divide evenly go one
 * at a time to the winners in `oddChipOrder` (first seat left of the button
 * first), which is the standard casino rule.
 */
export function splitPot(
  amount: number,
  winners: readonly number[],
  oddChipOrder: readonly number[],
): Map<number, number> {
  if (winners.length === 0) throw new Error("A pot needs at least one winner");
  const share = Math.floor(amount / winners.length);
  let remainder = amount - share * winners.length;
  const out = new Map<number, number>(winners.map((s) => [s, share]));
  for (const seat of oddChipOrder) {
    if (remainder === 0) break;
    if (out.has(seat)) {
      out.set(seat, out.get(seat)! + 1);
      remainder--;
    }
  }
  if (remainder !== 0) throw new Error("oddChipOrder must include every winner");
  return out;
}
