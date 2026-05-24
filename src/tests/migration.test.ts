import Database from "better-sqlite3";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { migrate } from "../db/migrator";

const MIGRATIONS_DIR = resolve(__dirname, "..", "..", "drizzle");

const EXPECTED_TABLES = [
  "sources",
  "vehicles",
  "trade_flows",
  "shipping_rates",
  "tariffs",
  "comparables",
  "ingestion_runs",
] as const;

const EXPECTED_INDICES = [
  "vehicles_make_model_year_idx",
  "vehicles_hs_code_idx",
  "trade_flows_lookup_idx",
  "trade_flows_unique",
  "shipping_rates_lane_idx",
  "shipping_rates_unique",
  "tariffs_lookup_idx",
  "tariffs_unique",
  "comparables_unique",
  "comparables_vehicle_idx",
  "comparables_sold_date_idx",
  "ingestion_runs_source_idx",
] as const;

function listTables(db: Database.Database): string[] {
  return db
    .prepare<[], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .all()
    .map((r) => r.name);
}

function listIndices(db: Database.Database): string[] {
  return db
    .prepare<[], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'",
    )
    .all()
    .map((r) => r.name);
}

describe("migrations", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
  });

  it("applies all up migrations and creates every table + index", () => {
    const result = migrate("up", { db, migrationsDir: MIGRATIONS_DIR });
    expect(result.applied.length).toBeGreaterThan(0);

    const tables = new Set(listTables(db));
    for (const t of EXPECTED_TABLES) {
      expect(tables.has(t), `expected table ${t}`).toBe(true);
    }
    expect(tables.has("__migrations")).toBe(true);

    const indices = new Set(listIndices(db));
    for (const idx of EXPECTED_INDICES) {
      expect(indices.has(idx), `expected index ${idx}`).toBe(true);
    }
  });

  it("up is idempotent", () => {
    migrate("up", { db, migrationsDir: MIGRATIONS_DIR });
    const second = migrate("up", { db, migrationsDir: MIGRATIONS_DIR });
    expect(second.applied).toEqual([]);
  });

  it("down rolls everything back to an empty database", () => {
    migrate("up", { db, migrationsDir: MIGRATIONS_DIR });
    const result = migrate("down", { db, migrationsDir: MIGRATIONS_DIR });
    expect(result.rolledBack.length).toBeGreaterThan(0);

    const tables = listTables(db);
    expect(tables).toEqual([]);
    const indices = listIndices(db);
    expect(indices).toEqual([]);
  });

  it("foreign keys are enforced after migrating up", () => {
    migrate("up", { db, migrationsDir: MIGRATIONS_DIR });
    expect(() =>
      db
        .prepare(
          "INSERT INTO trade_flows (reporter, partner, hs_code, year, month, value_usd, quantity, flow_direction, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run("US", "MX", "8703", 2025, 1, 1000, 1, "import", "no_such_source"),
    ).toThrow(/FOREIGN KEY/i);
  });

  it("unique indices enforce dedup keys", () => {
    migrate("up", { db, migrationsDir: MIGRATIONS_DIR });
    db.prepare(
      "INSERT INTO sources (source_key, display_name, base_url, rate_limit_per_sec) VALUES (?, ?, ?, ?)",
    ).run("un_comtrade", "UN Comtrade", "https://comtradeapi.un.org", 1);

    const insertFlow = db.prepare(
      "INSERT INTO trade_flows (reporter, partner, hs_code, year, month, value_usd, quantity, flow_direction, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    insertFlow.run("US", "MX", "8703", 2025, 1, 1000, 1, "import", "un_comtrade");
    expect(() =>
      insertFlow.run("US", "MX", "8703", 2025, 1, 9999, 9, "import", "un_comtrade"),
    ).toThrow(/UNIQUE/i);
  });
});
