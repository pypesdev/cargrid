import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runIngester } from "../../ingest/runner";
import { createFreightosIngester } from "../../ingesters/freightos";
import { count, makeTestDb, REPO_ROOT, seedAllSources } from "./helpers";

const FIXTURE = "fixtures/freightos/90d-major-lanes.json";

describe("freightos ingester", () => {
  beforeAll(() => {
    process.env.CARGRID_FIXTURES_ROOT = REPO_ROOT;
  });

  let env: ReturnType<typeof makeTestDb>;
  beforeEach(() => {
    env = makeTestDb();
    seedAllSources(env.db);
  });

  it("inserts >= 90 shipping_rates from the 90-day fixture", async () => {
    const ing = createFreightosIngester({ lookbackDays: 90 });
    const result = await runIngester(ing, env.db, { fixture: FIXTURE });
    expect(result.status).toBe("ok");
    expect(count(env.sqlite, "shipping_rates")).toBeGreaterThanOrEqual(90);
  });

  it("idempotent: second run inserts 0", async () => {
    const ing = createFreightosIngester({ lookbackDays: 90 });
    await runIngester(ing, env.db, { fixture: FIXTURE });
    const before = count(env.sqlite, "shipping_rates");
    const second = await runIngester(ing, env.db, { fixture: FIXTURE });
    expect(second.upsert.inserted).toBe(0);
    expect(count(env.sqlite, "shipping_rates")).toBe(before);
  });

  it("honors a narrow lookback window", async () => {
    const ing = createFreightosIngester({ lookbackDays: 7 });
    const result = await runIngester(ing, env.db, { fixture: FIXTURE });
    // 7 days * 6 lanes = 42 rows max
    expect(result.rowCount).toBeLessThanOrEqual(48);
  });

  it("validates UN/LOCODE port codes and positive rates", () => {
    const ing = createFreightosIngester();
    const bad = ing.validate({
      originPort: "XX",
      destinationPort: "YY",
      mode: "FCL",
      rateUsd: 0,
      currency: "USD",
      rateDate: "2024-01-01",
    });
    expect(bad.ok).toBe(false);
  });
});
