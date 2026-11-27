import { describe, expect, it } from "vitest";
import type { Card } from "@/lib/poker/cards";
import { act, deal, handTotal, legalActions, newShoe, toView, totalPayout, totalStaked, type BjState } from "./blackjack";
import { MemoryStore } from "./memory-store";
import { WHEEL_ORDER, colourOf, combineBets, covers, settleSpin, type RouletteBet } from "./roulette";
import { blackjackAction, blackjackStatus, rouletteSpin } from "./service";

/** A shoe that deals these cards in this order (player, dealer, player, dealer, then draws). */
const rigged = (...cards: string[]) => [...(cards as Card[])].reverse();
const seq = (values: number[]) => {
  let i = 0;
  return (max: number) => values[i++ % values.length] % max;
};

describe("blackjack totals", () => {
  it.each([
    [["As", "Kd"], 21, true],
    [["As", "As"], 12, true],
    [["As", "As", "9c"], 21, true],
    [["Ts", "6d", "As"], 17, false],
    [["5s", "Ah"], 16, true],
    [["Ks", "Qd", "2c"], 22, false],
  ] as [Card[], number, boolean][])("%j totals %i (soft %s)", (cards, total, soft) => {
    expect(handTotal(cards)).toEqual({ total, soft });
  });

  it("a fresh shoe is 6 full decks", () => {
    const shoe = newShoe(seq([3, 17, 41]));
    expect(shoe).toHaveLength(312);
    expect(new Set(shoe).size).toBe(52);
  });
});

describe("blackjack rounds", () => {
  it("a natural pays 3 to 2 at once, rounded down", () => {
    const s = deal(15, rigged("As", "9d", "Kh", "7c"));
    expect(s.phase).toBe("settled");
    expect(s.hands[0].outcome).toBe("blackjack");
    expect(totalPayout(s)).toBe(15 + 22);
    expect(s.dealer).toHaveLength(2); // the dealer does not draw against a natural
  });

  it("dealer blackjack beats everything but a natural, and takes only the first bet", () => {
    const lose = deal(100, rigged("Ts", "As", "9h", "Kc"));
    expect(lose.phase).toBe("settled");
    expect(lose.hands[0].outcome).toBe("lose");
    const push = deal(100, rigged("As", "Ad", "Kh", "Kc"));
    expect(push.hands[0].outcome).toBe("push");
    expect(totalPayout(push)).toBe(100);
  });

  it("dealer stands on soft 17 and draws to 16", () => {
    let s = deal(100, rigged("Ts", "As", "8h", "6c"));
    s = act(s, "stand");
    expect(s.dealer).toEqual(["As", "6c"]);
    expect(s.hands[0].outcome).toBe("win");
    expect(totalPayout(s)).toBe(200);

    s = deal(100, rigged("Ts", "Ts", "9h", "6c", "5d"));
    s = act(s, "stand");
    expect(handTotal(s.dealer).total).toBe(21);
    expect(s.hands[0].outcome).toBe("lose");
  });

  it("busting loses even if the dealer busts later, and the dealer does not draw", () => {
    let s = deal(50, rigged("Ts", "Ts", "6h", "6c", "Kd"));
    s = act(s, "hit");
    expect(s.hands[0].outcome).toBe("bust");
    expect(s.dealer).toHaveLength(2);
    expect(totalPayout(s)).toBe(0);
  });

  it("doubling doubles the bet, takes exactly one card and ends the hand", () => {
    let s = deal(100, rigged("6s", "Ts", "5h", "7c", "Td", "4c"));
    expect(legalActions(s)).toContain("double");
    s = act(s, "double");
    expect(s.hands[0].cards).toHaveLength(3);
    expect(s.hands[0].bet).toBe(200);
    expect(totalStaked(s)).toBe(200);
    expect(handTotal(s.hands[0].cards).total).toBe(21); // 6 + 5 + 10
    expect(s.dealer).toEqual(["Ts", "7c"]); // dealer stands on 17
    expect(s.hands[0].outcome).toBe("win");
    expect(totalPayout(s)).toBe(400);
  });

  it("splits into two hands; 21 after a split is not a blackjack; split aces get one card", () => {
    let s = deal(100, rigged("8s", "Ts", "8h", "7c", "3d", "Kc"));
    expect(legalActions(s)).toContain("split");
    s = act(s, "split");
    expect(s.hands).toHaveLength(2);
    expect(s.hands.map((h) => h.cards)).toEqual([["8s", "3d"], ["8h", "Kc"]]);
    expect(totalStaked(s)).toBe(200);
    s = act(s, "stand");
    expect(s.active).toBe(1);
    s = act(s, "stand");
    expect(s.phase).toBe("settled");

    let a = deal(100, rigged("As", "9s", "Ah", "8c", "Kd", "Qc"));
    a = act(a, "split");
    expect(a.phase).toBe("settled");
    expect(a.hands.every((h) => h.cards.length === 2)).toBe(true);
    expect(a.hands.map((h) => h.outcome)).toEqual(["win", "win"]); // 21 v 17, paid 1 to 1
    expect(totalPayout(a)).toBe(400);
  });

  it("allows at most 4 hands", () => {
    let s = deal(10, rigged("8s", "Ts", "8h", "7c", "8d", "8c", "8s", "2c", "2d", "2h", "2s"));
    s = act(s, "split");
    s = act(s, "split");
    s = act(s, "split");
    expect(s.hands).toHaveLength(4);
    expect(legalActions(s)).not.toContain("split");
  });

  it("refuses moves that are not allowed", () => {
    const s = deal(100, rigged("8s", "Ts", "9h", "7c", "2d"));
    expect(() => act(s, "split")).toThrow();
    const done = act(s, "stand");
    expect(() => act(done, "hit")).toThrow();
  });

  it("the player never sees the shoe or the hole card before the end", () => {
    const s = deal(100, rigged("8s", "Ts", "9h", "7c"));
    const view = toView(s);
    expect(view.dealer).toEqual(["Ts", null]);
    expect(view.dealerTotal).toBeNull();
    expect(JSON.stringify(view)).not.toContain("7c");
    expect(view).not.toHaveProperty("shoe");
    const end = toView(act(s, "stand"));
    expect(end.dealer).toEqual(["Ts", "7c"]);
  });

  it("over many random rounds, chips paid never exceed 2.5x the stake of any hand", () => {
    const rnd = (max: number) => Math.floor(Math.random() * max);
    for (let i = 0; i < 2000; i++) {
      let s: BjState = deal(100, newShoe(rnd));
      while (s.phase === "player") {
        const actions = legalActions(s);
        s = act(s, actions[rnd(actions.length)]);
      }
      for (const h of s.hands) expect(h.payout!).toBeLessThanOrEqual(h.bet * 2.5);
      expect(s.hands.every((h) => h.outcome)).toBe(true);
    }
  });
});

