import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

import { FlowFilters } from "../../../app/_components/FlowFilters";

const filterOptions = {
  hsCodes: ["8703", "8704", "8711"],
  reporters: ["US"],
  partners: ["JP", "MX"],
  years: [2024],
};

describe("FlowFilters", () => {
  beforeEach(() => {
    replaceMock.mockReset();
  });

  it("submits selected filters as URL params", async () => {
    const user = userEvent.setup();
    render(<FlowFilters filterOptions={filterOptions} initial={{}} />);
    await user.selectOptions(screen.getByLabelText(/hs code/i), "8703");
    await user.selectOptions(screen.getByLabelText(/partner/i), "JP");
    await user.click(screen.getByRole("button", { name: /apply filters/i }));

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock.mock.calls[0][0]).toBe("/flows?hs=8703&partner=JP");
  });

  it("clears all params when reset is clicked", async () => {
    const user = userEvent.setup();
    render(
      <FlowFilters
        filterOptions={filterOptions}
        initial={{ hsCode: "8703", partner: "JP" }}
      />,
    );
    await user.click(screen.getByRole("button", { name: /reset/i }));
    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock.mock.calls[0][0]).toBe("/flows");
  });
});
