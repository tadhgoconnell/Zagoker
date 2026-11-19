/**
 * Computer opponents for practice games ("Prefect #1", "#2", ...).
 *
 * A bot only ever sees what a real player in its seat would see: its own
 * hole cards and the public table (a HandView from toPlayerView). It
 * estimates its chance of winning by dealing out random run-outs, then
 * decides according to its personality and the chosen difficulty.
 *
 * Difficulty 0 to 10 controls how well a bot reads its hand (more
 * simulations, less random noise) and how much attention it pays to pot odds.
 */
import { createDeck, type Card, type RandomInt } from "./cards";
import type { HandView, LegalActions, PlayerAction } from "./engine";
import { compareHands, evaluateHand } from "./evaluator";

export type BotStyle = {
  key: string;
  /** Shown to the player. */
  name: string;
  description: string;
  /** 0..1: how many marginal hands it plays. */
  looseness: number;
  /** 0..1: raising and betting rather than calling and checking. */
  aggression: number;
  /** 0..1: how often it bets or raises with a weak hand. */
  bluffing: number;
  /** 0..1: how often it checks or calls a very strong hand to set a trap. */
  slowPlay: number;
  /** 0..1: how readily it shoves its whole stack. */
  shoving: number;
};

/** One personality per Prefect, in seat order; a ninth would wrap round. */
export const botStyles: readonly BotStyle[] = [
  { key: "shark", name: "The Shark", description: "Solid and patient; bets hard with good hands.", looseness: 0.35, aggression: 0.7, bluffing: 0.12, slowPlay: 0.1, shoving: 0.2 },
  { key: "maniac", name: "The Maniac", description: "Raises almost everything.", looseness: 0.85, aggression: 0.95, bluffing: 0.45, slowPlay: 0, shoving: 0.55 },
  { key: "rock", name: "The Rock", description: "Plays very few hands; rarely bluffs.", looseness: 0.1, aggression: 0.45, bluffing: 0.03, slowPlay: 0.05, shoving: 0.1 },
  { key: "station", name: "The Calling Station", description: "Calls nearly anything; seldom raises.", looseness: 0.9, aggression: 0.12, bluffing: 0.05, slowPlay: 0.2, shoving: 0.05 },
  { key: "trapper", name: "The Trapper", description: "Checks strong hands and springs a raise later.", looseness: 0.45, aggression: 0.55, bluffing: 0.1, slowPlay: 0.7, shoving: 0.2 },
  { key: "bluffer", name: "The Bluffer", description: "Bets whenever checked to.", looseness: 0.6, aggression: 0.75, bluffing: 0.6, slowPlay: 0.05, shoving: 0.25 },
  { key: "gambler", name: "The Gambler", description: "Chases draws and loves an all-in.", looseness: 0.75, aggression: 0.6, bluffing: 0.25, slowPlay: 0.1, shoving: 0.8 },
  { key: "grinder", name: "The Grinder", description: "Careful with pot odds; small, steady bets.", looseness: 0.4, aggression: 0.5, bluffing: 0.1, slowPlay: 0.15, shoving: 0.1 },
];

/** Bots are named by seat order: the first is always Prefect #1, and so on. */
export const botName = (n: number) => `Prefect #${n}`;
export const styleForBot = (n: number) => botStyles[(n - 1) % botStyles.length];

/**
 * Deals a random personality to each of `count` bots, never the same one
 * twice in a game (up to the eight there are).
 */
export function dealStyles(count: number, randomInt: RandomInt): BotStyle[] {
  const deck = botStyles.slice();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return Array.from({ length: count }, (_, i) => deck[i % deck.length]);
}

/**
 * Chance (0..1) that `hole` wins against `opponents` random hands, given the
 * board so far. Ties count as a share of a win.
 */