describe("roulette", () => {
  it("has 37 pockets, each once, with 18 red and 18 black", () => {
    expect([...WHEEL_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: 37 }, (_, i) => i));
    const colours = WHEEL_ORDER.map(colourOf);
    expect(colours.filter((c) => c === "red")).toHaveLength(18);
    expect(colours.filter((c) => c === "black")).toHaveLength(18);
    // Colours alternate around the wheel after zero.
    for (let i = 1; i < 36; i++) expect(colours[i]).not.toBe(colours[i + 1]);
  });

  it("pays 35 to 1, 2 to 1 and 1 to 1, and zero loses every outside bet", () => {
    const bets: RouletteBet[] = [
      { type: "number", n: 17, amount: 10 },
      { type: "black", amount: 20 },
      { type: "dozen", n: 2, amount: 30 },
      { type: "column", n: 2, amount: 40 },
      { type: "odd", amount: 50 },
      { type: "low", amount: 60 },
    ];
    const r = settleSpin(bets, 17);
    expect(r.bets.map((b) => b.payout)).toEqual([360, 40, 90, 120, 100, 120]);
    expect(r.staked).toBe(210);
    expect(r.payout).toBe(830);
    const zero = settleSpin(bets, 0);
    expect(zero.payout).toBe(0);
    expect(settleSpin([{ type: "number", n: 0, amount: 10 }], 0).payout).toBe(360);
  });

  it("covers the right numbers", () => {
    const count = (spot: Parameters<typeof covers>[0]) => Array.from({ length: 37 }, (_, n) => n).filter((n) => covers(spot, n));
    expect(count({ type: "dozen", n: 3 })).toEqual(Array.from({ length: 12 }, (_, i) => 25 + i));
    expect(count({ type: "column", n: 1 })).toEqual([1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]);
    expect(count({ type: "high" })).toHaveLength(18);
    expect(count({ type: "even" })).toHaveLength(18);
  });

  it("merges bets on the same spot", () => {
    expect(combineBets([{ type: "red", amount: 10 }, { type: "number", n: 5, amount: 25 }, { type: "red", amount: 25 }])).toEqual([
      { type: "red", amount: 35 },
      { type: "number", n: 5, amount: 25 },
    ]);
  });
});

