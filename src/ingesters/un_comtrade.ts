import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { z } from "zod";
import { loadJsonFixture } from "../ingest/fixture";
import { tradeFlows } from "../db/schema";
import type {
  FetchOptions,
  Ingester,
  RawRow,
  UpsertStats,
  ValidationResult,
} from "../ingest/types";

export const UN_COMTRADE_SOURCE_KEY = "un_comtrade";

// ISO-3166-alpha-3 → alpha-2 for the codes we exercise. Comtrade emits ISO-3
// in `reporterISO` / `partnerISO`; the schema stores ISO-2.
const ISO3_TO_ISO2: Record<string, string> = {
  USA: "US",
  MEX: "MX",
  CAN: "CA",
  JPN: "JP",
  DEU: "DE",
  KOR: "KR",
  GBR: "GB",
  ITA: "IT",
  FRA: "FR",
  CHN: "CN",
  BEL: "BE",
  ESP: "ES",
  NLD: "NL",
  CHE: "CH",
  AUS: "AU",
};

const RawSchema = z.object({
  refYear: z.number().int(),
  refMonth: z.number().int().min(1).max(12),
  reporterISO: z.string(),
  partnerISO: z.string(),
  flowCode: z.enum(["M", "X"]),
  cmdCode: z.string(),
  primaryValue: z.number(),
  qty: z.union([z.number(), z.null()]).optional(),
});

export interface ComtradeRecord {
  reporter: string;
  partner: string;
  hsCode: string;
  year: number;
  month: number;
  valueUsd: number;
  quantity: number;
  flowDirection: "import" | "export";
}

export interface UnComtradeOptions {
  year?: number;
  reporter?: string;
  hsCodes?: string[];
}

export function createUnComtradeIngester(
  opts: UnComtradeOptions = {},
): Ingester<ComtradeRecord> {
  const year = opts.year ?? 2024;
  const reporter = opts.reporter ?? "US";
  const hsCodes = opts.hsCodes ?? ["8703", "8704", "8711"];

  return {
    name: "un_comtrade.monthly",
    sourceKey: UN_COMTRADE_SOURCE_KEY,

    async *fetch(fopts: FetchOptions): AsyncIterable<RawRow> {
      if (!fopts.fixture) {
        throw new Error(
          "un_comtrade: live fetch not implemented in Phase 2; pass a fixture path",
        );
      }
      const payload = loadJsonFixture<{ data: RawRow[] }>(fopts.fixture);
      const rows = Array.isArray(payload) ? payload : (payload.data ?? []);
      for (const row of rows) {
        const r = row as Record<string, unknown>;
        if (r.refYear !== undefined && r.refYear !== year) continue;
        if (
          r.reporterISO !== undefined &&
          ISO3_TO_ISO2[String(r.reporterISO)] !== reporter
        )
          continue;
        if (r.cmdCode !== undefined && !hsCodes.includes(String(r.cmdCode))) continue;
        yield r;
      }
    },

    parse(raw: RawRow): ComtradeRecord {
      const parsed = RawSchema.parse(raw);
      const reporterIso2 = ISO3_TO_ISO2[parsed.reporterISO] ?? parsed.reporterISO;
      const partnerIso2 = ISO3_TO_ISO2[parsed.partnerISO] ?? parsed.partnerISO;
      return {
        reporter: reporterIso2,
        partner: partnerIso2,
        hsCode: parsed.cmdCode,
        year: parsed.refYear,
        month: parsed.refMonth,
        valueUsd: parsed.primaryValue,
        quantity: parsed.qty ?? 0,
        flowDirection: parsed.flowCode === "M" ? "import" : "export",
      };
    },

    validate(parsed: ComtradeRecord): ValidationResult<ComtradeRecord> {
      const errors = [];
      if (parsed.reporter.length !== 2)
        errors.push({ path: "reporter", message: "must be ISO-2" });
      if (parsed.partner.length !== 2)
        errors.push({ path: "partner", message: "must be ISO-2" });
      if (parsed.valueUsd < 0)
        errors.push({ path: "valueUsd", message: "must be non-negative" });
      if (parsed.quantity < 0)
        errors.push({ path: "quantity", message: "must be non-negative" });
      if (parsed.month < 1 || parsed.month > 12)
        errors.push({ path: "month", message: "must be 1-12" });
      if (errors.length > 0) return { ok: false, errors };
      return { ok: true, value: parsed };
    },

    async upsert(
      records: ComtradeRecord[],
      db: BetterSQLite3Database,
    ): Promise<UpsertStats> {
      if (records.length === 0)
        return { inserted: 0, updated: 0, skipped: 0 };
      const stats: UpsertStats = { inserted: 0, updated: 0, skipped: 0 };
      db.transaction((tx) => {
        for (const r of records) {
          const result = tx
            .insert(tradeFlows)
            .values({
              reporter: r.reporter,
              partner: r.partner,
              hsCode: r.hsCode,
              year: r.year,
              month: r.month,
              valueUsd: r.valueUsd,
              quantity: r.quantity,
              flowDirection: r.flowDirection,
              source: UN_COMTRADE_SOURCE_KEY,
            })
            .onConflictDoNothing()
            .run();
          if (result.changes > 0) stats.inserted += 1;
          else stats.skipped += 1;
        }
      });
      return stats;
    },

    idempotencyKey(r: ComtradeRecord): string {
      return [
        UN_COMTRADE_SOURCE_KEY,
        r.reporter,
        r.partner,
        r.hsCode,
        r.year,
        r.month,
        r.flowDirection,
      ].join("|");
    },
  };
}
