import { describe, expect, it } from "vitest";
import {
  applyAction,
  getLegalActions,
  getTimeoutAction,
  nextDealerSeat,
  PokerError,
  startHand,
  toPlayerView,
  type HandState,
  type PlayerAction,
} from "../engine";
import { deal, play, rig, seededRandomInt, stackOf, totalChips } from "./helpers";

function expectError(fn: () => unknown, code: PokerError["code"]) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(PokerError);
    expect((e as PokerError).code).toBe(code);
    return;
  }
  throw new Error(`expected PokerError ${code}, but nothing was thrown`);
}

describe("starting a hand", () => {
  it("posts blinds, deals two cards each and sets the first player to act", () => {
    const s = deal([1000, 1000, 1000, 1000]);
    expect([s.dealerSeat, s.smallBlindSeat, s.bigBlindSeat]).toEqual([0, 1, 2]);
    expect(s.players.map((p) => p.stack)).toEqual([1000, 950, 900, 1000]);
    expect(s.players.map((p) => p.streetBet)).toEqual([0, 50, 100, 0]);
    expect(s.players.every((p) => p.holeCards.length === 2)).toBe(true);
    expect(s.deck).toHaveLength(52 - 8);
    const all = [...s.deck, ...s.players.flatMap((p) => p.holeCards)];
    expect(new Set(all).size).toBe(52);
    expect(s.toActSeat).toBe(3); // left of the big blind
    expect(s.currentBet).toBe(100);
    expect(s.street).toBe("preflop");
  });

  it("heads-up: the button is the small blind and acts first pre-flop", () => {
    const s = deal([1000, 1000]);
    expect([s.dealerSeat, s.smallBlindSeat, s.bigBlindSeat]).toEqual([0, 0, 1]);
    expect(s.toActSeat).toBe(0);
  });

  it("works with gaps between seat numbers and any dealer seat", () => {
    const s = startHand({
      smallBlind: 5, bigBlind: 10, dealerSeat: 7,
      players: [{ seat: 2, id: "a", stack: 500 }, { seat: 7, id: "b", stack: 500 }, { seat: 4, id: "c", stack: 500 }],
      randomInt: seededRandomInt(3),
    });
    expect([s.smallBlindSeat, s.bigBlindSeat, s.toActSeat]).toEqual([2, 4, 7]);
  });

  it("a short stack posts what it has and is all-in", () => {
    const s = deal([1000, 30, 60]);
    const [, sb, bb] = s.players;
    expect([sb.streetBet, sb.stack, sb.allIn]).toEqual([30, 0, true]);
    expect([bb.streetBet, bb.stack, bb.allIn]).toEqual([60, 0, true]);
    expect(s.currentBet).toBe(100); // others still owe a full big blind
  });

  it("is deterministic for the same random sequence", () => {
    expect(deal([500, 500, 500], { seed: 5 })).toEqual(deal([500, 500, 500], { seed: 5 }));
    expect(deal([500, 500, 500], { seed: 5 }).deck).not.toEqual(deal([500, 500, 500], { seed: 6 }).deck);
  });

  it("rejects invalid setups", () => {
    const base = { smallBlind: 50, bigBlind: 100, dealerSeat: 0, randomInt: seededRandomInt(1) };
    const p = (seat: number, stack = 1000, id = `p${seat}`) => ({ seat, id, stack });
    expectError(() => startHand({ ...base, players: [p(0)] }), "invalid_setup");
    expectError(() => startHand({ ...base, players: Array.from({ length: 10 }, (_, i) => p(i)) }), "invalid_setup");
    expectError(() => startHand({ ...base, players: [p(0), p(0, 1000, "x")] }), "invalid_setup");
    expectError(() => startHand({ ...base, players: [p(0), p(1, 1000, "p0")] }), "invalid_setup");
    expectError(() => startHand({ ...base, players: [p(0), p(1, 0)] }), "invalid_setup");
    expectError(() => startHand({ ...base, players: [p(0), p(1, 10.5)] }), "invalid_setup");
    expectError(() => startHand({ ...base, dealerSeat: 5, players: [p(0), p(1)] }), "invalid_setup");
    expectError(() => startHand({ ...base, smallBlind: 0, players: [p(0), p(1)] }), "invalid_setup");
    expectError(() => startHand({ ...base, smallBlind: 200, players: [p(0), p(1)] }), "invalid_setup");
  });
});

