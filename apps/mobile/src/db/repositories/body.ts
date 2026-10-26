import {
  addDaysToKey,
  calculateTargets,
  checkMacroOverrides,
  resolveTargets,
  toLocalDateKey,
  type BodyProfile,
  type Goal,
  type NutritionSettings,
  type TargetOverrides,
  type Targets,
} from '@gym/shared';
import { db } from '../client';
import { createRecord, deleteRecord, updateRecord } from '../mutate';
import { getSettings } from '../../state/settingsStore';
import { getUserId } from './user';

/**
 * Bodyweight and calorie/macro targets (ROADMAP 2.15, spec §8). Targets live in `users.preferences.nutrition`
 * with a dated history so past days keep the targets they had. Targets use the 7-day average weight; hand-edited
 * targets are kept when weight changes, and a monthly prompt offers to recalculate them.
 */

const AVERAGE_DAYS = 7;
const TREND_DAYS = 30;
const PROMPT_EVERY_MS = 30 * 24 * 60 * 60 * 1000;
const today = () => toLocalDateKey(new Date());

type Reason = 'weight' | 'profile' | 'override' | 'prompt';

const saveNutrition = (nutrition: NutritionSettings) => getSettings().update({ nutrition });

export async function logWeight(kg: number, localDate: string, todayKey: string = today()): Promise<void> {
  await createRecord('body_metrics', { user_id: await getUserId(), local_date: localDate, measured_at: Date.now(), metric: 'weight', value: kg });
  await recalculateTargets('weight', todayKey);
}

/** Fix a mistyped weigh-in; the average and targets update. */
export async function updateWeight(id: string, kg: number, todayKey: string = today()): Promise<void> {
  await updateRecord('body_metrics', id, { value: kg });
  await recalculateTargets('weight', todayKey);
}

export async function deleteWeight(id: string, todayKey: string = today()): Promise<void> {
  await deleteRecord('body_metrics', id);
  await recalculateTargets('weight', todayKey);
}

/** Mean of weigh-ins in the last 7 days (incl. today), else the latest weigh-in; null if none. */
export async function currentWeightKg(todayKey: string = today()): Promise<number | null> {
  const avg = await db.getFirstAsync<{ v: number | null }>(
    `SELECT AVG(value) AS v FROM body_metrics
     WHERE deleted_at IS NULL AND metric = 'weight' AND local_date > ? AND local_date <= ?`,
    [addDaysToKey(todayKey, -AVERAGE_DAYS), todayKey],
  );
  if (avg?.v != null) return avg.v;
  const latest = await db.getFirstAsync<{ value: number }>(
    `SELECT value FROM body_metrics WHERE deleted_at IS NULL AND metric = 'weight' AND local_date <= ?
     ORDER BY local_date DESC, measured_at DESC LIMIT 1`,
    [todayKey],
  );
  return latest?.value ?? null;
}

export async function weightHistory(limit = 100): Promise<{ id: string; local_date: string; value: number }[]> {
  return db.getAllAsync(
    `SELECT id, local_date, value FROM body_metrics WHERE deleted_at IS NULL AND metric = 'weight'
     ORDER BY local_date DESC, measured_at DESC LIMIT ?`,
    [limit],
  );
}

/** One point per weigh-in date: the average of weigh-ins in the 30 days up to that date. */
export async function weightTrend(): Promise<{ local_date: string; value: number }[]> {
  const rows = await db.getAllAsync<{ local_date: string; value: number }>(
    `SELECT local_date, value FROM body_metrics WHERE deleted_at IS NULL AND metric = 'weight' ORDER BY local_date`,
  );
  const dates = [...new Set(rows.map((r) => r.local_date))];
  return dates.map((d) => {
    const from = addDaysToKey(d, -(TREND_DAYS - 1));
    const window = rows.filter((r) => r.local_date >= from && r.local_date <= d);
    return { local_date: d, value: window.reduce((s, r) => s + r.value, 0) / window.length };
  });
}

