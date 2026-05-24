import { and, lte, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { shippingRates, vehicles } from "../../db/schema";
import { calculateDuty } from "./duty_calculator";

export interface CheapestRouteInput {
  originPort: string;
  destinationPort: string;
  declaredValueUsd: number;
  asOf?: string;
  vehicleId?: number;
  hsCode?: string;
  vehicleAgeYears?: number;
  originCountry?: string;
  destinationCountry?: string;
  maxHops?: number;
  topK?: number;
  excludePorts?: string[];
  brokerFeePctOfShipping?: number;
  brokerFeeMinUsd?: number;
  legEtaDays?: number;
  transshipmentBufferDays?: number;
  referenceYear?: number;
}

export interface RouteHop {
  fromPort: string;
  toPort: string;
  mode: "FCL" | "RoRo";
  rateUsd: number;
  rateDate: string;
  source: string;
  etaDays: number;
}

export interface RouteOption {
  hops: RouteHop[];
  shippingCostUsd: number;
  etaDays: number;
  dutyUsd: number;
  brokerFeesUsd: number;
  totalLandedCostUsd: number;
}

const DEFAULT_MAX_HOPS = 3;
const DEFAULT_TOP_K = 3;
const DEFAULT_LEG_ETA_DAYS = 14;
const DEFAULT_TRANSSHIPMENT_BUFFER_DAYS = 3;
const DEFAULT_BROKER_PCT = 1.0;
const DEFAULT_BROKER_MIN_USD = 250;

interface EdgeKey {
  origin: string;
  destination: string;
  mode: "FCL" | "RoRo";
}

interface Edge extends EdgeKey {
  rateUsd: number;
  rateDate: string;
  source: string;
  etaDays: number;
}

interface VehicleContext {
  hsCode: string;
  ageYears: number;
}

export function countryFromPort(port: string): string {
  // UN/LOCODE: first 2 chars = ISO-3166-1 alpha-2 country code.
  if (port.length < 2) {
    throw new Error(`port code too short to derive country: ${port}`);
  }
  return port.slice(0, 2).toUpperCase();
}

export function cheapestRoute(
  input: CheapestRouteInput,
  db: BetterSQLite3Database,
): RouteOption[] {
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const maxHops = input.maxHops ?? DEFAULT_MAX_HOPS;
  const topK = input.topK ?? DEFAULT_TOP_K;
  const legEta = input.legEtaDays ?? DEFAULT_LEG_ETA_DAYS;
  const transshipBuffer =
    input.transshipmentBufferDays ?? DEFAULT_TRANSSHIPMENT_BUFFER_DAYS;
  const brokerPct = input.brokerFeePctOfShipping ?? DEFAULT_BROKER_PCT;
  const brokerMin = input.brokerFeeMinUsd ?? DEFAULT_BROKER_MIN_USD;

  if (input.declaredValueUsd < 0) {
    throw new Error("declaredValueUsd must be non-negative");
  }
  if (maxHops < 1) {
    throw new Error("maxHops must be >= 1");
  }

  const originCountry =
    input.originCountry ?? countryFromPort(input.originPort);
  const destinationCountry =
    input.destinationCountry ?? countryFromPort(input.destinationPort);

  const vehicleCtx = resolveVehicleContext(input, db);

  const excluded = new Set(input.excludePorts ?? []);
  // The terminal ports must remain in the graph regardless of pruning.
  excluded.delete(input.originPort);
  excluded.delete(input.destinationPort);

  const edges = loadLatestEdges(db, asOf, legEta).filter(
    (e) => !excluded.has(e.origin) && !excluded.has(e.destination),
  );

  const adj = buildAdjacency(edges);
  const paths = enumeratePaths(
    adj,
    input.originPort,
    input.destinationPort,
    maxHops,
  );

  if (paths.length === 0) return [];

  const duty = calculateDuty(
    {
      hsCode: vehicleCtx.hsCode,
      destinationCountry,
      originCountry,
      declaredValueUsd: input.declaredValueUsd,
      vehicleAgeYears: vehicleCtx.ageYears,
      asOf,
    },
    db,
  );

  const options: RouteOption[] = paths.map((hops) => {
    const shippingCostUsd = sumShipping(hops);
    const etaDays = sumEta(hops, transshipBuffer);
    const brokerFeesUsd = Math.max(
      brokerMin,
      (brokerPct / 100) * shippingCostUsd,
    );
    return {
      hops,
      shippingCostUsd: round2(shippingCostUsd),
      etaDays,
      dutyUsd: duty.dutyUsd,
      brokerFeesUsd: round2(brokerFeesUsd),
      totalLandedCostUsd: round2(
        shippingCostUsd + duty.dutyUsd + brokerFeesUsd,
      ),
    };
  });

  options.sort((a, b) => a.totalLandedCostUsd - b.totalLandedCostUsd);
  return options.slice(0, topK);
}

function loadLatestEdges(
  db: BetterSQLite3Database,
  asOf: string,
  legEta: number,
): Edge[] {
  const rows = db
    .select({
      originPort: shippingRates.originPort,
      destinationPort: shippingRates.destinationPort,
      mode: shippingRates.mode,
      rateUsd: shippingRates.rateUsd,
      rateDate: shippingRates.rateDate,
      source: shippingRates.source,
      latest: sql<string>`MAX(${shippingRates.rateDate})`,
    })
    .from(shippingRates)
    .where(lte(shippingRates.rateDate, asOf))
    .groupBy(
      shippingRates.originPort,
      shippingRates.destinationPort,
      shippingRates.mode,
    )
    .all();

  // Drizzle's GROUP BY with aggregated columns returns the latest date but
  // non-aggregated columns are unstable across SQLite versions. Re-fetch the
  // exact row for each (origin, destination, mode, latest) to get a canonical
  // rate.
  const edges: Edge[] = [];
  for (const r of rows) {
    const exact = db
      .select()
      .from(shippingRates)
      .where(
        and(
          sql`${shippingRates.originPort} = ${r.originPort}`,
          sql`${shippingRates.destinationPort} = ${r.destinationPort}`,
          sql`${shippingRates.mode} = ${r.mode}`,
          sql`${shippingRates.rateDate} = ${r.latest}`,
        ),
      )
      .orderBy(shippingRates.rateUsd)
      .limit(1)
      .all();
    if (exact.length === 0) continue;
    const row = exact[0];
    edges.push({
      origin: row.originPort,
      destination: row.destinationPort,
      mode: row.mode,
      rateUsd: row.rateUsd,
      rateDate: row.rateDate,
      source: row.source,
      etaDays: legEta,
    });
  }
  return edges;
}

function buildAdjacency(edges: Edge[]): Map<string, Edge[]> {
  const adj = new Map<string, Edge[]>();
  for (const e of edges) {
    if (!adj.has(e.origin)) adj.set(e.origin, []);
    adj.get(e.origin)!.push(e);
  }
  return adj;
}

function enumeratePaths(
  adj: Map<string, Edge[]>,
  from: string,
  to: string,
  maxHops: number,
): RouteHop[][] {
  const results: RouteHop[][] = [];
  const visited = new Set<string>([from]);
  const stack: RouteHop[] = [];

  const walk = (node: string): void => {
    if (stack.length >= maxHops && node !== to) return;
    if (node === to && stack.length > 0) {
      results.push(stack.map((h) => ({ ...h })));
      return;
    }
    const outs = adj.get(node) ?? [];
    for (const e of outs) {
      if (visited.has(e.destination)) continue;
      visited.add(e.destination);
      stack.push({
        fromPort: e.origin,
        toPort: e.destination,
        mode: e.mode,
        rateUsd: e.rateUsd,
        rateDate: e.rateDate,
        source: e.source,
        etaDays: e.etaDays,
      });
      walk(e.destination);
      stack.pop();
      visited.delete(e.destination);
    }
  };

  walk(from);
  return results;
}

function sumShipping(hops: RouteHop[]): number {
  return hops.reduce((acc, h) => acc + h.rateUsd, 0);
}

function sumEta(hops: RouteHop[], transshipBuffer: number): number {
  const legs = hops.reduce((acc, h) => acc + h.etaDays, 0);
  const buffers = Math.max(0, hops.length - 1) * transshipBuffer;
  return legs + buffers;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function resolveVehicleContext(
  input: CheapestRouteInput,
  db: BetterSQLite3Database,
): VehicleContext {
  if (input.hsCode && input.vehicleAgeYears !== undefined) {
    return { hsCode: input.hsCode, ageYears: input.vehicleAgeYears };
  }
  if (input.vehicleId !== undefined) {
    const rows = db
      .select()
      .from(vehicles)
      .where(sql`${vehicles.id} = ${input.vehicleId}`)
      .limit(1)
      .all();
    if (rows.length === 0) {
      throw new Error(`vehicle not found: id=${input.vehicleId}`);
    }
    const v = rows[0];
    const ageRef = input.referenceYear ?? new Date().getUTCFullYear();
    return {
      hsCode: input.hsCode ?? v.hsCode,
      ageYears: input.vehicleAgeYears ?? Math.max(0, ageRef - v.year),
    };
  }
  throw new Error(
    "cheapestRoute requires either vehicleId or (hsCode + vehicleAgeYears)",
  );
}