describe("dealer rotation", () => {
  it("starts on the lowest seat and moves clockwise", () => {
    expect(nextDealerSeat([0, 1, 2], null)).toBe(0);
    expect(nextDealerSeat([0, 1, 2], 0)).toBe(1);
    expect(nextDealerSeat([0, 1, 2], 2)).toBe(0);
  });
  it("skips empty seats and copes with the old dealer having left", () => {
    expect(nextDealerSeat([1, 4, 8], 4)).toBe(8);
    expect(nextDealerSeat([1, 4, 8], 8)).toBe(1);
    expect(nextDealerSeat([1, 4, 8], 5)).toBe(8);
    expect(nextDealerSeat([3], 3)).toBe(3);
  });
});

describe("turn order", () => {
  it("pre-flop goes clockwise from left of the big blind, ending with the big blind", () => {
    let s = deal([1000, 1000, 1000, 1000]);
    const order: number[] = [];
    while (s.street === "preflop") {
      order.push(s.toActSeat!);
      s = applyAction(s, s.toActSeat!, getLegalActions(s, s.toActSeat!).canCheck ? { type: "check" } : { type: "call" });
    }
    expect(order).toEqual([3, 0, 1, 2]);
  });

  it("post-flop starts left of the button and skips folded players", () => {
    let s = deal([1000, 1000, 1000, 1000]);
    s = play(s, [3, "call"], [0, "call"], [1, "fold"], [2, "check"]);
    expect(s.street).toBe("flop");
    expect(s.board).toHaveLength(3);
    expect(s.toActSeat).toBe(2);
    s = play(s, [2, "check"]);
    expect(s.toActSeat).toBe(3);
    s = play(s, [3, "check"]);
    expect(s.toActSeat).toBe(0);
  });

  it("heads-up post-flop the big blind acts first", () => {
    const s = play(deal([1000, 1000]), [0, "call"], [1, "check"]);
    expect(s.street).toBe("flop");
    expect(s.toActSeat).toBe(1);
  });

  it("the big blind gets the option to raise when everyone just calls", () => {
    const s = play(deal([1000, 1000, 1000]), [0, "call"], [1, "call"]);
    expect(s.street).toBe("preflop");
    expect(s.toActSeat).toBe(2);
    const legal = getLegalActions(s, 2);
    expect(legal.canCheck).toBe(true);
    expect(legal.raise).toEqual({ type: "raise", min: 200, max: 1000 });
  });

  it("a raise sends the action back round to everyone else", () => {
    let s = play(deal([1000, 1000, 1000]), [0, "call"], [1, "call"], [2, "raise", 400]);
    expect(s.toActSeat).toBe(0);
    s = play(s, [0, "call"], [1, "call"]);
    expect(s.street).toBe("flop");
  });
});

describe("streets", () => {
  it("deals flop, turn and river with a burn card before each", () => {
    let s = play(deal([1000, 1000]), [0, "call"], [1, "check"]);
    expect([s.board.length, s.deck.length]).toEqual([3, 52 - 4 - 4]);
    s = play(s, [1, "check"], [0, "check"]);
    expect([s.street, s.board.length, s.deck.length]).toEqual(["turn", 4, 52 - 4 - 6]);
    s = play(s, [1, "check"], [0, "check"]);
    expect([s.street, s.board.length, s.deck.length]).toEqual(["river", 5, 52 - 4 - 8]);
    s = play(s, [1, "check"], [0, "check"]);
    expect(s.result?.endedBy).toBe("showdown");
    expect(s.toActSeat).toBeNull();
  });

  it("resets street bets but keeps the pot between streets", () => {
    const s = play(deal([1000, 1000, 1000]), [0, "raise", 300], [1, "call"], [2, "call"]);
    expect(s.players.map((p) => p.streetBet)).toEqual([0, 0, 0]);
    expect(s.players.map((p) => p.totalBet)).toEqual([300, 300, 300]);
    expect(s.currentBet).toBe(0);
    expect(toPlayerView(s, null).pot).toBe(900);
  });
});

