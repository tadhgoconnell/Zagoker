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

## Stage 3 — Poker engine (awaiting approval)
- [x] Deck, Fisher-Yates shuffle, server-only cryptographic random source
- [x] Hand evaluator and comparison (cross-checked against a brute-force evaluator on 30,000 hands)
- [x] Blinds, dealer rotation, turn order, heads-up rules
- [x] Fold, check, call, bet, raise, all-in with minimum-raise and short all-in rules
- [x] Side pots, split pots, odd-chip rule, uncalled-bet return
- [x] Client-safe views that hide the deck and other players' cards
- [x] 124 automated tests, including 5,000 random hands (`npm test`); see `docs/POKER_ENGINE.md`

## Stage 4 — Betting and virtual currency
- [ ] Fold, check, call, bet, raise, all-in end to end
- [ ] Atomic chip accounting and ledger
- [ ] Abandoned-hand safety

## Stage 5 — Real-time multiplayer
- [ ] Public and private tables, room codes, invitation links
- [ ] Live state sync, turn timers, reconnect
- [ ] Duplicate-action and race protection
- [ ] Multi-browser tests

## Stage 6 — Lobby and social
- [ ] Lobby, create/join table
- [ ] Profiles, statistics, leaderboard
- [ ] Table chat
- [ ] Daily chip bonus

## Stage 7 — Design and UX polish
- [ ] Animations, loading/error/empty states, responsive table

## Stage 8 — Testing, security, deployment
- [ ] Full test pass, permission audit, Vercel deployment guide

## Placeholder routes to replace
`/lobby` and `/leaderboard` (stage 6) currently show an honest "arrives in stage N" notice with no fake controls.
