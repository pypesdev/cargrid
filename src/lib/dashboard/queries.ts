import "server-only";
import { and, asc, desc, eq, gte, lte, max, sql } from "drizzle-orm";
import { db } from "../../db";
import {
  comparables,
  ingestionRuns,
  shippingRates,
  sources,
  tariffs,
  tradeFlows,
} from "../../db/schema";
import { topCorridors, type CorridorStat } from "../analysis/flow_aggregations";

export interface SourceStat {
  sourceKey: string;
  displayName: string;
  rowCount: number;
  lastRunAt: string | null;
  lastRunStatus: string | null;
}

export interface OverviewStats {
  totalTradeRows: number;
  totalShippingRows: number;
  totalTariffs: number;
  totalComparables: number;
  perSource: SourceStat[];
}

export interface ChoroplethEntry {
  partner: string;
  valueUsd: number;
}

export interface OverviewSummary {
  latestYear: number | null;
  choropleth: ChoroplethEntry[];
  topCorridors: CorridorStat[];
  stats: OverviewStats;
}

export function getOverviewSummary(): OverviewSummary {
  const latestYearRow = db
    .select({ y: max(tradeFlows.year) })
    .from(tradeFlows)
    .all();
  const latestYear = latestYearRow[0]?.y ?? null;

  const choropleth: ChoroplethEntry[] = latestYear
    ? db
        .select({
          partner: tradeFlows.partner,
          valueUsd: sql<number>`SUM(${tradeFlows.valueUsd})`,
        })
        .from(tradeFlows)
        .where(
          and(
            eq(tradeFlows.year, latestYear),
            eq(tradeFlows.reporter, "US"),
            eq(tradeFlows.flowDirection, "import"),
          ),
        )
        .groupBy(tradeFlows.partner)
        .orderBy(desc(sql`SUM(${tradeFlows.valueUsd})`))
        .all()
        .map((r) => ({ partner: r.partner, valueUsd: r.valueUsd ?? 0 }))
    : [];

  const corridors = latestYear
    ? aggregateTopCorridorsAcrossHs(latestYear, 10)
    : [];

  return {
    latestYear,
    choropleth,
    topCorridors: corridors,
    stats: getOverviewStats(),
  };
}

function aggregateTopCorridorsAcrossHs(
  year: number,
  limit: number,
): CorridorStat[] {
  const hsCodes = db
    .select({ h: tradeFlows.hsCode })
    .from(tradeFlows)
    .groupBy(tradeFlows.hsCode)
    .all();

  const merged = new Map<string, CorridorStat>();
  for (const { h } of hsCodes) {
    const rows = topCorridors(
      { hsCode: h, yearFrom: year, yearTo: year, limit: 100 },
      db,
    );
    for (const r of rows) {
      const key = `${r.reporter}|${r.partner}`;
      const existing = merged.get(key);
      if (existing) {
        existing.totalValueUsd += r.totalValueUsd;
        existing.totalQuantity += r.totalQuantity;
        existing.monthCount += r.monthCount;
      } else {
        merged.set(key, { ...r });
      }
    }
  }
  return Array.from(merged.values())
    .sort((a, b) => b.totalValueUsd - a.totalValueUsd)
    .slice(0, limit);
}

function getOverviewStats(): OverviewStats {
  const tradeCountRow = db
    .select({ c: sql<number>`COUNT(*)` })
    .from(tradeFlows)
    .all();
  const shippingCountRow = db
    .select({ c: sql<number>`COUNT(*)` })
    .from(shippingRates)
    .all();
  const tariffCountRow = db
    .select({ c: sql<number>`COUNT(*)` })
    .from(tariffs)
    .all();
  const compsCountRow = db
    .select({ c: sql<number>`COUNT(*)` })
    .from(comparables)
    .all();

  const sourceRows = db.select().from(sources).all();
  const perSource: SourceStat[] = sourceRows.map((s) => {
    const last = db
      .select()
      .from(ingestionRuns)
      .where(eq(ingestionRuns.sourceKey, s.sourceKey))
      .orderBy(desc(ingestionRuns.startedAt))
      .limit(1)
      .all();
    return {
      sourceKey: s.sourceKey,
      displayName: s.displayName,
      rowCount: last[0]?.rowCount ?? 0,
      lastRunAt: last[0]?.startedAt
        ? new Date(last[0].startedAt).toISOString()
        : null,
      lastRunStatus: last[0]?.status ?? null,
    };
  });

  return {
    totalTradeRows: tradeCountRow[0]?.c ?? 0,
    totalShippingRows: shippingCountRow[0]?.c ?? 0,
    totalTariffs: tariffCountRow[0]?.c ?? 0,
    totalComparables: compsCountRow[0]?.c ?? 0,
    perSource,
  };
}

export interface FlowFilter {
  hsCode?: string;
  reporter?: string;
  partner?: string;
  yearFrom?: number;
  yearTo?: number;
  flowDirection?: "import" | "export";
}

export interface FlowRow {
  reporter: string;
  partner: string;
  hsCode: string;
  year: number;
  month: number;
  valueUsd: number;
  quantity: number;
  flowDirection: "import" | "export";
}

export interface FlowMonthlyPoint {
  year: number;
  month: number;
  valueUsd: number;
}

export interface FlowsResult {
  rows: FlowRow[];
  monthly: FlowMonthlyPoint[];
  total: number;
  filterOptions: {
    hsCodes: string[];
    reporters: string[];
    partners: string[];
    years: number[];
  };
}

const FLOW_ROW_LIMIT = 200;

