import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { tradeFlows } from "../../db/schema";

export interface TopCorridorsInput {
  hsCode: string;
  yearFrom: number;
  yearTo: number;
  limit?: number;
  flowDirection?: "import" | "export";
}

export interface CorridorStat {
  reporter: string;
  partner: string;
  totalValueUsd: number;
  totalQuantity: number;
  monthCount: number;
}

export interface YoYInput {
  hsCode: string;
  reporter: string;
  partner: string;
  flowDirection?: "import" | "export";
}

export interface DeltaPoint {
  year: number;
  month: number;
  valueUsd: number;
  priorYearValueUsd: number | null;
  yoyDelta: number | null;
  yoyPct: number | null;
}

export interface DeltaSeries {
  hsCode: string;
  reporter: string;
  partner: string;
  flowDirection: "import" | "export";
  points: DeltaPoint[];
}

export interface SeasonalityInput {
  hsCode: string;
  reporter: string;
  flowDirection?: "import" | "export";
}

export interface MonthlyAverage {
  month: number;
  avgValueUsd: number;
  sampleYears: number;
}

const DEFAULT_LIMIT = 10;

export function topCorridors(
  input: TopCorridorsInput,
  db: BetterSQLite3Database,
): CorridorStat[] {
  if (input.yearFrom > input.yearTo) {
    throw new Error("yearFrom must be <= yearTo");
  }
  const limit = input.limit ?? DEFAULT_LIMIT;
  const filters = [
    eq(tradeFlows.hsCode, input.hsCode),
    gte(tradeFlows.year, input.yearFrom),
    lte(tradeFlows.year, input.yearTo),
  ];
  if (input.flowDirection) {
    filters.push(eq(tradeFlows.flowDirection, input.flowDirection));
  }
  const rows = db
    .select({
      reporter: tradeFlows.reporter,
      partner: tradeFlows.partner,
      totalValueUsd: sql<number>`SUM(${tradeFlows.valueUsd})`,
      totalQuantity: sql<number>`SUM(${tradeFlows.quantity})`,
      monthCount: sql<number>`COUNT(*)`,
    })
    .from(tradeFlows)
    .where(and(...filters))
    .groupBy(tradeFlows.reporter, tradeFlows.partner)
    .orderBy(desc(sql`SUM(${tradeFlows.valueUsd})`))
    .limit(limit)
    .all();

  return rows.map((r) => ({
    reporter: r.reporter,
    partner: r.partner,
    totalValueUsd: r.totalValueUsd,
    totalQuantity: r.totalQuantity,
    monthCount: r.monthCount,
  }));
}

export function yearOverYearDelta(
  input: YoYInput,
  db: BetterSQLite3Database,
): DeltaSeries {
  const direction = input.flowDirection ?? "import";

  const monthly = db
    .select({
      year: tradeFlows.year,
      month: tradeFlows.month,
      valueUsd: sql<number>`SUM(${tradeFlows.valueUsd})`,
    })
    .from(tradeFlows)
    .where(
      and(
        eq(tradeFlows.hsCode, input.hsCode),
        eq(tradeFlows.reporter, input.reporter),
        eq(tradeFlows.partner, input.partner),
        eq(tradeFlows.flowDirection, direction),
      ),
    )
    .groupBy(tradeFlows.year, tradeFlows.month)
    .orderBy(tradeFlows.year, tradeFlows.month)
    .all();

  const byKey = new Map<string, number>();
  for (const m of monthly) {
    byKey.set(`${m.year}-${m.month}`, m.valueUsd);
  }

  const points: DeltaPoint[] = monthly.map((m) => {
    const prior = byKey.get(`${m.year - 1}-${m.month}`) ?? null;
    const delta = prior === null ? null : m.valueUsd - prior;
    const pct =
      prior === null || prior === 0 ? null : ((m.valueUsd - prior) / prior) * 100;
    return {
      year: m.year,
      month: m.month,
      valueUsd: m.valueUsd,
      priorYearValueUsd: prior,
      yoyDelta: delta,
      yoyPct: pct,
    };
  });

  return {
    hsCode: input.hsCode,
    reporter: input.reporter,
    partner: input.partner,
    flowDirection: direction,
    points,
  };
}

export function seasonality(
  input: SeasonalityInput,
  db: BetterSQLite3Database,
): MonthlyAverage[] {
  const direction = input.flowDirection ?? "import";
  const rows = db
    .select({
      year: tradeFlows.year,
      month: tradeFlows.month,
      valueUsd: sql<number>`SUM(${tradeFlows.valueUsd})`,
    })
    .from(tradeFlows)
    .where(
      and(
        eq(tradeFlows.hsCode, input.hsCode),
        eq(tradeFlows.reporter, input.reporter),
        eq(tradeFlows.flowDirection, direction),
      ),
    )
    .groupBy(tradeFlows.year, tradeFlows.month)
    .all();

  const byMonth = new Map<number, { sum: number; years: Set<number> }>();
  for (const r of rows) {
    const entry = byMonth.get(r.month) ?? { sum: 0, years: new Set() };
    entry.sum += r.valueUsd;
    entry.years.add(r.year);
    byMonth.set(r.month, entry);
  }

  const out: MonthlyAverage[] = [];
  for (let m = 1; m <= 12; m += 1) {
    const entry = byMonth.get(m);
    if (!entry || entry.years.size === 0) {
      out.push({ month: m, avgValueUsd: 0, sampleYears: 0 });
      continue;
    }
    out.push({
      month: m,
      avgValueUsd: entry.sum / entry.years.size,
      sampleYears: entry.years.size,
    });
  }
  return out;
}
