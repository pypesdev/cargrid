import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { z } from "zod";
import { loadJsonFixture } from "../ingest/fixture";
import { comparables } from "../db/schema";
import type {
  FetchOptions,
  Ingester,
  RawRow,
  UpsertStats,
  ValidationResult,
} from "../ingest/types";

export type AuctionSource = "cars_and_bids" | "bat";

const RawSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  sold_price_usd: z.number(),
  sold_date: z.string(),
  vin: z.union([z.string(), z.null()]).optional(),
});

export interface AuctionRecord {
  source: AuctionSource;
  vinOrListingId: string;
  soldPriceUsd: number;
  soldDate: string;
  url: string;
  rawJson: string;
}

export interface AuctionsOptions {
  source: AuctionSource;
  limit?: number;
  // ScraperOverrides exposed for tests / future live runs.
  robotsTxtFetcher?: (host: string) => Promise<string>;
  userAgent?: string;
}

const DEFAULT_USER_AGENT =
  "cargrid/0.1 (+https://github.com/pypesdev/cargrid)";

export function createAuctionsIngester(
  opts: AuctionsOptions,
): Ingester<AuctionRecord> {
  const source = opts.source;
  const limit = opts.limit ?? 200;

  return {
    name: `auctions.${source}`,
    sourceKey: source,

    async *fetch(fopts: FetchOptions): AsyncIterable<RawRow> {
      if (!fopts.fixture) {
        throw new Error(
          "auctions: live scraping not exercised in Phase 2 CI; pass a fixture path",
        );
      }
      const payload = loadJsonFixture<
        { source?: string; listings: RawRow[] } | RawRow[]
      >(fopts.fixture);
      const rows = Array.isArray(payload) ? payload : (payload.listings ?? []);
      let yielded = 0;
      for (const row of rows) {
        if (yielded >= limit) break;
        yield row as Record<string, unknown>;
        yielded += 1;
      }
    },

    parse(raw: RawRow): AuctionRecord {
      const parsed = RawSchema.parse(raw);
      const id =
        parsed.vin && parsed.vin.length > 0 ? parsed.vin : parsed.id;
      return {
        source,
        vinOrListingId: id,
        soldPriceUsd: parsed.sold_price_usd,
        soldDate: parsed.sold_date,
        url: parsed.url,
        rawJson: JSON.stringify(raw),
      };
    },

    validate(parsed: AuctionRecord): ValidationResult<AuctionRecord> {
      const errors = [];
      if (parsed.soldPriceUsd <= 0)
        errors.push({ path: "soldPriceUsd", message: "must be positive" });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.soldDate))
        errors.push({ path: "soldDate", message: "must be YYYY-MM-DD" });
      if (!parsed.url.startsWith("https://"))
        errors.push({ path: "url", message: "must be https" });
      if (errors.length > 0) return { ok: false, errors };
      return { ok: true, value: parsed };
    },

    async upsert(
      records: AuctionRecord[],
      db: BetterSQLite3Database,
    ): Promise<UpsertStats> {
      const stats: UpsertStats = { inserted: 0, updated: 0, skipped: 0 };
      if (records.length === 0) return stats;
      db.transaction((tx) => {
        for (const r of records) {
          const result = tx
            .insert(comparables)
            .values({
              vinOrListingId: r.vinOrListingId,
              source: r.source,
              soldPriceUsd: r.soldPriceUsd,
              soldDate: r.soldDate,
              vehicleId: null,
              url: r.url,
              rawJson: r.rawJson,
            })
            .onConflictDoNothing()
            .run();
          if (result.changes > 0) stats.inserted += 1;
          else stats.skipped += 1;
        }
      });
      return stats;
    },

    idempotencyKey(r: AuctionRecord): string {
      return [r.source, r.vinOrListingId].join("|");
    },
  };
}

export { DEFAULT_USER_AGENT };
