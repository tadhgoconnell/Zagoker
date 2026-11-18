# Supabase setup

One-off steps in the Supabase dashboard for a new project.

## 1. Create the tables

1. Open **SQL Editor** and choose **New query**.
2. Paste the full contents of each file in `supabase/migrations/`, oldest first, and press **Run**.
   - `20261112000001_accounts_and_chips.sql`
   - `20261113000001_tables_and_hands.sql`
   - `20261114000001_realtime_and_timers.sql`
   - `20261115000001_social.sql`
   - `20261118000001_hardening.sql`

Each migration is run once. If the Supabase CLI is linked to the project,
`supabase db push` does the same thing.

## 2. Authentication settings

- **Authentication → Sign In / Providers → Email**: turn **Confirm email** off
  (players can start straight after signing up).
- **Authentication → Sign In / Providers**: turn **Allow anonymous sign-ins** on.
  This is what lets visitors play as a guest with only a name.
- **Authentication → URL Configuration**:
  - **Site URL**: the production address, e.g. `https://royal-poker.vercel.app`
  - **Redirect URLs**: add `http://localhost:3000/auth/callback` and
    `https://royal-poker.vercel.app/auth/callback` (used by password-reset emails).

## 3. Keys

**Project Settings → API Keys**

| Key | Goes in | Secret? |
| --- | --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | No |
| Publishable / anon key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No (Row Level Security protects the data) |
| Secret / service_role key | Not used by this project | Keep it private; it is not needed |

## 4. Game server key

The game server proves itself to the database with its own key, which only
unlocks dealing, recording actions and settling hands.

```bash
node scripts/generate-game-key.mjs production
```

It prints a `GAME_SERVER_KEY=...` line (secret: put it in `.env.local` and in
Vercel) and one SQL statement containing only the key's hash (run it once in
the SQL editor). To retire a key, delete its row from `private.server_keys`.

## Testing the database rules locally

`supabase/tests/run-local.sh` applies the migrations to an empty, disposable
Postgres database and runs the SQL security tests:

```bash
DATABASE_URL=postgres://postgres@localhost:5432/zag_test supabase/tests/run-local.sh
```

`npm run test:db` runs the tables/hands integration tests the same way
(set `TEST_DATABASE_URL` to a local Postgres server).
