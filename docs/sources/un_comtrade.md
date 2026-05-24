# UN Comtrade

Bilateral monthly merchandise trade flows published by the United Nations
Statistics Division. Cargrid uses Comtrade as the source-of-truth for the
`trade_flows` table when the US is not the reporter, and as a
cross-reference for US-as-reporter flows that overlap with US Census data.

## Endpoint

- Base: `https://comtradeapi.un.org`
- Path used in Phase 2: `GET /data/v1/get/C/M/HS`
  - `typeCode=C` — commodities
  - `freqCode=M` — monthly
  - `classificationCode=HS` — Harmonized System
- Query parameters: `reporterCode`, `partnerCode`, `cmdCode`, `period`
- Docs: https://comtradeapi.un.org/

## Auth

Free public tier requires no API key. Higher rate limits require a free
JWT key. Cargrid stays in the free tier for Phase 2.

## Rate limits

- Free tier: 60 requests per minute (1 req/sec).
- Encoded in `sources.rate_limit_per_sec = 1.0`.
- Phase 2 ingester replays a recorded fixture and does not hit the live
  endpoint.

## Refresh cadence

- Comtrade publishes ~1 month after the close of the reporting month.
- Plan: monthly cron once Phase 4 deploys the orchestrator.

## License / ToS

- Comtrade data is freely redistributable for non-commercial research
  with attribution. See https://comtrade.un.org/data/Help/PoliciesAndDisclaimer
- Cargrid is a research dashboard; attribution lives in the UI footer
  (Phase 4) and in the source row's `display_name`.

## Data dictionary (raw → trade_flows mapping)

| Raw field        | Type   | Maps to                  | Notes                                  |
| ---------------- | ------ | ------------------------ | -------------------------------------- |
| `reporterISO`    | str    | `reporter` (ISO-2)       | ISO-3 → ISO-2 via internal lookup.     |
| `partnerISO`     | str    | `partner` (ISO-2)        | Same.                                  |
| `cmdCode`        | str    | `hs_code`                | HS-4 or HS-6.                          |
| `refYear`        | int    | `year`                   |                                        |
| `refMonth`       | int    | `month`                  | 1–12.                                  |
| `primaryValue`   | number | `value_usd`              | Already USD.                           |
| `qty`            | number | `quantity`               | Units as reported (typically units).   |
| `flowCode`       | enum   | `flow_direction`         | `M` → `import`, `X` → `export`.        |

Idempotency key: `(source, reporter, partner, hs_code, year, month, flow_direction)`.

## CLI

```
pnpm ingest:un-comtrade --year 2024 --reporter US
```

Optional flags: `--fixture <path>` overrides the default fixture
(`fixtures/un_comtrade/us-reporter-2024.json`).

## Fixture

`fixtures/un_comtrade/us-reporter-2024.json` — 12 months of US-as-reporter
data covering 14 partners × 3 HS codes × import/export, deterministically
seeded by `scripts/generate-fixtures.ts`.
