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
- `src/ingest/` — Ingester contract types and orchestrator runner.
- `src/ingesters/` — Per-source ingester implementations.
- `src/tests/` — Vitest unit tests.
- `e2e/` — Playwright end-to-end tests.
- `drizzle/` — Generated SQL migrations.
- `scripts/` — Migration, ingest, and fixture-generation entry points.
- `fixtures/` — Recorded raw payloads replayed by ingesters in CI.
- `docs/sources/` — Per-source data dictionaries, refresh cadence, ToS notes.
- `data/` — Local SQLite database (gitignored).
- `.github/workflows/` — CI pipelines.

## Environment variables

| Var                      | Required | Used by             | Notes                                                                                                                                            |
| ------------------------ | -------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CARGRID_DB`             | no       | all scripts         | SQLite path. Defaults to `./data/cargrid.db`.                                                                                                    |
| `CARGRID_FIXTURES_ROOT`  | no       | ingesters           | Root for fixture path resolution. Defaults to cwd.                                                                                               |
| `US_CENSUS_API_KEY`      | no       | `ingest:us-census`  | Free key from https://api.census.gov/data/key_signup.html. When missing, the ingester logs a warning and proceeds against the committed fixture. |

## Ingesters

Per-source documentation lives in `docs/sources/`:

- [`un_comtrade`](docs/sources/un_comtrade.md) — UN Comtrade monthly trade flows.
- [`us_census`](docs/sources/us_census.md) — US Census Bureau port-detail imports.
- [`freightos`](docs/sources/freightos.md) — Freightos Baltic Index daily container rates.
- [`auctions`](docs/sources/auctions.md) — Cars & Bids + Bring a Trailer sold listings.
- [`tariffs`](docs/sources/tariffs.md) — HTSUS / international tariff schedules (static).

CLI:

```
pnpm ingest:un-comtrade --year 2024 --reporter US
pnpm ingest:us-census  --quarter 2024Q1
pnpm ingest:freightos  --lookback 90
pnpm ingest:auctions   --source cars_and_bids --limit 200
pnpm ingest:seed       # runs all of the above + tariffs against fixtures only
```

Every ingester writes an `ingestion_runs` row on each invocation. Re-running
`pnpm ingest:seed` is a no-op (idempotent on the per-table `*_unique` indices).

## Out of scope

- Real-time shipping booking.
- Auction bidding integration.
- Commercial broker integration.
- Scraping of paywalled auction sites.
