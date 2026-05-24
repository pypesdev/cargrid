import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const OUT = resolve("test-results/phase-4-screenshots");

const PAGES = [
  { name: "overview", path: "/" },
  { name: "flows", path: "/flows" },
  { name: "calculator", path: "/calculator" },
  { name: "routes", path: "/routes" },
];

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const base = process.env.SCREENSHOT_BASE_URL ?? "http://127.0.0.1:3202";
  for (const p of PAGES) {
    await page.goto(`${base}${p.path}`);
    await page.waitForLoadState("networkidle");
    if (p.name === "calculator") {
      const value = await page
        .locator("#vehicle-options option")
        .first()
        .getAttribute("value");
      if (value) {
        await page.locator("#vehicle").fill(value);
        await page.locator("#declaredValue").fill("25000");
        await page.locator("#originPort").selectOption("CNSHA");
        await page.locator("#destPort").selectOption("USLAX");
        await page.getByRole("button", { name: /calculate/i }).click();
        await page.getByTestId("route-breakdown").waitFor({ timeout: 5_000 });
      }
    }
    if (p.name === "routes") {
      await page.getByRole("button", { name: /compute/i }).click();
      await page.getByTestId("batch-results").waitFor({ timeout: 5_000 });
    }
    await page.screenshot({
      path: `${OUT}/${p.name}.png`,
      fullPage: true,
    });
    process.stdout.write(`captured ${p.name}\n`);
  }
  await browser.close();
}

main().catch((err) => {
  process.stderr.write(`screenshots failed: ${err}\n`);
  process.exit(1);
});
