import fc from "fast-check";
import { beforeEach, describe, expect, it } from "vitest";
import {
  cheapestRoute,
  countryFromPort,
  type RouteOption,
} from "../../lib/analysis/cheapest_route";
import {
  insertShippingRate,
  makeAnalysisEnv,
  type AnalysisEnv,
} from "./helpers";

function seedSmallGraph(env: AnalysisEnv): void {
  const lanes: Array<{
    o: string;
    d: string;
    rate: number;
  }> = [
    { o: "CNSHA", d: "USLAX", rate: 2500 },
    { o: "CNSHA", d: "NLRTM", rate: 3700 },
    { o: "NLRTM", d: "USNYC", rate: 2600 },
    { o: "USLAX", d: "USNYC", rate: 800 },
    { o: "CNSHA", d: "USNYC", rate: 3500 },
  ];
  for (const l of lanes) {
    insertShippingRate(env.db, {
      originPort: l.o,
      destinationPort: l.d,
      mode: "FCL",
      rateUsd: l.rate,
      currency: "USD",
      rateDate: "2026-05-20",
    });
  }
}

describe("countryFromPort", () => {
  it("derives ISO-2 from UN/LOCODE prefix", () => {
    expect(countryFromPort("USLAX")).toBe("US");
    expect(countryFromPort("CNSHA")).toBe("CN");
    expect(countryFromPort("NLRTM")).toBe("NL");
  });
});