export function estimateEquity(
  hole: readonly Card[],
  board: readonly Card[],
  opponents: number,
  samples: number,
  rnd: () => number,
): number {
  const known = new Set<Card>([...hole, ...board]);
  const deck = createDeck().filter((c) => !known.has(c));
  let score = 0;
  for (let s = 0; s < samples; s++) {
    // Partial shuffle: only as many cards as this run-out needs.
    const need = 5 - board.length + opponents * 2;
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(rnd() * (deck.length - i));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const full = [...board, ...deck.slice(0, 5 - board.length)];
    const mine = evaluateHand([...hole, ...full]);
    let beaten = false;
    let ties = 0;
    for (let o = 0; o < opponents; o++) {
      const at = 5 - board.length + o * 2;
      const theirs = evaluateHand([deck[at], deck[at + 1], ...full]);
      const cmp = compareHands(mine, theirs);
      if (cmp < 0) {
        beaten = true;
        break;
      }
      if (cmp === 0) ties++;
    }
    if (!beaten) score += 1 / (ties + 1);
  }
  return samples > 0 ? score / samples : 0.5;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Chooses an action for the bot whose turn it is.
 *
 * @param view   the hand as the bot may see it (toPlayerView for its seat)
 * @param difficulty 0 (clueless) to 10 (strong)
 */
export function decideBotAction(
  view: HandView,
  seat: number,
  style: BotStyle,
  difficulty: number,
  randomInt: RandomInt,
): PlayerAction {
  const legal: LegalActions | null = view.legalActions;
  if (!legal) throw new Error("decideBotAction called when it is not this bot's turn");
  const rnd = () => randomInt(1_000_000) / 1_000_000;
  const me = view.players.find((p) => p.seat === seat)!;
  const hole = me.holeCards ?? [];
  const opponents = view.players.filter((p) => p.seat !== seat && !p.folded).length;

  const skill = clamp(difficulty, 0, 10) / 10;
  // Lower difficulty: fewer samples and more noise in the bot's read.
  const samples = Math.round(20 + skill * 280);
  const trueEquity = hole.length === 2 ? estimateEquity(hole, view.board, Math.max(1, opponents), samples, rnd) : 0.3;
  const noise = (1 - skill) * 0.9;
  const equity = clamp(trueEquity * (1 - noise) + rnd() * noise, 0, 1);
  // Equity a fair share would give against this many opponents.
  const fair = 1 / (Math.max(1, opponents) + 1);
  const edge = equity - fair; // > 0: better than average
  const strong = edge > 0.25 + (1 - style.aggression) * 0.1;

  const pot = view.pot;
  const toCall = legal.callAmount;
  const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
  const raise = legal.raise;

  /** Raise or bet sized as a fraction of the pot, kept within the legal range. */
  const sized = (fraction: number): PlayerAction => {
    if (!raise) return toCall > 0 ? { type: "call" } : { type: "check" };
    const target = Math.round(view.currentBet + toCall + (pot + toCall) * fraction);
    const amount = clamp(target, raise.min, raise.max);
    if (amount >= raise.max) return { type: "allin" };
    return { type: raise.type, amount };
  };
  const betSize = () => 0.4 + style.aggression * 0.6 + (strong ? 0.2 : 0) + (rnd() - 0.5) * 0.3;

  // Shove: very strong hands for shove-happy styles, or a short stack.
  const shortStack = me.stack <= view.bigBlind * 8;
  if (raise && (strong && rnd() < style.shoving * (0.3 + skill * 0.4) || (shortStack && edge > 0.05 && rnd() < 0.6))) {
    return { type: "allin" };
  }

  if (legal.canCheck) {
    if (strong && rnd() < style.slowPlay) return { type: "check" }; // the trap
    if (raise && edge > 0.12 - style.aggression * 0.08 && rnd() < 0.35 + style.aggression * 0.6) return sized(betSize());
    if (raise && rnd() < style.bluffing * (1 - equity)) return sized(0.5 + rnd() * 0.4);
    return { type: "check" };
  }

  // Facing a bet. Loose styles call with less; tight ones want a better
  // price. A weaker bot is sloppier about the price it is offered.
  const priceNeeded = potOdds * (1.2 - style.looseness * 0.6 - (1 - skill) * 0.2);
  const worthCalling = equity > priceNeeded;
  if (raise && strong && rnd() > style.slowPlay * 0.6 && rnd() < 0.3 + style.aggression * 0.7) return sized(betSize());
  // Loose-aggressive styles raise marginal hands too.
  if (raise && edge > -0.05 && rnd() < style.aggression * style.looseness * 0.5) return sized(betSize());
  if (raise && rnd() < style.bluffing * 0.2 * (1 - equity)) return sized(0.6 + rnd() * 0.5);
  if (worthCalling) return { type: "call" };
  // Very loose styles sometimes look at a cheap flop anyway.
  if (toCall <= view.bigBlind && rnd() < Math.max(0, style.looseness - 0.5)) return { type: "call" };
  return { type: "fold" };
}
