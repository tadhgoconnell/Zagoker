import { describe, expect, it } from "vitest";
import { createDeck, rankValue, shuffle, suitOf, type Card } from "../cards";
import { compareHands, evaluateHand, HandCategory } from "../evaluator";
import { cards, seededRandomInt } from "./helpers";

const ev = (text: string) => evaluateHand(cards(text));
const beats = (a: string, b: string) => expect(compareHands(ev(a), ev(b))).toBeGreaterThan(0);
const ties = (a: string, b: string) => expect(compareHands(ev(a), ev(b))).toBe(0);

describe("hand categories", () => {
  const cases: [string, HandCategory, string][] = [
    ["As Ks Qs Js Ts", HandCategory.StraightFlush, "Royal Flush"],
    ["9h 8h 7h 6h 5h", HandCategory.StraightFlush, "Straight Flush, Nine high"],
    ["5d 4d 3d 2d Ad", HandCategory.StraightFlush, "Straight Flush, Five high"],
    ["Kc Kd Kh Ks 3c", HandCategory.FourOfAKind, "Four of a Kind, Kings"],
    ["Kc Kd Kh 7s 7c", HandCategory.FullHouse, "Full House, Kings full of Sevens"],
    ["Ac Jc 8c 4c 2c", HandCategory.Flush, "Flush, Ace high"],
    ["9c 8d 7h 6s 5c", HandCategory.Straight, "Straight, Nine high"],
    ["Ac 2d 3h 4s 5c", HandCategory.Straight, "Straight, Five high"],
    ["Ac Kd Qh Js Tc", HandCategory.Straight, "Straight, Ace high"],
    ["Qc Qd Qh 9s 2c", HandCategory.ThreeOfAKind, "Three of a Kind, Queens"],
    ["Jc Jd 4h 4s Ac", HandCategory.TwoPair, "Two Pair, Jacks and Fours"],
    ["Tc Td Ah 8s 3c", HandCategory.Pair, "Pair of Tens"],
    ["Ac Jd 8h 6s 2c", HandCategory.HighCard, "High Card, Ace"],
  ];
  for (const [hand, category, name] of cases) {
    it(`${hand} is ${name}`, () => {
      const result = ev(hand);
      expect(result.category).toBe(category);
      expect(result.name).toBe(name);
      expect(result.cards).toHaveLength(5);
    });
  }

  it("ranks every category above the one below it", () => {
    const ordered = [
      "Ac Jd 8h 6s 2c", // high card
      "2c 2d 5h 4s 3c".replace("3c", "7c"), // lowest-ish pair
      "3c 3d 2h 2s 4c", // two pair
      "2c 2d 2h 4s 3c", // trips
      "Ac 2d 3h 4s 5c", // wheel straight
      "7c 5c 4c 3c 2c", // flush
      "2c 2d 2h 3s 3c", // full house
      "2c 2d 2h 2s 3c", // quads
      "5d 4d 3d 2d Ad", // straight flush
    ];
    for (let i = 1; i < ordered.length; i++) beats(ordered[i], ordered[i - 1]);
  });
});

