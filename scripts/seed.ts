import { ensureSourceRow, openDb } from "../src/ingesters/cli";
import { runIngester } from "../src/ingest/runner";
import type { Ingester } from "../src/ingest/types";
import { createUnComtradeIngester } from "../src/ingesters/un_comtrade";
import { createUsCensusIngester } from "../src/ingesters/us_census";
import { createFreightosIngester } from "../src/ingesters/freightos";
import { createAuctionsIngester } from "../src/ingesters/auctions";
import { createHtsusTariffIngester } from "../src/ingesters/htsus_tariffs";

interface SeedStep {
  ingester: Ingester<unknown>;
  fixture: string;
}

const STEPS: SeedStep[] = [
  {
    ingester: createUnComtradeIngester({
      year: 2024,
      reporter: "US",
    }) as unknown as Ingester<unknown>,
    fixture: "fixtures/un_comtrade/us-reporter-2024.json",
  },
  {
    ingester: createUsCensusIngester({
      quarter: "2024Q1",
    }) as unknown as Ingester<unknown>,
    fixture: "fixtures/us_census/q1-2024-port-detail.json",
  },
  {
    ingester: createFreightosIngester({
      lookbackDays: 90,
    }) as unknown as Ingester<unknown>,
    fixture: "fixtures/freightos/90d-major-lanes.json",
  },
  {
    ingester: createAuctionsIngester({
      source: "cars_and_bids",
      limit: 200,
    }) as unknown as Ingester<unknown>,
    fixture: "fixtures/auctions/sold-200.json",
  },
  {
    ingester: createHtsusTariffIngester() as unknown as Ingester<unknown>,
    fixture: "fixtures/tariffs/htsus_8703.json",
  },
];

async function main() {
  const { db, close } = openDb();
  try {
    let failures = 0;
    for (const step of STEPS) {
      ensureSourceRow(db, step.ingester.sourceKey);
      const result = await runIngester(step.ingester, db, {
        fixture: step.fixture,
      });
      process.stdout.write(
        `${step.ingester.name}: status=${result.status} rows=${result.rowCount} ` +
          `inserted=${result.upsert.inserted} skipped=${result.upsert.skipped} ` +
          `rejected=${result.rejected.length}` +
          (result.errorMessage ? ` error=${result.errorMessage}` : "") +
          "\n",
      );
      if (result.status !== "ok") failures += 1;
    }
    process.exit(failures === 0 ? 0 : 1);
  } finally {
    close();
  }
}

main().catch((err) => {
  process.stderr.write(`seed failed: ${err}\n`);
  process.exit(1);
});
