# Zagoker — handover for a new conversation

Written 20 November 2026, at commit `eb7fafc` ("Dragon rig: named body parts
with pivots, appearance unchanged"). Read this first, then `docs/DRAGON.md`
before touching the dragon.

---

## 1. Where things stand

- **Product:** Zagoker, a free online multiplayer No-Limit Texas Hold'em site
  with **virtual chips only** (no real money, deposits, withdrawals, purchases,
  crypto or prizes, ever).
- **Live:** https://zagoker.vercel.app (Vercel, auto-deploys from `main`).
- **Code:** GitHub `tadhgoconnell/zagoker`, branch `main`. Every feature below
  is committed, pushed and live. Working tree was clean at handover.
- **Database:** Supabase project `https://qvhduqzrcdmpqmwgmxgc.supabase.co`.
- **The original 8-stage build plan is complete** (setup, auth, engine,
  betting, real-time, social, UX, security/deploy). Since then the owner has
  asked for feature additions one at a time (see section 13).
- **Victory animation: built** (section 11). The dragon flies across the
  table breathing out coins, notes and cards when *you* win a pot.

### About the owner (how to work with them)

- Plays and tests mainly on an **iPad** (and phones). Not a developer: explain
  in plain language, give exact click-paths for dashboards.
- Their in-game username is **Scribe**.
- Standing preference: *when they ask for a definition, reply with only the
  term and its definition, nothing else.*
- Originally wanted stage-by-stage work with approval between stages; now
  gives one feature request at a time. Report what was done, how it was
  tested, and anything they need to do.
- **They run all SQL themselves** in Supabase → SQL Editor. Hand them a file
  to paste. Never push code that depends on a new column/function/bucket
  before they confirm the SQL ran (the site breaks otherwise). Pattern used:
  build and test on a local branch, send the SQL, wait, then merge and push.

---

## 2. Technology stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | **Next.js 16.4.6**, App Router, Turbopack, React 19.3 | `cacheComponents: true`, `partialPrefetching: true`. This Next version differs from older training data: read `node_modules/next/dist/docs/` before using unfamiliar APIs (`AGENTS.md` says so too). Middleware is called **`src/proxy.ts`**. Use `connection()` before reading the clock in server components (see `getCurrentUser`). |
| Language | TypeScript (strict) | `npm run typecheck` |
| Styling | Tailwind CSS 4 (`@theme` tokens in `src/app/globals.css`) | No gradients anywhere (owner's explicit request). |
| Icons | lucide-react, only for functional controls (menu, copy, send...). Decorative "generic symbols" were removed on request. |
| Auth + DB + Realtime + Storage | **Supabase** (free tier) | `@supabase/ssr`, `@supabase/supabase-js` |
| Validation | zod 4 | |
| Hosting | **Vercel** Hobby (free) | `vercel.json` sets framework `nextjs` (fixes "No Output Directory named public"). |
| Tests | vitest 5 (unit + DB integration), Playwright scripts (live browser e2e) | Chromium preinstalled in the cloud sandbox; **no WebKit** there. |

Fonts: Bricolage Grotesque (display, `font-display`), Geist Sans (UI), Geist
Mono (labels). Brand accent **#5DED51**; crowned-player gold `#f2c94c`
(`text-gold`).

---

## 3. Repository map

```
docs/                 ARCHITECTURE, POKER_ENGINE, SUPABASE_SETUP, DEPLOYMENT,
                      DRAGON, CHECKLIST, HANDOVER (this file)
scripts/
  generate-game-key.mjs         makes a GAME_SERVER_KEY + its SQL hash insert
  dragon/draw-dragon.mjs        ORIGINAL dragon drawing script (do not tidy)
  dragon/build-dragon-art.mjs   builds src/components/ui/dragon-art.ts (--check)
supabase/migrations/  6 SQL files, run in order (section 6)
supabase/maintenance/delete-test-accounts.sql
supabase/tests/       SQL stub of Supabase roles/auth for local Postgres tests
tests/db/             vitest DB integration + permission audit (local Postgres)
tests/e2e/*.e2e.cjs   live browser tests (auth, game, social, guest-invite,
                      table, layout, practice, photo, hand-info)
src/
  proxy.ts            session refresh + coarse redirects (/play for visitors)
  config/site.ts      brand name, routes, nav, gameConfig (10,000 start chips,
                      1,000 daily bonus, 2–9 players)
  config/avatars.ts   12 preset avatar keys (DB CHECK constraint matches)
  config/players.ts   display rules: crowned usernames, nickname rules
  lib/
    poker/            PURE engine: cards, evaluator, pots, engine (state
                      machine), bots, rankings, display helpers,
                      secure-random (server), browser-random (practice)
    game/             server game service + DB calls (service.ts, db.ts),
                      API schemas/errors/types, timing constants,
                      bet-chips (chip betting logic), client fetch helper
    api/http.ts       API route wrapper: auth check, cross-site check, errors
    auth/             server actions (register, login, guest, save account,
                      reset, avatar), session (getCurrentUser), schemas
    supabase/         browser + server clients
    players.ts        displayName(), isCrowned()
    photos.ts         photo URL + in-browser square JPEG resize
    lowpoly.ts        seeded RNG, facet mesh, colour shading
  app/
    (site)/...        pages with footer: home, play (guest entry), login,
                      register, forgot/reset-password, lobby, leaderboard,
                      players/[username], profile, join/[code],
                      hand-rankings, design (component showcase)
    table/[id]        live table screen (no footer)
    practice          bots practice mode (no footer)
    api/tables/...    POST create/join/leave/start/action/timeout/sit-in/
                      close/chat; GET snapshot + lobby list; api/bonus
    auth/callback     email link landing (code exchange)
  components/
    table/            poker-table (felt, seats, board, dealer, dragons),
                      seat, action-bar (chip betting), chip-token, hand-log,
                      table-chat, table-client (live screen), use-table
                      (realtime sync hook), dealer + dealer-art
    practice/practice-client.tsx
    ui/               button, panel, badge, field, alert, avatar (gems,
                      photos, crown), chip, logo, facets, confirm-dialog,
                      dragon, dragon-art (generated), dragon-rig
    cards/playing-card.tsx  (face-down back shows the dragon)
    landing/, lobby/, layout/, profile/, social/, auth/
```

---

## 4. How multiplayer poker works

### Architecture

```
Browser ──POST /api/tables/:id/action {version, action}──> Vercel function
   ▲                                                        │ verify user (Supabase)
   │                                                        │ load hand (game_load, needs GAME_SERVER_KEY)
   │                                                        │ applyAction (pure engine)
   │                                                        │ save (game_commit, checks version)
   │                                                        ▼
   └──── Supabase Realtime (postgres_changes on table_state) ◄── Postgres
         then GET /api/tables/:id for the authoritative snapshot
```

- **Vercel functions never hold connections.** Supabase Realtime pushes
  changes; each action is a short request.
- **Server-authoritative:** the engine (`src/lib/poker/engine.ts`) runs on the
  server; browsers send intentions only. The deck and hole cards live in the
  `private` schema, unreachable by clients. `toPlayerView(state, seat)` builds
  what a viewer may see (own cards only; shown hands at showdown).
- **Game server key:** server code calls `game_*` SQL functions with
  `GAME_SERVER_KEY`; only its SHA-256 is stored (`private.server_keys`). The
  Supabase service-role key is **not used** anywhere.
- **Chip safety:** bets live only inside the hand state; seat stacks change
  once at settlement (`private.finish_hand`, which first checks chips are
  conserved). Balances change only via `apply_chip_delta` (row lock, no
  negatives, ledger row in `chip_transactions`). Abandoned/aborted hands
  return every chip.
- **Concurrency:** every action carries the hand `version` the player saw;
  server and DB both reject stale/duplicate requests. One active hand per
  table enforced by a unique index.
- **Realtime client** (`components/table/use-table.ts`): subscribes after
  `supabase.realtime.setAuth()` (without it the feed is refused), applies the
  pushed public view instantly, then fetches the full snapshot; resyncs on
  "Subscribed to PostgreSQL", reconnect, focus, online; polls every 2.5 s when
  the live link is down, 15 s heartbeat otherwise. Presence shows
  disconnected players.
- **Timers:** 30 s per turn (`lib/game/timing.ts`). Any client calls
  `/timeout` after the deadline; the server checks it, checks/folds the
  player and marks them **sitting out** until "I'm back".
- **Dealing:** host starts the first hand of a private table; after that (and
  at public tables) browsers request the next deal after a pause
  (`PAUSE_AFTER_SHOWDOWN_MS` 6 s, fold ~3 s; server enforces ≥2.5 s).
- **Maintenance:** `pg_cron` runs `table_maintenance()` every minute: cancels
  hands idle 3 min, removes players away 15 min, and deletes (closes, everyone
  cashed out) any table that neither the host nor a seated player has had open
  for 30 min. The table screen checks in via `mark_table_active` (called from
  `GET /api/tables/:id`, at most one write per 30 s; `private.table_activity`).
- **Deleting tables:** the host can delete a table from the table screen
  ("Delete table") or from **Your tables** in the lobby (lists their open
  public and private tables). Uses the existing `close_table`.
- **Rules worth knowing:** one seat per player at a time; buy-in 10–1000 big
  blinds fixed per table; leaving mid-hand folds you and cashes out at hand
  end; host can close any time (cancels the hand, returns bets).

### Accounts

- **Guest play** (default "Play now"): Supabase anonymous sign-in with only a
  name (`/play`). Guests can later **save** the account (email + password)
  from the profile, keeping name/chips/stats. Email confirmation is off.
- 10,000 chips granted once at sign-up (DB trigger + unique index).
- Daily bonus 1,000 chips per 24 h (`claim_daily_bonus`).

### Betting UI

`components/table/action-bar.tsx`: **chips instead of a slider**. Five
denominations sized to the small blind (`lib/game/bet-chips.ts`); tapped chips
form a pile (tap to remove); chips = amount added now **on top of** the
player's current street bet. Min / All-in fill the pile; the button shows
"Bet 75" / "Raise to 350" / "All-in N" or how much more is needed.

### Practice mode (bots)

`/practice`, open to everyone, runs **entirely in the browser** on the same
engine (`browserRandomInt` shuffles). 1–8 bots named **Prefect #1, #2...** by
seat order; each game deals random, non-repeating personalities from 8 styles
(Shark, Maniac, Rock, Calling Station, Trapper, Bluffer, Gambler, Grinder) in
`lib/poker/bots.ts`. Difficulty 0–10 controls Monte Carlo sample count, noise
and pot-odds discipline. Bots only see their own cards. **Practice never
changes balances or stats** (deliberate: prevents chip farming).

### Other features

Table chat (uncensored, plain text, 5 msgs / 10 s, 500 chars), leaderboard
(chips / hands won / biggest pot; chips at tables count), public profiles,
profile photos (camera roll or camera; resized to 320 px JPEG on device;
`avatars` Storage bucket, own folder only; 1 h cache), hand rankings page
(☰ menu + footer), live "your hand" label above your cards, low-poly dealer
woman at the table centre (nods on new cards), display rules: names containing
"merto" show as **DURGO 💩**; **Scribe** shows in gold with a crown.

---

## 5. Design system

Flat near-black surfaces (`ink-*`), deep green felt (`felt-*`) with a faint
low-poly facet texture (`components/ui/facets.tsx`), single accent
`accent-400` = #5DED51. Avatars are generated low-poly gems (or uploaded
photos). Card backs: faceted dark card with the dragon. Tables are a tall oval
in portrait and a wide oval in landscape (`portrait:` / `landscape:`
variants); phones use full width. Header switches to the ☰ menu below 1024 px.
Respect `prefers-reduced-motion` (globals.css shortens all CSS animations).

---

## 6. Database (Supabase)

Migrations, run in order in SQL Editor (owner has run 1–4 and 6; see 13; 7
sent 23 Nov 2026):

1. `20261112000001_accounts_and_chips.sql` profiles, chip ledger, stats, RLS
2. `20261113000001_tables_and_hands.sql` tables, seats, private hands/cards,
   game_* functions, server keys, settlement
3. `20261114000001_realtime_and_timers.sql` sitting out, change feed,
   maintenance + pg_cron, realtime publication
4. `20261115000001_social.sql` chat, daily bonus, leaderboard/profile functions
5. `20261118000001_hardening.sql` revokes client access to 2 trigger functions
6. `20261120000001_profile_photos.sql` `avatar_path`, Storage bucket + policies
7. `20261123000001_table_cleanup.sql` table activity check-in, 30-minute
   auto-delete in `table_maintenance()` (safe to run twice)

Supabase settings: anonymous sign-ins **on**, confirm email **off**.
`tests/db/permissions.db.test.ts` pins every client-visible grant to an
allow-list; any new grant must be added there deliberately.

---

## 7. The dragon (read `docs/DRAGON.md` for full detail)

### Construction

- An **original low-poly dragon "rampant"** (rearing on hind legs, claws up,
  tail curling behind, open jaws, facing **left**), inspired by a heraldic
  lion image the owner supplied. Drawn as an **inline SVG of 142 flat-coloured
  polygons** in the box `viewBox="20 0 172 220"`. No image files.
- Drawn by `scripts/dragon/draw-dragon.mjs`: each part is an outline cut into
  triangles by fanning from an origin and shaded with light from the upper
  left; tail built as tapered quads along a centreline; claws/teeth/eye are
  flat polygons. Palette greens `#9cf493 #5ded51 #47d43c #35a92c #23731d`,
  belly `#7fef74`, teeth `#f4f5f2`, tongue `#d1302f`, eye `#0f1211`.
- Uses: card backs (full colour, `playing-card.tsx`); table felt
  (`poker-table.tsx`: one centred at 13 % opacity on portrait screens, a
  facing pair at 25 %/75 % and 16 % opacity on landscape); home page table
  (pair). `mirrored` flips via CSS `-scale-x-100`.

### Changes made to the dragon (history)

1. Created (commit `9b3cc17`) with the felt/card-back placements.
2. **Preparation step** (commit `eb7fafc`): **no visual change.** Added the
   drawing script to the repo (only `section(...)` markers added), a build
   script, the rig, the posing geometry, tests, docs. Proven unchanged by a
   SHA-256 fingerprint test of all facets
   (`8d0900938ab3b71475a20db486546b28d31ae89b990c465373b8fbb63691472c`) and
   pixel comparisons (home, card backs, practice table; phone, iPad both
   orientations, desktop). **No joint filler shapes were added.**

### Rig (in `src/components/ui/dragon-art.ts`, generated)

Facets are grouped by part **in original painting order**; each group renders
as `<g data-part="…" data-pivot="x y">`. Back to front:

| Part | Pivot (drawing coords) | Hangs from |
| --- | --- | --- |
| `wing` (membrane + bones; the FAR wing, behind body) | (103, 74) shoulder | torso |
| `tail` | (126, 146) hip | torso |
| `tailTip` (nested in tail) | (176, 98) | tail |
| `farHindLeg` (raised) | (127, 133) hip | torso |
| `torso` (body, belly, plates) | (108, 110) | — root |
| `neck` (+ back spines) | (91, 79) | torso |
| `nearHindLeg` (planted) | (110, 133) hip | torso |
| `lowerForeleg` | (92, 109) shoulder | torso |
| `upperForeleg` (raised) | (89, 87) shoulder | torso |
| `head` (horns, frill, skull, upper teeth, eye, brow, nostril) | (80, 44) | neck |
| `jaw` (nested in head, **two pieces**: jaw, then after the upper teeth, lower teeth + tongue) | (77, 55) hinge | head |

### Posing API

```tsx
<Dragon pose={{ torso: { rotate: -15, y: -4 }, wing: { rotate: -30 }, jaw: { rotate: 20 } }} />
```

`PartMove = { rotate?: deg clockwise, scale?, x?, y? }` (drawing units).
`src/components/ui/dragon-rig.ts` composes moves down the `attachedTo` chain
and emits SVG **`transform="matrix(…)"` attributes** (not CSS
transform-origin, which Safari and Chrome treat differently on SVG). Nested
DOM groups (jaw in head, tailTip in tail) only carry their own move. Exports:
`moveMatrix`, `partMatrix(part, pose, stopAt)`, `multiply`, `applyMatrix`,
`transformAttribute`. Unposed → no transforms → identical to original.

### Regenerating

Edit `draw-dragon.mjs` only for a deliberate art change, then
`node scripts/dragon/build-dragon-art.mjs`. CI-style check:
`node scripts/dragon/build-dragon-art.mjs --check` (also run by
`src/components/ui/dragon.test.tsx`). An intentional art change must update
`ORIGINAL_SHA256` in that test; otherwise it must keep passing.

---

## 8. The dealer

`components/table/dealer.tsx` + `dealer-art.ts`: original low-poly woman
(85 polygons, 200×200), dark bob, black vest, green bow tie/earring/badge.
Rendered at the table centre above pot/board. CSS keyframes `dealer-idle`
(sway) and `dealer-nod` (replayed by re-keying on `cue` = hand number + board
length).

---

## 9. Testing

| Command | Covers |
| --- | --- |
| `npm test` (vitest, `src/**/*.test.{ts,tsx}` + `tests/db`) | engine (124), bots, chip betting, rankings (300k random deals), display names, dragon fingerprint/rig. 30 s test timeout set in `vitest.config.mts`. |
| `TEST_DATABASE_URL=postgres://postgres@localhost:55432/postgres npm run test:db` | migrations + RLS + chip settlement + permission audit on a disposable local Postgres |
| `BASE_URL=… node tests/e2e/<name>.e2e.cjs` | live browser suites against a running site and the real Supabase project (create throwaway `zagtest_*` players) |

### Cloud-sandbox specifics (these cost time to rediscover)

- `.env.local` is git-ignored and **will not exist in a fresh session**.
  Needs `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key: Supabase → Project
  Settings → API Keys, or Vercel env), `GAME_SERVER_KEY`. For a new dev key:
  `node scripts/generate-game-key.mjs "dev sandbox 2"`, ask the owner to run
  the printed SQL. Never paste secrets into chat or commits.
- Network: the session uses the personal environment **"zagoker"**, which
  allows `zagoker.vercel.app` and the Supabase host. Node's fetch needs the
  proxy: run the server with
  `NODE_USE_ENV_PROXY=1 npx next start -p 3100` (after `npm run build`).
- Browser tests: `BROWSER_PROXY=$HTTPS_PROXY BASE_URL=http://localhost:3100 node tests/e2e/table.e2e.cjs`
  (add `NODE_USE_ENV_PROXY=1` for suites that call Supabase from Node; the
  photo test also needs `SUPABASE_URL` and `SUPABASE_ANON_KEY`).
- Local Postgres 16 is installed; start a throwaway cluster:
  `mkdir -p /var/tmp/zagpg && chown postgres /var/tmp/zagpg && su postgres -c "/usr/lib/postgresql/16/bin/initdb -D /var/tmp/zagpg -A trust && /usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/zagpg -o '-p 55432 -k /var/tmp/zagpg' -l /var/tmp/zagpg/log -w start"`
- **Pixel-identical comparison technique** (used for the dragon): build the
  old commit in `git worktree add /home/user/.zag-before <sha>` with
  `cp -al node_modules` (a symlink breaks Turbopack); serve on another port;
  in Playwright use `reducedMotion: "reduce"`, override
  `crypto.getRandomValues` with a seeded generator via `addInitScript`,
  `page.clock.install()` then `pauseAt` after the page loads, step with
  `clock.runFor`. Practice-table screenshots on iPad landscape show small
  run-to-run text noise even against the same build: compare inside the
  dragons' bounding boxes instead.
- Playwright's clock also controls `requestAnimationFrame`, so animations can
  be stepped frame by frame in tests.

---

## 10. Important decisions and constraints

- Virtual chips only; never add anything purchasable or redeemable.
- Server-authoritative game; never trust client amounts or outcomes.
- No Supabase service-role key in the app; only `GAME_SERVER_KEY`.
- Settlement atomic with conservation check; bets don't touch stacks mid-hand.
- Practice/bot games never touch balances or stats.
- Display-name rules and crowns are display-only (`src/config/players.ts`);
  usernames are `^[A-Za-z0-9_]{3,20}$`, case-insensitive unique.
- Visual style: flat, no gradients, #5DED51 accent, low-poly motif (dealer,
  dragon, felt, avatars, card backs, logo). Don't reintroduce stock decorative
  icons.
