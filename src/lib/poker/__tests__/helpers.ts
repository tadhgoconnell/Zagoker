import { createDeck, type Card, type RandomInt } from "../cards";
import { applyAction, startHand, type HandState, type PlayerAction } from "../engine";

/** Small deterministic PRNG (mulberry32) so tests are repeatable. */
export function seededRandomInt(seed: number): RandomInt {
  let a = seed >>> 0;
  return (maxExclusive) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const float = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(float * maxExclusive);
  };
}

/** Parses "As Kd 7c" into cards. */
export function cards(text: string): Card[] {
  return text.trim().split(/\s+/) as Card[];
}

/**
 * Starts a hand with seats 0..n-1 and the given stacks.
 * Defaults: blinds 50/100, dealer on seat 0.
 */
export function deal(
  stacks: number[],
  opts: { smallBlind?: number; bigBlind?: number; dealerSeat?: number; seed?: number } = {},
): HandState {
  return startHand({
    smallBlind: opts.smallBlind ?? 50,
    bigBlind: opts.bigBlind ?? 100,
    dealerSeat: opts.dealerSeat ?? 0,
    players: stacks.map((stack, seat) => ({ seat, id: `p${seat}`, stack })),
    randomInt: seededRandomInt(opts.seed ?? 1),
  });
}

/**
 * Replaces the random deal with chosen cards. `holes` maps seat -> two
 * cards; `board` is the five community cards in the order they will appear.
 */
export function rig(
  state: HandState,
  holes: Record<number, string>,
  board: string,
): HandState {
  const next = structuredClone(state);
  const used = new Set<Card>();
  for (const p of next.players) {
    p.holeCards = cards(holes[p.seat]);
    p.holeCards.forEach((c) => used.add(c));
  }
  const [f1, f2, f3, turn, river] = cards(board);
  [f1, f2, f3, turn, river].forEach((c) => used.add(c));
  const rest = createDeck().filter((c) => !used.has(c));
  const [burn1, burn2, burn3, ...filler] = rest;
  // The engine deals with pop(), so the next card out is the last element.
  next.deck = [...filler, river, burn3, turn, burn2, f3, f2, f1, burn1];
  return next;
}

type Step = [seat: number, type: PlayerAction["type"], amount?: number];

/** Applies a sequence of actions, e.g. play(state, [0, "call"], [1, "raise", 300]). */
export function play(state: HandState, ...steps: Step[]): HandState {
  let s = state;
  for (const [seat, type, amount] of steps) {
    const action =
      type === "bet" || type === "raise"
        ? { type, amount: amount! }
        : { type };
    s = applyAction(s, seat, action as PlayerAction);
  }
  return s;
}

export const stackOf = (s: HandState, seat: number) =>
  s.players.find((p) => p.seat === seat)!.stack;

export const totalChips = (s: HandState) =>
  s.players.reduce((sum, p) => sum + p.stack + (s.result ? 0 : p.totalBet), 0);
