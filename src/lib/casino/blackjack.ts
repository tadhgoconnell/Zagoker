/**
 * Blackjack against the house. Pure functions, no platform dependencies: the
 * server runs them with a secure random source and stores the state; the
 * browser only ever sees `toView()`, which hides the shoe and the dealer's
 * hole card until the round is over.
 *
 * Rules (shown to players on the page):
 *   - 6 decks, shuffled fresh for every round.
 *   - Dealer stands on all 17s, and peeks for blackjack with an ace or ten up.
 *   - Blackjack pays 3 to 2 (rounded down to a whole chip); wins pay 1 to 1.
 *   - Double on any first two cards, also after a split.
 *   - Split any two cards of equal value, up to 4 hands. Split aces get one
 *     card each. 21 after a split is not a blackjack.
 *   - No insurance, no surrender.
 */
import { createDeck, shuffle, type Card, type RandomInt } from "@/lib/poker/cards";

export const BLACKJACK_DECKS = 6;
export const MAX_HANDS = 4;

export type HandOutcome = "blackjack" | "win" | "push" | "lose" | "bust";

export type BjHand = {
  cards: Card[];
  /** Chips staked on this hand (doubles when doubled). */
  bet: number;
  doubled: boolean;
  /** No more cards: stood, busted, doubled, 21, or a split ace. */
  done: boolean;
  /** Part of a split: 21 here is not a blackjack. */
  split: boolean;
  outcome?: HandOutcome;
  /** Chips returned for this hand, stake included. */
  payout?: number;
};

export type BjState = {
  shoe: Card[];
  dealer: Card[];
  hands: BjHand[];
  /** Index of the hand being played; -1 once the round is over. */
  active: number;
  phase: "player" | "settled";
};

export type BjAction = "hit" | "stand" | "double" | "split";

/** What the player may see. */
export type BjView = {
  dealer: (Card | null)[];
  dealerTotal: number | null;
  hands: (Omit<BjHand, "cards"> & { cards: Card[]; total: number; soft: boolean })[];
  active: number;
  phase: "player" | "settled";
  actions: BjAction[];
  staked: number;
  payout: number;
};

function cardValue(card: Card): number {
  const r = card[0];
  if (r === "A") return 11;
  if (r === "T" || r === "J" || r === "Q" || r === "K") return 10;
  return Number(r);
}

/** Best total of a hand and whether an ace still counts as 11. */
export function handTotal(cards: readonly Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c);
    if (c[0] === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export const isBlackjack = (cards: readonly Card[]) => cards.length === 2 && handTotal(cards).total === 21;

export function newShoe(randomInt: RandomInt): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < BLACKJACK_DECKS; d++) cards.push(...createDeck());
  return shuffle(cards, randomInt);
}

/** Deals a new round. If either side has blackjack, it is already settled. */
export function deal(bet: number, shoe: Card[]): BjState {
  const s = shoe.slice();
  const take = () => s.pop()!;
  const p1 = take();
  const d1 = take();
  const p2 = take();
  const d2 = take();
  const state: BjState = {
    shoe: s,
    dealer: [d1, d2],
    hands: [{ cards: [p1, p2], bet, doubled: false, done: false, split: false }],
    active: 0,
    phase: "player",
  };
  // Dealer peeks with an ace or ten showing; a player blackjack ends the hand too.
  if (isBlackjack(state.dealer) || isBlackjack(state.hands[0].cards)) return settle(state);
  return state;
}

/** Which actions the current hand allows. Balance is checked separately. */
export function legalActions(state: BjState): BjAction[] {
  if (state.phase !== "player" || state.active < 0) return [];
  const hand = state.hands[state.active];
  const actions: BjAction[] = ["hit", "stand"];
  if (hand.cards.length === 2) {
    actions.push("double");
    if (state.hands.length < MAX_HANDS && cardValue(hand.cards[0]) === cardValue(hand.cards[1])) {
      // Aces can be split once only: split aces are done straight away.
      if (!(hand.split && hand.cards[0][0] === "A")) actions.push("split");
    }
  }
  return actions;
}

