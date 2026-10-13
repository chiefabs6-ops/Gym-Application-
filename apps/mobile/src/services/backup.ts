import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  SYNC_TABLES,
  TABLE_SPECS,
  buildWorkoutCsv,
  countBackupRows,
  parseBackup,
  resolveWrite,
  type BackupFile,
  type BackupTables,
  type SyncTable,
  type TelemetryPointRow,
  type VersionedRow,
} from '@gym/shared';
import { db } from '../db/client';
import { deleteMeta, getMeta, setMeta } from '../db/meta';
import { getUserId } from '../db/repositories/user';
import { fromSqlite, upsertRow } from '../db/rows';

/**
 * On-device backup, export and restore (ROADMAP 1.2). The phone is the only copy of the data
 * until cloud sync exists, so this is the user's safety net.
 *
 * - Backup file: every synced table in sync wire format (JSON), incl. tombstones, + telemetry.
 * - Restore: MERGE, never wipe. Rows are re-owned by this device's user and resolved with the
 *   same LWW/tombstone rules as sync (`resolveWrite`), so restoring an old file can't overwrite
 *   newer local edits, and importing the same file twice is a no-op.
 * - Auto backup: writes to a user-picked folder (persisted SAF permission) after each finished
 *   workout and on app start if the last one is older than a week; keeps the newest few files.
 *
 * Restored rows are NOT added to the sync outbox; Phase 8.2 uploads the full local history on first sign-in.
 */

const AUTO_KEEP_FILES = 8;
const AUTO_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const BACKUP_REMINDER_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
const FILE_PREFIX = 'gymlog-backup-';

const appVersion = () => Constants.expoConfig?.version ?? 'unknown';
const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;

/* ───────────────────────────── Build ───────────────────────────── */

async function readTables(): Promise<BackupTables> {
  const tables = {} as Record<SyncTable, unknown[]>;
  for (const table of SYNC_TABLES) {
    const raw = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
    tables[table] = raw.map((r) => fromSqlite(table, r));
  }
  return tables as BackupTables;
}

export async function buildBackup(): Promise<BackupFile> {
  const telemetry = await db.getAllAsync<TelemetryPointRow>(
    'SELECT session_id, recorded_at, lat, lng, altitude_m, heart_rate FROM telemetry_points',
  );
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: Date.now(),
    app_version: appVersion(),
    user_id: await getUserId(),
    tables: await readTables(),
    telemetry_points: telemetry,
  };
}

async function markBackedUp(kind: 'shared' | 'automatic') {
  await setMeta('last_backup_at', String(Date.now()));
  await setMeta('last_backup_kind', kind);
}

function writeCacheFile(name: string, content: string): File {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  return file;
}

/* ───────────────────────────── Share / export ───────────────────────────── */

/** Opens the share sheet with a full JSON backup (Drive, email, Files…). */
export async function shareBackup(): Promise<void> {
  const file = writeCacheFile(`${FILE_PREFIX}${stamp()}.json`, JSON.stringify(await buildBackup()));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your Gym Log backup' });
  // Android can't tell us whether the user completed or cancelled the share; record it optimistically.
  await markBackedUp('shared');
}

/** Opens the share sheet with a spreadsheet of every logged set. */
export async function shareWorkoutsCsv(): Promise<void> {
  const tables = await readTables();
  const file = writeCacheFile(`gymlog-workouts-${stamp()}.csv`, buildWorkoutCsv(tables));
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export workouts (CSV)' });
}

/* ───────────────────────────── Restore ───────────────────────────── */

export interface BackupSummary {
  exportedAt: number;
  appVersion: string;
  workouts: number;
  sets: number;
  routines: number;
  customExercises: number;
}

export type PickResult = { ok: true; backup: BackupFile; summary: BackupSummary } | { ok: false; error: string } | { ok: false; cancelled: true };

export function summarize(backup: BackupFile): BackupSummary {
  const live = <T extends { deleted_at: number | null }>(rows: T[]) => rows.filter((r) => r.deleted_at === null);
  return {
    exportedAt: backup.exported_at,
    appVersion: backup.app_version,
    workouts: live(backup.tables.workout_sessions).filter((s) => s.end_time !== null).length,
    sets: live(backup.tables.sets).filter((s) => s.is_completed).length,
    routines: live(backup.tables.workout_templates).length,
    customExercises: live(backup.tables.exercise_definitions).filter((e) => e.user_id !== null).length,
  };
}

/** Lets the user pick a backup file and validates it. Doesn't change any data. */
export async function pickBackupFile(): Promise<PickResult> {
  let picked: Awaited<ReturnType<typeof File.pickFileAsync>>;
  try {
    picked = await File.pickFileAsync(undefined, '*/*');
  } catch {
    return { ok: false, cancelled: true };
  }
  const file = Array.isArray(picked) ? picked[0] : picked;
  if (!file) return { ok: false, cancelled: true };
  const result = parseBackup(await file.text());
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, backup: result.backup, summary: summarize(result.backup) };
}

export interface RestoreStats {
  added: number;
  updated: number;
  unchanged: number;
}

