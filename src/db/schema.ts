import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const sources = sqliteTable("sources", {
  sourceKey: text("source_key").primaryKey(),
  displayName: text("display_name").notNull(),
  baseUrl: text("base_url").notNull(),
  rateLimitPerSec: real("rate_limit_per_sec").notNull(),
});

export const vehicles = sqliteTable(
  "vehicles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    make: text("make").notNull(),
    model: text("model").notNull(),
    year: integer("year").notNull(),
    bodyClass: text("body_class").notNull(),
    fuelType: text("fuel_type").notNull(),
    hsCode: text("hs_code", { enum: ["8703", "8704", "8711"] }).notNull(),
  },
  (t) => ({
    vehiclesMakeModelYearIdx: index("vehicles_make_model_year_idx").on(
      t.make,
      t.model,
      t.year,
    ),
    vehiclesHsCodeIdx: index("vehicles_hs_code_idx").on(t.hsCode),
  }),
);

export const tradeFlows = sqliteTable(
  "trade_flows",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reporter: text("reporter").notNull(),
    partner: text("partner").notNull(),
    hsCode: text("hs_code").notNull(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    valueUsd: real("value_usd").notNull(),
    quantity: real("quantity").notNull(),
    flowDirection: text("flow_direction", {
      enum: ["import", "export"],
    }).notNull(),
    source: text("source")
      .notNull()
      .references(() => sources.sourceKey),
  },
  (t) => ({
    tradeFlowsLookupIdx: index("trade_flows_lookup_idx").on(
      t.reporter,
      t.partner,
      t.year,
      t.month,
      t.hsCode,
    ),
    tradeFlowsUnique: uniqueIndex("trade_flows_unique").on(
      t.source,
      t.reporter,
      t.partner,
      t.hsCode,
      t.year,
      t.month,
      t.flowDirection,
    ),
  }),
);

export const shippingRates = sqliteTable(
  "shipping_rates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    originPort: text("origin_port").notNull(),
    destinationPort: text("destination_port").notNull(),
    mode: text("mode", { enum: ["FCL", "RoRo"] }).notNull(),
    rateUsd: real("rate_usd").notNull(),
    currency: text("currency").notNull(),
    rateDate: text("rate_date").notNull(),
    source: text("source")
      .notNull()
      .references(() => sources.sourceKey),
  },
  (t) => ({
    shippingRatesLaneIdx: index("shipping_rates_lane_idx").on(
      t.originPort,
      t.destinationPort,
      t.rateDate,
    ),
    shippingRatesUnique: uniqueIndex("shipping_rates_unique").on(
      t.source,
      t.originPort,
      t.destinationPort,
      t.mode,
      t.rateDate,
    ),
  }),
);

export const tariffs = sqliteTable(
  "tariffs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    destinationCountry: text("destination_country").notNull(),
    hsCode: text("hs_code").notNull(),
    adValoremPct: real("ad_valorem_pct").notNull(),
    specificUsd: real("specific_usd").notNull(),
    tradeAgreement: text("trade_agreement", {
      enum: ["USMCA", "GSP", "none"],
    }).notNull(),
    effectiveFrom: text("effective_from").notNull(),
    effectiveTo: text("effective_to"),
    source: text("source")
      .notNull()
      .references(() => sources.sourceKey),
  },
  (t) => ({
    tariffsLookupIdx: index("tariffs_lookup_idx").on(
      t.destinationCountry,
      t.hsCode,
      t.effectiveFrom,
    ),
    tariffsUnique: uniqueIndex("tariffs_unique").on(
      t.source,
      t.destinationCountry,
      t.hsCode,
      t.tradeAgreement,
      t.effectiveFrom,
    ),
  }),
);

export const comparables = sqliteTable(
  "comparables",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    vinOrListingId: text("vin_or_listing_id").notNull(),
    source: text("source")
      .notNull()
      .references(() => sources.sourceKey),
    soldPriceUsd: real("sold_price_usd").notNull(),
    soldDate: text("sold_date").notNull(),
    vehicleId: integer("vehicle_id").references(() => vehicles.id),
    url: text("url").notNull(),
    rawJson: text("raw_json").notNull(),
  },
  (t) => ({
    comparablesUnique: uniqueIndex("comparables_unique").on(
      t.source,
      t.vinOrListingId,
    ),
    comparablesVehicleIdx: index("comparables_vehicle_idx").on(t.vehicleId),
    comparablesSoldDateIdx: index("comparables_sold_date_idx").on(t.soldDate),
  }),
);

export const ingestionRuns = sqliteTable(
  "ingestion_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceKey: text("source_key")
      .notNull()
      .references(() => sources.sourceKey),
    startedAt: integer("started_at").notNull(),
    finishedAt: integer("finished_at"),
    status: text("status", { enum: ["ok", "error", "running"] }).notNull(),
    rowCount: integer("row_count").notNull().default(0),
    errorMessage: text("error_message"),
    fixtureUsed: text("fixture_used"),
  },
  (t) => ({
    ingestionRunsSourceIdx: index("ingestion_runs_source_idx").on(
      t.sourceKey,
      t.startedAt,
    ),
  }),
);

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type Vehicle = typeof vehicles.$inferSelect;
export type NewVehicle = typeof vehicles.$inferInsert;
export type TradeFlow = typeof tradeFlows.$inferSelect;
export type NewTradeFlow = typeof tradeFlows.$inferInsert;
export type ShippingRate = typeof shippingRates.$inferSelect;
export type NewShippingRate = typeof shippingRates.$inferInsert;
export type Tariff = typeof tariffs.$inferSelect;
export type NewTariff = typeof tariffs.$inferInsert;
export type Comparable = typeof comparables.$inferSelect;
export type NewComparable = typeof comparables.$inferInsert;
export type IngestionRun = typeof ingestionRuns.$inferSelect;
export type NewIngestionRun = typeof ingestionRuns.$inferInsert;

export { sql };
