import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { sources } from "../db/schema";
import { runIngester, type RunResult } from "../ingest/runner";
import type { Ingester } from "../ingest/types";
import { sourceRegistry } from "./registry";

export interface CliRunOptions {
  fixture?: string;
  dbPath?: string;
}

export function openDb(dbPath?: string): {
  db: BetterSQLite3Database;
  close: () => void;
} {
  const path = dbPath ?? process.env.CARGRID_DB ?? "./data/cargrid.db";
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite);
  return { db, close: () => sqlite.close() };
}

export function ensureSourceRow(
  db: BetterSQLite3Database,
  sourceKey: string,
): void {
  const meta = sourceRegistry[sourceKey];
  if (!meta) throw new Error(`unknown sourceKey: ${sourceKey}`);
  db.insert(sources)
    .values({
      sourceKey: meta.sourceKey,
      displayName: meta.displayName,
      baseUrl: meta.baseUrl,
      rateLimitPerSec: meta.rateLimitPerSec,
    })
    .onConflictDoNothing()
    .run();
}

export async function runCli<T>(
  ingester: Ingester<T>,
  opts: CliRunOptions,
): Promise<RunResult> {
  const { db, close } = openDb(opts.dbPath);
  try {
    ensureSourceRow(db, ingester.sourceKey);
    const result = await runIngester(ingester, db, { fixture: opts.fixture });
    process.stdout.write(
      `${ingester.name}: status=${result.status} rows=${result.rowCount} inserted=${result.upsert.inserted} skipped=${result.upsert.skipped} rejected=${result.rejected.length}` +
        (result.errorMessage ? ` error=${result.errorMessage}` : "") +
        "\n",
    );
    return result;
  } finally {
    close();
  }
}

export function parseArg(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return argv[idx + 1];
}
