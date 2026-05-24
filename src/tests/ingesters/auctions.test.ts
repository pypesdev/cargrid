import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runIngester } from "../../ingest/runner";
import {
  createAuctionsIngester,
  DEFAULT_USER_AGENT,
} from "../../ingesters/auctions";
import { count, makeTestDb, REPO_ROOT, seedAllSources } from "./helpers";

const FIXTURE = "fixtures/auctions/sold-200.json";

describe("auctions ingester", () => {
  beforeAll(() => {
    process.env.CARGRID_FIXTURES_ROOT = REPO_ROOT;
  });

  let env: ReturnType<typeof makeTestDb>;
  beforeEach(() => {
    env = makeTestDb();
    seedAllSources(env.db);
  });

  it("inserts 200 comparables from cars_and_bids fixture", async () => {
    const ing = createAuctionsIngester({ source: "cars_and_bids", limit: 200 });
    const result = await runIngester(ing, env.db, { fixture: FIXTURE });
    expect(result.status).toBe("ok");
    expect(count(env.sqlite, "comparables")).toBe(200);
  });

  it("idempotent: second run inserts 0", async () => {
    const ing = createAuctionsIngester({ source: "cars_and_bids", limit: 200 });
    await runIngester(ing, env.db, { fixture: FIXTURE });
    const second = await runIngester(ing, env.db, { fixture: FIXTURE });
    expect(second.upsert.inserted).toBe(0);
    expect(count(env.sqlite, "comparables")).toBe(200);
  });

  it("uses VIN as dedup key when present, falls back to listing id", () => {
    const ing = createAuctionsIngester({ source: "cars_and_bids" });
    const withVin = ing.parse({
      id: "cab-1",
      url: "https://carsandbids.com/auctions/cab-1/foo",
      sold_price_usd: 1,
      sold_date: "2025-01-01",
      vin: "ABC123",
    });
    expect(withVin.vinOrListingId).toBe("ABC123");
    const withoutVin = ing.parse({
      id: "cab-2",
      url: "https://carsandbids.com/auctions/cab-2/bar",
      sold_price_usd: 1,
      sold_date: "2025-01-01",
      vin: null,
    });
    expect(withoutVin.vinOrListingId).toBe("cab-2");
  });

  it("rejects non-https URLs and zero prices", () => {
    const ing = createAuctionsIngester({ source: "cars_and_bids" });
    const v = ing.validate({
      source: "cars_and_bids",
      vinOrListingId: "x",
      soldPriceUsd: 0,
      soldDate: "bad",
      url: "http://insecure.example",
      rawJson: "{}",
    });
    expect(v.ok).toBe(false);
  });

  it("exposes the polite user-agent contract", () => {
    expect(DEFAULT_USER_AGENT).toMatch(/cargrid/);
    expect(DEFAULT_USER_AGENT).toMatch(/github\.com\/pypesdev\/cargrid/);
  });

  it("limits source to cars_and_bids or bat (rejects others at the CLI layer)", () => {
    const cab = createAuctionsIngester({ source: "cars_and_bids" });
    const bat = createAuctionsIngester({ source: "bat" });
    expect(cab.sourceKey).toBe("cars_and_bids");
    expect(bat.sourceKey).toBe("bat");
  });
});
