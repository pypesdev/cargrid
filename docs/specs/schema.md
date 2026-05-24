# Cargrid Schema (Phase 1)

This document is the data-dictionary contract for the Drizzle schema in
`src/db/schema.ts`. The type-only test in `src/tests/schema.test.ts`
enforces that the inferred types match what is documented here.

All tables use SQLite types via Drizzle's `sqlite-core` builders:

- `text` → string
- `integer` → number (used for both integer values and Unix-millis timestamps)
- `real` → number (floating point)

Indices noted below are real indices in the migration. Foreign keys use
SQLite's default `ON UPDATE no action ON DELETE no action`.

---

## `sources`

Registry of upstream data providers. Seeded; not ingested.

| Column                | Type   | Null | Notes                                                            |
| --------------------- | ------ | ---- | ---------------------------------------------------------------- |
| `source_key`          | text   | no   | PK. Stable slug, e.g. `un_comtrade`, `us_census`, `freightos`, `cars_and_bids`, `bat`. |
| `display_name`        | text   | no   | Human-readable name.                                             |
| `base_url`            | text   | no   | Canonical base URL for the source's API or site.                 |
| `rate_limit_per_sec`  | real   | no   | Soft client-side rate cap used by ingesters.                     |

**Source of truth ingester:** none (manual seed in Phase 2 `scripts/seed.ts`).

---

## `vehicles`

Catalog of vehicle records. HS code constrained to the three classes in
scope for cargrid.

| Column        | Type    | Null | Notes                                                |
| ------------- | ------- | ---- | ---------------------------------------------------- |
| `id`          | integer | no   | PK, autoincrement.                                   |
| `make`        | text    | no   |                                                      |
| `model`       | text    | no   |                                                      |
| `year`        | integer | no   |                                                      |
| `body_class`  | text    | no   | e.g. `sedan`, `suv`, `pickup`, `motorcycle`.         |
| `fuel_type`   | text    | no   | e.g. `gasoline`, `diesel`, `bev`, `phev`, `hybrid`.  |
| `hs_code`     | text    | no   | Enum: `8703`, `8704`, `8711`.                        |

**Indices**

- `vehicles_make_model_year_idx` on (`make`, `model`, `year`)
- `vehicles_hs_code_idx` on (`hs_code`)

**Source of truth ingester:** `vpic` (Phase 2). Manual seed entries are
allowed; ingester upsert keys on `(make, model, year)`.

---

## `trade_flows`

Bilateral monthly trade flows per HS code.

| Column           | Type    | Null | Notes                                                  |
| ---------------- | ------- | ---- | ------------------------------------------------------ |
| `id`             | integer | no   | PK, autoincrement.                                     |
| `reporter`       | text    | no   | ISO-3166 alpha-2 country code of the reporting party.  |
| `partner`        | text    | no   | ISO-3166 alpha-2 country code of the counterparty.     |
| `hs_code`        | text    | no   | HS-6 or HS-4 product code (`8703`, `870321`, etc.).    |
| `year`           | integer | no   |                                                        |
| `month`          | integer | no   | 1–12.                                                  |
| `value_usd`      | real    | no   | Trade value in USD.                                    |
| `quantity`       | real    | no   | Unit quantity as reported by the source.               |
| `flow_direction` | text    | no   | Enum: `import`, `export`.                              |
| `source`         | text    | no   | FK → `sources.source_key`.                             |

**Indices**

- `trade_flows_lookup_idx` on (`reporter`, `partner`, `year`, `month`, `hs_code`)
- `trade_flows_unique` (UNIQUE) on (`source`, `reporter`, `partner`, `hs_code`, `year`, `month`, `flow_direction`)

**Source of truth ingester:** `un_comtrade` (Phase 2). `us_census` provides
overlapping coverage for US-as-reporter and is reconciled by the analyzer
in Phase 3, not at ingest time.

---

## `shipping_rates`

Lane-level container/vehicle shipping rates.

| Column             | Type    | Null | Notes                                              |
| ------------------ | ------- | ---- | -------------------------------------------------- |
| `id`               | integer | no   | PK, autoincrement.                                 |
| `origin_port`      | text    | no   | UN/LOCODE.                                         |
| `destination_port` | text    | no   | UN/LOCODE.                                         |
| `mode`             | text    | no   | Enum: `FCL`, `RoRo`.                               |
| `rate_usd`         | real    | no   | Normalized to USD even if `currency` is non-USD.   |
| `currency`         | text    | no   | ISO-4217 of the originally quoted price.           |
| `rate_date`        | text    | no   | ISO-8601 date (`YYYY-MM-DD`) the rate was observed. |
| `source`           | text    | no   | FK → `sources.source_key`.                         |

