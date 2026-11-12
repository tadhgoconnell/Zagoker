import { describe, expect, it, vi } from "vitest";
import { createDeck, createShuffledDeck, isCard, rankValue, shuffle } from "../cards";
import { seededRandomInt } from "./helpers";

// The secure source is marked server-only; that guard is a no-op under test.
vi.mock("server-only", () => ({}));

describe("deck", () => {
  it("has 52 unique, valid cards", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck).size).toBe(52);
    expect(deck.every(isCard)).toBe(true);
  });

  it("ranks run from 2 to ace high", () => {
    expect(rankValue("2c")).toBe(2);
    expect(rankValue("Td")).toBe(10);
    expect(rankValue("As")).toBe(14);
  });

  it("rejects things that are not cards", () => {
    for (const bad of ["", "A", "1s", "Ax", "10s", 5, null]) expect(isCard(bad)).toBe(false);
  });
});

describe("shuffle", () => {
  it("keeps exactly the same 52 cards", () => {
    const shuffled = createShuffledDeck(seededRandomInt(42));
    expect(shuffled.slice().sort()).toEqual(createDeck().sort());
    expect(shuffled).not.toEqual(createDeck());
  });

  it("does not modify its input", () => {
    const deck = createDeck();
    shuffle(deck, seededRandomInt(7));
    expect(deck).toEqual(createDeck());
  });

  it("is deterministic for a given random sequence", () => {
    expect(createShuffledDeck(seededRandomInt(99))).toEqual(createShuffledDeck(seededRandomInt(99)));
    expect(createShuffledDeck(seededRandomInt(99))).not.toEqual(createShuffledDeck(seededRandomInt(100)));
  });

  it("refuses a random source that returns out-of-range values", () => {
    expect(() => shuffle([1, 2, 3], () => 5)).toThrow();
    expect(() => shuffle([1, 2, 3], () => 0.5)).toThrow();
    expect(() => shuffle([1, 2, 3], () => -1)).toThrow();
  });

  it("puts each item in each position about equally often", () => {
    const rng = seededRandomInt(2024);
    const n = 6;
    const runs = 60_000;
    const counts = Array.from({ length: n }, () => Array<number>(n).fill(0));
    for (let i = 0; i < runs; i++) {
      shuffle([0, 1, 2, 3, 4, 5], rng).forEach((item, pos) => counts[item][pos]++);
    }
    const expected = runs / n;
    for (const row of counts) {
      for (const c of row) expect(Math.abs(c - expected) / expected).toBeLessThan(0.05);
    }
  });
});

describe("secure random source", () => {
  it("returns integers inside the requested range", async () => {
    const { secureRandomInt } = await import("../secure-random");
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = secureRandomInt(52);
      expect(Number.isInteger(v) && v >= 0 && v < 52).toBe(true);
      seen.add(v);
    }
    expect(seen.size).toBe(52);
  });
});
