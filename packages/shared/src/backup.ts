import { z } from 'zod';
import { SYNC_TABLES, TABLE_SPECS, type SyncRowMap, type SyncTable } from './tables';

/**
 * On-device backup file format. A backup is the full local data set in the same wire format
 * used for sync (snake_case, epoch ms, real booleans/objects), so restore can reuse the
 * sync conflict rules. Bump BACKUP_VERSION when the shape changes, and keep parsing old versions.
 */
export const BACKUP_FORMAT = 'gymlog-backup';
export const BACKUP_VERSION = 1;

export const telemetryPointSchema = z.object({
  session_id: z.string().uuid(),
  recorded_at: z.number().int().nonnegative(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  altitude_m: z.number().nullable(),
  heart_rate: z.number().nullable(),
});
export type TelemetryPointRow = z.infer<typeof telemetryPointSchema>;

const tablesSchema = z.object(
  Object.fromEntries(SYNC_TABLES.map((t) => [t, z.array(TABLE_SPECS[t].schema).default([])])) as Record<
    SyncTable,
    z.ZodDefault<z.ZodArray<z.AnyZodObject>>
  >,
);

export const backupFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().min(1),
  exported_at: z.number().int().nonnegative(),
  app_version: z.string(),
  /** Local user id on the exporting device (rows are re-owned on import). */
  user_id: z.string().uuid(),
  tables: tablesSchema,
  telemetry_points: z.array(telemetryPointSchema).default([]),
});

export type BackupTables = { [K in SyncTable]: SyncRowMap[K][] };
export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exported_at: number;
  app_version: string;
  user_id: string;
  tables: BackupTables;
  telemetry_points: TelemetryPointRow[];
}

/** `skippedTables`: tables in the file this app version doesn't know (a backup from a newer version). */
export type ParseBackupResult = { ok: true; backup: BackupFile; skippedTables: string[] } | { ok: false; error: string };

/** User-facing note after a restore that skipped unknown tables; null when nothing was skipped. */
export function skippedDataMessage(tables: string[]): string | null {
  if (tables.length === 0) return null;
  return `Some data (${tables.join(', ')}) was skipped because this backup is from a newer app version. Update the app to restore it.`;
}

/** Validates untrusted backup text. Errors are user-facing. */
export function parseBackup(text: string): ParseBackupResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file isn’t a Gym Log backup (not valid JSON).' };
  }
  const head = z.object({ format: z.string(), version: z.number() }).safeParse(json);
  if (!head.success || head.data.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'This file isn’t a Gym Log backup.' };
  }
  if (head.data.version > BACKUP_VERSION) {
    return { ok: false, error: 'This backup was made by a newer version of Gym Log. Update the app, then try again.' };
  }
  const parsed = backupFileSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `The backup is damaged or incomplete (${issue?.path.join('.') ?? 'unknown field'}).` };
  }
  const rawTables = (json as { tables?: unknown }).tables;
  const known = new Set<string>(SYNC_TABLES);
  const skippedTables =
    rawTables && typeof rawTables === 'object' ? Object.keys(rawTables).filter((t) => !known.has(t)) : [];
  return { ok: true, backup: parsed.data as unknown as BackupFile, skippedTables };
}

export function countBackupRows(tables: BackupTables): Record<SyncTable, number> {
  return Object.fromEntries(SYNC_TABLES.map((t) => [t, tables[t].length])) as Record<SyncTable, number>;
}

/* ───────────────────────────── CSV export ───────────────────────────── */

export const WORKOUT_CSV_HEADER = [
  'Date',
  'Workout',
  'Duration (min)',
  'Exercise',
  'Set',
  'Set Type',
  'Weight (kg)',
  'Reps',
  'RPE',
  'Completed',
  'Exercise Notes',
  'Workout Notes',
  'Workout RPE',
  'Duration (s)',
  'Distance (m)',
  'Set Notes',
] as const;

const pad = (n: number) => String(n).padStart(2, '0');
/** Local date-time, spreadsheet-friendly: 2026-10-07 18:30 */
export const formatCsvDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * One row per set of every *finished*, non-deleted workout, oldest first, in exercise and set order.
 * Exercises missing from `exercises` (shouldn't happen) are labelled "Unknown exercise".
 */
export function buildWorkoutCsv(tables: Pick<BackupTables, 'workout_sessions' | 'session_exercises' | 'sets' | 'exercise_definitions'>): string {
  const exerciseName = new Map(tables.exercise_definitions.map((e) => [e.id, e.name]));
  const live = <T extends { deleted_at: number | null }>(rows: T[]) => rows.filter((r) => r.deleted_at === null);

  const setsBySe = new Map<string, SyncRowMap['sets'][]>();
  for (const s of live(tables.sets)) {
    const list = setsBySe.get(s.session_exercise_id) ?? [];
    list.push(s);
    setsBySe.set(s.session_exercise_id, list);
  }
  const seBySession = new Map<string, SyncRowMap['session_exercises'][]>();
  for (const se of live(tables.session_exercises)) {
    const list = seBySession.get(se.session_id) ?? [];
    list.push(se);
    seBySession.set(se.session_id, list);
  }

  const lines = [WORKOUT_CSV_HEADER.join(',')];
  const sessions = live(tables.workout_sessions)
    .filter((s) => s.end_time !== null)
    .sort((a, b) => a.start_time - b.start_time);

  for (const session of sessions) {
    const minutes = Math.round(((session.end_time ?? session.start_time) - session.start_time) / 60_000);
    const exercises = (seBySession.get(session.id) ?? []).sort((a, b) => a.order_index - b.order_index);
    for (const se of exercises) {
      const sets = (setsBySe.get(se.id) ?? []).sort((a, b) => a.order_index - b.order_index);
      sets.forEach((set, i) => {
        lines.push(
          [
            formatCsvDate(session.start_time),
            session.title ?? 'Workout',
            minutes,
            exerciseName.get(se.exercise_id) ?? 'Unknown exercise',
            i + 1,
            set.set_type,
            set.weight_kg,
            set.reps,
            set.rpe,
            set.is_completed ? 'yes' : 'no',
            se.notes,
            session.notes,
            session.rpe,
            set.duration_s,
            set.distance_m,
            set.notes,
          ]
            .map(csvEscape)
            .join(','),
        );
      });
    }
  }
  return lines.join('\r\n') + '\r\n';
}
