# US Census USA Trade Online

Monthly US merchandise import/export data from the US Census Bureau,
including port-of-entry detail. Cargrid uses Census as the source-of-truth
for US-as-reporter trade flows; UN Comtrade is used for non-US reporters.

## Endpoint

- Base: `https://api.census.gov`
- Path used in Phase 2: `GET /data/timeseries/intltrade/imports/porths`
  - filtered by `I_COMMODITY` (HS code), `CTY_CODE` (partner)
- Docs: https://www.census.gov/foreign-trade/reference/guides/Guidev2.0.pdf

## Auth

Requires a free API key. Set in your environment:

```
US_CENSUS_API_KEY=your_key_here
```

If the key is missing at runtime the ingester logs:

```
us_census: set US_CENSUS_API_KEY in .env to ingest live; using fixture data
```

and proceeds against the committed fixture instead of failing the run.
Sign up: https://api.census.gov/data/key_signup.html

## Rate limits

- 500 queries/IP/day without a key, unlimited with a key.
- Encoded in `sources.rate_limit_per_sec = 5.0`.

## Refresh cadence

- Census releases monthly trade data ~45 days after month-close.
- Plan: monthly cron once Phase 4 deploys the orchestrator.

## License / ToS

- Public-domain US government data, no restrictions on redistribution.
- Attribution still appears in the dashboard footer (Phase 4).

## Data dictionary (raw → trade_flows mapping)

Port-detail rows are aggregated to `(year, month, partner, hs)` before
writing to `trade_flows`, because the trade-flows table is keyed on
those dimensions and does not store port.

| Raw field        | Type   | Maps to                  | Notes                                  |
| ---------------- | ------ | ------------------------ | -------------------------------------- |
| `CTY_CODE`       | number | `partner` (ISO-2)        | Census CTY_CODE → ISO-2 via lookup.    |
| `I_COMMODITY`    | str    | `hs_code`                | HS-4 in our subset.                    |
| `YEAR`           | str    | `year`                   |                                        |
| `MONTH`          | str    | `month`                  | Zero-padded.                           |
| `GEN_VAL_MO`     | str    | `value_usd`              | Aggregated across ports.               |
| `GEN_QY1_MO`     | str    | `quantity`               | Aggregated across ports.               |
| (constant)       | —      | `reporter`               | Always `US`.                           |
| (constant)       | —      | `flow_direction`         | Imports endpoint → always `import`.    |

Idempotency key: `(source, reporter, partner, hs_code, year, month, flow_direction)`.

## CLI

```
pnpm ingest:us-census --quarter 2024Q1
```

`--quarter` accepts `YYYYQ[1-4]`. Optional `--fixture <path>` overrides
the default fixture (`fixtures/us_census/q1-2024-port-detail.json`).

## Fixture

`fixtures/us_census/q1-2024-port-detail.json` — Q1 2024 port-of-entry
detail covering 7 partners × 3 HS codes × 5 ports × 3 months,
deterministically seeded by `scripts/generate-fixtures.ts`.
