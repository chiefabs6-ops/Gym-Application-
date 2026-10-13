import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite';
import { TABLE_SPECS, columnsOf, type SyncRow, type SyncTable } from '@gym/shared';

/** Wire row → SQLite bind values, in columnsOf(table) order. */
export function toSqliteValues(table: SyncTable, row: Record<string, unknown>): SQLiteBindValue[] {
  const spec = TABLE_SPECS[table];
  return columnsOf(table).map((col) => {
    const value = row[col];
    if (value === undefined || value === null) return null;
    if (spec.booleanColumns.includes(col)) return value ? 1 : 0;
    if (spec.jsonColumns.includes(col)) return JSON.stringify(value);
    return value as SQLiteBindValue;
  });
}

/** SQLite row → wire row (booleans and JSON decoded). */
export function fromSqlite<T extends SyncTable>(table: T, raw: Record<string, unknown>): SyncRow<T> {
  const spec = TABLE_SPECS[table];
  const out: Record<string, unknown> = { ...raw };
  for (const col of spec.booleanColumns) out[col] = raw[col] === 1;
  for (const col of spec.jsonColumns) out[col] = typeof raw[col] === 'string' ? JSON.parse(raw[col] as string) : raw[col];
  return out as SyncRow<T>;
}

const upsertSqlCache = new Map<SyncTable, string>();

function upsertSql(table: SyncTable): string {
  let sql = upsertSqlCache.get(table);
  if (!sql) {
    const cols = columnsOf(table);
    sql =
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) ` +
      `ON CONFLICT(id) DO UPDATE SET ${cols
        .filter((c) => c !== 'id')
        .map((c) => `${c} = excluded.${c}`)
        .join(', ')}`;
    upsertSqlCache.set(table, sql);
  }
  return sql;
}

export async function upsertRow(executor: SQLiteDatabase, table: SyncTable, row: Record<string, unknown>) {
  await executor.runAsync(upsertSql(table), toSqliteValues(table, row));
}
