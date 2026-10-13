import { useEffect, useState } from 'react';
import { addDatabaseChangeListener, type SQLiteBindValue } from 'expo-sqlite';
import { db } from './client';

/**
 * Reactive query: re-runs whenever any of `tables` changes (via SQLite's update hook).
 * Change bursts (e.g. a transaction touching many rows) are coalesced into one re-query.
 */
export function useLiveQuery<T>(
  sql: string,
  params: SQLiteBindValue[],
  tables: string[],
): { data: T[]; loading: boolean } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const paramsKey = JSON.stringify(params);
  const tablesKey = tables.join(',');

  useEffect(() => {
    let cancelled = false;
    let scheduled: ReturnType<typeof setTimeout> | null = null;
    const watched = new Set(tablesKey.split(','));
    const boundParams = JSON.parse(paramsKey) as SQLiteBindValue[];

    const run = async () => {
      scheduled = null;
      const rows = await db.getAllAsync<T>(sql, boundParams);
      if (!cancelled) {
        setData(rows);
        setLoading(false);
      }
    };

    void run();
    const sub = addDatabaseChangeListener(({ tableName }) => {
      if (!watched.has(tableName) || scheduled) return;
      scheduled = setTimeout(() => void run(), 16);
    });

    return () => {
      cancelled = true;
      if (scheduled) clearTimeout(scheduled);
      sub.remove();
    };
  }, [sql, paramsKey, tablesKey]);

  return { data, loading };
}
