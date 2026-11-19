import { describe, expect, it } from "vitest";
import { botName, botStyles, dealStyles, decideBotAction, estimateEquity, styleForBot } from "../bots";
import { applyAction, getLegalActions, nextDealerSeat, startHand, toPlayerView, type HandState } from "../engine";
import { cards, seededRandomInt } from "./helpers";

const rng = seededRandomInt(9);
const rnd = () => rng(1_000_000) / 1_000_000;

describe("bot names and styles", () => {
  it("are called Prefect #1, #2, ... and each has its own style", () => {
    expect(botName(1)).toBe("Prefect #1");
    expect(botName(8)).toBe("Prefect #8");
    const keys = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => styleForBot(n).key);
    expect(new Set(keys).size).toBe(8);
    expect(botStyles).toHaveLength(8);
  });
});

describe("dealing personalities", () => {
  it("never gives two bots in one game the same style", () => {
    for (let n = 1; n <= 8; n++) {
      for (let g = 0; g < 50; g++) expect(new Set(dealStyles(n, rng).map((s) => s.key)).size).toBe(n);
    }
  });
  it("any style can turn up even with only three bots", () => {
    const seen = new Map<string, number>();
    for (let g = 0; g < 4000; g++) for (const s of dealStyles(3, rng)) seen.set(s.key, (seen.get(s.key) ?? 0) + 1);
    expect(seen.size).toBe(8);
    // Each style should land in about 3/8 of games.
    for (const count of seen.values()) expect(Math.abs(count / 4000 - 3 / 8)).toBeLessThan(0.04);
    expect(seen.get("bluffer")).toBeGreaterThan(0);
  });
});

describe("equity estimate", () => {
  it("knows aces are strong and 7-2 offsuit is weak", () => {
    expect(estimateEquity(cards("As Ah"), [], 1, 2000, rnd)).toBeGreaterThan(0.8);
    expect(estimateEquity(cards("7c 2d"), [], 1, 2000, rnd)).toBeLessThan(0.4);
  });
  it("knows a made royal flush cannot lose", () => {
    expect(estimateEquity(cards("As Ks"), cards("Qs Js Ts 2c 3d"), 3, 300, rnd)).toBe(1);
  });
});

/** Plays one hand where every seat is a bot. */
function playBotHand(state: HandState, difficulty: Record<number, number>, randomInt = rng) {
  let s = state;
  let steps = 0;
  while (!s.result) {
    const seat = s.toActSeat!;
    const view = toPlayerView(s, seat);
    // A bot is only ever given its own cards.
    expect(view.players.filter((p) => p.holeCards !== null).map((p) => p.seat)).toEqual([seat]);
    const action = decideBotAction(view, seat, styleForBot(seat + 1), difficulty[seat], randomInt);
    s = applyAction(s, seat, action); // throws if the action were illegal
    expect(++steps).toBeLessThan(200);
  }
  return s;
}

describe("bots at the table", () => {
  it("every style at every difficulty only ever makes legal moves", () => {
    for (let difficulty = 0; difficulty <= 10; difficulty++) {
      for (let h = 0; h < 6; h++) {
        const players = botStyles.map((_, seat) => ({ seat, id: `b${seat}`, stack: 300 + ((seat * 137 + h * 53) % 1700) }));
        const start = startHand({ smallBlind: 10, bigBlind: 20, dealerSeat: h % 8, players, randomInt: rng });
        const end = playBotHand(start, Object.fromEntries(players.map((p) => [p.seat, difficulty])));
        expect(end.players.reduce((a, p) => a + p.stack, 0)).toBe(players.reduce((a, p) => a + p.stack, 0));
      }
    }
  });

  it("a difficulty 10 bot beats a difficulty 0 bot over many hands", () => {
    // Heads-up, same style, alternating the button; only the difficulty differs.
    let net = 0;
    for (let h = 0; h < 300; h++) {
      const s = startHand({
        smallBlind: 10,
        bigBlind: 20,
        dealerSeat: nextDealerSeat([0, 1], h % 2 === 0 ? 1 : 0),
        players: [
          { seat: 0, id: "strong", stack: 2000 },
          { seat: 1, id: "weak", stack: 2000 },
        ],
        randomInt: rng,
      });
      const end = playBotHand(s, { 0: 10, 1: 0 });
      net += end.result!.net[0];
    }
    expect(net).toBeGreaterThan(0);
  }, 60_000);

  it("never acts when it is not its turn", () => {
    const s = startHand({ smallBlind: 10, bigBlind: 20, dealerSeat: 0, randomInt: rng, players: [{ seat: 0, id: "a", stack: 500 }, { seat: 1, id: "b", stack: 500 }, { seat: 2, id: "c", stack: 500 }] });
    const notTurn = [0, 1, 2].find((x) => x !== s.toActSeat)!;
    expect(getLegalActions(s, notTurn).canFold).toBe(false);
    expect(() => decideBotAction(toPlayerView(s, notTurn), notTurn, botStyles[0], 5, rng)).toThrow();
  });
});

describe("personalities really differ", () => {
  it("the Maniac raises most, the Rock folds most, the Calling Station calls most", () => {
    const counts: Record<string, { fold: number; call: number; raise: number; total: number }> = {};
    const r = seededRandomInt(77);
    for (let h = 0; h < 400; h++) {
      const players = [0, 1, 2, 3, 4, 5].map((seat) => ({ seat, id: `b${seat}`, stack: 2000 }));
      let s = startHand({ smallBlind: 10, bigBlind: 20, dealerSeat: h % 6, players, randomInt: r });
      while (!s.result) {
        const seat = s.toActSeat!;
        const style = botStyles[seat]; // shark, maniac, rock, station, trapper, bluffer
        const a = decideBotAction(toPlayerView(s, seat), seat, style, 7, r);
        const c = (counts[style.key] ??= { fold: 0, call: 0, raise: 0, total: 0 });
        c.total++;
        if (a.type === "fold") c.fold++;
        else if (a.type === "call") c.call++;
        else if (a.type === "bet" || a.type === "raise" || a.type === "allin") c.raise++;
        s = applyAction(s, seat, a);
      }
    }
    const rate = (k: string, f: "fold" | "call" | "raise") => counts[k][f] / counts[k].total;
    const keys = Object.keys(counts);
    const top = (f: "fold" | "call" | "raise") => keys.reduce((a, b) => (rate(a, f) >= rate(b, f) ? a : b));
    console.log(Object.fromEntries(keys.map((k) => [k, `fold ${rate(k, "fold").toFixed(2)} call ${rate(k, "call").toFixed(2)} raise ${rate(k, "raise").toFixed(2)}`])));
    expect(top("raise")).toBe("maniac");
    expect(top("fold")).toBe("rock");
    expect(top("call")).toBe("station");
  }, 60_000);
});