/** Merges a validated backup into the local database (single transaction). */
export async function restoreBackup(backup: BackupFile): Promise<RestoreStats> {
  const localUserId = await getUserId();
  const stats: RestoreStats = { added: 0, updated: 0, unchanged: 0 };

  await db.withTransactionAsync(async () => {
    for (const table of SYNC_TABLES) {
      const { strategy } = TABLE_SPECS[table];
      for (const original of backup.tables[table] as (Record<string, unknown> & VersionedRow & { id: string })[]) {
        // Re-own the data by this device's user. The backup's own user row becomes this device's user row.
        const row: Record<string, unknown> & VersionedRow & { id: string } =
          table === 'users'
            ? { ...original, id: localUserId }
            : 'user_id' in original && original.user_id !== null
              ? { ...original, user_id: localUserId }
              : original;

        const local = await db.getFirstAsync<VersionedRow & { created_at: number }>(
          `SELECT created_at, updated_at, deleted_at FROM ${table} WHERE id = ?`,
          [row.id],
        );
        // A freshly installed app's user row has never been edited (created_at === updated_at): let the
        // backup's settings win even though the local row is newer, so units/preferences come back too.
        const pristineUser = table === 'users' && local !== null && local.created_at === local.updated_at;
        const decision = pristineUser ? 'update' : resolveWrite({ strategy, op: 'update', existing: local, incoming: row });
        if (decision === 'insert' || decision === 'update') {
          // Skip writes that wouldn't change anything (same updated_at), so re-imports report "unchanged".
          if (decision === 'update' && local && local.updated_at === row.updated_at && local.deleted_at === row.deleted_at) {
            stats.unchanged++;
            continue;
          }
          await upsertRow(db, table, row);
          stats[decision === 'insert' ? 'added' : 'updated']++;
        } else {
          stats.unchanged++;
        }
      }
    }

    for (const p of backup.telemetry_points) {
      await db.runAsync(
        `INSERT OR IGNORE INTO telemetry_points (session_id, recorded_at, lat, lng, altitude_m, heart_rate, uploaded)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [p.session_id, p.recorded_at, p.lat, p.lng, p.altitude_m, p.heart_rate],
      );
    }
  });

  return stats;
}

/* ───────────────────────────── Automatic backups ───────────────────────────── */

export interface BackupStatus {
  lastBackupAt: number | null;
  lastBackupKind: string | null;
  autoEnabled: boolean;
  autoFolderLabel: string | null;
  autoError: string | null;
}

/** Human-readable folder name from a SAF tree URI (".../tree/primary%3ADocuments%2FGymLog"). */
export function folderLabel(uri: string | null): string | null {
  if (!uri) return null;
  const decoded = decodeURIComponent(uri.split('/tree/').pop() ?? uri);
  return decoded.replace(/^primary:/, 'Phone storage/').replace(/^[0-9A-F]{4}-[0-9A-F]{4}:/, 'SD card/') || decoded;
}

export async function getBackupStatus(): Promise<BackupStatus> {
  const [at, kind, dir, enabled, error] = await Promise.all([
    getMeta('last_backup_at'),
    getMeta('last_backup_kind'),
    getMeta('auto_backup_dir'),
    getMeta('auto_backup_enabled'),
    getMeta('auto_backup_error'),
  ]);
  return {
    lastBackupAt: at ? Number(at) : null,
    lastBackupKind: kind,
    autoEnabled: enabled === '1' && !!dir,
    autoFolderLabel: folderLabel(dir),
    autoError: error,
  };
}

/** Prompts for a folder, remembers it, and writes a first backup there straight away. */
export async function chooseAutoBackupFolder(): Promise<boolean> {
  let dirUri: string;
  try {
    dirUri = (await Directory.pickDirectoryAsync()).uri;
  } catch {
    return false; // cancelled
  }
  await setMeta('auto_backup_dir', dirUri);
  await setMeta('auto_backup_enabled', '1');
  await runAutoBackup({ force: true });
  return true;
}

export async function setAutoBackupEnabled(enabled: boolean): Promise<void> {
  await setMeta('auto_backup_enabled', enabled ? '1' : '0');
}

/**
 * Writes a backup to the chosen folder if auto-backup is on and one is due (or `force`).
 * Never throws: failures (folder deleted, permission revoked) are recorded for the UI.
 */
export async function runAutoBackup({ force = false } = {}): Promise<boolean> {
  try {
    const [dirUri, enabled, last] = await Promise.all([
      getMeta('auto_backup_dir'),
      getMeta('auto_backup_enabled'),
      getMeta('last_backup_at'),
    ]);
    if (!dirUri || enabled !== '1') return false;
    if (!force && last && Date.now() - Number(last) < AUTO_INTERVAL_MS) return false;

    const dir = new Directory(dirUri);
    const name = `${FILE_PREFIX}${stamp()}.json`;
    for (const entry of dir.list()) if (entry instanceof File && entry.name === name) entry.delete();
    const file = dir.createFile(name, 'application/json');
    file.write(JSON.stringify(await buildBackup()));

    // Keep only the newest AUTO_KEEP_FILES backups we wrote (names sort chronologically).
    const ours = dir
      .list()
      .filter((e): e is File => e instanceof File && e.name.startsWith(FILE_PREFIX) && e.name.endsWith('.json'))
      .sort((a, b) => b.name.localeCompare(a.name));
    for (const old of ours.slice(AUTO_KEEP_FILES)) old.delete();

    await markBackedUp('automatic');
    await deleteMeta('auto_backup_error');
    return true;
  } catch (err) {
    await setMeta('auto_backup_error', `Couldn’t write to the backup folder. Choose it again. (${String(err).slice(0, 120)})`);
    return false;
  }
}

/** Show the reminder when the user has finished workouts but no recent backup. */
export async function needsBackupReminder(): Promise<boolean> {
  const status = await getBackupStatus();
  if (status.autoEnabled && !status.autoError) return false;
  if (status.lastBackupAt && Date.now() - status.lastBackupAt < BACKUP_REMINDER_AFTER_MS) return false;
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM workout_sessions WHERE end_time IS NOT NULL AND deleted_at IS NULL',
  );
  return (row?.n ?? 0) > 0;
}
