import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

export type RawRow = Record<string, unknown>;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ValidationError[] };

export interface ValidationError {
  path: string;
  message: string;
}

export interface UpsertStats {
  inserted: number;
  updated: number;
  skipped: number;
}

export interface FetchOptions {
  since?: Date;
  until?: Date;
  fixture?: string;
}

export type IngesterEmission<T> =
  | { kind: "row"; raw: RawRow; parsed: T }
  | { kind: "error"; raw: RawRow; errors: ValidationError[] };

export interface Ingester<T> {
  readonly name: string;
  readonly sourceKey: string;
  fetch(opts: FetchOptions): AsyncIterable<RawRow>;
  parse(raw: RawRow): T;
  validate(parsed: T): ValidationResult<T>;
  upsert(records: T[], db: BetterSQLite3Database): Promise<UpsertStats>;
  idempotencyKey(record: T): string;
}