describe("betting rules", () => {
  it("minimum raise pre-flop is one big blind on top", () => {
    const s = deal([1000, 1000, 1000]);
    expect(getLegalActions(s, 0)).toEqual({
      canFold: true, canCheck: false, callAmount: 100,
      raise: { type: "raise", min: 200, max: 1000 },
    });
    expectError(() => play(s, [0, "raise", 150]), "invalid_amount");
    expect(play(s, [0, "raise", 200]).currentBet).toBe(200);
  });

  it("a re-raise must be at least the size of the previous raise", () => {
    const s = play(deal([5000, 5000, 5000]), [0, "raise", 300]); // raise of 200
    expect(getLegalActions(s, 1).raise).toEqual({ type: "raise", min: 500, max: 5000 });
    expectError(() => play(s, [1, "raise", 450]), "invalid_amount");
    const s2 = play(s, [1, "raise", 900]); // raise of 600
    expect(getLegalActions(s2, 2).raise?.min).toBe(1500);
  });

  it("minimum bet post-flop is the big blind", () => {
    const s = play(deal([1000, 1000]), [0, "call"], [1, "check"]);
    expect(getLegalActions(s, 1).raise).toEqual({ type: "bet", min: 100, max: 900 });
    expectError(() => play(s, [1, "bet", 99]), "invalid_amount");
    expect(play(s, [1, "bet", 100]).currentBet).toBe(100);
  });

  it("a player can go all-in for less than the minimum", () => {
    const s = play(deal([1000, 130]), [0, "call"], [1, "check"]); // seat 1 has 30 left
    expect(getLegalActions(s, 1).raise).toEqual({ type: "bet", min: 30, max: 30 });
    const s2 = play(s, [1, "bet", 30]);
    expect(s2.players[1].allIn).toBe(true);
    expect(getLegalActions(s2, 0).callAmount).toBe(30);
  });

  it("calling with fewer chips than the bet puts the player all-in", () => {
    const s = play(deal([1000, 1000, 260]), [0, "raise", 600], [1, "fold"], [2, "call"]);
    expect(s.actions.at(-1)).toMatchObject({ seat: 2, type: "call", added: 160, allIn: true });
    expect(s.players[2].totalBet).toBe(260);
    expect(s.result?.returned).toEqual({ seat: 0, amount: 340 });
    expect(s.result?.endedBy).toBe("showdown"); // nobody left to bet, board runs out
    expect(s.board).toHaveLength(5);
  });

  it("the all-in action resolves to bet, raise or call as appropriate", () => {
    const pre = deal([1000, 1000, 400]);
    const raised = play(pre, [0, "allin"]);
    expect(raised.actions.at(-1)).toMatchObject({ type: "raise", streetBet: 1000, allIn: true });
    const called = play(raised, [1, "fold"], [2, "allin"]);
    expect(called.actions.at(-1)).toMatchObject({ type: "call", added: 300, allIn: true });
    const flop = play(deal([1000, 1000]), [0, "call"], [1, "check"], [1, "allin"]);
    expect(flop.actions.at(-1)).toMatchObject({ type: "bet", streetBet: 900, allIn: true });
  });

  it("an all-in raise smaller than the minimum does not reopen the betting", () => {
    // Seat 2 has 150 behind on the flop. Seat 1 bets 100, seat 2 shoves for 150.
    let s = play(deal([1000, 1000, 250]), [0, "call"], [1, "call"], [2, "check"]);
    s = play(s, [1, "bet", 100], [2, "allin"]);
    expect(s.currentBet).toBe(150);
    // Seat 0 has not acted yet this street, so may still raise.
    expect(getLegalActions(s, 0).raise).toEqual({ type: "raise", min: 250, max: 900 });
    s = play(s, [0, "call"]);
    // Seat 1 already acted and faces only a short raise: call or fold, no raise.
    expect(s.toActSeat).toBe(1);
    expect(getLegalActions(s, 1)).toEqual({ canFold: true, canCheck: false, callAmount: 50, raise: null });
    expectError(() => play(s, [1, "raise", 400]), "invalid_action");
    expectError(() => play(s, [1, "allin"]), "invalid_action");
    expect(play(s, [1, "call"]).street).toBe("turn");
  });

  it("a full raise after a short all-in reopens the betting", () => {
    let s = play(deal([1000, 1000, 250]), [0, "call"], [1, "call"], [2, "check"]);
    s = play(s, [1, "bet", 100], [2, "allin"], [0, "raise", 400]);
    expect(getLegalActions(s, 1).raise).toEqual({ type: "raise", min: 650, max: 900 });
  });

  it("several short all-ins that add up to a full raise reopen the betting", () => {
    // Seats: 0 button, 1 SB, 2 BB (260), 3 (320).
    let s = play(deal([1000, 1000, 260, 320]), [3, "call"], [0, "call"], [1, "call"], [2, "check"]);
    s = play(s, [1, "bet", 100], [2, "allin"]); // to 160: short by 40
    expect(play(s, [3, "fold"], [0, "call"]).toActSeat).toBe(1);
    expect(getLegalActions(play(s, [3, "fold"], [0, "call"]), 1).raise).toBeNull();
    s = play(s, [3, "allin"], [0, "call"]); // to 220: 120 over the original bet
    expect(s.toActSeat).toBe(1);
    expect(getLegalActions(s, 1).raise).toEqual({ type: "raise", min: 320, max: 900 });
  });

  it("cannot raise when every opponent is already all-in", () => {
    const s = play(deal([1000, 1000, 300]), [0, "fold"], [1, "call"], [2, "allin"]);
    expect(s.toActSeat).toBe(1);
    expect(getLegalActions(s, 1)).toEqual({ canFold: true, canCheck: false, callAmount: 200, raise: null });
  });
});

