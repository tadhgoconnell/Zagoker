import { describe, expect, it } from "vitest";
import { chipBet, chipDenominations, chipsFor } from "./bet-chips";

const raise = (type: "bet" | "raise", min: number, max: number) => ({
  canFold: true, canCheck: type === "bet", callAmount: type === "bet" ? 0 : 20, raise: { type, min, max },
});

describe("chip denominations", () => {
  it("start at the small blind and offer five values", () => {
    expect(chipDenominations(10)).toEqual([10, 25, 50, 100, 250]);
    expect(chipDenominations(25)).toEqual([25, 50, 100, 250, 500]);
    expect(chipDenominations(50)).toEqual([50, 100, 250, 500, 1000]);
    expect(chipDenominations(5)).toEqual([5, 10, 25, 50, 100]);
  });
  it("round down to a standard chip for unusual blinds", () => {
    expect(chipDenominations(30)).toEqual([25, 50, 100, 250, 500]);
    expect(chipDenominations(1)).toEqual([1, 5, 10, 25, 50]);
  });
});

describe("splitting an amount into chips", () => {
  it("uses the largest chips first", () => {
    expect(chipsFor(75, [10, 25, 50, 100, 250])).toEqual([50, 25]);
    expect(chipsFor(380, [10, 25, 50, 100, 250])).toEqual([250, 100, 10, 10, 10]);
    expect(chipsFor(40, [10, 25, 50])).toEqual([10, 10, 10, 10]);
    expect(chipsFor(60, [10, 25, 50])).toEqual([50, 10]);
  });
  it("keeps an odd remainder as one chip of that value", () => {
    expect(chipsFor(37, [10, 25, 50])).toEqual([25, 10, 2]);
  });
  it("always adds up exactly, for every amount", () => {
    for (let a = 0; a <= 3000; a += 7) {
      expect(chipsFor(a, [10, 25, 50, 100, 250]).reduce((x, y) => x + y, 0)).toBe(a);
    }
  });
});

describe("what the selected chips mean", () => {
  it("50 + 25 with nothing bet yet is a bet of 75", () => {
    expect(chipBet(75, 0, 1000, raise("bet", 20, 1000))).toEqual({ kind: "bet", target: 75 });
  });
  it("chips go on top of what is already in front of the player", () => {
    // Big blind (20 in) facing a raise to 60: adding 100 raises to 120.
    expect(chipBet(100, 20, 980, raise("raise", 100, 1000))).toEqual({ kind: "raise", target: 120 });
  });
  it("too few chips for a legal raise says how many more are needed", () => {
    expect(chipBet(25, 0, 1000, raise("raise", 40, 1000))).toEqual({ kind: "short", target: 25, min: 40, missing: 15 });
  });
  it("all of the stack is an all-in", () => {
    expect(chipBet(380, 20, 380, raise("raise", 100, 400))).toEqual({ kind: "allin", target: 400 });
  });
  it("nothing selected, or no raise allowed, means no bet", () => {
    expect(chipBet(0, 0, 1000, raise("bet", 20, 1000))).toEqual({ kind: "empty" });
    expect(chipBet(50, 0, 1000, { canFold: true, canCheck: false, callAmount: 20, raise: null })).toEqual({ kind: "empty" });
  });
});
