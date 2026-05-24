import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runIngester } from "../../ingest/runner";
import { createUsCensusIngester } from "../../ingesters/us_census";
import { count, makeTestDb, REPO_ROOT, seedAllSources } from "./helpers";

const FIXTURE = "fixtures/us_census/q1-2024-port-detail.json";

describe("us_census ingester", () => {
  beforeAll(() => {
    process.env.CARGRID_FIXTURES_ROOT = REPO_ROOT;
  });

  let env: ReturnType<typeof makeTestDb>;
  beforeEach(() => {
    env = makeTestDb();
    seedAllSources(env.db);
  });

  it("aggregates port-detail rows into monthly partner/hs records", async () => {
    const ing = createUsCensusIngester({ quarter: "2024Q1" });
    const result = await runIngester(ing, env.db, { fixture: FIXTURE });
    expect(result.status).toBe("ok");
    // Fixture is 5 ports per (partner, hs, month). Upsert aggregates.
    expect(result.upsert.inserted).toBe(result.rowCount / 5);
    expect(count(env.sqlite, "trade_flows")).toBe(result.upsert.inserted);
  });

  it("idempotent: second run inserts 0 rows", async () => {
    const ing = createUsCensusIngester({ quarter: "2024Q1" });
    await runIngester(ing, env.db, { fixture: FIXTURE });
    const before = count(env.sqlite, "trade_flows");
    const second = await runIngester(ing, env.db, { fixture: FIXTURE });
    expect(second.upsert.inserted).toBe(0);
    expect(count(env.sqlite, "trade_flows")).toBe(before);
  });

  it("filters to the requested quarter only", async () => {
    const ing = createUsCensusIngester({ quarter: "2023Q4" });
    const result = await runIngester(ing, env.db, { fixture: FIXTURE });
    // No 2023 rows in fixture, so all upstream rows filtered out.
    expect(result.rowCount).toBe(0);
    expect(result.upsert.inserted).toBe(0);
  });

  it("parses CTY_CODE into ISO-2 partner code", () => {
    const ing = createUsCensusIngester();
    const r = ing.parse({
      CTY_CODE: 2010, // MX
      I_COMMODITY: "8703",
      YEAR: "2024",
      MONTH: "01",
      GEN_VAL_MO: "100",
      GEN_QY1_MO: "5",
    });
    expect(r.partner).toBe("MX");
    expect(r.flowDirection).toBe("import");
  });

  it("rejects unknown CTY_CODE via parse-throw", () => {
    const ing = createUsCensusIngester();
    expect(() =>
      ing.parse({
        CTY_CODE: 99999,
        I_COMMODITY: "8703",
        YEAR: "2024",
        MONTH: "01",
        GEN_VAL_MO: "100",
        GEN_QY1_MO: "5",
      }),
    ).toThrow(/CTY_CODE/);
  });
});
