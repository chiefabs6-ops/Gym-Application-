import { z } from 'zod';
import { EQUIPMENT, EXERCISE_CATEGORIES, MUSCLE_GROUPS, SET_TYPES, UNIT_SYSTEMS } from './domain';
import { TRACKING_TYPES } from './tracking';

/**
 * Wire format for every synced row. Column names are snake_case and identical in
 * SQLite (mobile), the HTTP payloads, and Postgres (via Prisma @map).
 * Timestamps are epoch milliseconds; booleans are real booleans; JSON columns are objects.
 */
const epochMs = z.number().int().nonnegative();
const uuid = z.string().uuid();

const syncColumns = {
  id: uuid,
  created_at: epochMs,
  /** Client wall-clock time of the last edit. Drives Last-Write-Wins. */
  updated_at: epochMs,
  /** Tombstone. Rows are never hard-deleted so deletions can sync. */
  deleted_at: epochMs.nullable(),
};

export const userRowSchema = z.object({
  ...syncColumns,
  display_name: z.string().max(80).nullable(),
  unit_system: z.enum(UNIT_SYSTEMS),
  preferences: z.record(z.unknown()),
});

export const exerciseDefinitionRowSchema = z.object({
  ...syncColumns,
  /** null = canonical exercise shipped with the app (see DEFAULT_EXERCISES). */
  user_id: uuid.nullable(),
  name: z.string().min(1).max(120),
  primary_muscle: z.enum(MUSCLE_GROUPS),
  equipment: z.enum(EQUIPMENT),
  category: z.enum(EXERCISE_CATEGORIES),
  /** Custom exercises can be archived: hidden from pickers but kept in history. Canonical rows: always null. */
  archived_at: epochMs.nullable().default(null),
  /** How sets are logged (columns, records, volume). See tracking.ts. */
  tracking_type: z.enum(TRACKING_TYPES).default('weight_reps'),
});

/** One planned set when a routine exercise uses per-set targets (e.g. a warm-up, then 3 working sets). */
export const templateSetSchema = z.object({
  set_type: z.enum(SET_TYPES),
  reps: z.number().int().min(0).max(1000).nullable(),
  weight_kg: z.number().min(0).max(2000).nullable(),
  duration_s: z.number().int().min(0).max(86_400).nullable().default(null),
  distance_m: z.number().min(0).max(1_000_000).nullable().default(null),
});

export const templateExerciseSchema = z.object({
  exercise_id: uuid,
  order_index: z.number().int().nonnegative(),
  target_sets: z.number().int().min(1).max(50),
  target_reps: z.number().int().min(0).max(1000).nullable(),
  rest_seconds: z.number().int().min(0).max(3600).nullable(),
  /** Planned working weight (kg) pre-filled into each set when the routine is started. Older routines: null. */
  target_weight_kg: z.number().min(0).max(2000).nullable().default(null),
  /** Rep range (e.g. 8–12). When both are set, target_reps is null and the range is shown as the reps hint. */
  rep_min: z.number().int().min(0).max(1000).nullable().default(null),
  rep_max: z.number().int().min(0).max(1000).nullable().default(null),
  /** Per-set targets. When set they replace target_sets / target_reps / target_weight_kg (target_sets = sets.length). */
  sets: z.array(templateSetSchema).min(1).max(50).nullable().default(null),
  /** Time / distance targets for timed and cardio exercises. */
  target_duration_s: z.number().int().min(0).max(86_400).nullable().default(null),
  target_distance_m: z.number().min(0).max(1_000_000).nullable().default(null),
  /** Exercises next to each other with the same value form a superset (see supersets.ts). */
  superset_group: z.string().min(1).max(32).nullable().default(null),
  /** Interval timer: after rest, start the next timed set's countdown by itself. null = not set (older routines). */
  auto_next: z.boolean().nullable().default(null),
});

export const workoutTemplateRowSchema = z.object({
  ...syncColumns,
  user_id: uuid,
  title: z.string().min(1).max(120),
  notes: z.string().max(2000).nullable(),
  /** Routine folder name (Routines tab groups by it). null = no folder. */
  folder: z.string().min(1).max(60).nullable().default(null),
  /** Training-plan day this routine belongs to (see plans.ts). null = not linked. */
  plan_day_id: z.string().min(1).max(32).nullable().default(null),
  template_exercises: z.array(templateExerciseSchema).max(100),
});

export const workoutSessionRowSchema = z.object({
  ...syncColumns,
  user_id: uuid,
  template_id: uuid.nullable(),
  /** Training-plan day this workout counted as (set at start). Drives "Next: <day>". */
  plan_day_id: z.string().min(1).max(32).nullable().default(null),
  title: z.string().max(120).nullable(),
  start_time: epochMs,
  end_time: epochMs.nullable(),
  notes: z.string().max(5000).nullable(),
  rpe: z.number().min(1).max(10).nullable(),
});

export const sessionExerciseRowSchema = z.object({
  ...syncColumns,
  user_id: uuid,
  session_id: uuid,
  exercise_id: uuid,
  order_index: z.number().int().nonnegative(),
  notes: z.string().max(2000).nullable(),
  rest_seconds: z.number().int().min(0).max(3600).nullable(),
  /** Superset / circuit: neighbours with the same value are done back to back (see supersets.ts). */
  superset_group: z.string().min(1).max(32).nullable().default(null),
});