describe("invalid actions", () => {
  const s = deal([1000, 1000, 1000]); // seat 0 to act, facing 100

  it("rejects acting out of turn", () => expectError(() => play(s, [1, "call"]), "not_your_turn"));
  it("rejects a seat that is not in the hand", () => expectError(() => play(s, [7, "call"]), "not_in_hand"));
  it("rejects checking when there is a bet", () => expectError(() => play(s, [0, "check"]), "invalid_action"));
  it("rejects calling when there is nothing to call", () => {
    const flop = play(deal([1000, 1000]), [0, "call"], [1, "check"]);
    expectError(() => play(flop, [1, "call"]), "invalid_action");
  });
  it("rejects 'bet' when there is already a bet, and 'raise' when there is not", () => {
    expectError(() => play(s, [0, "bet", 300]), "invalid_action");
    const flop = play(deal([1000, 1000]), [0, "call"], [1, "check"]);
    expectError(() => play(flop, [1, "raise", 300]), "invalid_action");
  });
  it("rejects betting more chips than the player has", () => {
    expectError(() => play(s, [0, "raise", 1001]), "invalid_amount");
    expectError(() => play(s, [0, "raise", 1_000_000_000]), "invalid_amount");
  });
  it("rejects fractional, negative, NaN and non-numeric amounts", () => {
    for (const bad of [250.5, -300, NaN, Infinity, "500", null, undefined]) {
      expectError(() => applyAction(s, 0, { type: "raise", amount: bad as number }), "invalid_amount");
    }
  });
  it("rejects a raise that does not exceed the current bet", () => {
    expectError(() => play(s, [0, "raise", 100]), "invalid_amount");
    expectError(() => play(s, [0, "raise", 50]), "invalid_amount");
  });
  it("rejects any action once the hand is over", () => {
    const over = play(s, [0, "fold"], [1, "fold"]);
    expect(over.result).not.toBeNull();
    expectError(() => play(over, [2, "check"]), "hand_over");
  });
  it("leaves the state untouched when an action is rejected or applied", () => {
    const before = structuredClone(s);
    expectError(() => play(s, [0, "raise", 150]), "invalid_amount");
    play(s, [0, "raise", 300]);
    expect(s).toEqual(before);
  });
  it("a folded player cannot act again", () => {
    const after = play(s, [0, "fold"], [1, "call"]);
    expectError(() => play(after, [0, "call"]), "not_your_turn");
  });
});

describe("winning without a showdown", () => {
  it("the last player standing wins the pot and unmatched chips come back", () => {
    const s = play(deal([1000, 1000, 1000]), [0, "raise", 300], [1, "fold"], [2, "fold"]);
    expect(s.result).toMatchObject({
      endedBy: "fold",
      returned: { seat: 0, amount: 200 },
      winnings: { 0: 250 },
      net: { 0: 150, 1: -50, 2: -100 },
      shown: [],
    });
    expect(s.players.map((p) => p.stack)).toEqual([1150, 950, 900]);
    expect(s.board).toHaveLength(0);
  });

  it("the big blind wins the small blind when everyone folds to them", () => {
    const s = play(deal([1000, 1000, 1000]), [0, "fold"], [1, "fold"]);
    expect(s.result?.net).toEqual({ 0: 0, 1: -50, 2: 50 });
  });

  it("folding post-flop gives the pot to the bettor", () => {
    const s = play(deal([1000, 1000]), [0, "call"], [1, "check"], [1, "bet", 200], [0, "fold"]);
    expect(s.result?.net).toEqual({ 0: -100, 1: 100 });
  });
});