describe("cheapestRoute", () => {
  let env: AnalysisEnv;
  beforeEach(async () => {
    env = await makeAnalysisEnv();
    seedSmallGraph(env);
  });

  it("returns up to topK routes ranked by total landed cost", () => {
    const routes = cheapestRoute(
      {
        originPort: "CNSHA",
        destinationPort: "USNYC",
        declaredValueUsd: 25000,
        hsCode: "8703",
        vehicleAgeYears: 4,
        asOf: "2026-05-21",
        topK: 3,
      },
      env.db,
    );

    expect(routes.length).toBeGreaterThan(0);
    expect(routes.length).toBeLessThanOrEqual(3);
    // Sorted ascending by landed cost
    for (let i = 1; i < routes.length; i += 1) {
      expect(routes[i].totalLandedCostUsd).toBeGreaterThanOrEqual(
        routes[i - 1].totalLandedCostUsd,
      );
    }
    // The optimal is the direct CNSHA→USLAX→USNYC vs CNSHA→USNYC vs CNSHA→NLRTM→USNYC
    // Direct: 3500 + duty + broker fees
    // LAX hop: 2500 + 800 = 3300 + duty + broker
    // RTM hop: 3700 + 2600 = 6300 + duty + broker
    const best = routes[0];
    expect(best.shippingCostUsd).toBe(3300);
  });

  it("includes the duty + broker fees in the landed cost", () => {
    const routes = cheapestRoute(
      {
        originPort: "CNSHA",
        destinationPort: "USLAX",
        declaredValueUsd: 25000,
        hsCode: "8703",
        vehicleAgeYears: 4,
        asOf: "2026-05-21",
        topK: 1,
      },
      env.db,
    );
    const best = routes[0];
    // China origin → US destination, HS 8703 non-USMCA non-GSP → 2.5% of $25000 = $625
    expect(best.dutyUsd).toBe(625);
    expect(best.brokerFeesUsd).toBeGreaterThanOrEqual(250);
    expect(best.totalLandedCostUsd).toBeCloseTo(
      best.shippingCostUsd + best.dutyUsd + best.brokerFeesUsd,
      2,
    );
  });

  it("returns empty when no path exists", () => {
    const routes = cheapestRoute(
      {
        originPort: "USNYC",
        destinationPort: "CNSHA",
        declaredValueUsd: 25000,
        hsCode: "8703",
        vehicleAgeYears: 4,
        asOf: "2026-05-21",
      },
      env.db,
    );
    expect(routes).toEqual([]);
  });

  describe("property tests", () => {
    it("all reported route costs are non-negative (100 inputs)", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 200_000 }),
          fc.integer({ min: 0, max: 60 }),
          fc.constantFrom("8703", "8704", "8711"),
          (declared, age, hs) => {
            const routes = cheapestRoute(
              {
                originPort: "CNSHA",
                destinationPort: "USNYC",
                declaredValueUsd: declared,
                hsCode: hs,
                vehicleAgeYears: age,
                asOf: "2026-05-21",
              },
              env.db,
            );
            for (const r of routes) {
              expect(r.shippingCostUsd).toBeGreaterThanOrEqual(0);
              expect(r.dutyUsd).toBeGreaterThanOrEqual(0);
              expect(r.brokerFeesUsd).toBeGreaterThanOrEqual(0);
              expect(r.totalLandedCostUsd).toBeGreaterThanOrEqual(0);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("the optimal path contains no cycles (100 inputs)", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 200_000 }),
          fc.integer({ min: 0, max: 60 }),
          (declared, age) => {
            const routes = cheapestRoute(
              {
                originPort: "CNSHA",
                destinationPort: "USNYC",
                declaredValueUsd: declared,
                hsCode: "8703",
                vehicleAgeYears: age,
                asOf: "2026-05-21",
              },
              env.db,
            );
            for (const r of routes) {
              const visited = new Set<string>();
              for (const hop of r.hops) {
                visited.add(hop.fromPort);
              }
              const lastTo = r.hops[r.hops.length - 1]?.toPort;
              if (lastTo) visited.add(lastTo);
              // The flattened node list (in order) must have all unique nodes.
              const ordered = [r.hops[0].fromPort, ...r.hops.map((h) => h.toPort)];
              expect(new Set(ordered).size).toBe(ordered.length);
              expect(visited.size).toBeGreaterThanOrEqual(2);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("pruning a non-terminal hub never improves the best landed cost (100 inputs)", () => {
      const hubs = ["USLAX", "NLRTM"];
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 200_000 }),
          fc.constantFrom(...hubs),
          (declared, prunedHub) => {
            const baseInput = {
              originPort: "CNSHA",
              destinationPort: "USNYC",
              declaredValueUsd: declared,
              hsCode: "8703" as const,
              vehicleAgeYears: 4,
              asOf: "2026-05-21",
              topK: 1,
            };
            const baseline = cheapestRoute(baseInput, env.db);
            const pruned = cheapestRoute(
              { ...baseInput, excludePorts: [prunedHub] },
              env.db,
            );
            if (baseline.length === 0) return;
            const baseCost = baseline[0].totalLandedCostUsd;
            if (pruned.length === 0) return;
            const prunedCost = pruned[0].totalLandedCostUsd;
            expect(prunedCost).toBeGreaterThanOrEqual(baseCost - 1e-6);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  it("respects maxHops bound", () => {
    const direct = cheapestRoute(
      {
        originPort: "CNSHA",
        destinationPort: "USNYC",
        declaredValueUsd: 25000,
        hsCode: "8703",
        vehicleAgeYears: 4,
        asOf: "2026-05-21",
        maxHops: 1,
      },
      env.db,
    );
    expect(direct.length).toBeGreaterThan(0);
    for (const r of direct) {
      expect(r.hops.length).toBeLessThanOrEqual(1);
    }
  });

  it("derives originCountry and destinationCountry from port codes when unspecified", () => {
    const r: RouteOption = cheapestRoute(
      {
        originPort: "CNSHA",
        destinationPort: "USLAX",
        declaredValueUsd: 25000,
        hsCode: "8703",
        vehicleAgeYears: 4,
        asOf: "2026-05-21",
        topK: 1,
      },
      env.db,
    )[0];
    expect(r).toBeDefined();
    // CN → US, non-USMCA, non-GSP → 2.5%
    expect(r.dutyUsd).toBe(625);
  });
});