- Dragon artwork must stay pixel-identical at rest; animate via the rig.
- SVG part transforms via `matrix(...)` attributes, not CSS transform-origin.
- Content Security Policy (production): scripts/styles self + inline, images
  self + Supabase host, connect self + Supabase https/wss. Anything new from
  another origin will be blocked.
- Don't deploy code needing schema changes before the owner runs the SQL.

---

## 11. Victory animation — status and implementation guide

### Status

**Built** (owner's answers, 20 Nov 2026): plays only on the winner's own
screen, only for their own pot wins seen live (not when reopening a finished
hand), once per hand, about 3 s (fits the existing pauses), in practice mode
too. Reduced motion: a still dragon for 1.6 s instead. Code in
`src/components/table/victory/`; preview button on `/design`; tests in
`victory.test.ts` and `tests/e2e/victory.e2e.cjs`. No server/DB change.
Safari on a real iPad still to be checked by the owner.

**Correction to the guide below:** the jaw opens with a *negative* angle and
the head lifts with a *positive* one (they point left of their pivots).

### Recommended design (iPad-first)

1. **Where:** a new folder `src/components/table/victory/`
   (`victory-overlay.tsx`, `use-victory.ts`, `particles.tsx`,
   `flight-path.ts`). Mount the overlay inside the table's aspect box in
   `poker-table.tsx` (the `relative w-full aspect-…` div), absolutely
   positioned, `pointer-events-none`, above seats/board (e.g. `z-30`), below
   dialogs. This makes it work for live tables and practice mode alike.
2. **Trigger:** `hand.result` in the table snapshot (`winnings`, `pots`,
   `endedBy`, `shown`). Key the animation by `handNumber` so it plays once per
   hand; only play when the result arrives live (the version changed while the
   screen was open), not when reconnecting to an old finished hand. The
   overlay is purely client-side; no server or DB change is needed. Fit
   inside the post-hand pause (showdown 6 s, fold ~3 s) or lengthen
   `PAUSE_AFTER_SHOWDOWN_MS` in `lib/game/timing.ts` (clients use it; the
   server only enforces a 2.5 s minimum).
3. **Rendering for 60 fps on iPad:**
   - Render one `<Dragon>` once; drive motion **imperatively** in a
     `requestAnimationFrame` loop using refs. Do not re-render React per frame.
   - Whole-body flight: CSS `transform: translate3d(...) rotate() scale()` on
     a wrapper `div` (compositor-friendly), with `will-change: transform` only
     while flying.
   - Body parts: each frame compute `partMatrix(part, pose, enclosingPart)`
     and set the `transform` attribute on `svg.querySelectorAll('g[data-part=…]')`
     (the **jaw has two groups**; set both). For top-level groups pass
     `stopAt = null`; for `jaw` pass `"head"`, for `tailTip` pass `"tail"`.
   - At most ~11 group transforms + one wrapper transform per frame; 142
     polygons never change.
   - Avoid CSS `filter` (blur/drop-shadow) and SVG filters on animated
     elements; avoid animating `points`; keep particle count modest
     (≈30–60 DOM elements, transform/opacity only, pooled), or draw particles
     on a single `<canvas>` if more are wanted.
4. **Pose ideas** (rotate is clockwise in SVG; the dragon faces left, so
   "forward" is to the left): lean forward `torso: { rotate: -15…-25 }`; tuck
   legs (hind legs ±30–50°, forelegs ~-30°); flap `wing` between about -35°
   and +15° at 3–4 Hz with ease-in-out; sway `tail` ±10° with `tailTip`
   lagging; for the breath raise `head` (≈ +8°) then open `jaw` (-15…-25°).
   Pivots: section 7. When flying right, render `mirrored` and remember that
   rotations appear reversed on screen.
5. **Breath origin:** the mouth is around drawing coords (34–50, 48–52).
   Convert to screen with the jaw group's `getScreenCTM()` (includes the
   attribute transforms) or compute with `applyMatrix` + the svg's CTM, then
   spawn particles there each frame while the jaw is open.
