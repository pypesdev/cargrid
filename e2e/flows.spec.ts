import { expect, test } from "@playwright/test";

test("applying a partner filter shrinks the flows table", async ({ page }) => {
  await page.goto("/flows");
  await expect(page.getByRole("heading", { name: /flow explorer/i })).toBeVisible();
  await expect(page.getByTestId("flows-table")).toBeVisible();

  const before = (await page.getByTestId("flows-table").locator("tbody tr").count());
  expect(before).toBeGreaterThan(0);

  await page.locator("#partner").selectOption("MX");
  await page.getByRole("button", { name: /apply filters/i }).click();

  await expect(page).toHaveURL(/partner=MX/);
  await expect(page.getByTestId("flows-table")).toBeVisible();
  const after = await page.getByTestId("flows-table").locator("tbody tr").count();
  expect(after).toBeGreaterThan(0);
  expect(after).toBeLessThanOrEqual(before);

  const partnerCells = await page
    .getByTestId("flows-table")
    .locator("tbody tr td:nth-child(3)")
    .allInnerTexts();
  for (const c of partnerCells) {
    expect(c.trim()).toBe("MX");
  }
});
