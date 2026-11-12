import { describe, expect, it } from "vitest";
import { buildPots, splitPot, uncalledBet } from "../pots";

const c = (seat: number, amount: number, folded = false) => ({ seat, amount, folded });

describe("buildPots", () => {
  it("makes a single pot when everyone put in the same", () => {
    expect(buildPots([c(0, 100), c(1, 100), c(2, 100)])).toEqual([
      { amount: 300, eligibleSeats: [0, 1, 2] },
    ]);
  });

  it("makes a side pot when one player is all-in for less", () => {
    expect(buildPots([c(0, 300), c(1, 100), c(2, 300)])).toEqual([
      { amount: 300, eligibleSeats: [0, 1, 2] },
      { amount: 400, eligibleSeats: [0, 2] },
    ]);
  });

  it("makes several side pots for several all-in amounts", () => {
    expect(buildPots([c(0, 50), c(1, 200), c(2, 500), c(3, 500)])).toEqual([
      { amount: 200, eligibleSeats: [0, 1, 2, 3] },
      { amount: 450, eligibleSeats: [1, 2, 3] },
      { amount: 600, eligibleSeats: [2, 3] },
    ]);
  });

  it("includes folded players' chips but never lets them win", () => {
    expect(buildPots([c(0, 300), c(1, 100), c(2, 300), c(3, 150, true)])).toEqual([
      { amount: 400, eligibleSeats: [0, 1, 2] },
      { amount: 450, eligibleSeats: [0, 2] },
    ]);
  });

  it("folded money above every live level goes into the last pot", () => {
    expect(buildPots([c(0, 100), c(1, 100), c(2, 250, true)])).toEqual([
      { amount: 450, eligibleSeats: [0, 1] },
    ]);
  });

  it("always accounts for every chip", () => {
    const sets = [
      [c(0, 1), c(1, 2), c(2, 3), c(3, 4)],
      [c(0, 700, true), c(1, 20), c(2, 20, true), c(3, 990), c(4, 990)],
      [c(0, 5), c(1, 5, true), c(2, 5, true)],
    ];
    for (const set of sets) {
      const total = set.reduce((s, x) => s + x.amount, 0);
      expect(buildPots(set).reduce((s, p) => s + p.amount, 0)).toBe(total);
    }
  });
});

describe("uncalledBet", () => {
  it("returns the part of the biggest bet nobody matched", () => {
    expect(uncalledBet([c(0, 1000), c(1, 200)])).toEqual({ seat: 0, amount: 800 });
    expect(uncalledBet([c(0, 500), c(1, 100, true), c(2, 50, true)])).toEqual({ seat: 0, amount: 400 });
  });
  it("returns nothing when the top bet was matched", () => {
    expect(uncalledBet([c(0, 300), c(1, 300), c(2, 100)])).toBeNull();
  });
});

describe("splitPot", () => {
  it("gives a sole winner everything", () => {
    expect([...splitPot(901, [4], [1, 2, 3, 4])]).toEqual([[4, 901]]);
  });
  it("splits evenly", () => {
    expect(Object.fromEntries(splitPot(900, [1, 3], [1, 2, 3]))).toEqual({ 1: 450, 3: 450 });
  });
  it("gives odd chips to winners nearest the left of the button", () => {
    expect(Object.fromEntries(splitPot(125, [0, 2], [1, 2, 0]))).toEqual({ 2: 63, 0: 62 });
    expect(Object.fromEntries(splitPot(101, [0, 1, 2], [2, 0, 1]))).toEqual({ 2: 34, 0: 34, 1: 33 });
  });
  it("never creates or loses chips", () => {
    for (let amount = 1; amount < 200; amount++) {
      for (const winners of [[0], [0, 1], [0, 1, 2], [0, 1, 2, 3]]) {
        const total = [...splitPot(amount, winners, [3, 2, 1, 0]).values()].reduce((a, b) => a + b, 0);
        expect(total).toBe(amount);
      }
    }
  });
});