/** Extra chips the action takes from the player's balance. */
export function extraStake(state: BjState, action: BjAction): number {
  return action === "double" || action === "split" ? state.hands[state.active].bet : 0;
}

export class IllegalAction extends Error {}

/** Applies a player action. Returns a new state; the input is not changed. */
export function act(prev: BjState, action: BjAction): BjState {
  if (!legalActions(prev).includes(action)) throw new IllegalAction(`${action} is not allowed now`);
  const state: BjState = structuredClone(prev);
  const hand = state.hands[state.active];
  const take = () => state.shoe.pop()!;

  switch (action) {
    case "hit":
      hand.cards.push(take());
      if (handTotal(hand.cards).total >= 21) hand.done = true;
      break;
    case "stand":
      hand.done = true;
      break;
    case "double":
      hand.bet *= 2;
      hand.doubled = true;
      hand.cards.push(take());
      hand.done = true;
      break;
    case "split": {
      const aces = hand.cards[0][0] === "A";
      const second: BjHand = { cards: [hand.cards[1]], bet: hand.bet, doubled: false, done: false, split: true };
      hand.cards = [hand.cards[0], take()];
      hand.split = true;
      second.cards.push(take());
      state.hands.splice(state.active + 1, 0, second);
      for (const h of [hand, second]) {
        if (aces || handTotal(h.cards).total === 21) h.done = true;
      }
      break;
    }
  }
  return advance(state);
}

/** Moves to the next unfinished hand, or plays the dealer and settles. */
function advance(state: BjState): BjState {
  const next = state.hands.findIndex((h) => !h.done);
  if (next >= 0) {
    state.active = next;
    return state;
  }
  return settle(state);
}

/** Dealer plays (if any hand is still alive) and every hand is paid. */
function settle(state: BjState): BjState {
  state.active = -1;
  state.phase = "settled";
  const dealerBj = isBlackjack(state.dealer);
  const alive = state.hands.some((h) => handTotal(h.cards).total <= 21);
  const naturalOnly = state.hands.length === 1 && isBlackjack(state.hands[0].cards) && !state.hands[0].split;
  if (alive && !dealerBj && !naturalOnly) {
    while (handTotal(state.dealer).total < 17) state.dealer.push(state.shoe.pop()!);
  }
  const dealer = handTotal(state.dealer).total;

  for (const h of state.hands) {
    h.done = true;
    const total = handTotal(h.cards).total;
    const natural = isBlackjack(h.cards) && !h.split;
    if (total > 21) set(h, "bust", 0);
    else if (dealerBj) set(h, natural ? "push" : "lose", natural ? h.bet : 0);
    else if (natural) set(h, "blackjack", h.bet + Math.floor((h.bet * 3) / 2));
    else if (dealer > 21 || total > dealer) set(h, "win", h.bet * 2);
    else if (total === dealer) set(h, "push", h.bet);
    else set(h, "lose", 0);
  }
  return state;
}

function set(h: BjHand, outcome: HandOutcome, payout: number) {
  h.outcome = outcome;
  h.payout = payout;
}

export const totalStaked = (state: BjState) => state.hands.reduce((a, h) => a + h.bet, 0);
export const totalPayout = (state: BjState) => state.hands.reduce((a, h) => a + (h.payout ?? 0), 0);

/** The player's view: no shoe, and the hole card hidden until the end. */
export function toView(state: BjState): BjView {
  const settled = state.phase === "settled";
  return {
    dealer: settled ? state.dealer.slice() : [state.dealer[0], null],
    dealerTotal: settled ? handTotal(state.dealer).total : null,
    hands: state.hands.map((h) => ({ ...h, cards: h.cards.slice(), ...handTotal(h.cards) })),
    active: state.active,
    phase: state.phase,
    actions: legalActions(state),
    staked: totalStaked(state),
    payout: settled ? totalPayout(state) : 0,
  };
}
