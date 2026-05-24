"use server";

import { db } from "../../src/db";
import {
  cheapestRoute,
  countryFromPort,
  type RouteOption,
} from "../../src/lib/analysis/cheapest_route";
import { BATCH_MAX } from "./constants";

export interface BatchRow {
  vehicleLabel: string;
  hsCode: string;
  vehicleAgeYears: number;
  declaredValueUsd: number;
  originPort: string;
  destinationPort: string;
}

export interface BatchResultRow {
  input: BatchRow;
  best: RouteOption | null;
  errorMessage: string | null;
}

export interface BatchConsolidation {
  originPort: string;
  destinationPort: string;
  vehicleCount: number;
  totalLandedCostUsd: number;
}

export interface BatchResultOk {
  ok: true;
  rows: BatchResultRow[];
  totalLandedCostUsd: number;
  consolidations: BatchConsolidation[];
}

export interface BatchResultErr {
  ok: false;
  message: string;
}

export type BatchResult = BatchResultOk | BatchResultErr;

export async function runBatch(rows: BatchRow[]): Promise<BatchResult> {
  if (rows.length === 0) {
    return { ok: false, message: "No rows to process." };
  }
  if (rows.length > BATCH_MAX) {
    return {
      ok: false,
      message: `Too many rows (${rows.length}). Max ${BATCH_MAX} per batch.`,
    };
  }

  const out: BatchResultRow[] = [];
  let total = 0;
  const laneAgg = new Map<string, BatchConsolidation>();

  for (const row of rows) {
    try {
      const options = cheapestRoute(
        {
          originPort: row.originPort,
          destinationPort: row.destinationPort,
          declaredValueUsd: row.declaredValueUsd,
          hsCode: row.hsCode,
          vehicleAgeYears: row.vehicleAgeYears,
          originCountry: countryFromPort(row.originPort),
          destinationCountry: countryFromPort(row.destinationPort),
        },
        db,
      );
      const best = options[0] ?? null;
      if (best) {
        total += best.totalLandedCostUsd;
        const key = `${row.originPort}|${row.destinationPort}`;
        const existing = laneAgg.get(key);
        if (existing) {
          existing.vehicleCount += 1;
          existing.totalLandedCostUsd += best.totalLandedCostUsd;
        } else {
          laneAgg.set(key, {
            originPort: row.originPort,
            destinationPort: row.destinationPort,
            vehicleCount: 1,
            totalLandedCostUsd: best.totalLandedCostUsd,
          });
        }
      }
      out.push({ input: row, best, errorMessage: best ? null : "No route" });
    } catch (err) {
      out.push({
        input: row,
        best: null,
        errorMessage: err instanceof Error ? err.message : "Calculation failed",
      });
    }
  }

  const consolidations = Array.from(laneAgg.values())
    .filter((c) => c.vehicleCount > 1)
    .sort((a, b) => b.vehicleCount - a.vehicleCount);

  return {
    ok: true,
    rows: out,
    totalLandedCostUsd: Math.round(total * 100) / 100,
    consolidations,
  };
}
