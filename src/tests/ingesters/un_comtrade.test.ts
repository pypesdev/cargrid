import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runIngester } from "../../ingest/runner";
import { createUnComtradeIngester } from "../../ingesters/un_comtrade";
import { count, makeTestDb, REPO_ROOT, seedAllSources } from "./helpers";

const FIXTURE = "fixtures/un_comtrade/us-reporter-2024.json";

describe("un_comtrade ingester", () => {
  beforeAll(() => {
    process.env.CARGRID_FIXTURES_ROOT = REPO_ROOT;
  });

  let env: ReturnType<typeof makeTestDb>;
  beforeEach(() => {
    env = makeTestDb();
    seedAllSources(env.db);
  });

  it("parses + validates + upserts a known fixture", async () => {
    const ing = createUnComtradeIngester({ year: 2024, reporter: "US" });
    const result = await runIngester(ing, env.db, { fixture: FIXTURE });
    expect(result.status).toBe("ok");
    expect(result.rowCount).toBeGreaterThan(0);
    expect(result.rejected).toEqual([]);
    expect(result.upsert.inserted).toBe(result.rowCount);
    expect(count(env.sqlite, "trade_flows")).toBe(result.upsert.inserted);
  });

  it("idempotent: second run inserts 0 rows", async () => {
    const ing = createUnComtradeIngester({ year: 2024, reporter: "US" });
    await runIngester(ing, env.db, { fixture: FIXTURE });
    const before = count(env.sqlite, "trade_flows");
    const second = await runIngester(ing, env.db, { fixture: FIXTURE });
    expect(second.upsert.inserted).toBe(0);
    expect(second.upsert.skipped).toBe(second.rowCount);
    expect(count(env.sqlite, "trade_flows")).toBe(before);
  });

  it("writes an ingestion_runs row with terminal status=ok and fixture path", async () => {
    const ing = createUnComtradeIngester({ year: 2024, reporter: "US" });
    await runIngester(ing, env.db, { fixture: FIXTURE });
    const runs = env.sqlite
      .prepare(
        "SELECT source_key, status, row_count, fixture_used, finished_at FROM ingestion_runs",
      )
      .all() as Array<{
      source_key: string;
      status: string;
      row_count: number;
      fixture_used: string | null;
      finished_at: number | null;
    }>;
    expect(runs).toHaveLength(1);
    expect(runs[0].source_key).toBe("un_comtrade");
    expect(runs[0].status).toBe("ok");
    expect(runs[0].fixture_used).toBe(FIXTURE);
    expect(runs[0].finished_at).not.toBeNull();
  });

  it("validate rejects negative monetary fields", () => {
    const ing = createUnComtradeIngester();
    const negative = {
      reporter: "US",
      partner: "MX",
      hsCode: "8703",
      year: 2024,
      month: 1,
      valueUsd: -1,
      quantity: -2,
      flowDirection: "import" as const,
    };
    const v = ing.validate(negative);
    expect(v.ok).toBe(false);
    if (!v.ok) {
      const paths = v.errors.map((e) => e.path).sort();
      expect(paths).toContain("valueUsd");
      expect(paths).toContain("quantity");
    }
  });

  it("parse throws on out-of-range month (caught by the runner as a parse rejection)", () => {
    const ing = createUnComtradeIngester();
    expect(() =>
      ing.parse({
        refYear: 2024,
        refMonth: 13,
        reporterISO: "USA",
        partnerISO: "MEX",
        flowCode: "M",
        cmdCode: "8703",
        primaryValue: 1,
        qty: 0,
      }),
    ).toThrow(/12/);
  });

  it("idempotencyKey aligns with the trade_flows unique index", () => {
    const ing = createUnComtradeIngester();
    const rec = {
      reporter: "US",
      partner: "MX",
      hsCode: "8703",
      year: 2024,
      month: 1,
      valueUsd: 1,
      quantity: 1,
      flowDirection: "import" as const,
    };
    expect(ing.idempotencyKey(rec)).toBe("un_comtrade|US|MX|8703|2024|1|import");
  });

  it("throws on live fetch without a fixture", async () => {
    const ing = createUnComtradeIngester();
    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of ing.fetch({})) {
        // unreachable
      }
    }).rejects.toThrow(/fixture/);
  });
});
