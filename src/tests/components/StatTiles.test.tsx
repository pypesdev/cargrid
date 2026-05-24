import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatTiles } from "../../../app/_components/StatTiles";
import type { OverviewStats } from "../../lib/dashboard/queries";

const baseStats: OverviewStats = {
  totalTradeRows: 1234,
  totalShippingRows: 56,
  totalTariffs: 38,
  totalComparables: 200,
  perSource: [
    {
      sourceKey: "un_comtrade",
      displayName: "UN Comtrade",
      rowCount: 800,
      lastRunAt: "2026-05-20T10:00:00.000Z",
      lastRunStatus: "ok",
    },
    {
      sourceKey: "freightos",
      displayName: "Freightos",
      rowCount: 540,
      lastRunAt: "2026-05-22T10:00:00.000Z",
      lastRunStatus: "ok",
    },
  ],
};

describe("StatTiles", () => {
  it("renders four populated tiles", () => {
    render(<StatTiles stats={baseStats} />);
    expect(screen.getByTestId("stat-tiles")).toBeInTheDocument();
    expect(screen.getByTestId("stat-value-trade-flow-rows")).toHaveTextContent(
      "1,234",
    );
    expect(screen.getByTestId("stat-value-comparables")).toHaveTextContent(
      "200",
    );
    expect(screen.getByTestId("stat-value-tariffs-covered")).toHaveTextContent(
      "38",
    );
  });

  it("falls back to 'never' when no ingestion has run (empty state)", () => {
    render(
      <StatTiles
        stats={{
          totalTradeRows: 0,
          totalShippingRows: 0,
          totalTariffs: 0,
          totalComparables: 0,
          perSource: [],
        }}
      />,
    );
    expect(screen.getByTestId("stat-value-last-ingestion")).toHaveTextContent(
      "never",
    );
    expect(screen.getByTestId("stat-value-trade-flow-rows")).toHaveTextContent(
      "0",
    );
  });
});
