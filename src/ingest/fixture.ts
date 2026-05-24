import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadJsonFixture<T = unknown>(relativePath: string): T {
  const root = process.env.CARGRID_FIXTURES_ROOT ?? process.cwd();
  const abs = resolve(root, relativePath);
  const raw = readFileSync(abs, "utf8");
  return JSON.parse(raw) as T;
}