describe("comparing hands in the same category", () => {
  it("higher straight flush wins", () => beats("Ts 9s 8s 7s 6s", "9h 8h 7h 6h 5h"));
  it("higher quads win, then the kicker", () => {
    beats("Ac Ad Ah As 2c", "Kc Kd Kh Ks Qc");
    beats("9c 9d 9h 9s Ac", "9c 9d 9h 9s Kc");
  });
  it("full house compares trips first, then the pair", () => {
    beats("Qc Qd Qh 2s 2c", "Jc Jd Jh As Ac");
    beats("Qc Qd Qh 5s 5c", "Qc Qd Qh 4s 4c");
  });
  it("flush compares card by card", () => {
    beats("Ac Jc 8c 4c 3c", "Ad Jd 8d 4d 2d");
    beats("Kc Qc 8c 4c 3c", "Kd Jd Td 9d 7d");
  });
  it("six-high straight beats the wheel", () => beats("6c 5d 4h 3s 2c", "5c 4d 3h 2s Ac"));
  it("trips compare by rank, then kickers", () => {
    beats("8c 8d 8h 3s 2c", "7c 7d 7h As Kc");
    beats("8c 8d 8h As 2c", "8c 8d 8h Ks Qc");
    beats("8c 8d 8h As 3c", "8c 8d 8h As 2c");
  });
  it("two pair compares high pair, low pair, then kicker", () => {
    beats("Ac Ad 2h 2s 3c", "Kc Kd Qh Qs Jc");
    beats("Kc Kd Qh Qs 2c", "Kc Kd Jh Js Ac");
    beats("Kc Kd Qh Qs Ac", "Kc Kd Qh Qs Jc");
  });
  it("pair compares pair rank, then three kickers", () => {
    beats("9c 9d 2h 3s 4c", "8c 8d Ah Ks Qc");
    beats("9c 9d Ah 3s 2c", "9c 9d Kh Qs Jc");
    beats("9c 9d Ah Ks 3c", "9c 9d Ah Qs Jc");
    beats("9c 9d Ah Ks 4c", "9c 9d Ah Ks 3c");
  });
  it("high card compares all five cards", () => {
    beats("Ac Jd 8h 6s 3c", "Ac Jd 8h 6s 2c");
    beats("Ac Qd 3h 4s 2c", "Ac Jd Th 9s 7c");
  });
});

describe("ties", () => {
  it("identical ranks in different suits tie exactly", () => {
    ties("Ac Kd Qh Js 9c", "Ad Kh Qs Jc 9d");
    ties("Ac Ad Kh Ks Qc", "Ah As Kc Kd Qd");
    ties("9c 8d 7h 6s 5c", "9d 8h 7s 6c 5d");
    ties("Ac Jc 8c 4c 2c", "Ad Jd 8d 4d 2d");
  });
  it("suits never break a tie", () => ties("As Ks Qs Js Ts", "Ah Kh Qh Jh Th"));
  it("a sixth card does not break a tie when the board plays", () => {
    // Board is a broadway straight; hole cards are irrelevant.
    ties("Ac Kd Qh Js Tc 2d 3d", "Ac Kd Qh Js Tc 9h 9s");
  });
  it("kicker decides when both share a pair on the board", () => {
    beats("Kc Kd 7h 4s 2c As 9d", "Kc Kd 7h 4s 2c Qs Jd");
  });
  it("kicker is counterfeited when the board has better cards", () => {
    // Both play K K A Q J from the board plus one king... the fifth card is the board's.
    ties("Kc Kd Ah Qs Jc 3s 2d", "Kc Kd Ah Qs Jc 5s 4d");
  });
});

describe("seven-card hands", () => {
  it("finds the best five of seven", () => {
    expect(ev("Ac Kc 2d 7c 9c Jc 2h").name).toBe("Flush, Ace high");
    expect(ev("Ac Kc 2d 7c 9c Jc 2h").cards).toEqual(cards("Ac Kc Jc 9c 7c"));
  });
  it("uses the top five of a six-card flush", () => {
    expect(ev("2c 4c 6c 8c Tc Qc Ad").score).toEqual([HandCategory.Flush, 12, 10, 8, 6, 4]);
  });
  it("two sets of trips make a full house, higher trips on top", () => {
    const h = ev("7c 7d 7h Ks Kc Kd 2s");
    expect(h.name).toBe("Full House, Kings full of Sevens");
  });
  it("trips plus two pairs uses the higher pair", () => {
    expect(ev("7c 7d 7h Ks Kc 3d 3s").name).toBe("Full House, Sevens full of Kings");
  });
  it("three pairs make the best two pair with the best kicker", () => {
    const h = ev("Ac Ad Kh Ks 3c 3d Qs");
    expect(h.score).toEqual([HandCategory.TwoPair, 14, 13, 12]);
  });
  it("picks the highest straight from six in a row", () => {
    expect(ev("4c 5d 6h 7s 8c 9d Kh").name).toBe("Straight, Nine high");
  });
  it("prefers a straight flush over a higher plain straight or flush", () => {
    // Hearts 5-9 is a straight flush; the ten of clubs makes a higher plain straight.
    expect(ev("5h 6h 7h 8h 9h Tc Ah").name).toBe("Straight Flush, Nine high");
  });
  it("a flush and a straight in different cards is just a flush", () => {
    expect(ev("2h 5h 9h Jh Kh Qc Td").category).toBe(HandCategory.Flush);
  });
  it("quads use the best kicker of the remaining three", () => {
    expect(ev("9c 9d 9h 9s 2c Kd 5h").score).toEqual([HandCategory.FourOfAKind, 9, 13]);
  });
  it("ace plays low only in the wheel", () => {
    expect(ev("Ac 2d 3h 4s 9c Kd Qh").category).toBe(HandCategory.HighCard);
    expect(ev("Qc Kd Ah 2s 3c 8d 9h").category).toBe(HandCategory.HighCard);
  });
});