describe("casino service (shared balance)", () => {
  const fresh = (chips = 1000) => {
    const store = new MemoryStore();
    store.balances.set("u", chips);
    return store;
  };

  it("takes the bet when dealing and pays the result into the same balance", async () => {
    const store = fresh();
    // seq makes the shoe deterministic; play until settled with stands.
    let res = await blackjackAction(store, "u", { action: "deal", bet: 100 }, seq([5, 9, 2, 33, 7]));
    while (res.round!.phase === "player") {
      res = await blackjackAction(store, "u", { action: "stand", version: res.round!.version }, seq([1]));
    }
    expect(res.balance).toBe(1000 - 100 + res.round!.payout);
    expect(store.ledger.reduce((a, l) => a + l.amount, 0)).toBe(res.balance - 1000);
    expect((await blackjackStatus(store, "u")).round).toBeNull();
  });

  it("an unfinished hand is still there when the player comes back", async () => {
    const store = fresh();
    for (let i = 0; i < 50; i++) {
      const res = await blackjackAction(store, "u", { action: "deal", bet: 10 }, seq([i, i * 7 + 3]));
      if (res.round!.phase === "player") {
        const again = await blackjackStatus(store, "u");
        expect(again.round).toEqual(res.round);
        await expect(blackjackAction(store, "u", { action: "deal", bet: 10 }, seq([1]))).rejects.toThrow(/Finish the hand/);
        return;
      }
    }
    throw new Error("never dealt an unfinished hand");
  });

  it("enforces bet limits, the balance, and stale requests", async () => {
    const store = fresh(50);
    await expect(blackjackAction(store, "u", { action: "deal", bet: 5 }, seq([1]))).rejects.toThrow(/between 10 and 5,000/);
    await expect(blackjackAction(store, "u", { action: "deal", bet: 5001 }, seq([1]))).rejects.toThrow(/between/);
    await expect(blackjackAction(store, "u", { action: "deal", bet: 100 }, seq([1]))).rejects.toThrow(/enough chips/);
    expect(await store.balance("u")).toBe(50);
    await expect(blackjackAction(store, "u", { action: "hit", version: 0 }, seq([1]))).rejects.toThrow(/no hand in play/);
  });

  it("doubling takes the extra stake from the balance", async () => {
    const store = fresh();
    for (let i = 0; i < 200; i++) {
      const res = await blackjackAction(store, "u", { action: "deal", bet: 100 }, seq([i * 13 + 1, i * 5 + 2]));
      if (res.round!.phase !== "player") continue;
      const before = res.balance;
      const after = await blackjackAction(store, "u", { action: "double", version: res.round!.version }, seq([1]));
      expect(after.round!.phase).toBe("settled");
      expect(after.round!.staked).toBe(200);
      expect(after.balance).toBe(before - 100 + after.round!.payout);
      return;
    }
    throw new Error("never dealt a hand that could double");
  });

  it("a roulette spin takes the stake and pays the win in one go", async () => {
    const store = fresh();
    const res = await rouletteSpin(store, "u", { bets: [{ type: "number", n: 7, amount: 10 }, { type: "red", amount: 20 }] }, () => 7);
    expect(res.result.number).toBe(7);
    expect(res.result.payout).toBe(360 + 40);
    expect(res.balance).toBe(1000 - 30 + 400);
    await expect(rouletteSpin(store, "u", { bets: [{ type: "red", amount: 9 }] }, () => 1)).rejects.toThrow(/between/);
    await expect(
      rouletteSpin(store, "u", { bets: [{ type: "red", amount: 3000 }, { type: "black", amount: 2001 }] }, () => 1),
    ).rejects.toThrow(/between/);
  });
});
