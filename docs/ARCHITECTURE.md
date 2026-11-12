# ZAGPOKER architecture

Virtual-chip-only multiplayer No-Limit Texas Hold'em. No real money anywhere.

## Overview

```
Browser (Next.js client components)
  |  1. player actions: HTTPS POST  ------------->  Next.js server (Vercel functions)
  |                                                   - verifies the Supabase session
  |                                                   - runs the poker engine (pure TypeScript)
  |                                                   - writes state inside one DB transaction
  |                                                             |
  |  2. live updates: WebSocket  <------  Supabase Realtime  <--+  Supabase Postgres
  |                                                                 (RLS on every table)
  |  3. own hole cards: authenticated fetch, server checks seat ownership
```

### Why this shape

Vercel functions are short-lived and cannot hold WebSocket connections, so the
persistent connection is not held by Vercel at all:

- **Supabase Realtime** holds the WebSocket to every browser and pushes table
  state, chat and presence (who is connected).
- **Vercel functions** only handle short request/response calls: "player X
  raises to 400". Each call loads the hand, validates the action with the
  engine, saves the result and returns. No long-lived process is needed.
- **Postgres** is the single source of truth. Each action runs in a transaction
  that locks the hand row (`SELECT ... FOR UPDATE`) and checks a version
  number, so two simultaneous or duplicated requests cannot both apply.

### Server authority

- The deck is shuffled on the server with `crypto` secure randomness.
- The deck and all hole cards live in tables that clients have **no** RLS
  access to. Only server code using the service-role key can read them.
- Public table state (seats, stacks, bets, board, pot, whose turn) is what gets
  broadcast. A player's own hole cards are returned only to that player.
- Clients never send balances or outcomes, only intents (fold/call/raise N).
- Chip movements (buy-in, cash-out, pot settlement, daily bonus) are Postgres
  functions that run atomically and write a row to a transaction ledger.

### Turn timers without a permanent server

Every turn stores a `deadline` timestamp in the database. When it passes, any
connected client at the table calls a `timeout` endpoint; the server checks the
deadline itself and applies check/fold. Because the server validates the
deadline, a client cannot trigger it early, and duplicate calls are harmless.
A scheduled database job (`pg_cron`, included with Supabase) sweeps tables where
nobody is connected, so abandoned hands are always settled and chips returned.

### Alternative considered

A dedicated always-on Node WebSocket game server (Fly.io, Railway or Render,
roughly $5 to $7 per month). It gives slightly lower latency and in-memory
timers, but adds a second deployment, a second set of secrets and a monthly
cost. For turn-based poker the Supabase Realtime design is fast enough and
stays free, so it is the recommendation. The engine is UI- and
transport-independent, so moving to a dedicated server later would not require
rewriting game logic.

## Services and cost

| Service | Used for | Free tier | Paid if exceeded |
| --- | --- | --- | --- |
| Vercel (Hobby) | Hosting, server functions | Free for personal, non-commercial use | Pro $20/month |
| Supabase (Free) | Auth, Postgres, Realtime | 500 MB database, 50,000 monthly users, 200 concurrent realtime connections | Pro $25/month |
| GitHub | Source, Vercel deploys | Free | |

Notes: a free Supabase project pauses after about a week with no activity and
is resumed from the dashboard. Its built-in email sender (sign-up confirmation,
password reset) is limited to a few emails per hour; fine for friends, and a
free SMTP provider can be plugged in later if needed. Limits change, so check
the providers' pricing pages before launch.

## Folder structure

```
src/
  app/                 Routes (App Router). One folder per page.
    (later) api/       Server endpoints for game actions
  components/
    ui/                Design-system primitives: Button, Panel, Badge, Chip, Logo
    cards/             PlayingCard
    layout/            Header, footer, mobile nav
    landing/           Landing page sections
    (later) table/     Poker table, seats, action bar, chat
  config/site.ts       Brand name, routes, game constants
  lib/
    env.ts             Public env vars (browser-safe)
    env.server.ts      Secret env vars (server-only, build fails if imported by client code)
    utils.ts           cn(), chip formatting
    (stage 2) supabase/  Browser, server and admin clients
    (stage 3) poker/     Pure engine: deck, evaluator, betting, pots + tests
supabase/migrations/   (stage 2) SQL migrations
docs/                  Architecture, checklist
```

## Design system

Tokens are defined once in `src/app/globals.css` (`@theme`) and exposed as
Tailwind utilities: `ink-*` surfaces, `felt-*` greens, `gold-*` accents,
`cream`/`mist`/`slate` text. Display type is Playfair Display, interface type
is Geist. All components are shown on `/design`.