export function getFlows(filter: FlowFilter): FlowsResult {
  const filters = buildFlowWhere(filter);

  const rows = db
    .select({
      reporter: tradeFlows.reporter,
      partner: tradeFlows.partner,
      hsCode: tradeFlows.hsCode,
      year: tradeFlows.year,
      month: tradeFlows.month,
      valueUsd: tradeFlows.valueUsd,
      quantity: tradeFlows.quantity,
      flowDirection: tradeFlows.flowDirection,
    })
    .from(tradeFlows)
    .where(filters)
    .orderBy(
      desc(tradeFlows.year),
      desc(tradeFlows.month),
      desc(tradeFlows.valueUsd),
    )
    .limit(FLOW_ROW_LIMIT)
    .all();

  const totalRow = db
    .select({ c: sql<number>`COUNT(*)` })
    .from(tradeFlows)
    .where(filters)
    .all();

  const monthly = db
    .select({
      year: tradeFlows.year,
      month: tradeFlows.month,
      valueUsd: sql<number>`SUM(${tradeFlows.valueUsd})`,
    })
    .from(tradeFlows)
    .where(filters)
    .groupBy(tradeFlows.year, tradeFlows.month)
    .orderBy(asc(tradeFlows.year), asc(tradeFlows.month))
    .all()
    .map((r) => ({ year: r.year, month: r.month, valueUsd: r.valueUsd ?? 0 }));

  const filterOptions = getFlowFilterOptions();

  return {
    rows,
    monthly,
    total: totalRow[0]?.c ?? 0,
    filterOptions,
  };
}

function buildFlowWhere(filter: FlowFilter) {
  const conds = [] as ReturnType<typeof eq>[];
  if (filter.hsCode) conds.push(eq(tradeFlows.hsCode, filter.hsCode));
  if (filter.reporter) conds.push(eq(tradeFlows.reporter, filter.reporter));
  if (filter.partner) conds.push(eq(tradeFlows.partner, filter.partner));
  if (filter.yearFrom !== undefined)
    conds.push(gte(tradeFlows.year, filter.yearFrom));
  if (filter.yearTo !== undefined)
    conds.push(lte(tradeFlows.year, filter.yearTo));
  if (filter.flowDirection)
    conds.push(eq(tradeFlows.flowDirection, filter.flowDirection));
  return conds.length === 0 ? undefined : and(...conds);
}

export function getFlowFilterOptions(): FlowsResult["filterOptions"] {
  const hsCodes = db
    .select({ v: tradeFlows.hsCode })
    .from(tradeFlows)
    .groupBy(tradeFlows.hsCode)
    .orderBy(asc(tradeFlows.hsCode))
    .all()
    .map((r) => r.v);
  const reporters = db
    .select({ v: tradeFlows.reporter })
    .from(tradeFlows)
    .groupBy(tradeFlows.reporter)
    .orderBy(asc(tradeFlows.reporter))
    .all()
    .map((r) => r.v);
  const partners = db
    .select({ v: tradeFlows.partner })
    .from(tradeFlows)
    .groupBy(tradeFlows.partner)
    .orderBy(asc(tradeFlows.partner))
    .all()
    .map((r) => r.v);
  const years = db
    .select({ v: tradeFlows.year })
    .from(tradeFlows)
    .groupBy(tradeFlows.year)
    .orderBy(asc(tradeFlows.year))
    .all()
    .map((r) => r.v);
  return { hsCodes, reporters, partners, years };
}

export interface VehicleOption {
  make: string;
  model: string;
  year: number;
  hsCode: string;
  label: string;
}

export function getVehicleOptions(limit = 250): VehicleOption[] {
  // Derive vehicle suggestions from the seeded auctions catalog (comparables.rawJson).
  // The auctions ingester intentionally leaves `vehicles.vehicle_id` null because it
  // does not assert make/model verification — so the dashboard reads the raw payload
  // directly. Documented in PR description; tracked as a non-blocking follow-up.
  const rows = db
    .select({ raw: comparables.rawJson })
    .from(comparables)
    .limit(2000)
    .all();
  const seen = new Map<string, VehicleOption>();
  for (const { raw } of rows) {
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      const make = String(obj.make ?? "").trim();
      const model = String(obj.model ?? "").trim();
      const year = Number(obj.year);
      const hsCode = String(obj.hs_code ?? "").trim();
      if (!make || !model || !Number.isFinite(year) || !hsCode) continue;
      const key = `${make}|${model}|${year}|${hsCode}`;
      if (seen.has(key)) continue;
      seen.set(key, {
        make,
        model,
        year,
        hsCode,
        label: `${year} ${make} ${model}`,
      });
    } catch {
      continue;
    }
  }
  return Array.from(seen.values())
    .sort((a, b) =>
      a.year !== b.year
        ? b.year - a.year
        : a.label.localeCompare(b.label),
    )
    .slice(0, limit);
}

export interface PortOption {
  port: string;
  role: "origin" | "destination" | "both";
}

export function getPortOptions(): PortOption[] {
  const origins = db
    .select({ v: shippingRates.originPort })
    .from(shippingRates)
    .groupBy(shippingRates.originPort)
    .all()
    .map((r) => r.v);
  const destinations = db
    .select({ v: shippingRates.destinationPort })
    .from(shippingRates)
    .groupBy(shippingRates.destinationPort)
    .all()
    .map((r) => r.v);
  const all = new Map<string, PortOption["role"]>();
  for (const p of origins) all.set(p, "origin");
  for (const p of destinations) {
    all.set(p, all.has(p) ? "both" : "destination");
  }
  return Array.from(all.entries())
    .map(([port, role]) => ({ port, role }))
    .sort((a, b) => a.port.localeCompare(b.port));
}
