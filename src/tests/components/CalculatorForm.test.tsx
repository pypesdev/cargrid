import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const runMock = vi.fn();

vi.mock("../../../app/calculator/actions", () => ({
  runCalculator: (...args: unknown[]) => runMock(...args),
}));

import { CalculatorForm } from "../../../app/_components/CalculatorForm";

const vehicleOptions = [
  {
    make: "Toyota",
    model: "Camry",
    year: 2019,
    hsCode: "8703",
    label: "2019 Toyota Camry",
  },
];

const portOptions = [
  { port: "CNSHA", role: "origin" as const },
  { port: "USLAX", role: "destination" as const },
];

describe("CalculatorForm", () => {
  beforeEach(() => {
    runMock.mockReset();
  });

  it("blocks submit when no vehicle is selected (validation state)", async () => {
    const user = userEvent.setup();
    render(
      <CalculatorForm
        vehicleOptions={vehicleOptions}
        portOptions={portOptions}
      />,
    );
    await user.click(screen.getByRole("button", { name: /calculate/i }));
    expect(runMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("error-state")).toHaveTextContent(
      /pick a vehicle/i,
    );
  });

  it("renders the route breakdown when the server action returns ok", async () => {
    runMock.mockResolvedValue({
      ok: true,
      input: {
        make: "Toyota",
        model: "Camry",
        year: 2019,
        hsCode: "8703",
        declaredValueUsd: 35000,
        originPort: "CNSHA",
        destinationPort: "USLAX",
      },
      vehicleAgeYears: 6,
      routes: [
        {
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
          dutyUsd: 875,
          brokerFeesUsd: 250,
          totalLandedCostUsd: 3628,
        },
      ],
      duty: {
        dutyUsd: 875,
        agreementApplied: "none",
        breakdown: {
          candidates: [],
          applied: {
            adValoremPct: 2.5,
            specificUsd: 0,
            agreement: "none",
            tariffRowId: 1,
          },
          notes: ["MFN/general rate applied."],
        },
      },
    });

    const user = userEvent.setup();
    render(
      <CalculatorForm
        vehicleOptions={vehicleOptions}
        portOptions={portOptions}
      />,
    );
    await user.type(
      document.getElementById("vehicle") as HTMLInputElement,
      "Toyota::Camry::2019::8703",
    );
    await user.selectOptions(
      document.getElementById("originPort") as HTMLSelectElement,
      "CNSHA",
    );
    await user.selectOptions(
      document.getElementById("destPort") as HTMLSelectElement,
      "USLAX",
    );
    await user.click(screen.getByRole("button", { name: /calculate/i }));

    expect(runMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId("route-breakdown")).toBeInTheDocument();
    expect(screen.getByTestId("line-item-total")).toHaveTextContent("$3,628");
    expect(screen.getByTestId("duty-notes")).toHaveTextContent(/MFN/);
  });
});