export const setRowSchema = z.object({
  ...syncColumns,
  user_id: uuid,
  session_exercise_id: uuid,
  order_index: z.number().int().nonnegative(),
  set_type: z.enum(SET_TYPES),
  weight_kg: z.number().min(0).max(2000).nullable(),
  reps: z.number().int().min(0).max(10000).nullable(),
  rpe: z.number().min(1).max(10).nullable(),
  is_completed: z.boolean(),
  completed_at: epochMs.nullable(),
  /** Timed sets (seconds) and cardio (seconds + meters). Older rows: null. */
  duration_s: z.number().int().min(0).max(86_400).nullable().default(null),
  distance_m: z.number().min(0).max(1_000_000).nullable().default(null),
  /** Short note on one set ("left shoulder twinge", "paused reps"). */
  notes: z.string().max(500).nullable().default(null),
});

export type UserRow = z.infer<typeof userRowSchema>;
export type ExerciseDefinitionRow = z.infer<typeof exerciseDefinitionRowSchema>;
export type TemplateExercise = z.infer<typeof templateExerciseSchema>;
export type TemplateSet = z.infer<typeof templateSetSchema>;
export type WorkoutTemplateRow = z.infer<typeof workoutTemplateRowSchema>;
export type WorkoutSessionRow = z.infer<typeof workoutSessionRowSchema>;
export type SessionExerciseRow = z.infer<typeof sessionExerciseRowSchema>;
export type SetRow = z.infer<typeof setRowSchema>;

/** Ordered parent-first: pull results are applied in this order. */
export const SYNC_TABLES = [
  'users',
  'exercise_definitions',
  'workout_templates',
  'workout_sessions',
  'session_exercises',
  'sets',
] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

export interface SyncRowMap {
  users: UserRow;
  exercise_definitions: ExerciseDefinitionRow;
  workout_templates: WorkoutTemplateRow;
  workout_sessions: WorkoutSessionRow;
  session_exercises: SessionExerciseRow;
  sets: SetRow;
}
export type SyncRow<T extends SyncTable> = SyncRowMap[T];

/**
 * lww         – whole-row Last-Write-Wins on updated_at.
 * append_only – creates are idempotent inserts that never overwrite an existing row, so
 *               sets logged concurrently on two devices are unioned, never clobbered.
 *               Edits to an individual set still resolve with LWW.
 */
export type MergeStrategy = 'lww' | 'append_only';

export interface TableRef {
  column: string;
  table: SyncTable;
  nullable?: boolean;
  /** Reference may point at a canonical (user_id = null) row. */
  allowGlobal?: boolean;
}

export interface TableSpec {
  schema: z.AnyZodObject;
  strategy: MergeStrategy;
  /** Column that identifies the owning user ('id' only for the users table). */
  ownerColumn: 'id' | 'user_id';
  refs: readonly TableRef[];
  timestampColumns: readonly string[];
  booleanColumns: readonly string[];
  jsonColumns: readonly string[];
}

const BASE_TS = ['created_at', 'updated_at', 'deleted_at'] as const;

export const TABLE_SPECS: Record<SyncTable, TableSpec> = {
  users: {
    schema: userRowSchema,
    strategy: 'lww',
    ownerColumn: 'id',
    refs: [],
    timestampColumns: BASE_TS,
    booleanColumns: [],
    jsonColumns: ['preferences'],
  },
  exercise_definitions: {
    schema: exerciseDefinitionRowSchema,
    strategy: 'lww',
    ownerColumn: 'user_id',
    refs: [],
    timestampColumns: [...BASE_TS, 'archived_at'],
    booleanColumns: [],
    jsonColumns: [],
  },
  workout_templates: {
    schema: workoutTemplateRowSchema,
    strategy: 'lww',
    ownerColumn: 'user_id',
    refs: [],
    timestampColumns: BASE_TS,
    booleanColumns: [],
    jsonColumns: ['template_exercises'],
  },
  workout_sessions: {
    schema: workoutSessionRowSchema,
    strategy: 'lww',
    ownerColumn: 'user_id',
    refs: [{ column: 'template_id', table: 'workout_templates', nullable: true }],
    timestampColumns: [...BASE_TS, 'start_time', 'end_time'],
    booleanColumns: [],
    jsonColumns: [],
  },
  session_exercises: {
    schema: sessionExerciseRowSchema,
    strategy: 'lww',
    ownerColumn: 'user_id',
    refs: [
      { column: 'session_id', table: 'workout_sessions' },
      { column: 'exercise_id', table: 'exercise_definitions', allowGlobal: true },
    ],
    timestampColumns: BASE_TS,
    booleanColumns: [],
    jsonColumns: [],
  },
  sets: {
    schema: setRowSchema,
    strategy: 'append_only',
    ownerColumn: 'user_id',
    refs: [{ column: 'session_exercise_id', table: 'session_exercises' }],
    timestampColumns: [...BASE_TS, 'completed_at'],
    booleanColumns: ['is_completed'],
    jsonColumns: [],
  },
};

export const columnsOf = (table: SyncTable): string[] => Object.keys(TABLE_SPECS[table].schema.shape);
