import { beforeEach, describe, expect, it } from "vitest";
import {
  seasonality,
  topCorridors,
  yearOverYearDelta,
} from "../../lib/analysis/flow_aggregations";
import {
  insertTradeFlow,
  makeAnalysisEnv,
  type AnalysisEnv,
} from "./helpers";

interface FlowSpec {
  reporter: string;
  partner: string;
  hsCode: string;
  year: number;
  month: number;
  valueUsd: number;
  quantity: number;
  flowDirection: "import" | "export";
}

function seedFlows(env: AnalysisEnv, flows: FlowSpec[]): void {
  for (const f of flows) {
    insertTradeFlow(env.db, f);
  }
}

describe("topCorridors", () => {
  let env: AnalysisEnv;
  beforeEach(async () => {
    env = await makeAnalysisEnv();
  });

  it("aggregates value across months and ranks corridors descending", () => {
    seedFlows(env, [
      {
        reporter: "US",
        partner: "MX",
        hsCode: "8703",
        year: 2024,
        month: 1,
        valueUsd: 200,
        quantity: 1,
        flowDirection: "import",
      },
      {
        reporter: "US",
        partner: "MX",
        hsCode: "8703",
        year: 2024,
        month: 2,
        valueUsd: 100,
        quantity: 1,
        flowDirection: "import",
      },
      {
        reporter: "US",
        partner: "JP",
        hsCode: "8703",
        year: 2024,
        month: 1,
        valueUsd: 50,
        quantity: 1,
        flowDirection: "import",
      },
      {
        reporter: "US",
        partner: "DE",
        hsCode: "8704",
        year: 2024,
        month: 1,
        valueUsd: 9999,
        quantity: 1,
        flowDirection: "import",
      },
    ]);

    const res = topCorridors(
      { hsCode: "8703", yearFrom: 2024, yearTo: 2024 },
      env.db,
    );
    expect(res).toEqual([
      {
        reporter: "US",
        partner: "MX",
        totalValueUsd: 300,
        totalQuantity: 2,
        monthCount: 2,
      },
      {
        reporter: "US",
        partner: "JP",
        totalValueUsd: 50,
        totalQuantity: 1,
        monthCount: 1,
      },
    ]);
  });

  it("honors the limit parameter", () => {
    for (let i = 0; i < 5; i += 1) {
      insertTradeFlow(env.db, {
        reporter: "US",
        partner: `P${i}`,
        hsCode: "8703",
        year: 2024,
        month: 1,
        valueUsd: 100 - i,
        quantity: 1,
        flowDirection: "import",
      });
    }
    const res = topCorridors(
      { hsCode: "8703", yearFrom: 2024, yearTo: 2024, limit: 2 },
      env.db,
    );
    expect(res).toHaveLength(2);
    expect(res[0].partner).toBe("P0");
    expect(res[1].partner).toBe("P1");
  });

  it("rejects yearFrom > yearTo", () => {
    expect(() =>
      topCorridors(
        { hsCode: "8703", yearFrom: 2024, yearTo: 2023 },
        env.db,
      ),
    ).toThrow(/yearFrom/);
  });
});

describe("yearOverYearDelta", () => {
  let env: AnalysisEnv;
  beforeEach(async () => {
    env = await makeAnalysisEnv();
  });

  it("computes month-by-month YoY delta and percentage", () => {
    seedFlows(env, [
      // 2023 baseline
      ...[1, 2, 3].map((m) => ({
        reporter: "US",
        partner: "MX",
        hsCode: "8703",
        year: 2023,
        month: m,
        valueUsd: 100,
        quantity: 1,
        flowDirection: "import" as const,
      })),
      // 2024 actuals: +50%, flat, -25%
      {
        reporter: "US",
        partner: "MX",
        hsCode: "8703",
        year: 2024,
        month: 1,
        valueUsd: 150,
        quantity: 1,
        flowDirection: "import",
      },
      {
        reporter: "US",
        partner: "MX",
        hsCode: "8703",
        year: 2024,
        month: 2,
        valueUsd: 100,
        quantity: 1,
        flowDirection: "import",
      },
      {
        reporter: "US",
        partner: "MX",
        hsCode: "8703",
        year: 2024,
        month: 3,
        valueUsd: 75,
        quantity: 1,
        flowDirection: "import",
      },
    ]);

    const series = yearOverYearDelta(
      { hsCode: "8703", reporter: "US", partner: "MX" },
      env.db,
    );
    const points2024 = series.points.filter((p) => p.year === 2024);
    expect(points2024).toHaveLength(3);
    expect(points2024[0].yoyDelta).toBe(50);
    expect(points2024[0].yoyPct).toBeCloseTo(50, 4);
    expect(points2024[1].yoyDelta).toBe(0);
    expect(points2024[2].yoyDelta).toBe(-25);
    expect(points2024[2].yoyPct).toBeCloseTo(-25, 4);

    // Baseline (2023) has no prior, so deltas should be null.
    const points2023 = series.points.filter((p) => p.year === 2023);
    for (const p of points2023) {
      expect(p.yoyDelta).toBeNull();
      expect(p.yoyPct).toBeNull();
    }
  });

  it("handles prior-zero buckets without dividing by zero", () => {
    seedFlows(env, [
      {
        reporter: "US",
        partner: "JP",
        hsCode: "8703",
        year: 2023,
        month: 1,
        valueUsd: 0,
        quantity: 0,
        flowDirection: "import",
      },
      {
        reporter: "US",
        partner: "JP",
        hsCode: "8703",
        year: 2024,
        month: 1,
        valueUsd: 100,
        quantity: 1,
        flowDirection: "import",
      },
    ]);
    const series = yearOverYearDelta(
      { hsCode: "8703", reporter: "US", partner: "JP" },
      env.db,
    );
    const p = series.points.find((x) => x.year === 2024 && x.month === 1);
    expect(p?.yoyDelta).toBe(100);
    expect(p?.yoyPct).toBeNull();
  });
});

describe("seasonality", () => {
  let env: AnalysisEnv;
  beforeEach(async () => {
    env = await makeAnalysisEnv();
  });

  it("returns 12 buckets and averages across years", () => {
    seedFlows(env, [
      {
        reporter: "US",
        partner: "MX",
        hsCode: "8703",
        year: 2023,
        month: 1,
        valueUsd: 100,
        quantity: 1,
        flowDirection: "import",
      },
      {
        reporter: "US",
        partner: "MX",
        hsCode: "8703",
        year: 2024,
        month: 1,
        valueUsd: 200,
        quantity: 1,
        flowDirection: "import",
      },
      {
        reporter: "US",
        partner: "MX",
        hsCode: "8703",
        year: 2024,
        month: 6,
        valueUsd: 600,
        quantity: 1,
        flowDirection: "import",
      },
    ]);
    const res = seasonality(
      { hsCode: "8703", reporter: "US" },
      env.db,
    );
    expect(res).toHaveLength(12);
    const jan = res.find((r) => r.month === 1)!;
    expect(jan.avgValueUsd).toBe(150);
    expect(jan.sampleYears).toBe(2);
    const jun = res.find((r) => r.month === 6)!;
    expect(jun.avgValueUsd).toBe(600);
    expect(jun.sampleYears).toBe(1);
    const apr = res.find((r) => r.month === 4)!;
    expect(apr.avgValueUsd).toBe(0);
    expect(apr.sampleYears).toBe(0);
  });
});
