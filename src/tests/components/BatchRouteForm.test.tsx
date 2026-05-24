import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const runMock = vi.fn();

vi.mock("../../../app/routes/actions", () => ({
  runBatch: (...args: unknown[]) => runMock(...args),
}));

import { BatchRouteForm } from "../../../app/_components/BatchRouteForm";

beforeEach(() => {
  runMock.mockReset();
  if (!URL.createObjectURL) {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: () => "blob:mock",
    });
  } else {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
  }
});

describe("BatchRouteForm", () => {
  it("rejects bad CSV with a parse error (error state)", async () => {
    const user = userEvent.setup();
    render(<BatchRouteForm />);
    const textarea = screen.getByTestId("batch-textarea");
    await user.clear(textarea);
    await user.click(screen.getByRole("button", { name: /compute/i }));
    expect(runMock).not.toHaveBeenCalled();
    expect(await screen.findByTestId("error-state")).toHaveTextContent(/no data/i);
  });

  it("renders results when the server action succeeds", async () => {
    runMock.mockResolvedValue({
      ok: true,
      totalLandedCostUsd: 12345,
      consolidations: [
        {
          originPort: "CNSHA",
          destinationPort: "USLAX",
          vehicleCount: 2,
          totalLandedCostUsd: 8000,
        },
      ],
      rows: [
        {
          input: {
            vehicleLabel: "2019 Toyota Camry",
            hsCode: "8703",
            vehicleAgeYears: 5,
            declaredValueUsd: 21000,
            originPort: "CNSHA",
            destinationPort: "USLAX",
          },
          best: {
            hops: [
              {
                fromPort: "CNSHA",
                toPort: "USLAX",
                mode: "FCL",
                rateUsd: 2503,
                rateDate: "2026-05-20",
                source: "freightos",
                etaDays: 14,
              },
            ],
            shippingCostUsd: 2503,
            etaDays: 14,
            dutyUsd: 525,
            brokerFeesUsd: 250,
            totalLandedCostUsd: 3278,
          },
          errorMessage: null,
        },
      ],
    });

    const user = userEvent.setup();
    render(<BatchRouteForm />);
    await user.click(screen.getByRole("button", { name: /compute/i }));
    expect(await screen.findByTestId("batch-results")).toBeInTheDocument();
    expect(screen.getByTestId("batch-table")).toHaveTextContent(/Toyota Camry/);
    expect(screen.getByTestId("consolidation-list")).toHaveTextContent(
      /CNSHA → USLAX/,
    );
    expect(screen.getByTestId("batch-export")).toHaveAttribute(
      "href",
      "blob:mock",
    );
  });
});