6. **Particles in the house style:**
   - gold coins: new low-poly faceted coin SVG in `#f2c94c` / `#d9a92b` /
     `#c8961f` (the crown's colours, `components/ui/avatar.tsx`);
   - "money": flat green faceted notes (accent greens);
   - playing cards: reuse `PlayingCard` (face-down shows the dragon; face-up
     uses `cardParts`).
   Give them simple ballistic arcs with spin and fade; land/fade on the
   winner's seat if desired (seat positions come from `seatPosition()` in
   `poker-table.tsx`).
7. **Flight path:** enter from off-felt, cross the felt over the board, exit
   the other side; work in percentages of the table box so it scales across
   phone/iPad/desktop and both orientations (the felt is tall in portrait).
8. **Accessibility:** if `matchMedia('(prefers-reduced-motion: reduce)')`,
   skip the flight and show a brief static celebration (global CSS only
   shortens CSS animations; JS loops must check this themselves). Keep the
   overlay `aria-hidden`; the result text already announces the winner.
9. **Seams and the near wing:** big rotations may open gaps at shoulder/hips.
   If they show, add small filler facets behind joints **as a separate layer
   rendered only during the animation** (or in a dedicated flight artwork),
   so the resting dragon keeps its fingerprint. Same for a near wing in front
   of the body: new artwork in the same faceted style, drawn with the helpers
   in `draw-dragon.mjs`, rendered only in the animation.
