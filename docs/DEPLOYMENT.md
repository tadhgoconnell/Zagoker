# Deployment guide

How to run Zagoker in production on Vercel and Supabase, from nothing.
Everything here can be done in a web browser, including on an iPad, except
generating the game server key (step 3), which needs Node.js on any computer.

## What you need

| Service | Plan | Cost |
| --- | --- | --- |
| GitHub | Free | Free |
| Supabase | Free | Free. Pauses after about a week with no activity (resume from the dashboard). About 200 simultaneous live connections. Built-in email: a few emails per hour. |
| Vercel | Hobby | Free for personal, non-commercial use. A commercial site needs Pro ($20/month). |

There is no other service: live multiplayer runs on Supabase Realtime, and
the game server is the Vercel deployment itself. Check the providers' pricing
pages before launch; limits change.

## 1. Supabase project

1. Create a project at supabase.com. Note its region.
2. **SQL Editor → New query**: paste and run each file in `supabase/migrations/`,
   one at a time, oldest first. Each should end with "Success". Run each once.
   - `20261112000001_accounts_and_chips.sql`
   - `20261113000001_tables_and_hands.sql`
   - `20261114000001_realtime_and_timers.sql`
   - `20261115000001_social.sql`
   - `20261118000001_hardening.sql`
   - `20261120000001_profile_photos.sql` (also creates the `avatars` Storage bucket)
3. Check the maintenance job exists:
   `select jobname, schedule from cron.job;` should list `zagoker-table-maintenance`
   running every minute. If it does not, enable the **pg_cron** extension
   (Database → Extensions) and run the third migration's `do $$ ... $$` block again.
4. **Authentication → Sign In / Providers**
   - **Allow anonymous sign-ins**: on (guest play).
   - **Email → Confirm email**: off (players can start straight away).
5. **Project Settings → API Keys**: copy the **Project URL** and the
   **publishable** (anon) key. The secret / service_role key is not used.

## 2. GitHub and Vercel

1. Push this repository to GitHub.
2. At vercel.com: **Add New → Project**, import the repository.
   **Framework Preset** must be **Next.js** (`vercel.json` sets this).
3. The project name decides the free address: a project named `royal-poker`
   gets `royal-poker.vercel.app` if that name is free. Rename under
   **Settings → General** if needed.
4. **Settings → Functions → Function Region**: choose the region closest to
   your Supabase region. Every poker action is a round trip from Vercel to
   Supabase, so this matters more than anything else for speed.

## 3. Game server key

The game server proves itself to the database with its own key. It unlocks
only dealing, recording actions and settling hands.

On any computer with Node.js, in this repository:

```bash
node scripts/generate-game-key.mjs production
```

It prints two things:

- `GAME_SERVER_KEY=...`: **secret**. Goes into Vercel (next step). Do not
  commit it or share it.
- `insert into private.server_keys ...`: run once in Supabase's SQL Editor.
  It contains only the key's hash.

To replace a key later: generate a new one, register it, update Vercel,
redeploy, then delete the old row: `delete from private.server_keys where label = 'old label';`

## 4. Environment variables (Vercel → Settings → Environment Variables)

| Key | Value | Secret? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL from step 1 | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key from step 1 | No |
| `NEXT_PUBLIC_SITE_URL` | Your address, e.g. `https://royal-poker.vercel.app`, no trailing slash | No |
| `GAME_SERVER_KEY` | From step 3 | **Yes** |

Apply them to Production (and Preview if you use preview deployments).
`NEXT_PUBLIC_*` values are built into the site, so **redeploy after changing
any of them** (Deployments → latest → Redeploy).

## 5. Point Supabase at the site

**Authentication → URL Configuration**

- **Site URL**: your address.
- **Redirect URLs**: add `https://YOUR-ADDRESS/auth/callback` (password-reset
  emails) and, for local development, `http://localhost:3000/auth/callback`.

## 6. Custom domain (optional)

Vercel → **Settings → Domains** → add the domain and follow the DNS
instructions. Then update `NEXT_PUBLIC_SITE_URL` and the two Supabase URL
settings to the new domain, and redeploy.

## 7. Check it works

1. Open the site, press **Play now**, enter a name. You should land in the
   lobby with 10,000 chips.
2. Create a private table; open the **Invite** link on a second device.
3. Start a hand, play to showdown, check both screens update live.

| Symptom | Cause |
| --- | --- |
| Build fails: "No Output Directory named public" | Framework Preset is not Next.js. |
| "The game server is not configured yet" | `GAME_SERVER_KEY` missing in Vercel, or not redeployed. |
| Tables load but dealing fails with "Something went wrong" | The key's `insert into private.server_keys` line was not run, or the key in Vercel is different. |
| "Guest play is switched off" | Anonymous sign-ins are off in Supabase. |
| Screens only update every 15 seconds | Realtime blocked or the third migration not run (it publishes `table_state`). |
| Password reset link goes to the wrong place | Redirect URL / Site URL not set (step 5). |
| Everything fails after a quiet week | The free Supabase project paused: resume it in the dashboard. |

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in the same four values; SITE_URL=http://localhost:3000
npm run dev
```

## Tests

| Command | What it covers |
| --- | --- |
| `npm test` | Poker engine (124 tests) |
| `TEST_DATABASE_URL=postgres://... npm run test:db` | Database rules, chip accounting and the permission audit, on a disposable local Postgres |
| `BASE_URL=http://localhost:3000 node tests/e2e/<name>.e2e.cjs` | Live browser tests against a running site and a real Supabase project: `auth`, `game`, `social`, `guest-invite`, `table`, `layout`, `practice`, `photo`, `hand-info` (the photo test also needs `SUPABASE_URL` and `SUPABASE_ANON_KEY`). They create throwaway `zagtest_*` players. |

Remove test players with `supabase/maintenance/delete-test-accounts.sql`.

## Security model in one page

- All game logic runs on the server. Browsers send intentions ("raise to 300"),
  never chip amounts or results.
- The deck and hole cards live in a database schema no browser can read.
  A player can fetch only their own two cards.
- Chips change only through database functions that lock the row, refuse
  negative balances and write a ledger entry. A finished hand is settled in
  one transaction that first checks no chips were created or lost.
- Every action carries the hand version the player saw; duplicates and stale
  requests are rejected, in the server and again in the database.
- Row Level Security on every table; `tests/db/permissions.db.test.ts` fails
  if a migration grants anything beyond the reviewed list.
- Security headers include a Content Security Policy limiting scripts and
  connections to the site and the Supabase project.
