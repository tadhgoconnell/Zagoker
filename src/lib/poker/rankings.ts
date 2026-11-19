/**
 * The ten Texas Hold'em hands, best first, with an example and how often a
 * player's best five of seven cards (two hole cards plus the full board) is
 * that hand. Counts are out of all 133,784,560 seven-card combinations.
 */
export type RankingEntry = {
  name: string;
  /** Example five cards, e.g. "As Ks Qs Js Ts". */
  example: string;
  description: string;
  sevenCardCount: number;
};

export const SEVEN_CARD_TOTAL = 133_784_560;

export const handRankings: readonly RankingEntry[] = [
  { name: "Royal Flush", example: "As Ks Qs Js Ts", description: "Ace, King, Queen, Jack and Ten, all of one suit. The best hand there is.", sevenCardCount: 4_324 },
  { name: "Straight Flush", example: "9h 8h 7h 6h 5h", description: "Five cards in a row, all of one suit. The higher top card wins.", sevenCardCount: 37_260 },
  { name: "Four of a Kind", example: "Qc Qd Qh Qs 7d", description: "Four cards of the same rank, plus any fifth card.", sevenCardCount: 224_848 },
  { name: "Full House", example: "Kc Kh Kd 4s 4c", description: "Three of a kind plus a pair. The three decide first, then the pair.", sevenCardCount: 3_473_184 },
  { name: "Flush", example: "Ad Jd 9d 6d 3d", description: "Five cards of one suit, not in a row. Compared card by card from the top.", sevenCardCount: 4_047_644 },
  { name: "Straight", example: "Tc 9d 8s 7h 6c", description: "Five cards in a row, mixed suits. The Ace can be high (A-K-Q-J-10) or low (5-4-3-2-A).", sevenCardCount: 6_180_020 },
  { name: "Three of a Kind", example: "7s 7h 7d Kc 2s", description: "Three cards of the same rank and two unrelated cards.", sevenCardCount: 6_461_620 },
  { name: "Two Pair", example: "Jh Jc 5s 5d Ac", description: "Two different pairs. The higher pair decides, then the lower, then the fifth card.", sevenCardCount: 31_433_400 },
  { name: "One Pair", example: "Td Ts Ah 8c 4d", description: "Two cards of the same rank. If two players share the pair, the side cards (kickers) decide.", sevenCardCount: 58_627_800 },
  { name: "High Card", example: "Ah Qd 9c 6s 2h", description: "None of the above. Your highest card plays, then the next, and so on.", sevenCardCount: 23_294_460 },
];

/** "2.60%" or, for rare hands, "0.0032%". */
export function percent(count: number): string {
  const p = (count / SEVEN_CARD_TOTAL) * 100;
  return `${p >= 1 ? p.toFixed(2) : p >= 0.1 ? p.toFixed(3) : p.toFixed(4)}%`;
}

/** "1 in 38". */
export function oneIn(count: number): string {
  return `1 in ${new Intl.NumberFormat("en-US").format(Math.round(SEVEN_CARD_TOTAL / count))}`;
}
