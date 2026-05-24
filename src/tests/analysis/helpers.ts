import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import {
  shippingRates,
  tariffs,
  tradeFlows,
  vehicles,
  type NewShippingRate,
  type NewTariff,
  type NewTradeFlow,
  type NewVehicle,
} from "../../db/schema";
import { runIngester } from "../../ingest/runner";
import { createHtsusTariffIngester } from "../../ingesters/htsus_tariffs";
import { makeTestDb, REPO_ROOT, seedAllSources } from "../ingesters/helpers";

export interface AnalysisEnv {
  env: ReturnType<typeof makeTestDb>;
  db: BetterSQLite3Database;
}

export async function makeAnalysisEnv(): Promise<AnalysisEnv> {
  process.env.CARGRID_FIXTURES_ROOT = REPO_ROOT;
  const env = makeTestDb();
  seedAllSources(env.db);
  const ing = createHtsusTariffIngester();
  await runIngester(ing, env.db, { fixture: "fixtures/tariffs/htsus_8703.json" });
  return { env, db: env.db };
}

export function insertTariff(
  db: BetterSQLite3Database,
  row: Omit<NewTariff, "source"> & { source?: string },
): void {
  db.insert(tariffs)
    .values({ source: "htsus", ...row })
    .onConflictDoNothing()
    .run();
}

export function insertShippingRate(
  db: BetterSQLite3Database,
  row: Omit<NewShippingRate, "source"> & { source?: string },
): void {
  db.insert(shippingRates)
    .values({ source: "freightos", ...row })
    .onConflictDoNothing()
    .run();
}

export function insertTradeFlow(
  db: BetterSQLite3Database,
  row: Omit<NewTradeFlow, "source"> & { source?: string },
): void {
  db.insert(tradeFlows)
    .values({ source: "un_comtrade", ...row })
    .onConflictDoNothing()
    .run();
}

export function insertVehicle(
  db: BetterSQLite3Database,
  row: NewVehicle,
): number {
  const rows = db
    .insert(vehicles)
    .values(row)
    .returning({ id: vehicles.id })
    .all();
  return rows[0].id;
}
