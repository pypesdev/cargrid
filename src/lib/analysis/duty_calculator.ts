import { and, eq, isNull, or, lte, gte } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { tariffs } from "../../db/schema";

export type TradeAgreement = "USMCA" | "GSP" | "none";

export interface DutyInput {
  hsCode: string;
  destinationCountry: string;
  originCountry: string;
  declaredValueUsd: number;
  vehicleAgeYears: number;
  asOf?: string;
}

export interface AppliedRate {
  adValoremPct: number;
  specificUsd: number;
  agreement: TradeAgreement;
  tariffRowId: number | null;
}

export interface DutyBreakdown {
  candidates: AppliedRate[];
  applied: AppliedRate;
  notes: string[];
}

export interface DutyResult {
  dutyUsd: number;
  agreementApplied: TradeAgreement;
  breakdown: DutyBreakdown;
}

export const USMCA_COUNTRIES = new Set(["US", "CA", "MX"]);

// GSP beneficiary developing countries (subset relevant to vehicle trade).
// Source: USTR designated beneficiary list (pre-2021 expiration); the spec
// directs us to honor GSP carveouts encoded in the tariffs table.
export const GSP_BENEFICIARIES = new Set([
  "IN", "BR", "TH", "ID", "PH", "ZA", "EG", "TN",
  "PK", "LK", "BO", "EC", "KE", "GH", "AR", "TR",
]);

export const NHTSA_25_YEAR_AGE = 25;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function calculateDuty(
  input: DutyInput,
  db: BetterSQLite3Database,
): DutyResult {
  if (input.declaredValueUsd < 0) {
    throw new Error("declaredValueUsd must be non-negative");
  }
  if (input.vehicleAgeYears < 0) {
    throw new Error("vehicleAgeYears must be non-negative");
  }

  const asOf = input.asOf ?? todayIso();
  const rows = db
    .select()
    .from(tariffs)
    .where(
      and(
        eq(tariffs.hsCode, input.hsCode),
        eq(tariffs.destinationCountry, input.destinationCountry),
        lte(tariffs.effectiveFrom, asOf),
        or(isNull(tariffs.effectiveTo), gte(tariffs.effectiveTo, asOf)),
      ),
    )
    .all();

  if (rows.length === 0) {
    throw new Error(
      `no tariff row for hs=${input.hsCode} dest=${input.destinationCountry} asOf=${asOf}`,
    );
  }

  const usmcaEligible =
    USMCA_COUNTRIES.has(input.originCountry) &&
    USMCA_COUNTRIES.has(input.destinationCountry);
  const gspEligibleOrigin = GSP_BENEFICIARIES.has(input.originCountry);

  const candidates: AppliedRate[] = [];
  for (const row of rows) {
    if (row.tradeAgreement === "USMCA" && !usmcaEligible) continue;
    if (row.tradeAgreement === "GSP" && !gspEligibleOrigin) continue;
    candidates.push({
      adValoremPct: row.adValoremPct,
      specificUsd: row.specificUsd,
      agreement: row.tradeAgreement,
      tariffRowId: row.id,
    });
  }

  if (candidates.length === 0) {
    throw new Error(
      `no applicable tariff row for hs=${input.hsCode} dest=${input.destinationCountry} origin=${input.originCountry}`,
    );
  }

  // Pick the lowest landed-cost row among applicable agreements.
  const dutyAt = (r: AppliedRate): number =>
    (r.adValoremPct / 100) * input.declaredValueUsd + r.specificUsd;
  const ranked = [...candidates].sort((a, b) => dutyAt(a) - dutyAt(b));
  let applied = ranked[0];
  const notes: string[] = [];

  const nhtsaApplies =
    input.destinationCountry === "US" &&
    input.vehicleAgeYears >= NHTSA_25_YEAR_AGE;
  if (nhtsaApplies) {
    notes.push(
      `NHTSA 25-year exemption applied: vehicle age ${input.vehicleAgeYears}y ≥ ${NHTSA_25_YEAR_AGE}y; duty waived per FMVSS exemption.`,
    );
    applied = {
      adValoremPct: 0,
      specificUsd: 0,
      agreement: "none",
      tariffRowId: applied.tariffRowId,
    };
  }

  if (applied.agreement === "USMCA") {
    notes.push(
      `USMCA preferential rate applied: origin ${input.originCountry} → destination ${input.destinationCountry}.`,
    );
  } else if (applied.agreement === "GSP") {
    notes.push(
      `GSP preferential rate applied: origin ${input.originCountry} is a designated beneficiary.`,
    );
  } else if (!nhtsaApplies) {
    notes.push(
      `MFN/general rate applied: no preferential agreement matched origin ${input.originCountry}.`,
    );
  }

  const dutyUsd =
    (applied.adValoremPct / 100) * input.declaredValueUsd + applied.specificUsd;

  return {
    dutyUsd: roundCents(dutyUsd),
    agreementApplied: applied.agreement,
    breakdown: {
      candidates,
      applied,
      notes,
    },
  };
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}
