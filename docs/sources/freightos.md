# Freightos Baltic Index (FBX)

Daily container shipping spot rates by major lane, published by Freightos
and the Baltic Exchange. Cargrid uses FBX as the source-of-truth for
ocean container freight rates feeding the `shipping_rates` table.

## Endpoint

- Base: `https://fbx.freightos.com`
- Public dashboard: https://fbx.freightos.com/
- Public JSON feed: index payload exposed by the dashboard; if the feed
  is gated in the future, the ingester falls back to scraping the public
  dashboard with `cheerio` and a 1 req/sec throttle. No paywall is
  bypassed.

## Auth

None for the public daily index.

## Rate limits

- Self-imposed: 1 req/sec.
- Encoded in `sources.rate_limit_per_sec = 1.0`.

## Refresh cadence

- FBX publishes daily Mon–Fri.
- Plan: daily cron once Phase 4 deploys the orchestrator. Live ingester
  will pull the last 7 days each run and rely on idempotency to avoid
  duplicates.

## License / ToS

- The Freightos Baltic Index is published for public reference and
  attribution use. See https://fbx.freightos.com/legal — non-commercial
  use with attribution is permitted; redistribution as a competing index
  product is not. Cargrid stores raw daily rates for the dashboard only
  and attributes the index in the UI footer (Phase 4).

## Data dictionary (raw → shipping_rates mapping)

| Raw field          | Type   | Maps to              | Notes                                |
| ------------------ | ------ | -------------------- | ------------------------------------ |
| `origin_port`      | str    | `origin_port`        | UN/LOCODE (e.g. `CNSHA`).            |
| `destination_port` | str    | `destination_port`   | UN/LOCODE.                           |
| `rate_usd`         | number | `rate_usd`           | Per-FEU container rate in USD.       |
| `currency`         | str    | `currency`           | Always `USD` for FBX.                |
| `date`             | str    | `rate_date`          | ISO-8601 `YYYY-MM-DD`.               |
| (constant)         | —      | `mode`               | `FCL`. RoRo rates not in FBX.        |

Idempotency key: `(source, origin_port, destination_port, mode, rate_date)`.

## CLI

```
pnpm ingest:freightos --lookback 90
```

`--lookback` is the number of days back from the most-recent date in
the fixture (or from `now` in live mode) to ingest. Optional
`--fixture <path>` overrides the default
(`fixtures/freightos/90d-major-lanes.json`).

## Fixture

`fixtures/freightos/90d-major-lanes.json` — 90 days × 6 major lanes
(China → US West Coast, US East Coast, Europe; Europe → US East Coast;
US West Coast → China; US East Coast → Europe), deterministically
seeded by `scripts/generate-fixtures.ts`.
