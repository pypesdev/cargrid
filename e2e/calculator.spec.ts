import { expect, test } from "@playwright/test";

test("calculator returns a duty + shipping breakdown for a known lane", async ({
  page,
}) => {
  await page.goto("/calculator");
  await expect(
    page.getByRole("heading", { name: /vehicle import calculator/i }),
  ).toBeVisible();

  // Pick the first available vehicle from the autocomplete catalog.
  const datalist = page.locator("#vehicle-options option").first();
  const value = await datalist.getAttribute("value");
  if (!value) throw new Error("no vehicles in autocomplete catalog");
  await page.locator("#vehicle").fill(value);

  await page.locator("#declaredValue").fill("25000");
  await page.locator("#originPort").selectOption("CNSHA");
  await page.locator("#destPort").selectOption("USLAX");
  await page.getByRole("button", { name: /calculate/i }).click();

  const breakdown = page.getByTestId("route-breakdown");
  await expect(breakdown).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("route-option").first()).toBeVisible();
  await expect(page.getByTestId("line-item-duty").first()).toBeVisible();
  await expect(page.getByTestId("line-item-total").first()).toBeVisible();
  await expect(page.getByTestId("duty-notes")).toContainText(/rate applied/i);
});