10. **Testing:** unit-test the flight path/pose timeline as pure functions;
    e2e in practice mode with seeded `crypto.getRandomValues` and the
    Playwright clock (step `runFor` to sample frames, screenshot key frames);
    run `layout.e2e.cjs`, `practice.e2e.cjs`, `table.e2e.cjs` for
    regressions; confirm `dragon.test.tsx` still passes. Safari can't be run
    in the sandbox: ask the owner to try it on their iPad.

---

## 12. Deployment

Full guide: `docs/DEPLOYMENT.md`. Vercel env vars:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_SITE_URL` (`https://zagoker.vercel.app`), `GAME_SERVER_KEY`
(production key; its hash is in `private.server_keys`). Pushing to `main`
deploys in about a minute. `NEXT_PUBLIC_*` changes need a redeploy.

---

## 13. Outstanding tasks and known issues

Owner actions not confirmed:
- [ ] Run `20261118000001_hardening.sql` (sent, never confirmed).
- [ ] Check `select jobname, schedule from cron.job;` shows
      `zagoker-table-maintenance`.
- [ ] Authentication → URL Configuration: Site URL and Redirect URL
      `https://zagoker.vercel.app/auth/callback` (needed for password reset).
- [ ] Vercel Functions region near the Supabase region (speed).
- [ ] Delete the 152 `zagtest_*` test players (count on 20 Nov 2026)
      (`supabase/maintenance/delete-test-accounts.sql`, preview first).
- [ ] Revoke the sandbox game key: `private.server_keys` row labelled
      `dev sandbox` is valid on production; its key was only in an old
      sandbox's `.env.local`. Delete that row once a new dev key is registered.

Known limitations:
- Password reset by email never tested with a real inbox.
- Unknown `/players/<name>` returns HTTP 200 (shows the not-found screen).
- No chat or photo moderation; guests can be created freely (rankings can be
  inflated; chips have no value).
- npm audit: 17 advisories in dev-only lint/test tooling; production deps clean.
- iPad Safari never tested in-sandbox (Chromium emulation only).
- On small phones at 9-seat tables the player's own name plate can sit just
  under the controls (table area scrolls).

Victory animation done (section 11).
