import Database from "better-sqlite3";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const DB_PATH = process.env.CARGRID_DB ?? "./data/cargrid.db";
const MIGRATIONS_DIR = "./drizzle";

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS __migrations (
    id TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  );
`);

const applied = new Set(
  db.prepare<[], { id: string }>("SELECT id FROM __migrations").all().map((r) => r.id),
);

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let count = 0;
for (const file of files) {
  if (applied.has(file)) continue;
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  db.transaction(() => {
    db.exec(sql);
    db.prepare("INSERT INTO __migrations (id, applied_at) VALUES (?, ?)").run(
      file,
      Date.now(),
    );
  })();
  count++;
  process.stdout.write(`applied ${file}\n`);
}

if (count === 0) {
  process.stdout.write("no pending migrations\n");
}

db.close();
