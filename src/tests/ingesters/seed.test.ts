import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");

function runSeed(dbPath: string): string {
  return execSync(`pnpm -s exec tsx ${join("scripts", "seed.ts")}`, {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      CARGRID_DB: dbPath,
      CARGRID_FIXTURES_ROOT: REPO_ROOT,
    },
    encoding: "utf8",
  });
}

function migrate(dbPath: string): void {
  execSync(`pnpm -s exec tsx ${join("scripts", "migrate.ts")}`, {
    cwd: REPO_ROOT,
    env: { ...process.env, CARGRID_DB: dbPath },
    stdio: "pipe",
  });
}

describe("ingest:seed orchestrator", () => {
  let tmp: string;
  let dbPath: string;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), "cargrid-seed-"));
    dbPath = join(tmp, "cargrid.db");
    migrate(dbPath);
  });

  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("produces the documented row counts on a fresh database", () => {
    const out = runSeed(dbPath);
    expect(out).toMatch(/un_comtrade.monthly: status=ok/);
    expect(out).toMatch(/htsus.static: status=ok/);

    const db = new Database(dbPath, { readonly: true });
    const tf = db.prepare("SELECT COUNT(*) AS n FROM trade_flows").get() as {
      n: number;
    };
    const sr = db.prepare("SELECT COUNT(*) AS n FROM shipping_rates").get() as {
      n: number;
    };
    const cmp = db.prepare("SELECT COUNT(*) AS n FROM comparables").get() as {
      n: number;
    };
    const tariffs = db.prepare("SELECT COUNT(*) AS n FROM tariffs").get() as {
      n: number;
    };
    db.close();

    expect(tf.n).toBeGreaterThanOrEqual(1000);
    expect(sr.n).toBeGreaterThanOrEqual(90);
    expect(cmp.n).toBeGreaterThanOrEqual(200);
    expect(tariffs.n).toBeGreaterThan(0);
  });

  it("re-running yields zero new rows in any data table", () => {
    const db = new Database(dbPath, { readonly: true });
    const before = {
      trade_flows: db.prepare("SELECT COUNT(*) AS n FROM trade_flows").get() as { n: number },
      shipping_rates: db.prepare("SELECT COUNT(*) AS n FROM shipping_rates").get() as { n: number },
      comparables: db.prepare("SELECT COUNT(*) AS n FROM comparables").get() as { n: number },
      tariffs: db.prepare("SELECT COUNT(*) AS n FROM tariffs").get() as { n: number },
    };
    db.close();

    runSeed(dbPath);

    const db2 = new Database(dbPath, { readonly: true });
    expect(
      (db2.prepare("SELECT COUNT(*) AS n FROM trade_flows").get() as { n: number }).n,
    ).toBe(before.trade_flows.n);
    expect(
      (db2.prepare("SELECT COUNT(*) AS n FROM shipping_rates").get() as { n: number }).n,
    ).toBe(before.shipping_rates.n);
    expect(
      (db2.prepare("SELECT COUNT(*) AS n FROM comparables").get() as { n: number }).n,
    ).toBe(before.comparables.n);
    expect(
      (db2.prepare("SELECT COUNT(*) AS n FROM tariffs").get() as { n: number }).n,
    ).toBe(before.tariffs.n);
    db2.close();
  });

  it("ingestion_runs grows on every invocation", () => {
    const db = new Database(dbPath, { readonly: true });
    const total = db.prepare("SELECT COUNT(*) AS n FROM ingestion_runs").get() as { n: number };
    // 5 sources × 2 runs minimum (seed test #1 and idempotent re-run).
    expect(total.n).toBeGreaterThanOrEqual(10);
    db.close();
  });
});
