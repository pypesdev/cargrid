# cargrid

Local-first analytics CLI and Next.js dashboard over public automobile transaction data. Not a marketplace, not a broker, not an auction integration.

## Quickstart

```
pnpm install && pnpm db:migrate && pnpm ingest:seed && pnpm dev
```

App runs on `http://localhost:3000`.

## Requirements

- Node 20+
- pnpm 9+
- SQLite (bundled via `better-sqlite3`)

## Repo layout

- `app/` — Next.js app router routes and layouts.
- `src/db/` — Drizzle schema and SQLite client.
- `src/tests/` — Vitest unit tests.
- `e2e/` — Playwright end-to-end tests.
- `drizzle/` — Generated SQL migrations.
- `scripts/` — Migration and ingest entry points.
- `data/` — Local SQLite database (gitignored).
- `.github/workflows/` — CI pipelines.

## Out of scope

- Real-time shipping booking.
- Auction bidding integration.
- Commercial broker integration.
- Scraping of paywalled auction sites.
