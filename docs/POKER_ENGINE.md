# Poker engine

`src/lib/poker/` is a self-contained No-Limit Texas Hold'em engine. It has no
dependency on React, Next.js, Supabase, the clock or the network, so it is
tested on its own with `npm test`.

| File | Responsibility |
| --- | --- |
| `cards.ts` | Card type, 52-card deck, Fisher-Yates shuffle |
| `secure-random.ts` | Server-only cryptographic random source (`node:crypto`) used for live shuffles |
| `evaluator.ts` | Best five-card hand from 5 to 7 cards, comparison, hand names |
| `pots.ts` | Uncalled-bet return, main and side pots, split with odd-chip rule |
| `engine.ts` | The hand state machine: blinds, turn order, betting rules, streets, showdown, client-safe views |

## How the server will use it

```ts
let state = startHand({ smallBlind, bigBlind, dealerSeat, players, randomInt: secureRandomInt });
state = applyAction(state, seat, { type: "raise", amount: 300 }); // throws PokerError if illegal
const view = toPlayerView(state, seat); // what that player may see
```

- `HandState` holds the deck and every hole card. It stays on the server.
- `applyAction` never modifies its input; it returns a new state or throws. A
  rejected action therefore cannot leave a half-applied state.
- `state.version` goes up by one per action, which lets the server reject
  stale or duplicated requests.
- Determinism: the only randomness is the shuffle in `startHand`. The same
  shuffle and the same actions always produce the same result.

## Rules implemented

- 2 to 9 players. Button moves to the next occupied seat each hand.
- Heads-up: the button posts the small blind and acts first pre-flop; the big
  blind acts first on later streets.
- A player who cannot cover a blind posts what they have and is all-in.
- Minimum bet is the big blind. Minimum raise is the size of the last full bet
  or raise. A player may always go all-in for less.
- An all-in raise smaller than the minimum does not reopen the betting for
  players who have already acted (they may call or fold), unless several short
  all-ins together amount to a full raise.
- The big blind has the option to raise when everyone only calls.
- A bet nobody could match is returned before pots are formed.
- Side pots for every distinct all-in amount; folded players' chips stay in.
- Exact ties split the pot. Odd chips go to the first winner left of the button.
- A burn card is dealt before the flop, turn and river.
- When no further betting is possible the remaining cards are dealt and the
  hand goes to showdown. All players still in show their cards.
- Timeout action: check if free, otherwise fold.

## Tests (124)

- `cards.test.ts`: deck integrity, shuffle fairness and determinism.
- `evaluator.test.ts`: every category, kickers, ties, seven-card edge cases,
  and agreement with an independent brute-force evaluator on 30,000 random hands.
- `pots.test.ts`: side pots, dead money, odd chips, chip conservation.
- `engine.test.ts`: turn order, blinds, betting rules, invalid actions,
  showdowns, side pots, split pots, timeouts, information hiding, and 5,000
  random hands checked for chip conservation and correct settlement.
