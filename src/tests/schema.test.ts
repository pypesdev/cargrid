import { describe, expectTypeOf, it } from "vitest";
import type {
  Comparable,
  IngestionRun,
  ShippingRate,
  Source,
  Tariff,
  TradeFlow,
  Vehicle,
} from "../db/schema";

describe("schema types match docs/specs/schema.md", () => {
  it("sources", () => {
    expectTypeOf<Source>().toEqualTypeOf<{
      sourceKey: string;
      displayName: string;
      baseUrl: string;
      rateLimitPerSec: number;
    }>();
  });

  it("vehicles", () => {
    expectTypeOf<Vehicle>().toEqualTypeOf<{
      id: number;
      make: string;
      model: string;
      year: number;
      bodyClass: string;
      fuelType: string;
      hsCode: "8703" | "8704" | "8711";
    }>();
  });

  it("trade_flows", () => {
    expectTypeOf<TradeFlow>().toEqualTypeOf<{
      id: number;
      reporter: string;
      partner: string;
      hsCode: string;
      year: number;
      month: number;
      valueUsd: number;
      quantity: number;
      flowDirection: "import" | "export";
      source: string;
    }>();
  });

  it("shipping_rates", () => {
    expectTypeOf<ShippingRate>().toEqualTypeOf<{
      id: number;
      originPort: string;
      destinationPort: string;
      mode: "FCL" | "RoRo";
      rateUsd: number;
      currency: string;
      rateDate: string;
      source: string;
    }>();
  });

  it("tariffs", () => {
    expectTypeOf<Tariff>().toEqualTypeOf<{
      id: number;
      destinationCountry: string;
      hsCode: string;
      adValoremPct: number;
      specificUsd: number;
      tradeAgreement: "USMCA" | "GSP" | "none";
      effectiveFrom: string;
      effectiveTo: string | null;
      source: string;
    }>();
  });

  it("comparables", () => {
    expectTypeOf<Comparable>().toEqualTypeOf<{
      id: number;
      vinOrListingId: string;
      source: string;
      soldPriceUsd: number;
      soldDate: string;
      vehicleId: number | null;
      url: string;
      rawJson: string;
    }>();
  });

  it("ingestion_runs", () => {
    expectTypeOf<IngestionRun>().toEqualTypeOf<{
      id: number;
      sourceKey: string;
      startedAt: number;
      finishedAt: number | null;
      status: "ok" | "error" | "running";
      rowCount: number;
      errorMessage: string | null;
      fixtureUsed: string | null;
    }>();
  });
});
