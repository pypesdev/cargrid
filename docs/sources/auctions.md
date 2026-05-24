# Public auctions: Cars & Bids + Bring a Trailer

Sold-vehicle observations from public auction sites used as price
comparables. Cargrid does **not** integrate with paywalled or
auth-gated auction feeds (Manheim, Copart, IAA, etc.).

## Sources

| Source key       | Site                              |
| ---------------- | --------------------------------- |
| `cars_and_bids`  | https://carsandbids.com           |
| `bat`            | https://bringatrailer.com         |

Only **publicly visible sold listings** are scraped. Active auctions
and seller PII are out of scope.

## Auth

None. Both sites are publicly browsable.

## Rate limits

- Self-imposed: 1 req/sec per host.
- Encoded in `sources.rate_limit_per_sec = 1.0`.
- Exponential backoff on `429` / `5xx`.
- `User-Agent: cargrid/0.1 (+https://github.com/pypesdev/cargrid)` so
  site operators can identify and reach us.

## `robots.txt`

The live scraper (deferred to Phase 4 cron) must check `robots.txt`
once per process via `robots-parser` and cache it for the process
lifetime. A disallowed path is a **terminal error** for that source —
not a row-level skip.

As of Phase 2:

- `https://carsandbids.com/robots.txt` allows `/auctions/`.
- `https://bringatrailer.com/robots.txt` allows `/auctions/`.

If either site updates `robots.txt` to disallow sold-listing paths, the
ingester is expected to fail-fast with a terminal error and the source
should be marked skipped in this doc.

## Refresh cadence

- Sold listings finalize within a few hours of auction close. Plan:
  hourly cron during US business hours, once Phase 4 deploys the
  orchestrator.

## License / ToS

- Cars & Bids: ToS at https://carsandbids.com/terms permits scraping of
  publicly visible content for non-commercial research; commercial
  redistribution is restricted. Cargrid uses the data internally as
  comparables, not redistributed verbatim.
- Bring a Trailer: ToS at https://bringatrailer.com/terms permits
  similar non-commercial research use.

If either site updates ToS to forbid the scraping pattern we use, the
relevant ingester is removed and this doc is updated with the quoted
restriction — we do **not** work around ToS.

## Data dictionary (raw → comparables mapping)

| Raw field          | Type    | Maps to             | Notes                                |
| ------------------ | ------- | ------------------- | ------------------------------------ |
| `vin` (when set)   | str     | `vin_or_listing_id` | Preferred — survives URL changes.    |
| `id` (fallback)    | str     | `vin_or_listing_id` | Site-assigned listing slug.          |
| `url`              | str     | `url`               | Must be `https`.                     |
| `sold_price_usd`   | number  | `sold_price_usd`    |                                      |
| `sold_date`        | str     | `sold_date`         | ISO-8601 `YYYY-MM-DD`.               |
| (full raw row)     | —       | `raw_json`          | Stored verbatim for re-parse.        |

Idempotency key: `(source, vin_or_listing_id)`.

`vehicle_id` is left `null` at ingest. The vehicle resolver (Phase 3)
matches `(make, model, year)` from the raw listing to `vehicles.id`.

## CLI

```
pnpm ingest:auctions --source cars_and_bids --limit 200
```

`--source` is required, one of `cars_and_bids` or `bat`. `--limit`
caps rows yielded. Optional `--fixture <path>` overrides the default
(`fixtures/auctions/sold-200.json`).

## Fixture

`fixtures/auctions/sold-200.json` — 200 deterministic sold-listing
records for `cars_and_bids` covering passenger cars, light trucks, and
motorcycles. Roughly 25% are VIN-less (uses listing id as dedup key)
to exercise the fallback path. Seeded by `scripts/generate-fixtures.ts`.
