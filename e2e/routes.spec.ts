import { expect, test } from "@playwright/test";

const SAMPLE = `label,hs,ageYears,value,origin,destination
2019 Toyota Camry,8703,5,21000,CNSHA,USLAX
2018 BMW M3,8703,6,38000,NLRTM,USNYC
2020 Ford F-150,8704,4,34500,CNSHA,USNYC`;

test("batch optimizer returns one result row per input row", async ({ page }) => {
  await page.goto("/routes");
  await expect(
    page.getByRole("heading", { name: /batch route optimizer/i }),
  ).toBeVisible();

  const textarea = page.getByTestId("batch-textarea");
  await textarea.fill(SAMPLE);
  await page.getByRole("button", { name: /compute/i }).click();

  await expect(page.getByTestId("batch-results")).toBeVisible({
    timeout: 10_000,
  });
  const rows = page.getByTestId("batch-table").locator("tbody tr");
  await expect(rows).toHaveCount(3);
  await expect(page.getByTestId("batch-export")).toBeVisible();
});
