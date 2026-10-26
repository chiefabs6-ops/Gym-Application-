import { TABLE_SPECS, columnsOf, type SyncTable } from '@gym/shared';

/** Prisma delegate name for each synced table. */
export const PRISMA_MODEL: Record<SyncTable, string> = {
  users: 'user',
  exercise_definitions: 'exerciseDefinition',
  workout_templates: 'workoutTemplate',
  workout_sessions: 'workoutSession',
  session_exercises: 'sessionExercise',
  sets: 'workoutSet',
  foods: 'food',
  saved_meals: 'savedMeal',
  recipes: 'recipe',
  recipe_batches: 'recipeBatch',
  food_log_entries: 'foodLogEntry',
  body_metrics: 'bodyMetric',
};

const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** Wire row (snake_case, epoch ms) → Prisma data (camelCase, Date). */
export function toPrismaData(table: SyncTable, row: Record<string, unknown>): Record<string, unknown> {
  const ts = TABLE_SPECS[table].timestampColumns;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[snakeToCamel(key)] = ts.includes(key) && typeof value === 'number' ? new Date(value) : value;
  }
  return out;
}

/**
 * Prisma row → wire row. Iterates the shared schema's columns, so server-only
 * fields (password_hash, email, server_version, ...) can never leak into sync.
 */
export function toWireRow(table: SyncTable, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const column of columnsOf(table)) {
    const value = row[snakeToCamel(column)];
    out[column] = value instanceof Date ? value.getTime() : (value ?? null);
  }
  return out;
}
