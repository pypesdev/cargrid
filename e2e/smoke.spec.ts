import { expect, test } from "@playwright/test";

test("landing page renders the cargrid heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toContainText("cargrid");
});
