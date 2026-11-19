import type { Rank, Suit } from "@/components/cards/playing-card";
import type { ActionRecord } from "./engine";
import { rankValue, type Card } from "./cards";
import { evaluateHand } from "./evaluator";

const suits: Record<string, Suit> = { s: "spades", h: "hearts", d: "diamonds", c: "clubs" };

/** "Td" -> { rank: "10", suit: "diamonds" } for the PlayingCard component. */
export function cardParts(card: Card): { rank: Rank; suit: Suit } {
  const rank = card[0] === "T" ? "10" : (card[0] as Rank);
  return { rank, suit: suits[card[1]] };
}

/** "raises to 300", "posts the small blind 50", ... */
export function describeAction(a: ActionRecord, format: (n: number) => string): string {
  const allIn = a.allIn ? " and is all-in" : "";
  switch (a.type) {
    case "post_sb":
      return `posts the small blind ${format(a.added)}${allIn}`;
    case "post_bb":
      return `posts the big blind ${format(a.added)}${allIn}`;
    case "fold":
      return "folds";
    case "check":
      return "checks";
    case "call":
      return `calls ${format(a.added)}${allIn}`;
    case "bet":
      return `bets ${format(a.streetBet)}${allIn}`;
    case "raise":
      return `raises to ${format(a.streetBet)}${allIn}`;
  }
}

const RANK_WORDS: Record<number, [string, string]> = {
  2: ["Two", "Twos"], 3: ["Three", "Threes"], 4: ["Four", "Fours"], 5: ["Five", "Fives"],
  6: ["Six", "Sixes"], 7: ["Seven", "Sevens"], 8: ["Eight", "Eights"], 9: ["Nine", "Nines"],
  10: ["Ten", "Tens"], 11: ["Jack", "Jacks"], 12: ["Queen", "Queens"], 13: ["King", "Kings"], 14: ["Ace", "Aces"],
};

/**
 * What a player currently holds, in words: "Pair of Aces", "Three of a Kind,
 * Sevens", "Flush, King high". Before the flop only the two hole cards count.
 */
export function currentHandName(hole: readonly Card[], board: readonly Card[]): string | null {
  if (hole.length !== 2) return null;
  if (board.length >= 3) return evaluateHand([...hole, ...board]).name;
  const [a, b] = hole.map(rankValue).sort((x, y) => y - x);
  return a === b ? `Pair of ${RANK_WORDS[a][1]}` : `High Card, ${RANK_WORDS[a][0]}`;
}
