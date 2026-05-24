import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorldChoropleth } from "../../../app/_components/WorldChoropleth";

describe("WorldChoropleth", () => {
  it("renders an empty state when no data is present", () => {
    render(<WorldChoropleth entries={[]} year={null} />);
    expect(screen.getByTestId("empty-state")).toHaveTextContent(
      /no trade volume/i,
    );
  });

  it("renders the country grid and legend with top partners", () => {
    render(
      <WorldChoropleth
        year={2024}
        entries={[
          { partner: "MX", valueUsd: 90_000_000_000 },
          { partner: "CA", valueUsd: 60_000_000_000 },
          { partner: "JP", valueUsd: 40_000_000_000 },
        ]}
      />,
    );
    expect(screen.getByTestId("world-choropleth")).toBeInTheDocument();
    const legend = screen.getByTestId("choropleth-legend");
    expect(legend).toHaveTextContent(/MX/);
    expect(legend).toHaveTextContent(/CA/);
    expect(legend).toHaveTextContent(/\$90\.0B/);
  });
});
