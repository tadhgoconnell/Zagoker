import type { Rank, Suit } from "@/components/cards/playing-card";
import type { ActionRecord } from "./engine";
import type { Card } from "./cards";

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
