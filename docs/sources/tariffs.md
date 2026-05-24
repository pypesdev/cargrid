# Tariffs (HTSUS + non-US schedules)

Static tariff schedule for HS 8703 / 8704 / 8711 across seven
destinations (US, CA, MX, EU, GB, JP, AU), including USMCA and GSP
carveouts. Cargrid stores this as a committed fixture rather than
ingesting from a live source — tariff schedules change slowly and the
authoritative sources are PDFs / web tables that are not designed for
machine consumption.

## Source key

- `htsus` — registered in `sources.source_key` with `display_name`
  "USITC Harmonized Tariff Schedule (static)".

## Source documents

| Destination | Schedule                                           | URL                                                  |
| ----------- | -------------------------------------------------- | ---------------------------------------------------- |
| US          | USITC Harmonized Tariff Schedule (HTS)             | https://hts.usitc.gov/                               |
| CA          | Canada Border Services Agency — Customs Tariff    | https://www.cbsa-asfc.gc.ca/trade-commerce/tariff-tarif/menu-eng.html |
| MX          | Tarifa de la Ley de los Impuestos Generales       | https://www.snice.gob.mx/                            |
| EU          | EU TARIC                                           | https://taric.ec.europa.eu/                          |
| GB          | UK Trade Tariff                                    | https://www.gov.uk/trade-tariff                      |
| JP          | JETRO Tariff Database                              | https://www.customs.go.jp/english/tariff/index.htm  |
| AU          | Australian Customs Tariff                          | https://www.abf.gov.au/importing-exporting-and-manufacturing/tariff-classification |

## Refresh cadence

- **Annually** (Jan 1 effective date), or on any mid-year
  presidential proclamation that changes our HS codes.
- Re-run `scripts/generate-fixtures.ts` after edit-in-place updates to
  `fixtures/tariffs/htsus_8703.json` to regenerate the JSON formatting.
- The next live-ingester swap (Phase 4+) would replace this static
  fixture with a periodic scrape of each authority's published tariff
  XML / JSON.

## Trade agreements encoded

The `trade_agreement` column distinguishes three regimes per destination:

- `none` — MFN (most-favored-nation) rate.
- `USMCA` — 0% preferential rate for originating US/CA/MX goods. Set on
  destinations US, CA, MX for all three HS codes.
- `GSP` — Generalized System of Preferences 0% rate. Set on US, EU, GB,
  AU for HS 8703 (passenger vehicles) and 8711 (motorcycles). Not
  applied to 8704 (light trucks) since the US "chicken tax" carveout
  excludes light trucks from GSP eligibility.

## Data dictionary (raw → tariffs mapping)

The fixture is already in normalized form — one row per
`(destination_country, hs_code, trade_agreement, effective_from)`. Raw
keys map 1:1 to schema columns: `destination_country`, `hs_code`,
`ad_valorem_pct`, `specific_usd`, `trade_agreement`, `effective_from`,
`effective_to`.

Idempotency key: `(source, destination_country, hs_code, trade_agreement, effective_from)`.

## CLI

No standalone CLI — loaded as part of `pnpm ingest:seed`.

## Fixture

`fixtures/tariffs/htsus_8703.json` — 38 rows covering 7 destinations
× 3 HS codes plus USMCA (US/CA/MX × 3) and GSP (US/EU/GB/AU × 2)
preferential lines.
