import { describe, expect, it } from "vitest";
import {
  batchResultToCsv,
  parseBatchCsv,
  SAMPLE_CSV,
} from "../../lib/dashboard/batch-csv";
import { BATCH_MAX } from "../../../app/routes/constants";

describe("parseBatchCsv", () => {
  it("parses the sample CSV with header row", () => {
    const result = parseBatchCsv(SAMPLE_CSV);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toMatchObject({
      hsCode: "8703",
      originPort: "CNSHA",
      destinationPort: "USLAX",
    });
  });

  it("treats input without a header as positional columns", () => {
    const result = parseBatchCsv(
      "2019 Camry,8703,5,21000,CNSHA,USLAX\n2018 M3,8703,6,38000,NLRTM,USNYC",
    );
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[1].declaredValueUsd).toBe(38000);
  });

  it("caps at BATCH_MAX rows and reports truncation", () => {
    const header = "label,hs,ageYears,value,origin,destination";
    const row = "2019 Camry,8703,5,21000,CNSHA,USLAX";
    const csv = [header, ...Array.from({ length: BATCH_MAX + 5 }, () => row)].join(
      "\n",
    );
    const result = parseBatchCsv(csv);
    expect(result.rows).toHaveLength(BATCH_MAX);
    expect(result.truncated).toBe(true);
  });

  it("reports the empty-input case explicitly", () => {
    const result = parseBatchCsv("");
    expect(result.errors[0]).toMatch(/no data/i);
    expect(result.rows).toHaveLength(0);
  });

  it("serialises results back to CSV with a header row", () => {
    const csv = batchResultToCsv([
      {
        input: {
          vehicleLabel: "Test",
          hsCode: "8703",
          vehicleAgeYears: 4,
          declaredValueUsd: 1000,
          originPort: "CNSHA",
          destinationPort: "USLAX",
        },
        best: {
          hops: [
            {
              fromPort: "CNSHA",
              toPort: "USLAX",
              mode: "FCL",
              rateUsd: 100,
              rateDate: "2026-05-20",
              source: "freightos",
              etaDays: 14,
            },
          ],
          shippingCostUsd: 100,
          etaDays: 14,
          dutyUsd: 25,
          brokerFeesUsd: 250,
          totalLandedCostUsd: 375,
        },
        errorMessage: null,
      },
    ]);
    const [header, body] = csv.split("\n");
    expect(header).toBe(
      "label,hs,origin,destination,declared_value_usd,shipping_usd,duty_usd,broker_usd,total_landed_usd,eta_days,error",
    );
    expect(body).toContain("Test");
    expect(body).toContain("375");
  });
});
