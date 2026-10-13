import { DEFAULT_EXERCISES } from '@gym/shared';
import { db } from './client';

/**
 * Append-only list of migrations, tracked with PRAGMA user_version.
 * NEVER edit a shipped migration; add a new entry instead.
 *
 * Synced tables mirror packages/shared/src/tables.ts column-for-column:
 * timestamps are INTEGER epoch ms, booleans INTEGER 0/1, JSON columns TEXT.
 * No FOREIGN KEY constraints: the server enforces referential integrity and pulled
 * rows may arrive referencing data (e.g. new canonical exercises) not yet on device.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY NOT NULL,
    display_name TEXT,
    unit_system TEXT NOT NULL DEFAULT 'metric',
    preferences TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );

  CREATE TABLE exercise_definitions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT,
    name TEXT NOT NULL,
    primary_muscle TEXT NOT NULL,
    equipment TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX idx_exercises_name ON exercise_definitions(name COLLATE NOCASE);

  CREATE TABLE workout_templates (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    notes TEXT,
    template_exercises TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );

  CREATE TABLE workout_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    template_id TEXT,
    title TEXT,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    notes TEXT,
    rpe REAL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX idx_sessions_start ON workout_sessions(start_time DESC);

  CREATE TABLE session_exercises (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    notes TEXT,
    rest_seconds INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX idx_session_exercises_session ON session_exercises(session_id, order_index);
  CREATE INDEX idx_session_exercises_exercise ON session_exercises(exercise_id);

  CREATE TABLE sets (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    session_exercise_id TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    set_type TEXT NOT NULL DEFAULT 'working',
    weight_kg REAL,
    reps INTEGER,
    rpe REAL,
    is_completed INTEGER NOT NULL DEFAULT 0,
    completed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX idx_sets_session_exercise ON sets(session_exercise_id, order_index);

  -- High-frequency samples: uploaded in batches, outside the row sync protocol.
  CREATE TABLE telemetry_points (
    session_id TEXT NOT NULL,
    recorded_at INTEGER NOT NULL,
    lat REAL,
    lng REAL,
    altitude_m REAL,
    heart_rate INTEGER,
    uploaded INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (session_id, recorded_at)
  );
  CREATE INDEX idx_telemetry_pending ON telemetry_points(uploaded, session_id);

  -- Transactional outbox. Every local mutation lands here in the same transaction as the row write.
  CREATE TABLE sync_queue (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    mutation_id TEXT NOT NULL UNIQUE,
    table_name TEXT NOT NULL,
    op TEXT NOT NULL,
    record_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    client_ts INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'dead'
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
  );
  CREATE INDEX idx_sync_queue_status ON sync_queue(status, seq);
  CREATE INDEX idx_sync_queue_record ON sync_queue(record_id, status);

  CREATE TABLE sync_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
  // v2 (ROADMAP 2.2 / 2.3): routine folders, archivable custom exercises.
  `
  ALTER TABLE workout_templates ADD COLUMN folder TEXT;
  ALTER TABLE exercise_definitions ADD COLUMN archived_at INTEGER;
  `,
  // v3 (ROADMAP 2.4): exercise tracking types; timed and distance sets.
  `
  ALTER TABLE exercise_definitions ADD COLUMN tracking_type TEXT NOT NULL DEFAULT 'weight_reps';
  ALTER TABLE sets ADD COLUMN duration_s INTEGER;
  ALTER TABLE sets ADD COLUMN distance_m REAL;
  `,
  // v4 (ROADMAP 2.5): supersets / circuits.
  `
  ALTER TABLE session_exercises ADD COLUMN superset_group TEXT;
  `,
  // v5 (ROADMAP 2.6): per-set notes.
  `
  ALTER TABLE sets ADD COLUMN notes TEXT;
  `,
  // v6: training split. Routine ↔ plan day, and the day each workout counted as.
  `
  ALTER TABLE workout_templates ADD COLUMN plan_day_id TEXT;
  ALTER TABLE workout_sessions ADD COLUMN plan_day_id TEXT;
  CREATE INDEX idx_sessions_plan_day ON workout_sessions(plan_day_id, end_time);
  `,
];

async function seedCanonicalExercises(): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const ex of DEFAULT_EXERCISES) {
      await db.runAsync(
        // Upsert so renamed canonical exercises update on existing installs. Canonical rows are never
        // user-edited (custom exercises have a user_id), so overwriting their fields is safe.
        `INSERT INTO exercise_definitions
           (id, user_id, name, primary_muscle, equipment, category, tracking_type, created_at, updated_at, deleted_at)
         VALUES (?, NULL, ?, ?, ?, ?, ?, 0, 0, NULL)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, primary_muscle = excluded.primary_muscle,
           equipment = excluded.equipment, category = excluded.category, tracking_type = excluded.tracking_type
         WHERE exercise_definitions.user_id IS NULL`,
        [ex.id, ex.name, ex.primary_muscle, ex.equipment, ex.category, ex.tracking_type],
      );
    }
  });
}

export async function initDatabase(): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[v]!);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }

  await seedCanonicalExercises();
}
