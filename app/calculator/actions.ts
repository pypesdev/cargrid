"use server";

import { db } from "../../src/db";
import {
  calculateDuty,
  type DutyResult,
} from "../../src/lib/analysis/duty_calculator";
import {
  cheapestRoute,
  countryFromPort,
  type RouteOption,
} from "../../src/lib/analysis/cheapest_route";

export interface CalculatorInput {
  make: string;
  model: string;
  year: number;
  hsCode: string;
  declaredValueUsd: number;
  originPort: string;
  destinationPort: string;
}

export interface CalculatorResultOk {
  ok: true;
  input: CalculatorInput;
  routes: RouteOption[];
  duty: DutyResult;
  vehicleAgeYears: number;
}

export interface CalculatorResultErr {
  ok: false;
  message: string;
}

export type CalculatorResult = CalculatorResultOk | CalculatorResultErr;

export async function runCalculator(
  input: CalculatorInput,
): Promise<CalculatorResult> {
  if (!input.originPort || !input.destinationPort) {
    return { ok: false, message: "Origin and destination ports are required." };
  }
  if (!input.hsCode) {
    return { ok: false, message: "HS code is required (select a vehicle)." };
  }
  if (!Number.isFinite(input.declaredValueUsd) || input.declaredValueUsd <= 0) {
    return { ok: false, message: "Declared value must be greater than 0." };
  }
  if (!Number.isFinite(input.year) || input.year < 1900 || input.year > 2100) {
    return { ok: false, message: "Vehicle year is out of range." };
  }
  const referenceYear = new Date().getUTCFullYear();
  const vehicleAgeYears = Math.max(0, referenceYear - input.year);
  try {
    const routes = cheapestRoute(
      {
        originPort: input.originPort,
        destinationPort: input.destinationPort,
        declaredValueUsd: input.declaredValueUsd,
        hsCode: input.hsCode,
        vehicleAgeYears,
      },
      db,
    );
    const duty = calculateDuty(
      {
        hsCode: input.hsCode,
        destinationCountry: countryFromPort(input.destinationPort),
        originCountry: countryFromPort(input.originPort),
        declaredValueUsd: input.declaredValueUsd,
        vehicleAgeYears,
      },
      db,
    );
    return { ok: true, input, routes, duty, vehicleAgeYears };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Calculation failed.",
    };
  }
}
