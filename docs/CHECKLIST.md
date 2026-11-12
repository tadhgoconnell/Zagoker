# Project checklist

Legend: [x] built and tested · [ ] not started

## Stage 1 — Architecture and project setup (awaiting approval)
- [x] Inspect existing project (directory was empty)
- [x] Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- [x] Folder structure
- [x] Environment variable template and typed, server-only secret access
- [x] Design system: tokens, Button, Panel, Badge, Chip, Logo, PlayingCard (`/design`)
- [x] Landing page: hero, how it works, features, virtual-chips-only section
- [x] Navigation: header, mobile menu, footer, 404
- [x] Security response headers
- [x] Architecture and cost write-up (`docs/ARCHITECTURE.md`)
- [x] Verified: typecheck, lint, production build, browser checks at 1440/820/390 px

## Stage 2 — Database and authentication
- [ ] Supabase project, schema migrations, RLS
- [ ] Register, login, logout, password reset, usernames
- [ ] Profiles and avatars
- [ ] One-time 10,000 chip grant

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
`/login`, `/register` (stage 2) and `/lobby`, `/leaderboard` (stage 6) currently
show an honest "arrives in stage N" notice with no fake controls.
