import { rankValue, suitOf, type Card } from "./cards";

export enum HandCategory {
  HighCard = 0,
  Pair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
}

export type EvaluatedHand = {
  category: HandCategory;
  /**
   * Comparable score: [category, ...tiebreak ranks]. Compare element by
   * element; the first difference decides. Equal arrays are an exact tie.
   */
  score: number[];
  /** The five cards that make the hand, most significant first. */
  cards: Card[];
  /** Human-readable description, e.g. "Full House, Kings full of Sevens". */
  name: string;
};

const RANK_NAMES: Record<number, [string, string]> = {
  2: ["Two", "Twos"], 3: ["Three", "Threes"], 4: ["Four", "Fours"],
  5: ["Five", "Fives"], 6: ["Six", "Sixes"], 7: ["Seven", "Sevens"],
  8: ["Eight", "Eights"], 9: ["Nine", "Nines"], 10: ["Ten", "Tens"],
  11: ["Jack", "Jacks"], 12: ["Queen", "Queens"], 13: ["King", "Kings"],
  14: ["Ace", "Aces"],
};
const one = (r: number) => RANK_NAMES[r][0];
const many = (r: number) => RANK_NAMES[r][1];

/**
 * Highest straight in a set of ranks. Returns the top rank of the straight
 * (5 for the wheel A-2-3-4-5), or 0 if there is none.
 */
function straightHigh(ranks: Set<number>): number {
  for (let high = 14; high >= 6; high--) {
    let ok = true;
    for (let r = high; r > high - 5; r--) {
      if (!ranks.has(r)) {
        ok = false;
        break;
      }
    }
    if (ok) return high;
  }
  if (ranks.has(14) && ranks.has(2) && ranks.has(3) && ranks.has(4) && ranks.has(5)) {
    return 5;
  }
  return 0;
}

/** Ranks of a straight from the top down; the wheel's ace counts low. */
function straightRanks(high: number): number[] {
  return high === 5 ? [5, 4, 3, 2, 14] : [high, high - 1, high - 2, high - 3, high - 4];
}

/**
 * Best five-card poker hand from 5, 6 or 7 cards.
 * Checks categories from strongest to weakest, so the first match is the best.
 */
export function evaluateHand(cards: readonly Card[]): EvaluatedHand {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error(`evaluateHand needs 5 to 7 cards, got ${cards.length}`);
  }
  if (new Set(cards).size !== cards.length) {
    throw new Error("evaluateHand received duplicate cards");
  }

  // Highest first; stable so equal ranks keep input order.
  const sorted = cards.slice().sort((a, b) => rankValue(b) - rankValue(a));

  const bySuit = new Map<string, Card[]>();
  const byRank = new Map<number, Card[]>();
  for (const card of sorted) {
    const s = suitOf(card);
    const r = rankValue(card);
    bySuit.set(s, [...(bySuit.get(s) ?? []), card]);
    byRank.set(r, [...(byRank.get(r) ?? []), card]);
  }

  const pick = (ranks: number[], pool: readonly Card[]) =>
    ranks.map((r) => pool.find((c) => rankValue(c) === r)!);
  const kickers = (exclude: number[], count: number) =>
    sorted.filter((c) => !exclude.includes(rankValue(c))).slice(0, count);
  const make = (category: HandCategory, tiebreak: number[], five: Card[], name: string): EvaluatedHand =>
    ({ category, score: [category, ...tiebreak], cards: five, name });

  // Rank groups: four of a kind first, then trips, then pairs; high ranks first.
  const groups = [...byRank.entries()]
    .map(([rank, cs]) => ({ rank, count: cs.length }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  const flushCards = [...bySuit.values()].find((cs) => cs.length >= 5);

  // Straight flush
  if (flushCards) {
    const high = straightHigh(new Set(flushCards.map(rankValue)));
    if (high) {
      const name = high === 14 ? "Royal Flush" : `Straight Flush, ${one(high)} high`;
      return make(HandCategory.StraightFlush, [high], pick(straightRanks(high), flushCards), name);
    }
  }

  // Four of a kind
  if (groups[0].count === 4) {
    const quad = groups[0].rank;
    const kicker = kickers([quad], 1);
    return make(
      HandCategory.FourOfAKind,
      [quad, rankValue(kicker[0])],
      [...byRank.get(quad)!, ...kicker],
      `Four of a Kind, ${many(quad)}`,
    );
  }

  // Full house: best trips plus the best remaining pair (which may itself be
  // a second set of trips when seven cards are in play).
  const trips = groups.filter((g) => g.count === 3).map((g) => g.rank);
  const pairs = groups.filter((g) => g.count === 2).map((g) => g.rank);
  if (trips.length > 0) {
    const pairRank = Math.max(trips[1] ?? 0, pairs[0] ?? 0);
    if (pairRank > 0) {
      return make(
        HandCategory.FullHouse,
        [trips[0], pairRank],
        [...byRank.get(trips[0])!, ...byRank.get(pairRank)!.slice(0, 2)],
        `Full House, ${many(trips[0])} full of ${many(pairRank)}`,
      );
    }
  }

  // Flush
  if (flushCards) {
    const five = flushCards.slice(0, 5);
    return make(HandCategory.Flush, five.map(rankValue), five, `Flush, ${one(rankValue(five[0]))} high`);
  }

  // Straight
  const high = straightHigh(new Set(byRank.keys()));
  if (high) {
    return make(HandCategory.Straight, [high], pick(straightRanks(high), sorted), `Straight, ${one(high)} high`);
  }

  // Three of a kind
  if (trips.length > 0) {
    const k = kickers([trips[0]], 2);
    return make(
      HandCategory.ThreeOfAKind,
      [trips[0], ...k.map(rankValue)],
      [...byRank.get(trips[0])!, ...k],
      `Three of a Kind, ${many(trips[0])}`,
    );
  }

  // Two pair
  if (pairs.length >= 2) {
    const [hi, lo] = pairs;
    const k = kickers([hi, lo], 1);
    return make(
      HandCategory.TwoPair,
      [hi, lo, rankValue(k[0])],
      [...byRank.get(hi)!, ...byRank.get(lo)!, ...k],
      `Two Pair, ${many(hi)} and ${many(lo)}`,
    );
  }

  // One pair
  if (pairs.length === 1) {
    const k = kickers([pairs[0]], 3);
    return make(
      HandCategory.Pair,
      [pairs[0], ...k.map(rankValue)],
      [...byRank.get(pairs[0])!, ...k],
      `Pair of ${many(pairs[0])}`,
    );
  }

  const five = sorted.slice(0, 5);
  return make(HandCategory.HighCard, five.map(rankValue), five, `High Card, ${one(rankValue(five[0]))}`);
}

/** Positive if a beats b, negative if b beats a, 0 for an exact tie. */
export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  const len = Math.max(a.score.length, b.score.length);
  for (let i = 0; i < len; i++) {
    const diff = (a.score[i] ?? 0) - (b.score[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