describe("input validation", () => {
  it("rejects too few or too many cards", () => {
    expect(() => ev("Ac Kc Qc Jc")).toThrow();
    expect(() => ev("Ac Kc Qc Jc Tc 9c 8c 7c")).toThrow();
  });
  it("rejects duplicate cards", () => expect(() => ev("Ac Ac Qc Jc Tc")).toThrow());
});

/**
 * Independent reference: a deliberately simple five-card evaluator, applied to
 * all 21 five-card subsets of seven cards. The production evaluator must agree
 * with it on every random deal.
 */
function naiveFive(five: Card[]): number[] {
  const ranks = five.map(rankValue).sort((a, b) => b - a);
  const flush = five.every((c) => suitOf(c) === suitOf(five[0]));
  const uniq = [...new Set(ranks)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0];
    else if (ranks.join() === "14,5,4,3,2") straightHigh = 5;
  }
  const counts = new Map<number, number>();
  ranks.forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1));
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const shape = groups.map((g) => g[1]).join("");
  const byGroup = groups.map((g) => g[0]);
  if (straightHigh && flush) return [8, straightHigh];
  if (shape === "41") return [7, ...byGroup];
  if (shape === "32") return [6, ...byGroup];
  if (flush) return [5, ...ranks];
  if (straightHigh) return [4, straightHigh];
  if (shape === "311") return [3, ...byGroup];
  if (shape === "221") return [2, ...byGroup];
  if (shape === "2111") return [1, ...byGroup];
  return [0, ...ranks];
}

function naiveBest(seven: Card[]): number[] {
  let best: number[] = [-1];
  for (let a = 0; a < 7; a++) {
    for (let b = a + 1; b < 7; b++) {
      const score = naiveFive(seven.filter((_, i) => i !== a && i !== b));
      for (let i = 0; i < Math.max(score.length, best.length); i++) {
        const d = (score[i] ?? 0) - (best[i] ?? 0);
        if (d > 0) best = score;
        if (d !== 0) break;
      }
    }
  }
  return best;
}

describe("cross-check against an independent brute-force evaluator", () => {
  it("agrees on 30,000 random seven-card hands", () => {
    const rng = seededRandomInt(31337);
    const seen = new Set<number>();
    for (let i = 0; i < 30_000; i++) {
      const seven = shuffle(createDeck(), rng).slice(0, 7);
      const fast = evaluateHand(seven);
      expect(fast.score, seven.join(" ")).toEqual(naiveBest(seven));
      // The five reported cards must really be that hand.
      expect(naiveFive(fast.cards), seven.join(" ")).toEqual(fast.score);
      expect(fast.cards.every((c) => seven.includes(c))).toBe(true);
      seen.add(fast.category);
    }
    // Sanity: the sample covered at least high card through full house.
    for (let c = 0; c <= 6; c++) expect(seen.has(c)).toBe(true);
  });
});
