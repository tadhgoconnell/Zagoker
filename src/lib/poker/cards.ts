/**
 * Cards, deck and shuffling. Pure functions with no platform dependencies.
 *
 * A card is a two-character string: rank then suit, e.g. "As", "Td", "7c".
 */
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;
export const SUITS = ["s", "h", "d", "c"] as const;

export type RankChar = (typeof RANKS)[number];
export type SuitChar = (typeof SUITS)[number];
export type Card = `${RankChar}${SuitChar}`;

/** Returns an integer in [0, maxExclusive). Must be uniform. */
export type RandomInt = (maxExclusive: number) => number;

/** Numeric rank: 2..14 (ace high). */
export function rankValue(card: Card): number {
  return RANKS.indexOf(card[0] as RankChar) + 2;
}

export function suitOf(card: Card): SuitChar {
  return card[1] as SuitChar;
}

export function isCard(value: unknown): value is Card {
  return (
    typeof value === "string" &&
    value.length === 2 &&
    RANKS.includes(value[0] as RankChar) &&
    SUITS.includes(value[1] as SuitChar)
  );
}

/** A fresh 52-card deck in a fixed order. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push(`${rank}${suit}`);
  }
  return deck;
}

/**
 * Fisher-Yates shuffle. Returns a new array. Every permutation is equally
 * likely provided `randomInt` is uniform, which is why it must return a
 * bounded integer directly rather than a float that gets scaled.
 */
export function shuffle<T>(items: readonly T[], randomInt: RandomInt): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    if (!Number.isInteger(j) || j < 0 || j > i) {
      throw new Error("randomInt returned a value outside [0, maxExclusive)");
    }
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createShuffledDeck(randomInt: RandomInt): Card[] {
  return shuffle(createDeck(), randomInt);
}
