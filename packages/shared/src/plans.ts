import { z } from 'zod';

/**
 * Training split (e.g. Push / Pull / Cardio) run as a rotation: the next day is the one after the last finished
 * workout's day, whatever the date. Stored in `users.preferences.training_plan`. Day ids never change once made,
 * so renaming a day keeps the routines linked to it (`workout_templates.plan_day_id`).
 */
export const MAX_PLAN_DAYS = 14;

export const planDaySchema = z.object({
  id: z.string().min(1).max(32),
  name: z.string().min(1).max(40),
});

export const trainingPlanSchema = z.object({
  /** Preset it started from; null once edited (custom). */
  preset: z.string().max(32).nullable(),
  days: z.array(planDaySchema).min(1).max(MAX_PLAN_DAYS),
});

export type PlanDay = z.infer<typeof planDaySchema>;
export type TrainingPlan = z.infer<typeof trainingPlanSchema>;

export interface PlanPreset {
  id: string;
  name: string;
  days: readonly PlanDay[];
}

/** Built-in splits. Never change a preset day id: routines link to it. */
export const PLAN_PRESETS: readonly PlanPreset[] = [
  {
    id: 'push_pull_cardio',
    name: 'Push / Pull / Cardio',
    days: [
      { id: 'push', name: 'Push' },
      { id: 'pull', name: 'Pull' },
      { id: 'cardio', name: 'Cardio' },
    ],
  },
];

export function planFromPreset(presetId: string): TrainingPlan | null {
  const preset = PLAN_PRESETS.find((p) => p.id === presetId);
  return preset ? { preset: preset.id, days: preset.days.map((d) => ({ ...d })) } : null;
}

/** The day after `lastDayId`, wrapping to the first. No history, or a day no longer in the plan: the first day. */
export function nextPlanDay(plan: TrainingPlan, lastDayId: string | null): PlanDay {
  const i = lastDayId === null ? -1 : plan.days.findIndex((d) => d.id === lastDayId);
  return plan.days[(i + 1) % plan.days.length]!;
}

const cleanName = (name: string) => name.trim().slice(0, 40);
const custom = (days: PlanDay[]): TrainingPlan => ({ preset: null, days });

function newDayId(plan: TrainingPlan): string {
  const taken = new Set(plan.days.map((d) => d.id));
  for (;;) {
    const id = `d_${Math.random().toString(36).slice(2, 8)}`;
    if (!taken.has(id)) return id;
  }
}

export function renamePlanDay(plan: TrainingPlan, id: string, name: string): TrainingPlan {
  const n = cleanName(name);
  if (!n) return plan;
  return custom(plan.days.map((d) => (d.id === id ? { ...d, name: n } : d)));
}

export function addPlanDay(plan: TrainingPlan, name: string): TrainingPlan {
  if (plan.days.length >= MAX_PLAN_DAYS) return plan;
  const n = cleanName(name) || `Day ${plan.days.length + 1}`;
  return custom([...plan.days, { id: newDayId(plan), name: n }]);
}

/** Removing the only day leaves no plan. */
export function removePlanDay(plan: TrainingPlan, id: string): TrainingPlan | null {
  const days = plan.days.filter((d) => d.id !== id);
  return days.length > 0 ? custom(days) : null;
}

export function movePlanDay(plan: TrainingPlan, id: string, delta: -1 | 1): TrainingPlan {
  const i = plan.days.findIndex((d) => d.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= plan.days.length) return plan;
  const days = [...plan.days];
  [days[i], days[j]] = [days[j]!, days[i]!];
  return custom(days);
}

/**
 * Day ids whose routines must be unlinked after a plan change. Switching to no plan removes nothing, so turning
 * the plan back on restores every link.
 */
export function removedDayIds(before: TrainingPlan | null, after: TrainingPlan | null): string[] {
  if (!before || !after) return [];
  const kept = new Set(after.days.map((d) => d.id));
  return before.days.filter((d) => !kept.has(d.id)).map((d) => d.id);
}
