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

export const US_CENSUS_SOURCE_KEY = "us_census";

// US Census Bureau CTY_CODE → ISO-3166 alpha-2 for the partner set we ship.
const CTY_TO_ISO2: Record<number, string> = {
  2010: "MX",
  1220: "CA",
  5880: "JP",
  4280: "DE",
  5800: "KR",
  4120: "GB",
  4759: "IT",
};

const RawSchema = z.object({
  CTY_CODE: z.number().int(),
  I_COMMODITY: z.string(),
  YEAR: z.string(),
  MONTH: z.string(),
  GEN_VAL_MO: z.string(),
  GEN_QY1_MO: z.string(),
});

export interface CensusRecord {
  reporter: "US";
  partner: string;
  hsCode: string;
  year: number;
  month: number;
  valueUsd: number;
  quantity: number;
  flowDirection: "import";
}

export interface UsCensusOptions {
  quarter?: string; // e.g. "2024Q1"
  hsCodes?: string[];
}

function parseQuarter(q: string): { year: number; months: number[] } {
  const m = q.match(/^(\d{4})Q([1-4])$/);
  if (!m) throw new Error(`invalid --quarter ${q}, expected YYYYQ[1-4]`);
  const year = Number(m[1]);
  const q1 = (Number(m[2]) - 1) * 3 + 1;
  return { year, months: [q1, q1 + 1, q1 + 2] };
}

export function createUsCensusIngester(
  opts: UsCensusOptions = {},
): Ingester<CensusRecord> {
  const hsCodes = opts.hsCodes ?? ["8703", "8704", "8711"];
  const window = opts.quarter ? parseQuarter(opts.quarter) : null;

  return {
    name: "us_census.port_detail",
    sourceKey: US_CENSUS_SOURCE_KEY,

    async *fetch(fopts: FetchOptions): AsyncIterable<RawRow> {
      const hasKey = !!process.env.US_CENSUS_API_KEY;
      if (!fopts.fixture && !hasKey) {
        process.stdout.write(
          "us_census: set US_CENSUS_API_KEY in .env to ingest live; using fixture data\n",
        );
      }
      if (!fopts.fixture) {
        throw new Error(
          "us_census: live fetch not implemented in Phase 2; pass a fixture path",
        );
      }
      const payload = loadJsonFixture<RawRow[] | { data: RawRow[] }>(
        fopts.fixture,
      );
      const rows = Array.isArray(payload) ? payload : (payload.data ?? []);
      for (const row of rows) {
        const r = row as Record<string, unknown>;
        if (window && Number(r.YEAR) !== window.year) continue;
        if (window && !window.months.includes(Number(r.MONTH))) continue;
        if (!hsCodes.includes(String(r.I_COMMODITY))) continue;
        // Port-detail rows arrive per-port; aggregate by yielding each row and
        // letting the upserter accumulate via the unique key collision below.
        yield r;
      }
    },

    parse(raw: RawRow): CensusRecord {
      const parsed = RawSchema.parse(raw);
      const partner = CTY_TO_ISO2[parsed.CTY_CODE];
      if (!partner) throw new Error(`unknown CTY_CODE ${parsed.CTY_CODE}`);
      return {
        reporter: "US",
        partner,
        hsCode: parsed.I_COMMODITY,
        year: Number(parsed.YEAR),
        month: Number(parsed.MONTH),
        valueUsd: Number(parsed.GEN_VAL_MO),
        quantity: Number(parsed.GEN_QY1_MO),
        flowDirection: "import",
      };
    },

    validate(parsed: CensusRecord): ValidationResult<CensusRecord> {
      const errors = [];
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
      records: CensusRecord[],
      db: BetterSQLite3Database,
    ): Promise<UpsertStats> {
      const stats: UpsertStats = { inserted: 0, updated: 0, skipped: 0 };
      if (records.length === 0) return stats;

      // Aggregate port-detail rows up to (year, month, partner, hs) so the
      // unique index on trade_flows (which has no port column) doesn't
      // silently drop ports beyond the first.
      const agg = new Map<string, CensusRecord>();
      for (const r of records) {
        const key = `${r.partner}|${r.hsCode}|${r.year}|${r.month}`;
        const cur = agg.get(key);
        if (!cur) {
          agg.set(key, { ...r });
        } else {
          cur.valueUsd += r.valueUsd;
          cur.quantity += r.quantity;
        }
      }

      db.transaction((tx) => {
        for (const r of agg.values()) {
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
              source: US_CENSUS_SOURCE_KEY,
            })
            .onConflictDoNothing()
            .run();
          if (result.changes > 0) stats.inserted += 1;
          else stats.skipped += 1;
        }
      });
      return stats;
    },

    idempotencyKey(r: CensusRecord): string {
      return [
        US_CENSUS_SOURCE_KEY,
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
