import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
let DB_PATH = "";
let TMP_DIR = "";

function exec(script: string, args: string[]): string {
  return execSync(
    `pnpm -s exec tsx ${join("scripts", script)} ${args.join(" ")}`,
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        CARGRID_DB: DB_PATH,
        CARGRID_FIXTURES_ROOT: REPO_ROOT,
      },
      encoding: "utf8",
    },
  );
}

beforeAll(() => {
  TMP_DIR = mkdtempSync(join(tmpdir(), "cargrid-analyze-"));
  DB_PATH = join(TMP_DIR, "cargrid.db");
  execSync(`pnpm -s exec tsx ${join("scripts", "migrate.ts")}`, {
    cwd: REPO_ROOT,
    env: { ...process.env, CARGRID_DB: DB_PATH },
    stdio: "pipe",
  });
  execSync(`pnpm -s exec tsx ${join("scripts", "seed.ts")}`, {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      CARGRID_DB: DB_PATH,
      CARGRID_FIXTURES_ROOT: REPO_ROOT,
    },
    stdio: "pipe",
  });
});

afterAll(() => {
  if (TMP_DIR) rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("analyze:cheapest CLI", () => {
  it("renders a deterministic table for SHA → LAX HS 8703 $25000 as-of 2026-05-20", () => {
    const out = exec("analyze-cheapest.ts", [
      "--origin",
      "SHA",
      "--destination",
      "LAX",
      "--hs",
      "8703",
      "--value",
      "25000",
      "--as-of",
      "2026-05-20",
    ]);
    expect(out).toMatchSnapshot();
  });

  it("emits JSON when --json is passed", () => {
    const out = exec("analyze-cheapest.ts", [
      "--origin",
      "SHA",
      "--destination",
      "LAX",
      "--hs",
      "8703",
      "--value",
      "25000",
      "--as-of",
      "2026-05-20",
      "--json",
    ]);
    const parsed = JSON.parse(out);
    expect(parsed).toMatchSnapshot();
  });
});

describe("analyze:corridors CLI", () => {
  it("renders a deterministic top-10 table for HS 8703 2022-2024", () => {
    const out = exec("analyze-corridors.ts", [
      "--hs",
      "8703",
      "--year-from",
      "2022",
      "--year-to",
      "2024",
      "--limit",
      "10",
    ]);
    expect(out).toMatchSnapshot();
  });

  it("emits JSON when --json is passed", () => {
    const out = exec("analyze-corridors.ts", [
      "--hs",
      "8703",
      "--year-from",
      "2022",
      "--year-to",
      "2024",
      "--limit",
      "10",
      "--json",
    ]);
    const parsed = JSON.parse(out);
    expect(parsed).toMatchSnapshot();
  });
});
