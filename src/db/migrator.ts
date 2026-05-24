import type Database from "better-sqlite3";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Direction = "up" | "down";

export interface MigratorOptions {
  db: Database.Database;
  migrationsDir: string;
}

export interface MigratorResult {
  applied: string[];
  rolledBack: string[];
}

const STATEMENT_BREAKPOINT = /-->\s*statement-breakpoint/;

function splitStatements(sql: string): string[] {
  return sql
    .split(STATEMENT_BREAKPOINT)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function listUpMigrations(migrationsDir: string): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql") && !f.endsWith(".down.sql"))
    .sort();
}

function downFileFor(upFile: string): string {
  return upFile.replace(/\.sql$/, ".down.sql");
}

function ensureBookkeeping(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS __migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);
}

export function migrate(
  direction: Direction,
  opts: MigratorOptions,
): MigratorResult {
  ensureBookkeeping(opts.db);

  if (direction === "up") {
    const applied = new Set(
      opts.db
        .prepare<[], { id: string }>("SELECT id FROM __migrations")
        .all()
        .map((r) => r.id),
    );
    const files = listUpMigrations(opts.migrationsDir);
    const appliedNow: string[] = [];
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(join(opts.migrationsDir, file), "utf8");
      const stmts = splitStatements(sql);
      opts.db.transaction(() => {
        for (const stmt of stmts) opts.db.exec(stmt);
        opts.db
          .prepare("INSERT INTO __migrations (id, applied_at) VALUES (?, ?)")
          .run(file, Date.now());
      })();
      appliedNow.push(file);
    }
    return { applied: appliedNow, rolledBack: [] };
  }

  const appliedList = opts.db
    .prepare<[], { id: string }>(
      "SELECT id FROM __migrations ORDER BY id DESC",
    )
    .all()
    .map((r) => r.id);

  const rolledBack: string[] = [];
  for (const file of appliedList) {
    const downPath = join(opts.migrationsDir, downFileFor(file));
    if (!existsSync(downPath)) {
      throw new Error(
        `missing down migration for ${file} (expected ${downPath})`,
      );
    }
    const sql = readFileSync(downPath, "utf8");
    const stmts = splitStatements(sql);
    opts.db.transaction(() => {
      for (const stmt of stmts) opts.db.exec(stmt);
      opts.db.prepare("DELETE FROM __migrations WHERE id = ?").run(file);
    })();
    rolledBack.push(file);
  }

  opts.db.exec("DROP TABLE IF EXISTS __migrations");
  return { applied: [], rolledBack };
}
