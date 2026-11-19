import { describe, expect, it } from "vitest";
import { createDeck, shuffle } from "../cards";
import { evaluateHand } from "../evaluator";
import { handRankings, SEVEN_CARD_TOTAL } from "../rankings";
import { cards, seededRandomInt } from "./helpers";

const nameOf = (e: ReturnType<typeof evaluateHand>) =>
  e.name === "Royal Flush" ? "Royal Flush" : handRankings[9 - e.category]?.name;

describe("hand rankings page", () => {
  it("lists ten hands, best first, and each example really is that hand", () => {
    expect(handRankings).toHaveLength(10);
    for (const [i, r] of handRankings.entries()) {
      const e = evaluateHand(cards(r.example));
      if (i === 0) expect(e.name).toBe("Royal Flush");
      else expect(e.name.startsWith(r.name === "One Pair" ? "Pair of" : r.name)).toBe(true);
    }
    // Each example beats the next one down.
    for (let i = 0; i + 1 < handRankings.length; i++) {
      const a = evaluateHand(cards(handRankings[i].example)).score;
      const b = evaluateHand(cards(handRankings[i + 1].example)).score;
      expect(a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])).toBe(true);
    }
  });

  it("the seven-card counts add up to every possible combination", () => {
    expect(handRankings.reduce((s, r) => s + r.sevenCardCount, 0)).toBe(SEVEN_CARD_TOTAL);
  });

  it("the stated odds match random deals through the game's own evaluator", () => {
    const rng = seededRandomInt(2025);
    const N = 300_000;
    const seen = new Map<string, number>();
    for (let i = 0; i < N; i++) {
      const e = evaluateHand(shuffle(createDeck(), rng).slice(0, 7));
      const key = nameOf(e) ?? "?";
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    for (const r of handRankings) {
      const expected = r.sevenCardCount / SEVEN_CARD_TOTAL;
      const observed = (seen.get(r.name) ?? 0) / N;
      // Within five standard errors (and an absolute floor for very rare hands).
      const tolerance = Math.max(5 * Math.sqrt((expected * (1 - expected)) / N), 0.0002);
      expect(Math.abs(observed - expected), r.name).toBeLessThan(tolerance);
    }
  }, 120_000);
});
