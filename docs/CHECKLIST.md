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

## Stage 6 — Lobby and social (done)
- [x] Lobby with live public tables, create and join (built in stage 5)
- [x] Public player profiles (`/players/NAME`) and own profile with statistics
- [x] Leaderboard: top 50 by chips, hands won or biggest pot
- [x] Table chat: live, uncensored, plain-text rendering, 5 messages per 10 seconds
- [x] Daily bonus: 1,000 chips every 24 hours, duplicate-proof
- [x] 36 database tests, 36 live checks (`tests/e2e/social.e2e.cjs`)

## Guest play (added after stage 6 at the owner's request)
- [x] `/play`: pick a name and play, no email or password
- [x] Guests can optionally save their account later with an email and password
- [x] Tested: entry page, name validation, redirects, clear message when guest sign-in is disabled
- [x] Live guest flow: enter, play, claim bonus, save account, log back in; a friend joins from an invitation link with no account

## Stage 7 — Design and user experience (done)
- [x] Header switches to the menu below 1024px (fixes iPad portrait overflow); balance stays visible
- [x] Table follows screen orientation: tall oval in portrait, wide in landscape; phones use full width
- [x] Bet markers moved clear of the player's own cards
- [x] Seats show each player's last action ("Raise 300", "Check"), full name on hover, turn glow, win pop
- [x] Bet presets no longer duplicate (e.g. ½ pot equal to min)
- [x] In-app confirm dialogs replace browser pop-ups; info messages no longer shown in red
- [x] Host can close the table at any time (the hand in progress is cancelled, bets returned)
- [x] Other players see "table not available" when it closes
- [x] "Your turn" shown in the browser tab title
- [x] Error page with retry instead of a blank screen
- [x] Layout sweep at 6 screen sizes (`tests/e2e/layout.e2e.cjs`): no sideways scrolling, every seat on screen

## Stage 8 — Testing, security and deployment (awaiting approval)
- [x] Dependency audit: 0 known vulnerabilities in production dependencies
- [x] Database permission audit; now a permanent test (`tests/db/permissions.db.test.ts`)
- [x] Hardening migration: two internal trigger functions no longer callable by clients
- [x] Content Security Policy in production; browser tests fail if it blocks anything
- [x] Full test pass: 165 unit/database tests and 6 live browser suites
- [x] Deployment guide (`docs/DEPLOYMENT.md`) and test-account cleanup script
- [ ] Verify the live Vercel deployment (needs the address)
- [ ] Owner: run `20261118000001_hardening.sql` in Supabase

## Dragon rig (preparation for a victory animation)
- [x] Original drawing script preserved in `scripts/dragon/`
- [x] 142 facets grouped into 11 named parts with pivots, original order kept
- [x] `<Dragon>` API unchanged; optional `pose` prop for animation
- [x] Proven unchanged: facet fingerprint test, and pixel comparison of home page, card backs and practice table on phone, iPad (both ways) and desktop
- [ ] Victory animation (not started)