describe("showdown", () => {
  it("the best hand wins the whole pot", () => {
    let s = rig(deal([1000, 1000]), { 0: "Ah Ad", 1: "Kh Kd" }, "2c 7d 9h Js 3c");
    s = play(s, [0, "raise", 300], [1, "call"], [1, "check"], [0, "check"], [1, "check"], [0, "check"], [1, "check"], [0, "check"]);
    expect(s.result?.endedBy).toBe("showdown");
    expect(s.result?.pots).toEqual([{ amount: 600, eligibleSeats: [0, 1], winners: [{ seat: 0, amount: 600 }] }]);
    expect(s.result?.shown.map((x) => [x.seat, x.hand.name])).toEqual([[0, "Pair of Aces"], [1, "Pair of Kings"]]);
    expect(s.players.map((p) => p.stack)).toEqual([1300, 700]);
  });

  it("a folded player cannot win even with the best cards", () => {
    let s = rig(deal([1000, 1000, 1000]), { 0: "Ah Ad", 1: "Kh Kd", 2: "Qh Qd" }, "2c 7d 9h Js 3c");
    s = play(s, [0, "fold"], [1, "call"], [2, "check"]);
    for (let i = 0; i < 3; i++) s = play(s, [1, "check"], [2, "check"]);
    expect(s.result?.winnings).toEqual({ 1: 200 });
    expect(s.result?.shown.map((x) => x.seat)).toEqual([1, 2]);
  });

  it("splits the pot on an exact tie", () => {
    let s = rig(deal([1000, 1000]), { 0: "2h 3d", 1: "2d 3h" }, "As Kd Qh Jc Ts");
    s = play(s, [0, "call"], [1, "check"]);
    for (let i = 0; i < 3; i++) s = play(s, [1, "check"], [0, "check"]);
    expect(s.result?.pots[0].winners).toEqual([{ seat: 0, amount: 100 }, { seat: 1, amount: 100 }]);
    expect(s.result?.net).toEqual({ 0: 0, 1: 0 });
  });

  it("gives the odd chip of a split pot to the first winner left of the button", () => {
    let s = rig(deal([1000, 1000, 1000], { smallBlind: 25, bigBlind: 50 }),
      { 0: "2h 3d", 1: "7c 8c", 2: "2d 3h" }, "As Kd Qh Jc Ts");
    s = play(s, [0, "call"], [1, "fold"], [2, "check"]);
    for (let i = 0; i < 3; i++) s = play(s, [2, "check"], [0, "check"]);
    // Pot is 125: seat 2 is first left of the button among the winners.
    expect(s.result?.pots[0].winners).toEqual([{ seat: 0, amount: 62 }, { seat: 2, amount: 63 }]);
    expect(s.players.map((p) => p.stack)).toEqual([1012, 975, 1013]);
  });

  it("kickers decide between equal pairs", () => {
    let s = rig(deal([1000, 1000]), { 0: "Ah Kd", 1: "As Qd" }, "Ac 7d 9h 2s 3c");
    s = play(s, [0, "call"], [1, "check"]);
    for (let i = 0; i < 3; i++) s = play(s, [1, "check"], [0, "check"]);
    expect(s.result?.winnings).toEqual({ 0: 200 });
  });
});

