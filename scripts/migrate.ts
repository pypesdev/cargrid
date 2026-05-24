import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { migrate } from "../src/db/migrator";

const DB_PATH = process.env.CARGRID_DB ?? "./data/cargrid.db";
const MIGRATIONS_DIR = process.env.CARGRID_MIGRATIONS_DIR ?? "./drizzle";
const direction = process.argv.includes("--down") ? "down" : "up";

if (DB_PATH !== ":memory:") {
  mkdirSync(dirname(DB_PATH), { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const result = migrate(direction, { db, migrationsDir: MIGRATIONS_DIR });

if (direction === "up") {
  if (result.applied.length === 0) {
    process.stdout.write("no pending migrations\n");
  } else {
    for (const f of result.applied) process.stdout.write(`applied ${f}\n`);
  }
} else {
  if (result.rolledBack.length === 0) {
    process.stdout.write("no migrations to roll back\n");
  } else {
    for (const f of result.rolledBack) {
      process.stdout.write(`rolled back ${f}\n`);
    }
  }
}

db.close();
