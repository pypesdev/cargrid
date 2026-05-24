import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { z } from "zod";
import { loadJsonFixture } from "../ingest/fixture";
import { tariffs } from "../db/schema";
import type {
  FetchOptions,
  Ingester,
  RawRow,
  UpsertStats,
  ValidationResult,
} from "../ingest/types";

export const HTSUS_SOURCE_KEY = "htsus";

const RawSchema = z.object({
  destination_country: z.string(),
  hs_code: z.string(),
  ad_valorem_pct: z.number(),
  specific_usd: z.number(),
  trade_agreement: z.enum(["USMCA", "GSP", "none"]),
  effective_from: z.string(),
  effective_to: z.union([z.string(), z.null()]).optional(),
});

export interface TariffRecord {
  destinationCountry: string;
  hsCode: string;
  adValoremPct: number;
  specificUsd: number;
  tradeAgreement: "USMCA" | "GSP" | "none";
  effectiveFrom: string;
  effectiveTo: string | null;
}

export function createHtsusTariffIngester(): Ingester<TariffRecord> {
  return {
    name: "htsus.static",
    sourceKey: HTSUS_SOURCE_KEY,

    async *fetch(fopts: FetchOptions): AsyncIterable<RawRow> {
      if (!fopts.fixture) {
        throw new Error(
          "htsus: tariffs are static fixture data; pass --fixture path",
        );
      }
      const payload = loadJsonFixture<{ rows: RawRow[] } | RawRow[]>(
        fopts.fixture,
      );
      const rows = Array.isArray(payload) ? payload : (payload.rows ?? []);
      for (const row of rows) yield row as Record<string, unknown>;
    },

    parse(raw: RawRow): TariffRecord {
      const parsed = RawSchema.parse(raw);
      return {
        destinationCountry: parsed.destination_country,
        hsCode: parsed.hs_code,
        adValoremPct: parsed.ad_valorem_pct,
        specificUsd: parsed.specific_usd,
        tradeAgreement: parsed.trade_agreement,
        effectiveFrom: parsed.effective_from,
        effectiveTo: parsed.effective_to ?? null,
      };
    },

    validate(parsed: TariffRecord): ValidationResult<TariffRecord> {
      const errors = [];
      if (parsed.destinationCountry.length !== 2 && parsed.destinationCountry !== "EU")
        errors.push({
          path: "destinationCountry",
          message: "must be ISO-2 or EU",
        });
      if (parsed.adValoremPct < 0)
        errors.push({ path: "adValoremPct", message: "must be non-negative" });
      if (parsed.specificUsd < 0)
        errors.push({ path: "specificUsd", message: "must be non-negative" });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.effectiveFrom))
        errors.push({ path: "effectiveFrom", message: "must be YYYY-MM-DD" });
      if (errors.length > 0) return { ok: false, errors };
      return { ok: true, value: parsed };
    },

    async upsert(
      records: TariffRecord[],
      db: BetterSQLite3Database,
    ): Promise<UpsertStats> {
      const stats: UpsertStats = { inserted: 0, updated: 0, skipped: 0 };
      if (records.length === 0) return stats;
      db.transaction((tx) => {
        for (const r of records) {
          const result = tx
            .insert(tariffs)
            .values({
              destinationCountry: r.destinationCountry,
              hsCode: r.hsCode,
              adValoremPct: r.adValoremPct,
              specificUsd: r.specificUsd,
              tradeAgreement: r.tradeAgreement,
              effectiveFrom: r.effectiveFrom,
              effectiveTo: r.effectiveTo,
              source: HTSUS_SOURCE_KEY,
            })
            .onConflictDoNothing()
            .run();
          if (result.changes > 0) stats.inserted += 1;
          else stats.skipped += 1;
        }
      });
      return stats;
    },

    idempotencyKey(r: TariffRecord): string {
      return [
        HTSUS_SOURCE_KEY,
        r.destinationCountry,
        r.hsCode,
        r.tradeAgreement,
        r.effectiveFrom,
      ].join("|");
    },
  };
}