**Indices**

- `shipping_rates_lane_idx` on (`origin_port`, `destination_port`, `rate_date`)
- `shipping_rates_unique` (UNIQUE) on (`source`, `origin_port`, `destination_port`, `mode`, `rate_date`)

**Source of truth ingester:** `freightos` (Phase 2).

---

## `tariffs`

Per-destination tariff schedule for an HS code, scoped to a trade
agreement and an effective date window.

| Column                | Type    | Null | Notes                                              |
| --------------------- | ------- | ---- | -------------------------------------------------- |
| `id`                  | integer | no   | PK, autoincrement.                                 |
| `destination_country` | text    | no   | ISO-3166 alpha-2.                                  |
| `hs_code`             | text    | no   | HS code the rate applies to.                       |
| `ad_valorem_pct`      | real    | no   | Percentage (e.g. `2.5` = 2.5%).                    |
| `specific_usd`        | real    | no   | Per-unit specific duty in USD; `0` when absent.    |
| `trade_agreement`     | text    | no   | Enum: `USMCA`, `GSP`, `none`.                      |
| `effective_from`      | text    | no   | ISO-8601 date.                                     |
| `effective_to`        | text    | yes  | ISO-8601 date; null means open-ended.              |
| `source`              | text    | no   | FK → `sources.source_key`.                         |

**Indices**

- `tariffs_lookup_idx` on (`destination_country`, `hs_code`, `effective_from`)
- `tariffs_unique` (UNIQUE) on (`source`, `destination_country`, `hs_code`, `trade_agreement`, `effective_from`)

**Source of truth ingester:** `us_census` (Phase 2) for US tariff lines.
Non-US destinations are out of scope until Phase 3.

---

## `comparables`

Sold-vehicle observations used for price comparables.

| Column              | Type    | Null | Notes                                                  |
| ------------------- | ------- | ---- | ------------------------------------------------------ |
| `id`                | integer | no   | PK, autoincrement.                                     |
| `vin_or_listing_id` | text    | no   | VIN when available, otherwise the source listing id.   |
| `source`            | text    | no   | FK → `sources.source_key`.                             |
| `sold_price_usd`    | real    | no   |                                                        |
| `sold_date`         | text    | no   | ISO-8601 date.                                         |
| `vehicle_id`        | integer | yes  | FK → `vehicles.id`; null until resolver matches.       |
| `url`               | text    | no   | Source URL of the listing.                             |
| `raw_json`          | text    | no   | JSON-encoded raw payload for re-parse without re-fetch.|

**Indices**

- `comparables_unique` (UNIQUE) on (`source`, `vin_or_listing_id`)
- `comparables_vehicle_idx` on (`vehicle_id`)
- `comparables_sold_date_idx` on (`sold_date`)

**Source of truth ingesters:** `cars_and_bids` and `bat` (Phase 2). Both
write to this table; `(source, vin_or_listing_id)` is the dedup key.

---

## `ingestion_runs`

One row per ingester invocation. Written by the ingest orchestrator
(Phase 2). The contract is owned by `src/ingest/types.ts`.

| Column          | Type    | Null | Notes                                              |
| --------------- | ------- | ---- | -------------------------------------------------- |
| `id`            | integer | no   | PK, autoincrement.                                 |
| `source_key`    | text    | no   | FK → `sources.source_key`.                         |
| `started_at`    | integer | no   | Unix milliseconds.                                 |
| `finished_at`   | integer | yes  | Unix milliseconds; null while `running`.           |
| `status`        | text    | no   | Enum: `ok`, `error`, `running`.                    |
| `row_count`     | integer | no   | Default `0`. Total rows the ingester emitted.      |
| `error_message` | text    | yes  | Populated when `status = 'error'`.                 |
| `fixture_used`  | text    | yes  | Path to fixture when run against a recorded file.  |

**Indices**

- `ingestion_runs_source_idx` on (`source_key`, `started_at`)

**Source of truth ingester:** the orchestrator itself; no external feed.

---

## Migrations

- `drizzle/0000_init.sql` creates the tables and indices above.
- `drizzle/0000_init.down.sql` reverses them (indices, then tables in
  FK-safe order).
- `pnpm db:migrate` applies pending migrations.
- `pnpm db:migrate --down` rolls back every applied migration and drops
  the `__migrations` bookkeeping table, leaving an empty database.