describe("all-in and side pots", () => {
  it("a short all-in can only win the main pot; the side pot goes to the next best hand", () => {
    // Seat 1 (300 chips) has the best hand, seat 0 the second best.
    let s = rig(deal([1000, 300, 1000]), { 0: "Kh Kd", 1: "Ah Ad", 2: "Qh Qd" }, "2c 7d 9h Js 3c");
    s = play(s, [0, "raise", 300], [1, "call"], [2, "call"]);
    expect(s.players[1].allIn).toBe(true);
    expect(s.toActSeat).toBe(2); // the all-in player is skipped
    s = play(s, [2, "check"], [0, "bet", 400], [2, "call"], [2, "check"], [0, "check"], [2, "check"], [0, "check"]);
    expect(s.result?.pots).toEqual([
      { amount: 900, eligibleSeats: [0, 1, 2], winners: [{ seat: 1, amount: 900 }] },
      { amount: 800, eligibleSeats: [0, 2], winners: [{ seat: 0, amount: 800 }] },
    ]);
    expect(s.players.map((p) => p.stack)).toEqual([1100, 900, 300]);
    expect(s.result?.net).toEqual({ 0: 100, 1: 600, 2: -700 });
  });

  it("three different stack sizes all-in make a main pot and two side pots", () => {
    let s = rig(deal([200, 500, 1000, 1000]),
      { 0: "Ah Ad", 1: "Kh Kd", 2: "Qh Qd", 3: "Jh Jd" }, "2c 7d 9h 4s 3c");
    s = play(s, [3, "allin"], [0, "allin"], [1, "allin"], [2, "allin"]);
    expect(s.result?.endedBy).toBe("showdown");
    expect(s.board).toHaveLength(5);
    expect(s.result?.pots).toEqual([
      { amount: 800, eligibleSeats: [0, 1, 2, 3], winners: [{ seat: 0, amount: 800 }] },
      { amount: 900, eligibleSeats: [1, 2, 3], winners: [{ seat: 1, amount: 900 }] },
      { amount: 1000, eligibleSeats: [2, 3], winners: [{ seat: 2, amount: 1000 }] },
    ]);
    expect(s.players.map((p) => p.stack)).toEqual([800, 900, 1000, 0]);
  });

  it("a tie in the main pot with a different winner of the side pot", () => {
    // Seats 0 and 1 tie with the board straight; seat 2 (short) also ties.
    let s = rig(deal([1000, 1000, 100]), { 0: "2h 3d", 1: "2d 3h", 2: "4c 4d" }, "As Kd Qh Jc Ts");
    s = play(s, [0, "raise", 400], [1, "call"]);
    for (let i = 0; i < 3; i++) s = play(s, [1, "check"], [0, "check"]);
    expect(s.result?.pots).toEqual([
      { amount: 300, eligibleSeats: [0, 1, 2], winners: [{ seat: 0, amount: 100 }, { seat: 1, amount: 100 }, { seat: 2, amount: 100 }] },
      { amount: 600, eligibleSeats: [0, 1], winners: [{ seat: 0, amount: 300 }, { seat: 1, amount: 300 }] },
    ]);
    expect(s.players.map((p) => p.stack)).toEqual([1000, 1000, 100]);
  });

  it("returns the uncalled part of an all-in to the bigger stack", () => {
    let s = rig(deal([1000, 200]), { 0: "7h 2d", 1: "Ah Ad" }, "Kc 8d 9h Js 3c");
    s = play(s, [0, "allin"], [1, "call"]);
    expect(s.result?.returned).toEqual({ seat: 0, amount: 800 });
    expect(s.result?.pots).toEqual([{ amount: 400, eligibleSeats: [0, 1], winners: [{ seat: 1, amount: 400 }] }]);
    expect(s.players.map((p) => p.stack)).toEqual([800, 400]);
  });

  it("a folded player's chips stay in the pot", () => {
    let s = rig(deal([1000, 1000, 1000]), { 0: "Ah Ad", 1: "Kh Kd", 2: "Qh Qd" }, "2c 7d 9h Js 3c");
    s = play(s, [0, "raise", 300], [1, "call"], [2, "call"], [1, "check"], [2, "check"], [0, "bet", 300], [1, "fold"], [2, "call"]);
    s = play(s, [2, "check"], [0, "check"], [2, "check"], [0, "check"]);
    expect(s.result?.pots).toEqual([{ amount: 1500, eligibleSeats: [0, 2], winners: [{ seat: 0, amount: 1500 }] }]);
  });

  it("short blinds all-in: the board runs out with no betting", () => {
    const s = deal([40, 80]); // both are all-in from the blinds
    expect(s.result?.endedBy).toBe("showdown");
    expect(s.board).toHaveLength(5);
    expect(s.result?.returned).toEqual({ seat: 1, amount: 40 });
    expect(stackOf(s, 0) + stackOf(s, 1)).toBe(120);
  });

  it("a short big blind still lets the others play for a side pot", () => {
    let s = rig(deal([1000, 1000, 60]), { 0: "Kh Kd", 1: "Qh Qd", 2: "Ah Ad" }, "2c 7d 9h Js 3c");
    s = play(s, [0, "call"], [1, "call"]);
    expect(s.street).toBe("flop");
    s = play(s, [1, "check"], [0, "bet", 200], [1, "call"], [1, "check"], [0, "check"], [1, "check"], [0, "check"]);
    expect(s.result?.pots).toEqual([
      { amount: 180, eligibleSeats: [0, 1, 2], winners: [{ seat: 2, amount: 180 }] },
      { amount: 480, eligibleSeats: [0, 1], winners: [{ seat: 0, amount: 480 }] },
    ]);
  });
});

