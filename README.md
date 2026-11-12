# Zagoker

Free online multiplayer No-Limit Texas Hold'em. Virtual chips only: no real
money, deposits, withdrawals or prizes.

Status: **Stage 1 of 8 complete** (project setup, design system, landing page).
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

Open http://localhost:3000. Stage 1 runs without any keys.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
