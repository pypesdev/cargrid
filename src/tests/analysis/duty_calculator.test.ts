import { beforeEach, describe, expect, it } from "vitest";
import { calculateDuty } from "../../lib/analysis/duty_calculator";
import { makeAnalysisEnv, type AnalysisEnv } from "./helpers";

describe("calculateDuty", () => {
  let env: AnalysisEnv;
  beforeEach(async () => {
    env = await makeAnalysisEnv();
  });

  it("returns 2.5% for a US import of a 5-year-old non-USMCA passenger vehicle (HS 8703)", () => {
    const result = calculateDuty(
      {
        hsCode: "8703",
        destinationCountry: "US",
        originCountry: "JP",
        declaredValueUsd: 25000,
        vehicleAgeYears: 5,
        asOf: "2024-06-15",
      },
      env.db,
    );

    expect(result.dutyUsd).toBeCloseTo(625, 2);
    expect(result.agreementApplied).toBe("none");
    expect(result.breakdown.applied.adValoremPct).toBe(2.5);
    expect(result.breakdown.notes.join(" ")).toMatch(/MFN|general rate/);
    expect(result.breakdown.applied.tariffRowId).not.toBeNull();
  });

  it("returns 0% for a USMCA-qualifying CA import from US (HS 8703)", () => {
    const result = calculateDuty(
      {
        hsCode: "8703",
        destinationCountry: "CA",
        originCountry: "US",
        declaredValueUsd: 25000,
        vehicleAgeYears: 5,
        asOf: "2024-06-15",
      },
      env.db,
    );

    expect(result.dutyUsd).toBe(0);
    expect(result.agreementApplied).toBe("USMCA");
    expect(result.breakdown.notes.join(" ")).toMatch(/USMCA/);
  });

  it("returns 0% and notes NHTSA exemption for a 25+ year old Japan import to US", () => {
    const result = calculateDuty(
      {
        hsCode: "8703",
        destinationCountry: "US",
        originCountry: "JP",
        declaredValueUsd: 25000,
        vehicleAgeYears: 30,
        asOf: "2024-06-15",
      },
      env.db,
    );

    expect(result.dutyUsd).toBe(0);
    expect(result.agreementApplied).toBe("none");
    expect(result.breakdown.notes.join(" ")).toMatch(/NHTSA 25-year/);
  });

  it("applies the GSP preferential rate when origin is a designated beneficiary", () => {
    const result = calculateDuty(
      {
        hsCode: "8703",
        destinationCountry: "US",
        originCountry: "IN",
        declaredValueUsd: 18000,
        vehicleAgeYears: 4,
        asOf: "2024-06-15",
      },
      env.db,
    );

    expect(result.dutyUsd).toBe(0);
    expect(result.agreementApplied).toBe("GSP");
    expect(result.breakdown.notes.join(" ")).toMatch(/GSP/);
  });

  it("rejects negative declared value and negative age", () => {
    expect(() =>
      calculateDuty(
        {
          hsCode: "8703",
          destinationCountry: "US",
          originCountry: "JP",
          declaredValueUsd: -1,
          vehicleAgeYears: 5,
          asOf: "2024-06-15",
        },
        env.db,
      ),
    ).toThrow(/non-negative/);

    expect(() =>
      calculateDuty(
        {
          hsCode: "8703",
          destinationCountry: "US",
          originCountry: "JP",
          declaredValueUsd: 25000,
          vehicleAgeYears: -1,
          asOf: "2024-06-15",
        },
        env.db,
      ),
    ).toThrow(/non-negative/);
  });

  it("throws when no tariff row exists for the destination + hs code + as-of", () => {
    expect(() =>
      calculateDuty(
        {
          hsCode: "8703",
          destinationCountry: "ZZ",
          originCountry: "JP",
          declaredValueUsd: 25000,
          vehicleAgeYears: 5,
          asOf: "2024-06-15",
        },
        env.db,
      ),
    ).toThrow(/no tariff row/);
  });

  it("returns identical results for repeated calls (pure on stable DB)", () => {
    const input = {
      hsCode: "8703" as const,
      destinationCountry: "US",
      originCountry: "DE",
      declaredValueUsd: 35000,
      vehicleAgeYears: 2,
      asOf: "2024-06-15",
    };
    const a = calculateDuty(input, env.db);
    const b = calculateDuty(input, env.db);
    expect(a).toEqual(b);
  });
});
