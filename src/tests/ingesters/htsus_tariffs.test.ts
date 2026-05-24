import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runIngester } from "../../ingest/runner";
import { createHtsusTariffIngester } from "../../ingesters/htsus_tariffs";
import { count, makeTestDb, REPO_ROOT, seedAllSources } from "./helpers";

const FIXTURE = "fixtures/tariffs/htsus_8703.json";

describe("htsus tariff loader", () => {
  beforeAll(() => {
    process.env.CARGRID_FIXTURES_ROOT = REPO_ROOT;
  });

  let env: ReturnType<typeof makeTestDb>;
  beforeEach(() => {
    env = makeTestDb();
    seedAllSources(env.db);
  });

  it("loads tariffs across US/CA/MX/EU/GB/JP/AU for HS 8703/8704/8711", async () => {
    const ing = createHtsusTariffIngester();
    const result = await runIngester(ing, env.db, { fixture: FIXTURE });
    expect(result.status).toBe("ok");
    expect(count(env.sqlite, "tariffs")).toBeGreaterThan(0);

    const destinations = env.sqlite
      .prepare("SELECT DISTINCT destination_country FROM tariffs ORDER BY destination_country")
      .all() as Array<{ destination_country: string }>;
    const set = destinations.map((r) => r.destination_country);
    for (const c of ["US", "CA", "MX", "EU", "GB", "JP", "AU"]) {
      expect(set).toContain(c);
    }

    const hsCodes = env.sqlite
      .prepare("SELECT DISTINCT hs_code FROM tariffs ORDER BY hs_code")
      .all() as Array<{ hs_code: string }>;
    expect(hsCodes.map((r) => r.hs_code)).toEqual(["8703", "8704", "8711"]);
  });

  it("encodes USMCA carveouts at 0% for US/CA/MX", async () => {
    const ing = createHtsusTariffIngester();
    await runIngester(ing, env.db, { fixture: FIXTURE });
    const usmca = env.sqlite
      .prepare(
        "SELECT destination_country, hs_code, ad_valorem_pct FROM tariffs WHERE trade_agreement = 'USMCA'",
      )
      .all() as Array<{
      destination_country: string;
      hs_code: string;
      ad_valorem_pct: number;
    }>;
    expect(usmca.every((r) => r.ad_valorem_pct === 0)).toBe(true);
    expect(
      new Set(usmca.map((r) => r.destination_country)),
    ).toEqual(new Set(["US", "CA", "MX"]));
  });

  it("encodes GSP carveouts for passenger vehicles + motorcycles only", async () => {
    const ing = createHtsusTariffIngester();
    await runIngester(ing, env.db, { fixture: FIXTURE });
    const gsp = env.sqlite
      .prepare(
        "SELECT DISTINCT hs_code FROM tariffs WHERE trade_agreement = 'GSP' ORDER BY hs_code",
      )
      .all() as Array<{ hs_code: string }>;
    expect(gsp.map((r) => r.hs_code)).toEqual(["8703", "8711"]);
  });

  it("idempotent: second run inserts 0", async () => {
    const ing = createHtsusTariffIngester();
    await runIngester(ing, env.db, { fixture: FIXTURE });
    const before = count(env.sqlite, "tariffs");
    const second = await runIngester(ing, env.db, { fixture: FIXTURE });
    expect(second.upsert.inserted).toBe(0);
    expect(count(env.sqlite, "tariffs")).toBe(before);
  });
});
