# Project checklist

Legend: [x] built and tested · [ ] not started

## Stage 1 — Architecture and project setup (done)
- [x] Next.js 16 (App Router) + TypeScript + Tailwind CSS 4, folder structure
- [x] Environment variable template and typed, server-only secret access
- [x] Design system (`/design`), landing page, navigation, 404, security headers
- [x] Architecture and cost write-up (`docs/ARCHITECTURE.md`)

## Stage 2 — Database and authentication (in progress)
Legend here: [x] built and tested · [~] built, waiting on the live database to test end to end
- [x] Schema migration: profiles, chip ledger, player statistics
- [x] Row Level Security and column grants, 31 SQL checks passing on local Postgres
- [x] One-time 10,000 chip grant inside the sign-up transaction (unique index prevents a second)
- [x] Form validation, signed-out redirects, safe redirect handling (browser tested)
- [~] Register, login, logout against the live project
- [~] Password reset by email
- [~] Profile page, avatar picker, chip history
- [ ] You: run the migration SQL in Supabase and turn off "Confirm email"

## Stage 3 — Poker engine
- [ ] Deck, secure shuffle, dealing
- [ ] Hand evaluator and comparison
- [ ] Betting rounds, blinds, dealer rotation, turn order
- [ ] Side pots and split pots
- [ ] Automated tests

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