describe("timeouts", () => {
  it("checks when checking is free, otherwise folds", () => {
    const facingBet = deal([1000, 1000, 1000]);
    expect(getTimeoutAction(facingBet, 0)).toEqual({ type: "fold" });
    const bbOption = play(facingBet, [0, "call"], [1, "call"]);
    expect(getTimeoutAction(bbOption, 2)).toEqual({ type: "check" });
  });

  it("a table where everyone times out still finishes the hand", () => {
    let s = deal([1000, 1000, 1000, 1000]);
    while (!s.result) s = applyAction(s, s.toActSeat!, getTimeoutAction(s, s.toActSeat!));
    expect(s.result.net).toEqual({ 0: 0, 1: -50, 2: 50, 3: 0 });
  });
});

describe("what each player is allowed to see", () => {
  const live = play(deal([1000, 1000, 1000]), [0, "call"], [1, "call"], [2, "check"]);

  it("never includes the deck", () => {
    expect(JSON.stringify(toPlayerView(live, 0))).not.toContain("deck");
    expect("deck" in toPlayerView(live, 0)).toBe(false);
  });

  it("shows a player their own cards and nobody else's", () => {
    const view = toPlayerView(live, 1);
    expect(view.players[1].holeCards).toEqual(live.players[1].holeCards);
    expect(view.players[0].holeCards).toBeNull();
    expect(view.players[2].holeCards).toBeNull();
    const json = JSON.stringify(view);
    for (const p of [live.players[0], live.players[2]]) {
      for (const card of p.holeCards) expect(json).not.toContain(`"${card}"`);
    }
    for (const card of live.deck) expect(json).not.toContain(`"${card}"`);
  });

  it("shows spectators no hole cards at all", () => {
    expect(toPlayerView(live, null).players.every((p) => p.holeCards === null)).toBe(true);
  });

  it("includes legal actions only for the player whose turn it is", () => {
    expect(toPlayerView(live, live.toActSeat).legalActions).not.toBeNull();
    expect(toPlayerView(live, 0).legalActions).toBeNull();
    expect(toPlayerView(live, null).legalActions).toBeNull();
  });

  it("at showdown reveals only the hands of players who did not fold", () => {
    let s = play(live, [1, "bet", 100], [2, "fold"], [0, "call"]);
    s = play(s, [1, "check"], [0, "check"], [1, "check"], [0, "check"]);
    const view = toPlayerView(s, null);
    expect(view.players[0].holeCards).toHaveLength(2);
    expect(view.players[1].holeCards).toHaveLength(2);
    expect(view.players[2].holeCards).toBeNull();
  });

  it("reveals nothing when the hand ends by everyone folding", () => {
    const s = play(live, [1, "bet", 100], [2, "fold"], [0, "fold"]);
    expect(toPlayerView(s, null).players.every((p) => p.holeCards === null)).toBe(true);
  });

  it("changing a view cannot change the real state", () => {
    const view = toPlayerView(live, 1);
    view.players[1].holeCards!.length = 0;
    view.board.length = 0;
    expect(live.players[1].holeCards).toHaveLength(2);
    expect(live.board).toHaveLength(3);
  });
});

describe("replay", () => {
  it("the same shuffle and the same actions always give the same result", () => {
    const run = () => {
      let s = deal([800, 1200, 500, 1000], { seed: 77 });
      const rng = seededRandomInt(5);
      while (!s.result) s = applyAction(s, s.toActSeat!, randomLegalAction(s, rng));
      return s;
    };
    expect(run()).toEqual(run());
  });
});

