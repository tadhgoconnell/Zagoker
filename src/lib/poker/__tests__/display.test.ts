import { describe, expect, it } from "vitest";
import { currentHandName } from "../display";
import { cards } from "./helpers";

describe("the player's current hand, in words", () => {
  it("before the flop: a pair or the high card", () => {
    expect(currentHandName(cards("Ah Ad"), [])).toBe("Pair of Aces");
    expect(currentHandName(cards("7c Kd"), [])).toBe("High Card, King");
    expect(currentHandName(cards("2c 2d"), [])).toBe("Pair of Twos");
  });
  it("after the flop, turn and river: the best five cards", () => {
    expect(currentHandName(cards("7h 7d"), cards("7s Kc 2d"))).toBe("Three of a Kind, Sevens");
    expect(currentHandName(cards("Ah 2h"), cards("Kh 9h 4h 3c"))).toBe("Flush, Ace high");
    expect(currentHandName(cards("Qs Jd"), cards("Ts 9c 8h 2d 2s"))).toBe("Straight, Queen high");
    expect(currentHandName(cards("5c 6d"), cards("As Ks Qs Js Ts"))).toBe("Royal Flush");
  });
  it("nothing without two hole cards", () => {
    expect(currentHandName([], [])).toBeNull();
  });
});
