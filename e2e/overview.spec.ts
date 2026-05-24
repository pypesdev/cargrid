import { expect, test } from "@playwright/test";

test("overview page loads with stat tiles showing real numbers", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Trade overview" })).toBeVisible();
  const tiles = page.getByTestId("stat-tiles");
  await expect(tiles).toBeVisible();
  const tradeRows = page.getByTestId("stat-value-trade-flow-rows");
  await expect(tradeRows).toBeVisible();
  await expect(tradeRows).not.toHaveText("0");
  const comparables = page.getByTestId("stat-value-comparables");
  await expect(comparables).not.toHaveText("0");
  await expect(page.getByTestId("world-choropleth")).toBeVisible();
  await expect(page.getByTestId("top-corridors-table")).toBeVisible();
});
