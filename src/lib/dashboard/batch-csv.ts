import type { BatchRow } from "../../../app/routes/actions";
import { BATCH_MAX } from "../../../app/routes/constants";

export interface BatchParseResult {
  rows: BatchRow[];
  errors: string[];
  truncated: boolean;
}

const REQUIRED_HEADERS = [
  "label",
  "hs",
  "ageYears",
  "value",
  "origin",
  "destination",
] as const;

type Header = (typeof REQUIRED_HEADERS)[number];

function splitRow(line: string): string[] {
  return line.split(",").map((c) => c.trim());
}

export function parseBatchCsv(text: string): BatchParseResult {
  const trimmed = text.trim();
  const errors: string[] = [];
  if (!trimmed) {
    return { rows: [], errors: ["No data."], truncated: false };
  }
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return { rows: [], errors: ["No data."], truncated: false };
  }

  const firstCols = splitRow(lines[0]);
  const headerLooks = firstCols.every((c) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(c));

  let dataStart = 0;
  let headerMap: Record<Header, number>;
  if (headerLooks) {
    headerMap = mapHeaders(firstCols, errors);
    dataStart = 1;
  } else {
    headerMap = {
      label: 0,
      hs: 1,
      ageYears: 2,
      value: 3,
      origin: 4,
      destination: 5,
    };
  }

  if (errors.length > 0) {
    return { rows: [], errors, truncated: false };
  }

  const rows: BatchRow[] = [];
  let truncated = false;
  for (let i = dataStart; i < lines.length; i += 1) {
    if (rows.length >= BATCH_MAX) {
      truncated = true;
      break;
    }
    const cols = splitRow(lines[i]);
    if (cols.length < 6) {
      errors.push(`Row ${i + 1}: expected 6 columns, got ${cols.length}`);
      continue;
    }
    const ageYears = Number(cols[headerMap.ageYears]);
    const value = Number(cols[headerMap.value]);
    if (!Number.isFinite(ageYears) || ageYears < 0) {
      errors.push(`Row ${i + 1}: bad ageYears`);
      continue;
    }
    if (!Number.isFinite(value) || value <= 0) {
      errors.push(`Row ${i + 1}: bad value`);
      continue;
    }
    rows.push({
      vehicleLabel: cols[headerMap.label],
      hsCode: cols[headerMap.hs],
      vehicleAgeYears: ageYears,
      declaredValueUsd: value,
      originPort: cols[headerMap.origin].toUpperCase(),
      destinationPort: cols[headerMap.destination].toUpperCase(),
    });
  }
  return { rows, errors, truncated };
}

function mapHeaders(headers: string[], errors: string[]): Record<Header, number> {
  const map: Partial<Record<Header, number>> = {};
  const norm = headers.map((h) => h.toLowerCase());
  for (const h of REQUIRED_HEADERS) {
    const idx = norm.indexOf(h.toLowerCase());
    if (idx < 0) {
      errors.push(`Missing required header: ${h}`);
    } else {
      map[h] = idx;
    }
  }
  return map as Record<Header, number>;
}

export function batchResultToCsv(
  rows: Array<{
    input: BatchRow;
    best: import("../../../app/routes/actions").BatchResultRow["best"];
    errorMessage: string | null;
  }>,
): string {
  const header = [
    "label",
    "hs",
    "origin",
    "destination",
    "declared_value_usd",
    "shipping_usd",
    "duty_usd",
    "broker_usd",
    "total_landed_usd",
    "eta_days",
    "error",
  ].join(",");
  const body = rows.map((r) => {
    if (!r.best) {
      return [
        r.input.vehicleLabel,
        r.input.hsCode,
        r.input.originPort,
        r.input.destinationPort,
        r.input.declaredValueUsd,
        "",
        "",
        "",
        "",
        "",
        r.errorMessage ?? "",
      ].join(",");
    }
    return [
      r.input.vehicleLabel,
      r.input.hsCode,
      r.input.originPort,
      r.input.destinationPort,
      r.input.declaredValueUsd,
      r.best.shippingCostUsd,
      r.best.dutyUsd,
      r.best.brokerFeesUsd,
      r.best.totalLandedCostUsd,
      r.best.etaDays,
      "",
    ].join(",");
  });
  return [header, ...body].join("\n");
}

export const SAMPLE_CSV = `label,hs,ageYears,value,origin,destination
2019 Toyota Camry,8703,5,21000,CNSHA,USLAX
2018 BMW M3,8703,6,38000,NLRTM,USNYC
2020 Ford F-150,8704,4,34500,CNSHA,USNYC`;