function withHistory(n: NutritionSettings, fromDate: string, targets: Targets): NutritionSettings['history'] {
  return [...n.history.filter((h) => h.from_date !== fromDate), { from_date: fromDate, targets }].sort((a, b) =>
    a.from_date.localeCompare(b.from_date),
  );
}

async function computeAndSave(n: NutritionSettings, reason: Reason, todayKey: string): Promise<void> {
  const weight = await currentWeightKg(todayKey);
  if (weight === null) {
    await saveNutrition(n);
    return;
  }
  const calculated = calculateTargets(n.profile, n.goal, weight, todayKey);
  const targets = resolveTargets(calculated, n.overrides, { sex: n.profile.sex, weight_kg: weight });
  const hasOverrides = Object.keys(n.overrides).length > 0;
  // The prompt's baseline only moves when the hand-edited targets are (re)based on the current weight.
  const keepBaseline = (reason === 'weight' || reason === 'override') && hasOverrides && n.weight_at_last_calc !== null;
  await saveNutrition({
    ...n,
    history: withHistory(n, todayKey, targets),
    weight_at_last_calc: keepBaseline ? n.weight_at_last_calc : weight,
  });
}

export async function recalculateTargets(reason: Reason, todayKey: string = today()): Promise<void> {
  const n = getSettings().nutrition;
  if (n) await computeAndSave(n, reason, todayKey);
}

export async function saveProfileAndGoal(profile: BodyProfile, goal: Goal, todayKey: string = today()): Promise<void> {
  const n = getSettings().nutrition;
  const base: NutritionSettings = n
    ? { ...n, profile, goal }
    : { profile, goal, overrides: {}, history: [], last_prompt_at: null, weight_at_last_calc: null };
  await computeAndSave(base, 'profile', todayKey);
}

/** Sets (or clears, with null) a hand-edited target. Rejected without saving when edited macros fall below the minimum. */
export async function setOverride(
  key: keyof Targets,
  value: number | null,
  todayKey: string = today(),
): Promise<{ ok: true } | { ok: false; kcal: number; min: number }> {
  const n = getSettings().nutrition;
  if (!n) return { ok: true };
  const overrides: TargetOverrides = { ...n.overrides };
  if (value === null) delete overrides[key];
  else overrides[key] = value;
  const check = checkMacroOverrides(overrides, n.profile.sex);
  if (!check.ok) return check;
  await computeAndSave({ ...n, overrides }, 'override', todayKey);
  return { ok: true };
}

/** Targets in effect on a day (latest history entry on or before it); null before targets were set up. */
export function getTargetsForDate(localDate: string): Targets | null {
  const history = getSettings().nutrition?.history ?? [];
  let found: Targets | null = null;
  for (const h of history) if (h.from_date <= localDate) found = h.targets;
  return found;
}

/**
 * Monthly prompt: not on a maintain goal; only with hand-edited targets; weight moved at least two weeks of the goal
 * rate since the targets were last based on it; at most once every 30 days.
 */
export async function shouldPromptRecalc(now: Date): Promise<boolean> {
  const n = getSettings().nutrition;
  if (!n || n.goal.kind === 'maintain' || n.goal.rate_kg_per_week <= 0) return false;
  if (Object.keys(n.overrides).length === 0 || n.weight_at_last_calc === null) return false;
  if (n.last_prompt_at !== null && now.getTime() - n.last_prompt_at < PROMPT_EVERY_MS) return false;
  const weight = await currentWeightKg(toLocalDateKey(now));
  if (weight === null) return false;
  return Math.abs(weight - n.weight_at_last_calc) >= n.goal.rate_kg_per_week * 2 - 1e-9;
}

export async function markPrompted(now: Date): Promise<void> {
  const n = getSettings().nutrition;
  if (n) await saveNutrition({ ...n, last_prompt_at: now.getTime() });
}

/** "Recalculate": every hand-edited target goes back to the calculated value. */
export async function acceptRecalcPrompt(todayKey: string = today()): Promise<void> {
  const n = getSettings().nutrition;
  if (n) await computeAndSave({ ...n, overrides: {} }, 'prompt', todayKey);
}
