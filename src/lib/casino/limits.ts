/** Bet limits for blackjack and roulette. Must match the casino SQL functions. */
export const casinoLimits = {
  /** Smallest blackjack hand or roulette spin (total of all bets). */
  minBet: 10,
  /** Largest blackjack hand (before doubles and splits) or roulette spin. */
  maxBet: 5_000,
} as const;

/** Chip values offered for betting. */
export const casinoChips = [10, 25, 100, 500, 1_000] as const;
