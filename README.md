# Zagoker

Free online multiplayer No-Limit Texas Hold'em. Virtual chips only: no real
money, deposits, withdrawals or prizes.

Status: **Stages 1 to 3 of 8 complete** (setup and design, accounts and chips, poker engine).
See [docs/CHECKLIST.md](docs/CHECKLIST.md) and
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Run locally

Requires Node.js 20.9 or newer.

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Open http://localhost:3000. Fill in the Supabase values in `.env.local` first; see [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Poker engine tests |
