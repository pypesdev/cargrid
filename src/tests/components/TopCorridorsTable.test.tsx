import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopCorridorsTable } from "../../../app/_components/TopCorridorsTable";

describe("TopCorridorsTable", () => {
  it("renders an empty state when no corridors are available", () => {
    render(<TopCorridorsTable corridors={[]} year={2024} />);
    expect(screen.getByTestId("empty-state")).toHaveTextContent(
      /no corridor data/i,
    );
  });

  it("renders rows with formatted currency", () => {
    render(
      <TopCorridorsTable
        year={2024}
        corridors={[
          {
            reporter: "US",
            partner: "MX",
            totalValueUsd: 12_000_000_000,
            totalQuantity: 50_000,
            monthCount: 12,
          },
          {
            reporter: "US",
            partner: "JP",
            totalValueUsd: 7_500_000_000,
            totalQuantity: 30_000,
            monthCount: 12,
          },
        ]}
      />,
    );
    const table = screen.getByTestId("top-corridors-table");
    expect(table).toHaveTextContent(/MX/);
    expect(table).toHaveTextContent(/JP/);
    expect(table).toHaveTextContent(/\$12\.0B/);
  });
});
