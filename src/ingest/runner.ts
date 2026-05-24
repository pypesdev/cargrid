import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { ingestionRuns } from "../db/schema";
import { eq } from "drizzle-orm";
import type {
  FetchOptions,
  Ingester,
  RawRow,
  UpsertStats,
  ValidationError,
} from "./types";

export interface RunResult {
  runId: number;
  status: "ok" | "error";
  rowCount: number;
  upsert: UpsertStats;
  rejected: Array<{ raw: RawRow; errors: ValidationError[] }>;
  errorMessage: string | null;
}

export interface RunOptions extends FetchOptions {
  batchSize?: number;
  onRejected?: (raw: RawRow, errors: ValidationError[]) => void;
}

const DEFAULT_BATCH = 500;

export async function runIngester<T>(
  ingester: Ingester<T>,
  db: BetterSQLite3Database,
  opts: RunOptions = {},
): Promise<RunResult> {
  const batchSize = opts.batchSize ?? DEFAULT_BATCH;
  const startedAt = Date.now();

  const [inserted] = await db
    .insert(ingestionRuns)
    .values({
      sourceKey: ingester.sourceKey,
      startedAt,
      status: "running",
      rowCount: 0,
      fixtureUsed: opts.fixture ?? null,
    })
    .returning({ id: ingestionRuns.id });

  const runId = inserted.id;
  const rejected: Array<{ raw: RawRow; errors: ValidationError[] }> = [];
  const upsertTotal: UpsertStats = { inserted: 0, updated: 0, skipped: 0 };
  let rowCount = 0;
  let buffer: T[] = [];

  const flush = async (): Promise<void> => {
    if (buffer.length === 0) return;
    const stats = await ingester.upsert(buffer, db);
    upsertTotal.inserted += stats.inserted;
    upsertTotal.updated += stats.updated;
    upsertTotal.skipped += stats.skipped;
    buffer = [];
  };

  try {
    for await (const raw of ingester.fetch(opts)) {
      rowCount += 1;
      let parsed: T;
      try {
        parsed = ingester.parse(raw);
      } catch (err) {
        const errors: ValidationError[] = [
          { path: "$", message: err instanceof Error ? err.message : String(err) },
        ];
        rejected.push({ raw, errors });
        opts.onRejected?.(raw, errors);
        continue;
      }
      const validated = ingester.validate(parsed);
      if (!validated.ok) {
        rejected.push({ raw, errors: validated.errors });
        opts.onRejected?.(raw, validated.errors);
        continue;
      }
      buffer.push(validated.value);
      if (buffer.length >= batchSize) {
        await flush();
      }
    }
    await flush();

    await db
      .update(ingestionRuns)
      .set({
        finishedAt: Date.now(),
        status: "ok",
        rowCount,
      })
      .where(eq(ingestionRuns.id, runId));

    return {
      runId,
      status: "ok",
      rowCount,
      upsert: upsertTotal,
      rejected,
      errorMessage: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(ingestionRuns)
      .set({
        finishedAt: Date.now(),
        status: "error",
        rowCount,
        errorMessage: message,
      })
      .where(eq(ingestionRuns.id, runId));
    return {
      runId,
      status: "error",
      rowCount,
      upsert: upsertTotal,
      rejected,
      errorMessage: message,
    };
  }
}
