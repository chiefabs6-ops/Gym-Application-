/**
 * expo-sqlite stand-in backed by Node's built-in SQLite (node:sqlite), so tests run the app's
 * real SQL (migrations, outbox, PR query, backup/restore) without a device.
 * Only the API surface the app uses is implemented.
 */
import { DatabaseSync } from 'node:sqlite';

export type SQLiteBindValue = string | number | null | boolean | Uint8Array;

const bind = (params: SQLiteBindValue[] | undefined) =>
  (params ?? []).map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v)) as (string | number | null | Uint8Array)[];
const plain = <T>(row: unknown): T => ({ ...(row as object) }) as T;

export class TestSQLiteDatabase {
  raw = new DatabaseSync(':memory:');
  private inTransaction = false;

  async execAsync(sql: string): Promise<void> {
    this.raw.exec(sql);
  }
  async runAsync(sql: string, params?: SQLiteBindValue[]) {
    const r = this.raw.prepare(sql).run(...bind(params));
    return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
  }
  async getFirstAsync<T>(sql: string, params?: SQLiteBindValue[]): Promise<T | null> {
    const row = this.raw.prepare(sql).get(...bind(params));
    return row ? plain<T>(row) : null;
  }
  async getAllAsync<T>(sql: string, params?: SQLiteBindValue[]): Promise<T[]> {
    return this.raw.prepare(sql).all(...bind(params)).map((r) => plain<T>(r));
  }
  async prepareAsync(sql: string) {
    const stmt = this.raw.prepare(sql);
    return {
      async executeAsync(params?: SQLiteBindValue[]) {
        const r = stmt.run(...bind(params));
        return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
      },
      async finalizeAsync() {},
    };
  }
  async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
    if (this.inTransaction) throw new Error('test adapter: nested/concurrent transaction');
    this.inTransaction = true;
    this.raw.exec('BEGIN');
    try {
      await fn();
      this.raw.exec('COMMIT');
    } catch (err) {
      this.raw.exec('ROLLBACK');
      throw err;
    } finally {
      this.inTransaction = false;
    }
  }
}

let instance: TestSQLiteDatabase | null = null;

export function openDatabaseSync(): TestSQLiteDatabase {
  instance ??= new TestSQLiteDatabase();
  return instance;
}

/** Test helper: give the shared db object a fresh, empty in-memory database. */
export function resetTestDatabase(): void {
  const db = openDatabaseSync();
  db.raw.close();
  db.raw = new DatabaseSync(':memory:');
}

export function addDatabaseChangeListener() {
  return { remove() {} };
}
