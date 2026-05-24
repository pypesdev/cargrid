import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { resolve } from "node:path";
import { migrate } from "../../db/migrator";
import { sources } from "../../db/schema";
import { sourceRegistry } from "../../ingesters/registry";

export const MIGRATIONS_DIR = resolve(__dirname, "..", "..", "..", "drizzle");
export const REPO_ROOT = resolve(__dirname, "..", "..", "..");

export interface TestDb {
  sqlite: Database.Database;
  db: BetterSQLite3Database;
}

export function makeTestDb(): TestDb {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  migrate("up", { db: sqlite, migrationsDir: MIGRATIONS_DIR });
  const db = drizzle(sqlite);
  return { sqlite, db };
}

export function seedAllSources(db: BetterSQLite3Database): void {
  for (const meta of Object.values(sourceRegistry)) {
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
}

export function count(sqlite: Database.Database, table: string): number {
  const row = sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {
    n: number;
  };
  return row.n;
}
