import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { z } from "zod";
import { loadJsonFixture } from "../ingest/fixture";
import { shippingRates } from "../db/schema";
import type {
  FetchOptions,
  Ingester,
  RawRow,
  UpsertStats,
  ValidationResult,
} from "../ingest/types";

export const FREIGHTOS_SOURCE_KEY = "freightos";

const RawSchema = z.object({
  index: z.string(),
  date: z.string(),
  origin_port: z.string(),
  destination_port: z.string(),
  rate_usd: z.number(),
  currency: z.string(),
  equipment: z.string(),
});

export interface FreightosRecord {
  originPort: string;
  destinationPort: string;
  mode: "FCL";
  rateUsd: number;
  currency: string;
  rateDate: string;
}

export interface FreightosOptions {
  lookbackDays?: number;
  asOf?: Date;
}

export function createFreightosIngester(
  opts: FreightosOptions = {},
): Ingester<FreightosRecord> {
  const lookback = opts.lookbackDays ?? 90;

  return {
    name: "freightos.daily_fbx",
    sourceKey: FREIGHTOS_SOURCE_KEY,

    async *fetch(fopts: FetchOptions): AsyncIterable<RawRow> {
      if (!fopts.fixture) {
        throw new Error(
          "freightos: live fetch not implemented in Phase 2; pass a fixture path",
        );
      }
      const payload = loadJsonFixture<{ rates: RawRow[] } | RawRow[]>(
        fopts.fixture,
      );
      const rows = Array.isArray(payload) ? payload : (payload.rates ?? []);

      // The fixture is a daily series; the orchestrator passes a lookback
      // window so re-runs against a wider fixture stay bounded.
      const asOf = opts.asOf ?? deriveAsOf(rows as Array<{ date?: string }>);
      const cutoff = new Date(asOf.getTime() - lookback * 24 * 3600_000);

      for (const row of rows) {
        const r = row as Record<string, unknown>;
        const dateStr = String(r.date);
        if (Number.isNaN(Date.parse(dateStr))) continue;
        const d = new Date(dateStr);
        if (d < cutoff) continue;
        if (d > asOf) continue;
        yield r;
      }
    },

    parse(raw: RawRow): FreightosRecord {
      const parsed = RawSchema.parse(raw);
      return {
        originPort: parsed.origin_port,
        destinationPort: parsed.destination_port,
        mode: "FCL",
        rateUsd: parsed.rate_usd,
        currency: parsed.currency,
        rateDate: parsed.date,
      };
    },

    validate(parsed: FreightosRecord): ValidationResult<FreightosRecord> {
      const errors = [];
      if (parsed.rateUsd <= 0)
        errors.push({ path: "rateUsd", message: "must be positive" });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.rateDate))
        errors.push({ path: "rateDate", message: "must be YYYY-MM-DD" });
      if (parsed.originPort.length !== 5)
        errors.push({ path: "originPort", message: "must be UN/LOCODE" });
      if (parsed.destinationPort.length !== 5)
        errors.push({ path: "destinationPort", message: "must be UN/LOCODE" });
      if (errors.length > 0) return { ok: false, errors };
      return { ok: true, value: parsed };
    },

    async upsert(
      records: FreightosRecord[],
      db: BetterSQLite3Database,
    ): Promise<UpsertStats> {
      const stats: UpsertStats = { inserted: 0, updated: 0, skipped: 0 };
      if (records.length === 0) return stats;
      db.transaction((tx) => {
        for (const r of records) {
          const result = tx
            .insert(shippingRates)
            .values({
              originPort: r.originPort,
              destinationPort: r.destinationPort,
              mode: r.mode,
              rateUsd: r.rateUsd,
              currency: r.currency,
              rateDate: r.rateDate,
              source: FREIGHTOS_SOURCE_KEY,
            })
            .onConflictDoNothing()
            .run();
          if (result.changes > 0) stats.inserted += 1;
          else stats.skipped += 1;
        }
      });
      return stats;
    },

    idempotencyKey(r: FreightosRecord): string {
      return [
        FREIGHTOS_SOURCE_KEY,
        r.originPort,
        r.destinationPort,
        r.mode,
        r.rateDate,
      ].join("|");
    },
  };
}

function deriveAsOf(rows: Array<{ date?: string }>): Date {
  let max = 0;
  for (const r of rows) {
    if (!r.date) continue;
    const t = Date.parse(r.date);
    if (Number.isFinite(t) && t > max) max = t;
  }
  return max > 0 ? new Date(max) : new Date();
}