/** Picks a uniformly random legal action, including random bet sizes. */
function randomLegalAction(s: HandState, rng: (n: number) => number): PlayerAction {
  const seat = s.toActSeat!;
  const legal = getLegalActions(s, seat);
  const options: PlayerAction[] = [];
  if (legal.canCheck) options.push({ type: "check" }, { type: "check" });
  else options.push({ type: "fold" });
  if (legal.callAmount > 0) options.push({ type: "call" }, { type: "call" });
  if (legal.raise) {
    const { type, min, max } = legal.raise;
    options.push({ type, amount: min }, { type, amount: min + rng(max - min + 1) }, { type: "allin" });
  }
  return options[rng(options.length)];
}

describe("randomised play (5,000 hands)", () => {
  it("never creates or destroys chips, never deadlocks, and always settles correctly", () => {
    const rng = seededRandomInt(20261112);
    const endings = { fold: 0, showdown: 0 };
    let sidePotHands = 0;
    let splitHands = 0;

    for (let hand = 0; hand < 5000; hand++) {
      const n = 2 + rng(8);
      const bigBlind = [2, 10, 100][rng(3)];
      const players = Array.from({ length: n }, (_, seat) => ({
        seat: seat * (1 + rng(2)) + (seat > 0 ? seat : 0), // gaps between seats
        id: `p${seat}`,
        stack: 1 + rng(bigBlind * 60),
      }));
      // Make seats unique and increasing.
      players.forEach((p, i) => (p.seat = i === 0 ? rng(3) : players[i - 1].seat + 1 + rng(2)));
      const total = players.reduce((s, p) => s + p.stack, 0);

      let s = startHand({
        smallBlind: bigBlind / 2,
        bigBlind,
        dealerSeat: players[rng(n)].seat,
        players,
        randomInt: rng,
      });

      let steps = 0;
      while (!s.result) {
        expect(totalChips(s)).toBe(total);
        const actor = s.players.find((p) => p.seat === s.toActSeat)!;
        expect(actor && !actor.folded && !actor.allIn && actor.stack > 0).toBe(true);
        expect(s.players.every((p) => p.stack >= 0 && p.streetBet <= s.currentBet || p.allIn || p.streetBet === s.currentBet)).toBe(true);
        const versionBefore = s.version;
        s = applyAction(s, s.toActSeat!, randomLegalAction(s, rng));
        expect(s.version).toBe(versionBefore + 1);
        expect(++steps).toBeLessThan(400);
      }

      const r = s.result;
      endings[r.endedBy]++;
      // Chips conserved, nobody negative, net results sum to zero.
      expect(s.players.reduce((sum, p) => sum + p.stack, 0)).toBe(total);
      expect(s.players.every((p) => p.stack >= 0)).toBe(true);
      expect(Object.values(r.net).reduce((a, b) => a + b, 0)).toBe(0);
      // Pots contain exactly what was contributed, and pay out exactly what they contain.
      const contributed = s.players.reduce((sum, p) => sum + p.totalBet, 0);
      expect(r.pots.reduce((sum, p) => sum + p.amount, 0)).toBe(contributed);
      for (const pot of r.pots) {
        expect(pot.winners.reduce((sum, w) => sum + w.amount, 0)).toBe(pot.amount);
        expect(pot.winners.length).toBeGreaterThan(0);
        for (const w of pot.winners) {
          expect(pot.eligibleSeats).toContain(w.seat);
          expect(s.players.find((p) => p.seat === w.seat)!.folded).toBe(false);
        }
        if (pot.winners.length > 1) splitHands++;
      }
      if (r.pots.length > 1) sidePotHands++;
      if (r.endedBy === "showdown") {
        expect(s.board).toHaveLength(5);
        expect(r.shown.length).toBeGreaterThanOrEqual(2);
      } else {
        expect(r.shown).toHaveLength(0);
      }
      // No card appears twice anywhere.
      const all = [...s.deck, ...s.board, ...s.players.flatMap((p) => p.holeCards)];
      expect(new Set(all).size).toBe(all.length);
    }

    // The random play really did exercise the interesting paths.
    expect(endings.fold).toBeGreaterThan(300);
    expect(endings.showdown).toBeGreaterThan(300);
    expect(sidePotHands).toBeGreaterThan(100);
    expect(splitHands).toBeGreaterThan(5);
  });
});
