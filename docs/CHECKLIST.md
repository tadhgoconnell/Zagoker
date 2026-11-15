# Project checklist

Legend: [x] built and tested · [ ] not started

## Stage 1 — Architecture and project setup (done)
- [x] Next.js 16 (App Router) + TypeScript + Tailwind CSS 4, folder structure
- [x] Environment variable template and typed, server-only secret access
- [x] Design system (`/design`), landing page, navigation, 404, security headers
- [x] Architecture and cost write-up (`docs/ARCHITECTURE.md`)

## Stage 2 — Database and authentication (done)
- [x] Schema migration: profiles, chip ledger, player statistics (applied to the live project)
- [x] Row Level Security and column grants; 31 SQL checks pass on local Postgres
- [x] One-time 10,000 chip grant inside the sign-up transaction
- [x] Register, login, logout, session persistence, protected pages
- [x] Profile page, 12 preset avatars, chip history
- [x] 32 end-to-end checks pass against the live project in two independent browser sessions (`tests/e2e/auth.e2e.cjs`)
- [x] Password reset: request form and link handling built and tested
- [ ] Password reset: receiving the email and following the link has not been tested (needs a real inbox)

## Stage 3 — Poker engine (done)
- [x] Deck, shuffle, evaluator, betting rules, pots, client-safe views; 124 tests (`npm test`)

## Stage 4 — Betting and virtual currency (done)
- [x] Tables, seats, buy-in and cash-out through the chip ledger
- [x] Server-run dealing and betting (fold, check, call, bet, raise, all-in) with the engine
- [x] Atomic settlement with a database-side chip conservation check
- [x] Hidden cards in a private schema; game server key instead of the Supabase secret key
- [x] Duplicate and stale requests rejected (hand version check in server and database)
- [x] Abandoned hands cancelled with chips restored; leaving mid-hand handled
- [x] 32 database integration tests (`npm run test:db`), 70 live API checks (`tests/e2e/game.e2e.cjs`)

## Stage 5 — Real-time multiplayer (done)
- [x] Live updates through Supabase Realtime, with polling fallback and resync on reconnect
- [x] Public and private tables, room codes, invitation links (`/join/CODE`)
- [x] Lobby with live table list, create-table form, join by code
- [x] Table screen: seats, cards, pot, bets, dealer and blind markers, action bar, hand log
- [x] 30-second turn timer enforced by the server; timed-out players sit out until "I'm back"
- [x] Automatic next hand; host starts the first hand at private tables
- [x] Presence: disconnected players are marked
- [x] Scheduled database maintenance (stale hands, long-absent players, idle tables)
- [x] 39 live multi-browser checks through the UI (`tests/e2e/table.e2e.cjs`)

## Stage 6 — Lobby and social (awaiting approval)
- [x] Lobby with live public tables, create and join (built in stage 5)
- [x] Public player profiles (`/players/NAME`) and own profile with statistics
- [x] Leaderboard: top 50 by chips, hands won or biggest pot
- [x] Table chat: live, uncensored, plain-text rendering, 5 messages per 10 seconds
- [x] Daily bonus: 1,000 chips every 24 hours, duplicate-proof
- [x] 36 database tests, 36 live checks (`tests/e2e/social.e2e.cjs`)

## Stage 7 — Design and UX polish
- [ ] Animations, loading/error/empty states, responsive table

## Stage 8 — Testing, security, deployment
- [ ] Full test pass, permission audit, Vercel deployment guide

