# Supabase setup

One-off steps in the Supabase dashboard for a new project.

## 1. Create the tables

1. Open **SQL Editor** and choose **New query**.
2. Paste the full contents of each file in `supabase/migrations/`, oldest first, and press **Run**.
   - `20261112000001_accounts_and_chips.sql`

Each migration is run once. If the Supabase CLI is linked to the project,
`supabase db push` does the same thing.

## 2. Authentication settings

- **Authentication → Sign In / Providers → Email**: turn **Confirm email** off
  (players can start straight after signing up).
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
| Secret / service_role key | `SUPABASE_SERVICE_ROLE_KEY` | **Yes.** Server only. Needed from the betting stage onwards. |

## Testing the database rules locally

`supabase/tests/run-local.sh` applies the migrations to an empty, disposable
Postgres database and runs the SQL security tests:

```bash
DATABASE_URL=postgres://postgres@localhost:5432/zag_test supabase/tests/run-local.sh
```
