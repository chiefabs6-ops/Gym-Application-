# Training Split & Next Workout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user define a rotating training split (Push / Pull / Cardio, editable), link routines to its days, have the Workout tab offer the next day, build an "empty" workout before starting it, and save an unsaved workout as a routine afterwards.

**Architecture:** The plan lives in `users.preferences.training_plan` (settings). Routines and sessions get a nullable `plan_day_id` column (migration v6). Pure logic (`plans.ts`, `routineFromSession`) lives in `packages/shared`; DB logic in a new `apps/mobile/src/db/repositories/plan.ts`; the next day is derived from the latest finished session's `plan_day_id`. UI reuses `RoutineEditor` in a `draft` mode.

**Tech Stack:** TypeScript, zod, vitest, expo-sqlite (tests on node:sqlite), Zustand, React Native + NativeWind, lucide-react-native.

**Spec:** `docs/superpowers/specs/2026-10-09-training-split-design.md`

## Global Constraints

- All writes to synced tables go through `apps/mobile/src/db/mutate.ts` (`write`, `stageCreate`, `stageUpdate`, `createRecord`, `updateRecord`). Never call `write()` inside a `write()` builder.
- Every query filters `deleted_at IS NULL`.
- Synced column change = zod schema in `packages/shared/src/tables.ts` + appended mobile migration + `schema.prisma` field (`planDayId String? @map("plan_day_id")`). `prisma migrate dev` is **not** run (offline-only scope; no DB). Run `prisma generate` only.
- Weights stored in kg; never hard-code "kg" in UI.
- `plan_day_id` zod: `z.string().min(1).max(32).nullable().default(null)`.
- `training_plan` = `{ preset: string | null, days: { id, name }[] }` with 1–14 days, or `null`; invalid stored values fall back to `null`.
- Preset day ids are fixed forever: `push`, `pull`, `cardio` (preset id `push_pull_cardio`).
- Setting the plan to None keeps all `plan_day_id` values (re-enabling restores links). Removing a day, or replacing days via a preset, unlinks that day's routines.
- **No git commits:** the project has no repo of its own (the enclosing repo is the user's home folder with no commits). "Checkpoint" steps run the tests instead. Do not `git add`/`commit`.
- Commands from repo root: `npm test`, `npm run typecheck`. Single shared test: `npx vitest run packages/shared/src/__tests__/plans.test.ts` from `packages/shared` (`cd packages/shared && npx vitest run src/__tests__/plans.test.ts`). Single mobile test: `cd apps/mobile && npx vitest run test/plan.test.ts`.
- Keep test/typecheck output short: pipe through `| tail -25`.

## Review Focus

1. **A workout started for a day with no routine and not saved** must still move the rotation (session `plan_day_id` is set at start) — test in Task 4.
2. **Switching the plan to None and back to the preset** must keep routine links (no unlinking on `null`) — test in Task 4 (`setTrainingPlan`).
3. **Superset partner dropped when saving as routine** (one exercise of a pair had no completed sets) must not leave a one-exercise superset — test in Task 2.
4. **Logged reps above the template max (1000) or more than 50 sets** must not make the routine fail zod validation on save — test in Task 2.
5. **Unfinished (active) or deleted sessions** must never be "the last day" — test in Task 4.

---

### Task 1: Shared plan model and settings field

**Files:**
- Create: `packages/shared/src/plans.ts`
- Modify: `packages/shared/src/settings.ts` (add `training_plan` to `settingsSchema`)
- Modify: `packages/shared/src/index.ts` (export `./plans`)
- Test: `packages/shared/src/__tests__/plans.test.ts`

**Interfaces:**
- Produces:
  - `MAX_PLAN_DAYS = 14`
  - `trainingPlanSchema`, `type PlanDay = { id: string; name: string }`, `type TrainingPlan = { preset: string | null; days: PlanDay[] }`
  - `PLAN_PRESETS: readonly { id: string; name: string; days: readonly PlanDay[] }[]`
  - `planFromPreset(presetId: string): TrainingPlan | null`
  - `nextPlanDay(plan: TrainingPlan, lastDayId: string | null): PlanDay`
  - `renamePlanDay(plan, id, name): TrainingPlan`, `addPlanDay(plan, name): TrainingPlan`, `removePlanDay(plan, id): TrainingPlan | null`, `movePlanDay(plan, id, delta: -1 | 1): TrainingPlan`
  - `removedDayIds(before: TrainingPlan | null, after: TrainingPlan | null): string[]`
  - `AppSettings.training_plan: TrainingPlan | null`

- [ ] **Step 1: Write the failing test** — `packages/shared/src/__tests__/plans.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import {
  addPlanDay,
  MAX_PLAN_DAYS,
  movePlanDay,
  nextPlanDay,
  PLAN_PRESETS,
  planFromPreset,
  removedDayIds,
  removePlanDay,
  renamePlanDay,
  type TrainingPlan,
} from '../plans';
import { parseSettings } from '../settings';

const ppc = () => planFromPreset('push_pull_cardio')!;

describe('presets', () => {
  it('has Push / Pull / Cardio with fixed ids', () => {
    expect(PLAN_PRESETS.map((p) => p.id)).toContain('push_pull_cardio');
    expect(ppc()).toEqual({
      preset: 'push_pull_cardio',
      days: [
        { id: 'push', name: 'Push' },
        { id: 'pull', name: 'Pull' },
        { id: 'cardio', name: 'Cardio' },
      ],
    });
    expect(planFromPreset('nope')).toBeNull();
  });

  it('returns a copy, so edits never change the preset', () => {
    const a = ppc();
    a.days[0]!.name = 'Changed';
    expect(ppc().days[0]!.name).toBe('Push');
  });
});

describe('nextPlanDay', () => {
  it('starts at the first day with no history', () => {
    expect(nextPlanDay(ppc(), null).id).toBe('push');
  });
  it('returns the day after the last one and wraps', () => {
    expect(nextPlanDay(ppc(), 'push').id).toBe('pull');
    expect(nextPlanDay(ppc(), 'pull').id).toBe('cardio');
    expect(nextPlanDay(ppc(), 'cardio').id).toBe('push');
  });
  it('restarts at the first day when the last day is no longer in the plan', () => {
    expect(nextPlanDay(ppc(), 'legs').id).toBe('push');
  });
  it('a one-day plan always returns that day', () => {
    const one: TrainingPlan = { preset: null, days: [{ id: 'full', name: 'Full body' }] };
    expect(nextPlanDay(one, 'full').id).toBe('full');
  });
});

describe('editing keeps ids stable and marks the plan custom', () => {
  it('renames without changing the id', () => {
    const p = renamePlanDay(ppc(), 'push', '  Chest & shoulders ');
    expect(p.preset).toBeNull();
    expect(p.days[0]).toEqual({ id: 'push', name: 'Chest & shoulders' });
  });
  it('ignores a blank rename', () => {
    const p = renamePlanDay(ppc(), 'push', '   ');
    expect(p.days[0]!.name).toBe('Push');
  });
  it('adds a day with a new unique id, capped at the max', () => {
    const p = addPlanDay(ppc(), 'Legs');
    expect(p.days).toHaveLength(4);
    expect(p.days[3]!.name).toBe('Legs');
    expect(['push', 'pull', 'cardio']).not.toContain(p.days[3]!.id);
    let full: TrainingPlan = ppc();
    for (let i = 0; i < 20; i++) full = addPlanDay(full, `D${i}`);
    expect(full.days).toHaveLength(MAX_PLAN_DAYS);
    expect(new Set(full.days.map((d) => d.id)).size).toBe(MAX_PLAN_DAYS);
  });
  it('defaults a blank new day name', () => {
    expect(addPlanDay(ppc(), ' ').days[3]!.name).toBe('Day 4');
  });
  it('removes a day; removing the last day leaves no plan', () => {
    expect(removePlanDay(ppc(), 'pull')!.days.map((d) => d.id)).toEqual(['push', 'cardio']);
    const one: TrainingPlan = { preset: null, days: [{ id: 'a', name: 'A' }] };
    expect(removePlanDay(one, 'a')).toBeNull();
  });
  it('moves a day up/down and ignores moves past the ends', () => {
    expect(movePlanDay(ppc(), 'cardio', -1).days.map((d) => d.id)).toEqual(['push', 'cardio', 'pull']);
    expect(movePlanDay(ppc(), 'push', -1).days.map((d) => d.id)).toEqual(['push', 'pull', 'cardio']);
  });
});

describe('removedDayIds', () => {
  it('lists days that disappeared', () => {
    expect(removedDayIds(ppc(), removePlanDay(ppc(), 'pull'))).toEqual(['pull']);
  });
  it('switching to no plan removes nothing (links are kept)', () => {
    expect(removedDayIds(ppc(), null)).toEqual([]);
  });
  it('no previous plan removes nothing', () => {
    expect(removedDayIds(null, ppc())).toEqual([]);
  });
});

describe('training_plan setting', () => {
  it('defaults to null and keeps a valid plan', () => {
    expect(parseSettings({}).training_plan).toBeNull();
    expect(parseSettings({ training_plan: ppc() }).training_plan).toEqual(ppc());
  });
  it('falls back to null for invalid values', () => {
    for (const bad of ['x', { days: [] }, { preset: null, days: [{ id: '', name: 'A' }] }, { preset: null }]) {
      expect(parseSettings({ training_plan: bad }).training_plan).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/__tests__/plans.test.ts | tail -25`
Expected: FAIL — cannot resolve `../plans`.

- [ ] **Step 3: Implement** — `packages/shared/src/plans.ts`

```ts
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
```

In `packages/shared/src/settings.ts` add the import and the field (last field of `settingsSchema`):

```ts
import { trainingPlanSchema } from './plans';
```

```ts
  /** Training split run as a rotation (see plans.ts). null = no plan. */
  training_plan: trainingPlanSchema.nullable().catch(null),
```

In `packages/shared/src/index.ts` append:

```ts
export * from './plans';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/__tests__/plans.test.ts | tail -25`
Expected: PASS (all tests in `plans.test.ts`).

- [ ] **Step 5: Checkpoint**

Run: `cd packages/shared && npx vitest run | tail -8` — Expected: all shared tests pass.

---

### Task 2: `routineFromSession` (save what was logged)

**Files:**
- Modify: `packages/shared/src/templates.ts`
- Test: `packages/shared/src/__tests__/templates.test.ts` (append a `describe`)

**Interfaces:**
- Consumes: `normalizeGroups(groups: readonly (string | null)[]): (string | null)[]` from `./supersets`; `SetRow`, `TemplateExercise` types from `./tables`.
- Produces:
  - `interface LoggedExercise { exercise_id: string; rest_seconds: number | null; superset_group: string | null; sets: LoggedSet[] }`
  - `type LoggedSet = Pick<SetRow, 'set_type' | 'reps' | 'weight_kg' | 'duration_s' | 'distance_m' | 'is_completed'>`
  - `routineFromSession(exercises: readonly LoggedExercise[]): TemplateExercise[]`

- [ ] **Step 1: Write the failing test** — append to `packages/shared/src/__tests__/templates.test.ts` (add `routineFromSession` and `type LoggedSet` to the `../templates` import, and `templateExerciseSchema` is already imported):

```ts
describe('routineFromSession', () => {
  const EX2 = '00000000-0000-4000-8000-000000000015';
  const set = (extra: Partial<LoggedSet> = {}): LoggedSet => ({
    set_type: 'working',
    reps: 10,
    weight_kg: 60,
    duration_s: null,
    distance_m: null,
    is_completed: true,
    ...extra,
  });

  it('keeps completed sets as per-set targets, in order, including warm-ups', () => {
    const out = routineFromSession([
      {
        exercise_id: EX,
        rest_seconds: 120,
        superset_group: null,
        sets: [set({ set_type: 'warmup', reps: 12, weight_kg: 20 }), set(), set({ is_completed: false })],
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ exercise_id: EX, order_index: 0, target_sets: 2, rest_seconds: 120 });
    expect(out[0]!.sets).toEqual([
      { set_type: 'warmup', reps: 12, weight_kg: 20, duration_s: null, distance_m: null },
      { set_type: 'working', reps: 10, weight_kg: 60, duration_s: null, distance_m: null },
    ]);
    expect(() => templateExerciseSchema.parse(out[0])).not.toThrow();
  });

  it('drops exercises with no completed sets and renumbers order_index', () => {
    const out = routineFromSession([
      { exercise_id: EX, rest_seconds: null, superset_group: null, sets: [set({ is_completed: false })] },
      { exercise_id: EX2, rest_seconds: null, superset_group: null, sets: [set()] },
    ]);
    expect(out.map((t) => [t.exercise_id, t.order_index])).toEqual([[EX2, 0]]);
  });

  it('keeps timed and distance values', () => {
    const out = routineFromSession([
      { exercise_id: EX, rest_seconds: null, superset_group: null, sets: [set({ reps: null, weight_kg: null, duration_s: 60, distance_m: 5000 })] },
    ]);
    expect(out[0]!.sets![0]).toMatchObject({ duration_s: 60, distance_m: 5000, reps: null, weight_kg: null });
  });

  it('keeps a superset when both partners survive, drops it when one is removed', () => {
    const both = routineFromSession([
      { exercise_id: EX, rest_seconds: null, superset_group: 'g1', sets: [set()] },
      { exercise_id: EX2, rest_seconds: null, superset_group: 'g1', sets: [set()] },
    ]);
    expect(both.map((t) => t.superset_group)).toEqual(['g1', 'g1']);
    const one = routineFromSession([
      { exercise_id: EX, rest_seconds: null, superset_group: 'g1', sets: [set()] },
      { exercise_id: EX2, rest_seconds: null, superset_group: 'g1', sets: [set({ is_completed: false })] },
    ]);
    expect(one.map((t) => t.superset_group)).toEqual([null]);
  });

  it('clamps values the routine schema would reject (reps > 1000, > 50 sets)', () => {
    const out = routineFromSession([
      { exercise_id: EX, rest_seconds: null, superset_group: null, sets: Array.from({ length: 60 }, () => set({ reps: 5000 })) },
    ]);
    expect(out[0]!.sets).toHaveLength(50);
    expect(out[0]!.target_sets).toBe(50);
    expect(out[0]!.sets![0]!.reps).toBe(1000);
    expect(() => templateExerciseSchema.parse(out[0])).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/__tests__/templates.test.ts | tail -25`
Expected: FAIL — `routineFromSession` is not exported.

- [ ] **Step 3: Implement** — in `packages/shared/src/templates.ts` change the first import line and append:

```ts
import { normalizeGroups } from './supersets';
import type { SetRow, TemplateExercise, TemplateSet } from './tables';
```

```ts
export type LoggedSet = Pick<SetRow, 'set_type' | 'reps' | 'weight_kg' | 'duration_s' | 'distance_m' | 'is_completed'>;

/** One exercise of a finished workout, in session order, with all its sets (ticked or not). */
export interface LoggedExercise {
  exercise_id: string;
  rest_seconds: number | null;
  superset_group: string | null;
  sets: LoggedSet[];
}

const MAX_TEMPLATE_SETS = 50;

/**
 * "Save as routine" after a workout: what was actually logged becomes per-set targets. Only ticked sets count;
 * exercises with none are dropped, and supersets that lost a partner are dissolved.
 */
export function routineFromSession(exercises: readonly LoggedExercise[]): TemplateExercise[] {
  const kept = exercises
    .map((e) => ({ e, done: e.sets.filter((s) => s.is_completed).slice(0, MAX_TEMPLATE_SETS) }))
    .filter((x) => x.done.length > 0);
  const groups = normalizeGroups(kept.map((x) => x.e.superset_group));
  return kept.map(({ e, done }, i) => ({
    exercise_id: e.exercise_id,
    order_index: i,
    target_sets: done.length,
    target_reps: null,
    rest_seconds: e.rest_seconds,
    target_weight_kg: null,
    rep_min: null,
    rep_max: null,
    sets: done.map((s) => ({
      set_type: s.set_type,
      reps: s.reps === null ? null : Math.min(s.reps, MAX_REPS),
      weight_kg: s.weight_kg,
      duration_s: s.duration_s,
      distance_m: s.distance_m,
    })),
    target_duration_s: null,
    target_distance_m: null,
    superset_group: groups[i] ?? null,
    auto_next: null,
  }));
}
```

(`MAX_REPS = 1000` already exists near the top of `templates.ts`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/__tests__/templates.test.ts | tail -25`
Expected: PASS.

- [ ] **Step 5: Checkpoint**

Run: `cd packages/shared && npx vitest run | tail -8` — Expected: all pass.

---

### Task 3: `plan_day_id` columns, migration v6, start options

**Files:**
- Modify: `packages/shared/src/tables.ts:74-91` (two schema fields)
- Modify: `apps/mobile/src/db/migrations.ts:144` (append v6)
- Modify: `apps/server/src/db/schema.prisma:93-127` (two fields)
- Modify: `apps/mobile/src/db/repositories/templates.ts` (`createTemplate`, `updateTemplate`, `duplicateTemplate`)
- Modify: `apps/mobile/src/db/repositories/workouts.ts` (`StartOptions`, `startSession`, `repeatSession`)
- Test: `apps/mobile/test/plan.test.ts` (new)

**Interfaces:**
- Consumes: `TemplateExercise` (shared).
- Produces:
  - `WorkoutTemplateRow.plan_day_id: string | null`, `WorkoutSessionRow.plan_day_id: string | null`
  - `createTemplate(title, exercises, opts: { notes?; folder?; planDayId?: string | null })`
  - `updateTemplate(id, patch: { …existing; plan_day_id?: string | null })`
  - `StartOptions` gains `planDayId?: string | null` (explicit day; `undefined` = use the routine's day) and `draft?: TemplateExercise[]` (exercises to start with, no routine row).

- [ ] **Step 1: Write the failing test** — `apps/mobile/test/plan.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { templateExerciseSchema, type TemplateExercise } from '@gym/shared';
import { db } from '../src/db/client';
import { getRecord } from '../src/db/mutate';
import { createTemplate, duplicateTemplate } from '../src/db/repositories/templates';
import * as workouts from '../src/db/repositories/workouts';
import { BENCH, SQUAT, freshApp } from './helpers';

beforeEach(async () => {
  await freshApp();
});

const te = (exercise_id: string, extra: Partial<TemplateExercise> = {}): TemplateExercise =>
  templateExerciseSchema.parse({ exercise_id, order_index: 0, target_sets: 2, target_reps: 10, rest_seconds: 90, ...extra });

describe('plan_day_id on routines and sessions', () => {
  it('migration v6 adds the columns', async () => {
    const cols = async (t: string) => (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name);
    expect(await cols('workout_templates')).toContain('plan_day_id');
    expect(await cols('workout_sessions')).toContain('plan_day_id');
  });

  it('stores a routine day and duplicates keep it', async () => {
    const t = await createTemplate('Push A', [te(BENCH)], { planDayId: 'push' });
    expect(t.plan_day_id).toBe('push');
    const copy = await getRecord('workout_templates', await duplicateTemplate(t.id));
    expect(copy!.plan_day_id).toBe('push');
  });

  it('a session started from a routine takes its day unless one is given', async () => {
    const t = await createTemplate('Push A', [te(BENCH)], { planDayId: 'push' });
    const a = await workouts.startSession({ templateId: t.id });
    expect((await getRecord('workout_sessions', a))!.plan_day_id).toBe('push');
    await workouts.finishSession(a);
    const b = await workouts.startSession({ templateId: t.id, planDayId: 'pull' });
    expect((await getRecord('workout_sessions', b))!.plan_day_id).toBe('pull');
  });

  it('starts from a draft without writing a routine row', async () => {
    const id = await workouts.startSession({ draft: [te(SQUAT, { target_sets: 3 })], title: 'Push', planDayId: 'push' });
    const s = await getRecord('workout_sessions', id);
    expect(s).toMatchObject({ template_id: null, title: 'Push', plan_day_id: 'push' });
    const n = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM sets x JOIN session_exercises se ON se.id = x.session_exercise_id WHERE se.session_id = ?`,
      [id],
    );
    expect(n!.n).toBe(3);
    const routines = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM workout_templates');
    expect(routines!.n).toBe(0);
  });

  it('repeating a workout keeps its day', async () => {
    const a = await workouts.startSession({ draft: [te(BENCH)], planDayId: 'cardio' });
    await workouts.finishSession(a);
    const b = await workouts.startSession({ repeatOf: a });
    expect((await getRecord('workout_sessions', b))!.plan_day_id).toBe('cardio');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx vitest run test/plan.test.ts | tail -25`
Expected: FAIL — `plan_day_id` column missing / `planDayId` ignored.

- [ ] **Step 3a: Shared schema** — `packages/shared/src/tables.ts`. In `workoutTemplateRowSchema`, after `folder`:

```ts
  /** Training-plan day this routine belongs to (see plans.ts). null = not linked. */
  plan_day_id: z.string().min(1).max(32).nullable().default(null),
```

In `workoutSessionRowSchema`, after `template_id`:

```ts
  /** Training-plan day this workout counted as (set at start). Drives "Next: <day>". */
  plan_day_id: z.string().min(1).max(32).nullable().default(null),
```

(`TABLE_SPECS` columns come from `schema.shape` via `columnsOf`, so no list to edit.)

- [ ] **Step 3b: Migration** — append to `MIGRATIONS` in `apps/mobile/src/db/migrations.ts`, after the v5 entry:

```ts
  // v6: training split. Routine ↔ plan day, and the day each workout counted as.
  `
  ALTER TABLE workout_templates ADD COLUMN plan_day_id TEXT;
  ALTER TABLE workout_sessions ADD COLUMN plan_day_id TEXT;
  CREATE INDEX idx_sessions_plan_day ON workout_sessions(plan_day_id, end_time);
  `,
```

- [ ] **Step 3c: Prisma** — `apps/server/src/db/schema.prisma`: in `model WorkoutTemplate` after `folder String?` add `planDayId String? @map("plan_day_id")`; in `model WorkoutSession` after `templateId …` add `planDayId String? @map("plan_day_id")`. Align columns with the neighbours. Then run `npm run db:generate -w apps/server | tail -5` (no database needed). Do **not** run `prisma migrate`.

- [ ] **Step 3d: Templates repository** — `apps/mobile/src/db/repositories/templates.ts`:

```ts
export async function createTemplate(
  title: string,
  exercises: TemplateExercise[],
  opts: { notes?: string | null; folder?: string | null; planDayId?: string | null } = {},
) {
  return createRecord('workout_templates', {
    user_id: await getUserId(),
    title,
    notes: opts.notes ?? null,
    folder: cleanFolder(opts.folder),
    plan_day_id: opts.planDayId ?? null,
    template_exercises: exercises,
  });
}

/** Templates sync as one LWW document: always write the full exercise list. */
export const updateTemplate = (
  id: string,
  patch: {
    title?: string;
    notes?: string | null;
    folder?: string | null;
    plan_day_id?: string | null;
    template_exercises?: TemplateExercise[];
  },
) => updateRecord('workout_templates', id, 'folder' in patch ? { ...patch, folder: cleanFolder(patch.folder) } : patch);
```

In `duplicateTemplate`, extend the `draft` parameter type with `plan_day_id?: string | null` and add to the staged row:

```ts
      plan_day_id: source.plan_day_id ?? null,
```

- [ ] **Step 3e: Workouts repository** — `apps/mobile/src/db/repositories/workouts.ts`:

Import `type TemplateExercise` from `@gym/shared` alongside the existing imports. Replace `StartOptions`:

```ts
export interface StartOptions {
  templateId?: string | null;
  title?: string | null;
  /** Copy the exercises and sets of this (finished) session: History → "Repeat workout". */
  repeatOf?: string | null;
  /** Training-plan day this workout counts as. undefined = the routine's own day (if any). */
  planDayId?: string | null;
  /** Workout tab "Start empty workout": exercises built in the draft editor. No routine row is written. */
  draft?: TemplateExercise[];
}
```

In `startSession`, the session row gains:

```ts
      plan_day_id: opts.planDayId !== undefined ? opts.planDayId : (template?.plan_day_id ?? null),
```

and `planned` becomes:

```ts
    const planned = [...(opts.draft ?? template?.template_exercises ?? [])].sort((a, b) => a.order_index - b.order_index);
```

In `repeatSession`, the session row gains `plan_day_id: source.plan_day_id,`.

- [ ] **Step 4: Run tests and typecheck**

Run: `cd apps/mobile && npx vitest run test/plan.test.ts | tail -25` — Expected: PASS.
Run: `npm run typecheck 2>&1 | tail -25` — Expected: no errors. If any other `stageCreate`/`createRecord` call for these two tables (or a server/test fixture) now errors with a missing `plan_day_id`, add `plan_day_id: null` there.

- [ ] **Step 5: Checkpoint**

Run: `npm test 2>&1 | tail -15` — Expected: all shared + mobile tests pass.

---

### Task 4: Plan repository (next day, unlinking, save as routine)

**Files:**
- Create: `apps/mobile/src/db/repositories/plan.ts`
- Test: `apps/mobile/test/plan.test.ts` (append)

**Interfaces:**
- Consumes: `removedDayIds`, `routineFromSession`, `type LoggedExercise`, `type TrainingPlan` (shared); `cleanFolder` (templates repo); `useSettingsStore`, `getSettings` (`src/state/settingsStore.ts`); `write`, `stageCreate`, `stageUpdate` (mutate).
- Produces:
  - `LAST_PLAN_DAY_SQL(count: number): string` — SQL with `count` `?` placeholders.
  - `lastPlanDayId(dayIds: readonly string[]): Promise<string | null>`
  - `unlinkPlanDays(dayIds: readonly string[]): Promise<void>`
  - `countLinkedRoutines(dayIds: readonly string[]): Promise<number>`
  - `setTrainingPlan(next: TrainingPlan | null): Promise<void>` — saves the setting, then unlinks removed days.
  - `interface SavePrompt { sessionId: string; title: string | null; planDayId: string | null }`
  - `getSavePrompt(sessionId: string): Promise<SavePrompt | null>`
  - `saveSessionAsRoutine(sessionId: string, opts: { title: string; folder: string | null; planDayId: string | null }): Promise<string>` (new routine id)

- [ ] **Step 1: Write the failing tests** — append to `apps/mobile/test/plan.test.ts`. Extend imports:

```ts
import { planFromPreset, removePlanDay } from '@gym/shared';
import {
  countLinkedRoutines,
  getSavePrompt,
  lastPlanDayId,
  saveSessionAsRoutine,
  setTrainingPlan,
} from '../src/db/repositories/plan';
import { getSettings } from '../src/state/settingsStore';
import { logWorkout } from './helpers';
```

```ts
const DAYS = ['push', 'pull', 'cardio'];

/** Finished workout counted as `day` (optionally from a routine). */
async function doDay(day: string | null, templateId?: string) {
  const id = await workouts.startSession({ templateId: templateId ?? null, draft: templateId ? undefined : [te(BENCH)], planDayId: day });
  await workouts.finishSession(id);
  return id;
}

describe('lastPlanDayId', () => {
  it('is null with no history', async () => {
    expect(await lastPlanDayId(DAYS)).toBeNull();
  });

  it('is the most recently finished workout in the plan', async () => {
    await doDay('push');
    await new Promise((r) => setTimeout(r, 5));
    await doDay('pull');
    expect(await lastPlanDayId(DAYS)).toBe('pull');
  });

  it('a day workout that was never saved as a routine still counts', async () => {
    await doDay('push'); // draft start, template_id null
    expect(await lastPlanDayId(DAYS)).toBe('push');
  });

  it('ignores unfinished, deleted, unlinked and foreign-day workouts', async () => {
    await doDay('push');
    await new Promise((r) => setTimeout(r, 5));
    await workouts.startSession({ draft: [te(BENCH)], planDayId: 'pull' }); // still active
    const deleted = await doDay('cardio');
    await workouts.discardSession(deleted);
    await doDay(null);
    await doDay('legs');
    expect(await lastPlanDayId(DAYS)).toBe('push');
  });
});

describe('setTrainingPlan', () => {
  it('saves the plan and unlinks routines of removed days only', async () => {
    const ppc = planFromPreset('push_pull_cardio')!;
    await setTrainingPlan(ppc);
    const push = await createTemplate('Push A', [te(BENCH)], { planDayId: 'push' });
    const pull = await createTemplate('Pull A', [te(SQUAT)], { planDayId: 'pull' });
    expect(await countLinkedRoutines(['pull'])).toBe(1);

    await setTrainingPlan(removePlanDay(ppc, 'pull'));
    expect(getSettings().training_plan!.days.map((d) => d.id)).toEqual(['push', 'cardio']);
    expect((await getRecord('workout_templates', pull.id))!.plan_day_id).toBeNull();
    expect((await getRecord('workout_templates', push.id))!.plan_day_id).toBe('push');
  });

  it('switching to no plan keeps links, so re-enabling restores them', async () => {
    await setTrainingPlan(planFromPreset('push_pull_cardio'));
    const push = await createTemplate('Push A', [te(BENCH)], { planDayId: 'push' });
    await setTrainingPlan(null);
    expect(getSettings().training_plan).toBeNull();
    await setTrainingPlan(planFromPreset('push_pull_cardio'));
    expect((await getRecord('workout_templates', push.id))!.plan_day_id).toBe('push');
  });
});

describe('save as routine', () => {
  it('offers to save only an unsaved workout with completed sets', async () => {
    const { sessionId } = await logWorkout(BENCH, [{ weight: 60, reps: 8 }]);
    expect(await getSavePrompt(sessionId)).toEqual({ sessionId, title: 'Test', planDayId: null });

    const empty = await logWorkout(BENCH, [{ weight: 60, reps: 8, done: false }]);
    expect(await getSavePrompt(empty.sessionId)).toBeNull();

    const t = await createTemplate('Push A', [te(BENCH)]);
    const fromRoutine = await workouts.startSession({ templateId: t.id });
    await workouts.finishSession(fromRoutine);
    expect(await getSavePrompt(fromRoutine)).toBeNull();
  });

  it('creates the routine from what was logged and links the session to it', async () => {
    const { sessionId } = await logWorkout(BENCH, [
      { weight: 20, reps: 12, type: 'warmup' },
      { weight: 60, reps: 8 },
      { weight: 60, reps: 8, done: false },
    ]);
    const id = await saveSessionAsRoutine(sessionId, { title: '  Push day ', folder: 'PPL', planDayId: 'push' });

    const r = await getRecord('workout_templates', id);
    expect(r).toMatchObject({ title: 'Push day', folder: 'PPL', plan_day_id: 'push' });
    expect(r!.template_exercises).toHaveLength(1);
    expect(r!.template_exercises[0]!.sets!.map((s) => [s.set_type, s.weight_kg, s.reps])).toEqual([
      ['warmup', 20, 12],
      ['working', 60, 8],
    ]);
    expect(await getRecord('workout_sessions', sessionId)).toMatchObject({ template_id: id, plan_day_id: 'push' });
    expect(await getSavePrompt(sessionId)).toBeNull();
  });

  it('a blank name falls back to "Workout"', async () => {
    const { sessionId } = await logWorkout(BENCH, [{ weight: 60, reps: 8 }]);
    const id = await saveSessionAsRoutine(sessionId, { title: '  ', folder: null, planDayId: null });
    expect((await getRecord('workout_templates', id))!.title).toBe('Workout');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/mobile && npx vitest run test/plan.test.ts | tail -25`
Expected: FAIL — cannot resolve `../src/db/repositories/plan`.

- [ ] **Step 3: Implement** — `apps/mobile/src/db/repositories/plan.ts`

```ts
import { removedDayIds, routineFromSession, type LoggedExercise, type SetRow, type TrainingPlan } from '@gym/shared';
import { getSettings, useSettingsStore } from '../../state/settingsStore';
import { db } from '../client';
import { getRecord, stageCreate, stageUpdate, write } from '../mutate';
import { cleanFolder } from './templates';
import { getUserId } from './user';

/** Training split: the rotation's last day, plan edits that unlink routines, and "Save as routine". */

const marks = (n: number) => Array.from({ length: n }, () => '?').join(', ');

/** Latest finished workout counted as one of the plan's days. Used by useLiveQuery too. */
export const LAST_PLAN_DAY_SQL = (count: number) =>
  `SELECT plan_day_id FROM workout_sessions
   WHERE deleted_at IS NULL AND end_time IS NOT NULL AND plan_day_id IN (${marks(count)})
   ORDER BY end_time DESC LIMIT 1`;

export async function lastPlanDayId(dayIds: readonly string[]): Promise<string | null> {
  if (dayIds.length === 0) return null;
  const row = await db.getFirstAsync<{ plan_day_id: string }>(LAST_PLAN_DAY_SQL(dayIds.length), [...dayIds]);
  return row?.plan_day_id ?? null;
}

const linkedRoutines = (dayIds: readonly string[]) =>
  db.getAllAsync<{ id: string }>(
    `SELECT id FROM workout_templates WHERE deleted_at IS NULL AND plan_day_id IN (${marks(dayIds.length)})`,
    [...dayIds],
  );

export async function countLinkedRoutines(dayIds: readonly string[]): Promise<number> {
  return dayIds.length === 0 ? 0 : (await linkedRoutines(dayIds)).length;
}

export async function unlinkPlanDays(dayIds: readonly string[]): Promise<void> {
  if (dayIds.length === 0) return;
  await write(async () => {
    const rows = await linkedRoutines(dayIds);
    return Promise.all(rows.map((r) => stageUpdate('workout_templates', r.id, { plan_day_id: null })));
  });
}

/** Saves the plan, then unlinks routines of days that were removed. Switching to no plan keeps every link. */
export async function setTrainingPlan(next: TrainingPlan | null): Promise<void> {
  const removed = removedDayIds(getSettings().training_plan, next);
  await useSettingsStore.getState().update({ training_plan: next });
  await unlinkPlanDays(removed);
}

export interface SavePrompt {
  sessionId: string;
  title: string | null;
  planDayId: string | null;
}

/** "Save as routine?" applies to a workout not started from a routine that has at least one ticked set. */
export async function getSavePrompt(sessionId: string): Promise<SavePrompt | null> {
  const row = await db.getFirstAsync<{ template_id: string | null; title: string | null; plan_day_id: string | null; done: number }>(
    `SELECT s.template_id, s.title, s.plan_day_id,
       (SELECT COUNT(*) FROM sets x JOIN session_exercises se ON se.id = x.session_exercise_id
        WHERE se.session_id = s.id AND se.deleted_at IS NULL AND x.deleted_at IS NULL AND x.is_completed = 1) AS done
     FROM workout_sessions s WHERE s.id = ? AND s.deleted_at IS NULL`,
    [sessionId],
  );
  if (!row || row.template_id !== null || row.done === 0) return null;
  return { sessionId, title: row.title, planDayId: row.plan_day_id };
}

/** New routine from what was logged; the workout then counts as started from it (and as `planDayId`). */
export async function saveSessionAsRoutine(
  sessionId: string,
  opts: { title: string; folder: string | null; planDayId: string | null },
): Promise<string> {
  const userId = await getUserId();
  let routineId = '';
  await write(async () => {
    const session = await getRecord('workout_sessions', sessionId);
    if (!session || session.deleted_at !== null) throw new Error(`workout_sessions/${sessionId} not found`);
    const exercises = await db.getAllAsync<{ id: string; exercise_id: string; rest_seconds: number | null; superset_group: string | null }>(
      `SELECT id, exercise_id, rest_seconds, superset_group FROM session_exercises
       WHERE session_id = ? AND deleted_at IS NULL ORDER BY order_index`,
      [sessionId],
    );
    const sets = await db.getAllAsync<
      Pick<SetRow, 'set_type' | 'weight_kg' | 'reps' | 'duration_s' | 'distance_m'> & { se: string; done: number }
    >(
      `SELECT s.session_exercise_id AS se, s.set_type, s.weight_kg, s.reps, s.duration_s, s.distance_m, s.is_completed AS done
       FROM sets s JOIN session_exercises se ON se.id = s.session_exercise_id
       WHERE se.session_id = ? AND s.deleted_at IS NULL ORDER BY s.order_index`,
      [sessionId],
    );
    const logged: LoggedExercise[] = exercises.map((e) => ({
      exercise_id: e.exercise_id,
      rest_seconds: e.rest_seconds,
      superset_group: e.superset_group,
      sets: sets
        .filter((s) => s.se === e.id)
        .map(({ se: _se, done, ...s }) => ({ ...s, is_completed: done === 1 })),
    }));
    const template_exercises = routineFromSession(logged);
    if (template_exercises.length === 0) throw new Error('Nothing logged to save');

    const routine = stageCreate('workout_templates', {
      user_id: userId,
      title: opts.title.trim().slice(0, 120) || 'Workout',
      notes: null,
      folder: cleanFolder(opts.folder),
      plan_day_id: opts.planDayId,
      template_exercises,
    });
    routineId = routine.row.id;
    return [routine, await stageUpdate('workout_sessions', sessionId, { template_id: routineId, plan_day_id: opts.planDayId })];
  });
  return routineId;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/mobile && npx vitest run test/plan.test.ts | tail -25` — Expected: PASS.
If the `lastPlanDayId` ordering test is flaky because two `end_time`s are equal, keep the `setTimeout(5)` between workouts (already in the test).

- [ ] **Step 5: Checkpoint**

Run: `npm test 2>&1 | tail -15` and `npm run typecheck 2>&1 | tail -15` — Expected: all pass, no type errors.

---

### Task 5: Store wiring (save prompt after finish) and `useNextPlanDay` hook

**Files:**
- Modify: `apps/mobile/src/state/activeWorkoutStore.ts` (`savePrompt` state, `finish`, `clearSavePrompt`)
- Create: `apps/mobile/src/hooks/usePlan.ts` (if `src/hooks` doesn't exist, create it)
- Test: `apps/mobile/test/plan.test.ts` (append)

**Interfaces:**
- Consumes: `getSavePrompt`, `SavePrompt`, `LAST_PLAN_DAY_SQL` (Task 4); `nextPlanDay`, `PlanDay`, `TrainingPlan` (Task 1); `useLiveQuery(sql, params, tables)`.
- Produces:
  - `useActiveWorkoutStore` state `savePrompt: SavePrompt | null` (not persisted) and action `clearSavePrompt(): void`.
  - `useNextPlanDay(): { plan: TrainingPlan; day: PlanDay } | null` (null = no plan).
  - `useDayRoutines(dayId: string | null): { id: string; title: string; n: number }[]` — routines linked to the day, never-used first, then least recently used.

- [ ] **Step 1: Write the failing test** — append to `apps/mobile/test/plan.test.ts`:

```ts
import { useActiveWorkoutStore } from '../src/state/activeWorkoutStore';

describe('finish → save prompt', () => {
  it('sets savePrompt for an unsaved workout with ticked sets, and clears it', async () => {
    const store = useActiveWorkoutStore.getState();
    await store.start({ draft: [te(BENCH)], planDayId: 'push', title: 'Push' });
    const sessionId = useActiveWorkoutStore.getState().sessionId!;
    const set = await db.getFirstAsync<{ id: string }>(
      `SELECT x.id FROM sets x JOIN session_exercises se ON se.id = x.session_exercise_id WHERE se.session_id = ? LIMIT 1`,
      [sessionId],
    );
    await workouts.updateSet(set!.id, { weight_kg: 60, reps: 8 });
    await workouts.setCompleted(set!.id, true);
    await useActiveWorkoutStore.getState().finish();
    expect(useActiveWorkoutStore.getState().savePrompt).toEqual({ sessionId, title: 'Push', planDayId: 'push' });
    useActiveWorkoutStore.getState().clearSavePrompt();
    expect(useActiveWorkoutStore.getState().savePrompt).toBeNull();
  });
});
```

(If existing mobile tests reset the store between tests, follow that pattern; otherwise add `useActiveWorkoutStore.setState({ sessionId: null, savePrompt: null })` at the start of this test.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx vitest run test/plan.test.ts -t "save prompt" | tail -25`
Expected: FAIL — `savePrompt` is undefined.

- [ ] **Step 3: Implement the store change** — `apps/mobile/src/state/activeWorkoutStore.ts`:
  - Import: `import { getSavePrompt, type SavePrompt } from '../db/repositories/plan';`
  - In `ActiveWorkoutState` add:
    ```ts
    /** Set after finishing a workout that wasn't started from a routine: Workout tab asks "Save as routine?". */
    savePrompt: SavePrompt | null;
    clearSavePrompt: () => void;
    ```
  - Initial state: `savePrompt: null,` and action `clearSavePrompt: () => set({ savePrompt: null }),`
  - In `finish`, after `await workouts.finishSession(sessionId, fields);`:
    ```ts
        const savePrompt = await getSavePrompt(sessionId);
    ```
    and include `savePrompt` in the following `set({ sessionId: null, … })` call.
  - Leave `partialize` unchanged (the prompt is not persisted; it is only offered right after finishing).

- [ ] **Step 4: Implement the hooks** — `apps/mobile/src/hooks/usePlan.ts`

```ts
import { nextPlanDay, type PlanDay, type TrainingPlan } from '@gym/shared';
import { LAST_PLAN_DAY_SQL } from '../db/repositories/plan';
import { useLiveQuery } from '../db/useLiveQuery';
import { useSettingsStore } from '../state/settingsStore';

/** The plan and its next day (after the last finished workout's day). null = no plan. */
export function useNextPlanDay(): { plan: TrainingPlan; day: PlanDay } | null {
  const plan = useSettingsStore((s) => s.training_plan);
  const ids = plan?.days.map((d) => d.id) ?? [];
  const { data } = useLiveQuery<{ plan_day_id: string }>(
    ids.length ? LAST_PLAN_DAY_SQL(ids.length) : 'SELECT NULL AS plan_day_id WHERE 0',
    ids,
    ['workout_sessions'],
  );
  if (!plan) return null;
  return { plan, day: nextPlanDay(plan, data[0]?.plan_day_id ?? null) };
}

/** Routines linked to a plan day: never used first, then least recently used. */
export function useDayRoutines(dayId: string | null) {
  const { data } = useLiveQuery<{ id: string; title: string; n: number }>(
    `SELECT t.id, t.title, json_array_length(t.template_exercises) AS n,
       (SELECT MAX(s.start_time) FROM workout_sessions s WHERE s.template_id = t.id AND s.deleted_at IS NULL) AS last_used
     FROM workout_templates t
     WHERE t.deleted_at IS NULL AND t.plan_day_id = ?
     ORDER BY last_used IS NOT NULL, last_used, t.title COLLATE NOCASE`,
    [dayId ?? ''],
    ['workout_templates', 'workout_sessions'],
  );
  return data;
}
```

Check `useLiveQuery` re-runs when `sql`/`params` change (read `apps/mobile/src/db/useLiveQuery.ts`); if its effect deps don't include them, add `JSON.stringify(params)` and `sql` to the deps.

- [ ] **Step 5: Run tests, typecheck, checkpoint**

Run: `cd apps/mobile && npx vitest run test/plan.test.ts | tail -15` — Expected: PASS.
Run: `npm test 2>&1 | tail -15` and `npm run typecheck 2>&1 | tail -15` — Expected: all pass.

---

### Task 6: Plan-day picker and routine editor (day chips + draft mode)

**Files:**
- Create: `apps/mobile/src/components/PlanDayPicker.tsx`
- Modify: `apps/mobile/src/screens/RoutineBuilderScreen.tsx` (`Draft` type, `loadRoutine`, `RoutineEditor`, export `RoutineEditor` and `FolderPicker`)

**Interfaces:**
- Consumes: `useSettingsStore((s) => s.training_plan)`; `createTemplate(…, { planDayId })`, `updateTemplate(id, { plan_day_id })` (Task 3); `useActiveWorkoutStore.start({ draft, title, planDayId })`.
- Produces:
  - `PlanDayPicker({ value: string | null; onChange: (id: string | null) => void })` — renders nothing when no plan.
  - `export function RoutineEditor(props: { templateId: string | null; onDone: () => void; onOpen: (id: string) => void; mode?: 'routine' | 'draft'; initialPlanDayId?: string | null })`
  - `export function FolderPicker(...)` (unchanged signature).

- [ ] **Step 1: PlanDayPicker** — `apps/mobile/src/components/PlanDayPicker.tsx`

```tsx
import { Pressable, ScrollView, Text } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import { useSettingsStore } from '../state/settingsStore';
import { colors } from '../theme';

/** "Which plan day is this?" chips: None + one per day of the training plan. Hidden with no plan. */
export function PlanDayPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const plan = useSettingsStore((s) => s.training_plan);
  if (!plan) return null;
  const options = [{ id: null as string | null, name: 'No day' }, ...plan.days];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
      <CalendarDays size={16} color={colors.subtle} />
      {options.map((d) => {
        const active = value === d.id;
        return (
          <Pressable
            key={d.id ?? 'none'}
            onPress={() => onChange(d.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`rounded-full border px-3 py-1.5 ${active ? 'border-accent bg-accent-soft' : 'border-surface-border bg-surface-raised'}`}
          >
            <Text className={`text-sm ${active ? 'font-semibold text-accent' : 'text-ink-muted'}`}>{d.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
```

- [ ] **Step 2: Routine editor plan day**
  - `Draft` type (near `loadRoutine`): add `plan_day_id: string | null`; `loadRoutine` returns `plan_day_id: t.plan_day_id`.
  - `RoutineEditor` state: `const [planDayId, setPlanDayId] = useState<string | null>(initialPlanDayId ?? null);` set from `r.plan_day_id` on load; include `planDayId` in the `initial` JSON and `dirty` comparison (`JSON.stringify({ title, folder, planDayId, items })` — update all three places).
  - `save`: `fields` gains `plan_day_id: planDayId`; `createTemplate(fields.title, fields.template_exercises, { notes, folder, planDayId })`.
  - `duplicate`: pass `plan_day_id: planDayId` in the draft object.
  - Render: in the FlatList **footer** (`ListFooterComponent`, after the existing "Add exercise" control — keep any existing footer content first), add:
    ```tsx
    <View className="mt-4 gap-2">
      <PlanDayPicker value={planDayId} onChange={setPlanDayId} />
    </View>
    ```
    so the "which day?" choice sits at the end of the builder, above nothing but the bottom padding.

- [ ] **Step 3: Draft mode** in `RoutineEditor` (`mode = 'routine'` default):
  - Header title: `mode === 'draft' ? 'New workout' : templateId ? 'Edit routine' : 'New routine'`.
  - Header right button: in draft mode label `Start`, calls `startDraft`; otherwise `Save` as today.
  - Hide the `FolderPicker` in draft mode; the title input placeholder becomes `Workout name (optional)`.
  - `problem()` in draft mode skips the empty-title check (keep the "at least one exercise" and reps checks).
  - `cancel` / Back: in draft mode the confirm reads `Discard this workout?` / `The exercises you added will be lost.` / `Discard`.
  - Add:
    ```ts
    const start = useActiveWorkoutStore((s) => s.start);
    const startDraft = async () => {
      const p = problem();
      if (p) return setConfirm(p);
      const dayName = useSettingsStore.getState().training_plan?.days.find((d) => d.id === planDayId)?.name ?? null;
      setSaving(true);
      try {
        await start({ draft: toTemplateExercises(items), title: title.trim() || dayName, planDayId });
        onDone();
      } finally {
        setSaving(false);
      }
    };
    ```
  - Add a full-width primary **Start workout** button at the bottom of the list footer in draft mode (same style as the Workout tab's start button: `rounded-card bg-accent py-4`, `Play` icon), calling `startDraft`.
  - Export: change `function RoutineEditor` → `export function RoutineEditor`, `function FolderPicker` → `export function FolderPicker`.

- [ ] **Step 4: Typecheck and tests**

Run: `npm run typecheck 2>&1 | tail -15` — Expected: no errors.
Run: `npm test 2>&1 | tail -8` — Expected: all pass.

- [ ] **Step 5: Checkpoint** — editor behaviour is verified on the phone in Task 9.

---

### Task 7: Settings → Training plan

**Files:**
- Create: `apps/mobile/src/components/TrainingPlanSection.tsx`
- Modify: `apps/mobile/src/screens/SettingsScreen.tsx` (render it after the Units card)

**Interfaces:**
- Consumes: `PLAN_PRESETS`, `planFromPreset`, `renamePlanDay`, `addPlanDay`, `removePlanDay`, `movePlanDay`, `removedDayIds`, `MAX_PLAN_DAYS` (Task 1); `setTrainingPlan`, `countLinkedRoutines` (Task 4); `SettingsCard` (`components/SettingsControls.tsx`); `ConfirmSheet`, `ConfirmRequest` (`components/ConfirmSheet.tsx`).
- Produces: `TrainingPlanSection()` component.

The spec's "plan screen" is implemented as an expandable `SettingsCard` (same as every other settings group), so no new route is needed.

- [ ] **Step 1: Component** — `apps/mobile/src/components/TrainingPlanSection.tsx`

```tsx
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { CalendarDays, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react-native';
import {
  addPlanDay,
  MAX_PLAN_DAYS,
  movePlanDay,
  PLAN_PRESETS,
  planFromPreset,
  removedDayIds,
  removePlanDay,
  renamePlanDay,
  type TrainingPlan,
} from '@gym/shared';
import { countLinkedRoutines, setTrainingPlan } from '../db/repositories/plan';
import { useSettingsStore } from '../state/settingsStore';
import { colors } from '../theme';
import { ConfirmSheet, type ConfirmRequest } from './ConfirmSheet';
import { SettingsCard } from './SettingsControls';

/** Training split: pick a preset, then rename / add / remove / reorder its days. Days run as a rotation. */
export function TrainingPlanSection() {
  const plan = useSettingsStore((s) => s.training_plan);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  /** Applies a change, confirming first when routines would lose their day. */
  const apply = async (next: TrainingPlan | null, what: string) => {
    const linked = await countLinkedRoutines(removedDayIds(plan, next));
    if (linked === 0) return void setTrainingPlan(next);
    setConfirm({
      title: what,
      message: `${linked} routine${linked === 1 ? '' : 's'} will no longer be linked to a plan day.`,
      confirmLabel: 'Continue',
      tone: 'destructive',
      onConfirm: () => void setTrainingPlan(next),
    });
  };

  return (
    <SettingsCard title="Training plan" icon={<CalendarDays size={18} color={colors.accent} />}>
      <Text className="mb-2 text-xs leading-4 text-ink-subtle">
        Days run in order. The Workout tab offers the day after your last finished one.
      </Text>
      <View className="flex-row flex-wrap gap-2 py-2">
        <PresetChip label="None" active={plan === null} onPress={() => void setTrainingPlan(null)} />
        {PLAN_PRESETS.map((p) => (
          <PresetChip
            key={p.id}
            label={p.name}
            active={plan?.preset === p.id}
            onPress={() => void apply(planFromPreset(p.id), `Switch to ${p.name}?`)}
          />
        ))}
      </View>

      {plan?.days.map((d, i) => (
        <View key={d.id} className="flex-row items-center gap-1 py-1.5">
          <Text className="w-6 text-sm text-ink-subtle">{i + 1}.</Text>
          <DayName name={d.name} onRename={(name) => void setTrainingPlan(renamePlanDay(plan, d.id, name))} />
          <IconBtn label="Move up" disabled={i === 0} onPress={() => void setTrainingPlan(movePlanDay(plan, d.id, -1))}>
            <ChevronUp size={16} color={colors.muted} />
          </IconBtn>
          <IconBtn label="Move down" disabled={i === plan.days.length - 1} onPress={() => void setTrainingPlan(movePlanDay(plan, d.id, 1))}>
            <ChevronDown size={16} color={colors.muted} />
          </IconBtn>
          <IconBtn label={`Delete ${d.name}`} onPress={() => void apply(removePlanDay(plan, d.id), `Delete “${d.name}”?`)}>
            <Trash2 size={16} color={colors.danger} />
          </IconBtn>
        </View>
      ))}

      {plan && plan.days.length < MAX_PLAN_DAYS && (
        <Pressable
          onPress={() => void setTrainingPlan(addPlanDay(plan, ''))}
          className="mt-1 flex-row items-center gap-1 self-start rounded-full border border-dashed border-surface-border px-3 py-1.5 active:opacity-70"
        >
          <Plus size={14} color={colors.muted} />
          <Text className="text-sm text-ink-muted">Add day</Text>
        </Pressable>
      )}
      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
    </SettingsCard>
  );
}

/** Inline rename: saved on blur / submit; a blank name is ignored (keeps the old one). */
function DayName({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [text, setText] = useState(name);
  const commit = () => {
    if (text.trim() && text.trim() !== name) onRename(text);
    else setText(name);
  };
  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onBlur={commit}
      onSubmitEditing={commit}
      maxLength={40}
      className="flex-1 rounded-xl bg-surface-elevated px-3 py-2 text-base text-ink"
    />
  );
}

function PresetChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`rounded-full border px-3 py-1.5 ${active ? 'border-accent bg-accent-soft' : 'border-surface-border bg-surface-raised'}`}
    >
      <Text className={`text-sm ${active ? 'font-semibold text-accent' : 'text-ink-muted'}`}>{label}</Text>
    </Pressable>
  );
}

function IconBtn({ label, disabled, onPress, children }: { label: string; disabled?: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`h-9 w-9 items-center justify-center rounded-full ${disabled ? 'opacity-30' : 'active:opacity-60'}`}
    >
      {children}
    </Pressable>
  );
}
```

If `colors.danger` / `colors.muted` / `colors.subtle` or `bg-surface-elevated` don't exist in `apps/mobile/src/theme`, use the names `RoutineBuilderScreen.tsx` uses for the same purpose.

- [ ] **Step 2: Mount it** — `SettingsScreen.tsx`: `import { TrainingPlanSection } from '../components/TrainingPlanSection';` and render `<TrainingPlanSection />` right after the Units `SettingsCard`.

- [ ] **Step 3: Typecheck and tests**

Run: `npm run typecheck 2>&1 | tail -15` and `npm test 2>&1 | tail -8` — Expected: clean.

---

### Task 8: Workout tab (next day card, pick another day, draft editor, save-as-routine sheet)

**Files:**
- Create: `apps/mobile/src/components/SaveRoutineSheet.tsx`
- Create: `apps/mobile/src/components/PlanDaySheet.tsx`
- Modify: `apps/mobile/src/screens/ActiveWorkoutScreen.tsx` (`StartWorkout`, ~lines 58–108)

**Interfaces:**
- Consumes: `useNextPlanDay`, `useDayRoutines` (Task 5); `RoutineEditor`, `FolderPicker` (Task 6); `PlanDayPicker` (Task 6); `saveSessionAsRoutine`, `SavePrompt` (Task 4); `listFolders` (templates repo); `useActiveWorkoutStore` (`start`, `savePrompt`, `clearSavePrompt`); `BottomSheet` (`components/BottomSheet.tsx`, props `visible`, `onClose`, `avoidKeyboard`, `className`).
- Produces: `SaveRoutineSheet({ prompt: SavePrompt | null; onClose: () => void })`, `PlanDaySheet({ visible; days: PlanDay[]; onClose; onPick: (day: PlanDay) => void })`, `DayRoutineSheet` (local to `ActiveWorkoutScreen.tsx`).

- [ ] **Step 1: SaveRoutineSheet** — `apps/mobile/src/components/SaveRoutineSheet.tsx`

```tsx
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { saveSessionAsRoutine, type SavePrompt } from '../db/repositories/plan';
import { listFolders } from '../db/repositories/templates';
import { FolderPicker } from '../screens/RoutineBuilderScreen';
import { useSettingsStore } from '../state/settingsStore';
import { colors } from '../theme';
import { BottomSheet } from './BottomSheet';
import { PlanDayPicker } from './PlanDayPicker';

/** After finishing a workout that wasn't from a routine: keep what was logged as a new routine. */
export function SaveRoutineSheet({ prompt, onClose }: { prompt: SavePrompt | null; onClose: () => void }) {
  const plan = useSettingsStore((s) => s.training_plan);
  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState<string | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [planDayId, setPlanDayId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!prompt) return;
    const dayName = plan?.days.find((d) => d.id === prompt.planDayId)?.name;
    setTitle(prompt.title ?? (dayName ? `${dayName} day` : 'Workout'));
    setFolder(null);
    setPlanDayId(prompt.planDayId);
    void listFolders().then(setFolders);
  }, [prompt]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!prompt) return;
    setSaving(true);
    try {
      await saveSessionAsRoutine(prompt.sessionId, { title, folder, planDayId });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet visible={prompt !== null} onClose={onClose} avoidKeyboard className="gap-4 p-5">
      <Text className="text-xl font-bold text-ink">Save as routine?</Text>
      <Text className="text-sm text-ink-subtle">Keeps the exercises and sets you logged, so you can start it next time.</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        maxLength={120}
        placeholder="Routine name"
        placeholderTextColor={colors.subtle}
        className="rounded-xl bg-surface-elevated px-4 py-3.5 text-base text-ink"
      />
      <FolderPicker value={folder} folders={folders} onChange={setFolder} />
      <PlanDayPicker value={planDayId} onChange={setPlanDayId} />
      <View className="flex-row gap-3">
        <Pressable onPress={onClose} className="flex-1 items-center rounded-card border border-surface-border py-4 active:opacity-80">
          <Text className="text-base font-semibold text-ink-muted">Not now</Text>
        </Pressable>
        <Pressable onPress={() => void save()} disabled={saving} className="flex-1 items-center rounded-card bg-accent py-4 active:opacity-80">
          <Text className="text-base font-bold text-surface">Save routine</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
```

Importing `FolderPicker` from a screen file is acceptable here; if it causes a require cycle warning in Metro, move `FolderPicker` and its `Chip` into `apps/mobile/src/components/FolderPicker.tsx` and import it from both places.

- [ ] **Step 2: PlanDaySheet** — `apps/mobile/src/components/PlanDaySheet.tsx`

```tsx
import { Pressable, Text } from 'react-native';
import type { PlanDay } from '@gym/shared';
import { BottomSheet } from './BottomSheet';

/** "Not today? Pick another day": every day of the plan. */
export function PlanDaySheet({
  visible,
  days,
  onClose,
  onPick,
}: {
  visible: boolean;
  days: PlanDay[];
  onClose: () => void;
  onPick: (day: PlanDay) => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} className="gap-2 p-5">
      <Text className="mb-2 text-xl font-bold text-ink">Pick a day</Text>
      {days.map((d) => (
        <Pressable
          key={d.id}
          onPress={() => {
            onClose();
            onPick(d);
          }}
          className="rounded-card border border-surface-border bg-surface-raised p-4 active:opacity-80"
        >
          <Text className="text-base font-semibold text-ink">{d.name}</Text>
        </Pressable>
      ))}
    </BottomSheet>
  );
}
```

- [ ] **Step 3: StartWorkout** — in `ActiveWorkoutScreen.tsx`, rewrite `StartWorkout`:
  - State: `const [draftDay, setDraftDay] = useState<string | null | undefined>(undefined);` (`undefined` = editor closed; `null` = open with no day), `const [picking, setPicking] = useState(false);`, `const [chosen, setChosen] = useState<PlanDay | null>(null);` (day whose routines are listed in the picker sheet).
  - `const next = useNextPlanDay();` `const routines = useDayRoutines(next?.day.id ?? null);`
  - `const savePrompt = useActiveWorkoutStore((s) => s.savePrompt);` `const clearSavePrompt = useActiveWorkoutStore((s) => s.clearSavePrompt);`
  - If `draftDay !== undefined`, render only:
    ```tsx
    <RoutineEditor templateId={null} mode="draft" initialPlanDayId={draftDay} onDone={() => setDraftDay(undefined)} onOpen={() => {}} />
    ```
  - `startDay(day: PlanDay, dayRoutines: { id: string }[])`: 0 routines → `setDraftDay(day.id)`; 1 → `start({ templateId: dayRoutines[0].id, planDayId: day.id })`; more → `setChosen(day)`.
  - Card (when `next`): a `Pressable` styled like the old start button (`rounded-card bg-accent py-4`, `cardShadow`) reading **`Next: {next.day.name}`**, with a subtitle line listing `routines.map(r => r.title).join(' · ')` or `No routine yet – build one` when empty. `onPress={() => startDay(next.day, routines)}`.
  - Under it a text link **`Not today? Pick another day`** → `setPicking(true)`.
  - **Start empty workout** becomes a secondary button (`rounded-card border border-surface-border bg-surface-raised py-4`, accent text) when a plan exists, primary (old style) when not. `onPress={() => setDraftDay(null)}`.
  - Keep `BackupReminder` and the routine list exactly as they are.
  - Sheets at the end of the view:
    ```tsx
    <PlanDaySheet visible={picking} days={next?.plan.days ?? []} onClose={() => setPicking(false)} onPick={(d) => setChosen(d)} />
    <DayRoutineSheet day={chosen} onClose={() => setChosen(null)} onStart={(templateId) => { const d = chosen!; setChosen(null); void start({ templateId, planDayId: d.id }); }} onEmpty={() => { const d = chosen!; setChosen(null); setDraftDay(d.id); }} />
    <SaveRoutineSheet prompt={savePrompt} onClose={clearSavePrompt} />
    ```
  - `DayRoutineSheet` (local component in the same file): uses `useDayRoutines(day?.id ?? null)`; lists routines (title + `n exercises`) as rows that call `onStart(id)`; last row `Start empty {day.name}` calls `onEmpty()`. Wrap in `BottomSheet visible={day !== null}`. Picking a day from `PlanDaySheet` always goes through `DayRoutineSheet`, so the user sees that day's routines (or the empty option) before starting.
  - Imports: `PlanDay` from `@gym/shared`; `useNextPlanDay`, `useDayRoutines` from `../hooks/usePlan`; `RoutineEditor` from `./RoutineBuilderScreen`; `PlanDaySheet`, `SaveRoutineSheet`, `BottomSheet`.

- [ ] **Step 4: Save prompt visibility** — `SaveRoutineSheet` renders from `StartWorkout`, which is what the Workout tab shows once `sessionId` is null after `finish`, so the sheet appears straight after finishing. Confirm by reading `ActiveWorkoutScreen` (default export) that it renders `StartWorkout` when there is no session.

- [ ] **Step 5: Typecheck and tests**

Run: `npm run typecheck 2>&1 | tail -15` and `npm test 2>&1 | tail -8` — Expected: clean.

---

### Task 9: Roadmap entry and phone verification

**Files:**
- Modify: `ROADMAP.md` (new item before `### Phase 5`, note under 5.3)

- [ ] **Step 1: Roadmap** — before `### Phase 5: Programs & periodisation`, add a short section in the file's existing style:

```markdown
### Training split & next workout
Spec: `docs/superpowers/specs/2026-10-09-training-split-design.md`.

- [ ] **Training split & next workout** (M)
  - Settings → Training plan: preset (Push / Pull / Cardio) then rename / add / remove / reorder days; runs as a rotation.
  - Routines link to a day (builder "Plan day" chips); Workout tab shows "Next: <day>", "Pick another day".
  - "Start empty workout" opens a draft editor; after finishing, "Save as routine?" keeps what was logged.
```

Under 5.3 add: `  - Builds on "Training split & next workout" (plan days, next-day card).`

- [ ] **Step 2: Build and install on the phone** — follow `docs/release-apk.md` (or `npm run dev:mobile`, press `a`). Before any scripted taps, check the phone for an active workout (real data on the device).

- [ ] **Step 3: Verify on the phone** (spec §1 and §6):
  1. Settings → Training plan → Push / Pull / Cardio. Days list shows 3 days.
  2. Routines tab: edit a push routine → "Plan day" chips at the end → Push → Save. Same for a pull routine.
  3. Workout tab shows **Next: Push** with the push routine listed. Tap → workout starts. Finish → no save prompt.
  4. Workout tab shows **Next: Pull**.
  5. Tap **Start empty workout** → draft editor, no workout running yet. Add an exercise, pick Cardio, tap **Start workout**. Log a set, finish → **Save as routine?** sheet with Cardio preselected → Save.
  6. Workout tab shows **Next: Push**. Routines tab shows the new routine.
  7. Settings: rename Push → "Chest" → Workout tab card and routine links still work.
  8. "Not today? Pick another day" → Cardio → sheet lists the cardio routine.
  9. Draft editor with an exercise → Back → discard prompt.
  10. Settings → None → Workout tab back to the old layout (with the new empty-workout flow); → Push / Pull / Cardio again → links still there.

- [ ] **Step 4: Tick the roadmap item with the date** only after every check passes.

---

## Self-review notes

- Spec §3.1 → Task 3; §3.2 → Task 1; §3.3 → Tasks 1–2; §3.4 → Tasks 4–5; §4.1 → Task 7; §4.2 → Task 6; §4.3 → Task 8; §4.4 → Tasks 3, 6, 8; §4.5 → Tasks 2, 4, 5, 8; §5 → Tasks 4 (tests), 8, 9; §6 → tests in Tasks 1–5 + Task 9; §7 → Task 9.
- Deviation from spec §4.3: a routine started from the plain list stores its own `plan_day_id` even if that day is no longer in the plan. Harmless: the rotation query only matches current plan day ids.
- Deviation from spec §4.1: the plan editor is an expandable Settings card, not a separate screen.
- Spec §4.5 mentions copying `auto_next`; session exercises have no `auto_next` column, so the routine gets `auto_next: null`.
