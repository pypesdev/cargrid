# Ingester Contract (Phase 1)

This document is the contract for the `Ingester<T>` interface defined in
`src/ingest/types.ts`. Phase 2 implements concrete ingesters against
this interface; Phase 1 only nails down the shape and lifecycle.

## Interface

```ts
interface Ingester<T> {
  readonly name: string;
  readonly sourceKey: string;

  fetch(opts: FetchOptions): AsyncIterable<RawRow>;
  parse(raw: RawRow): T;
  validate(parsed: T): ValidationResult<T>;
  upsert(records: T[], db: BetterSQLite3Database): Promise<UpsertStats>;
  idempotencyKey(record: T): string;
}
```

Supporting types:

```ts
type RawRow = Record<string, unknown>;

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ValidationError[] };

interface ValidationError { path: string; message: string }

interface UpsertStats { inserted: number; updated: number; skipped: number }

interface FetchOptions {
  since?: Date;
  until?: Date;
  fixture?: string; // path to a recorded fixture, bypasses network
}
```

### Field semantics

- `name` — short, log-friendly identifier (`"un_comtrade.monthly"`).
- `sourceKey` — matches a row in the `sources` table; the orchestrator
  uses it to write the `ingestion_runs.source_key` FK.
- `fetch(opts)` — yields raw rows from the upstream source. Honors
  `opts.fixture` by replaying recorded JSON instead of hitting the
  network. The orchestrator passes `since`/`until` for incremental
  windows; ingesters that cannot honor a window MUST throw at
  construction time, not silently ignore the option.
- `parse(raw)` — pure, no I/O. Converts a raw row to the typed `T`.
- `validate(parsed)` — pure, no I/O. Returns either an `ok: true` value
  or a list of structured errors with a JSON-pointer-style `path`.
- `upsert(records, db)` — writes a batch using `idempotencyKey` to
  dedupe. Must be transactional per call. Returns counts.
- `idempotencyKey(record)` — deterministic. Two records with the same
  key MUST be considered the same row by `upsert`.

## Lifecycle

The orchestrator runs every ingester through this sequence:

1. Insert an `ingestion_runs` row with `status = 'running'`,
   `started_at = now`, `fixture_used = opts.fixture ?? null`.
2. Iterate `fetch(opts)`.
3. For each raw row: call `parse`, then `validate`. Successful rows are
   buffered; failed rows are logged with their `ValidationError[]` and
   the run counter is incremented but the row is dropped.
4. Flush buffered rows to `upsert` in batches (default 500).
5. Update the `ingestion_runs` row with `finished_at`, terminal
   `status` (`ok` or `error`), `row_count`, and `error_message` when
   applicable.

## Rules

- **Never throw inside the iterator.** `fetch` MUST yield until the
  source is exhausted or a terminal error is unrecoverable. Per-row
  errors are surfaced via `validate`, not by throwing from the loop.
  Network exhaustion or auth failure may throw — those are terminal.
- **Rate limit at the source.** Use `p-limit` (or equivalent) sized to
  `sources.rate_limit_per_sec`. The orchestrator does not throttle for
  you.
- **Respect `robots.txt`.** For any scraped source (`cars_and_bids`,
  `bat`, future additions), check `robots.txt` on first fetch in a
  process and cache for the process lifetime. A disallowed path is a
  terminal error.
- **`parse` and `validate` are pure.** No network, no DB, no clock
  reads. This is what makes fixture replay deterministic.
- **`idempotencyKey` is the dedup contract.** It must align with the
  table's `*_unique` index in `docs/specs/schema.md` so DB-level
  uniqueness and ingester-level dedup never disagree.

## Out of scope for Phase 1

- Concrete ingester implementations (Phase 2).
- The orchestrator process itself (Phase 2).
- Backfill / replay UX (Phase 4).
