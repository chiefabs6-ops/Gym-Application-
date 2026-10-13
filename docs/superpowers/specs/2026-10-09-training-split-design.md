# Training split & next workout — design

Date: 2026-10-09 · Status: draft for review

## 1. Goal

Let the user set up a training split (e.g. Push / Pull / Cardio), link their routines to its days, and have the
Workout tab offer the **next** day of the split instead of a generic "Start empty workout".

- The split is a **rotation**: the next day is the one after the last finished workout's day, whatever the date.
  Missing a gym day shifts the cycle; it never shows the "wrong" weekday.
- "Start empty workout" no longer starts a workout immediately. It opens a draft editor where the user builds the
  workout first, then taps **Start workout**. After finishing an unsaved workout, a sheet offers to save what was
  actually logged as a routine (and link it to a split day).

Success (on the phone): with Push / Pull / Cardio set and routines linked, finishing a Push routine makes the card
show "Next: Pull"; starting empty, logging, and saving it as a Cardio routine makes the card show "Next: Push";
renaming a day keeps all routine links.

**Out of scope:** multi-week programs, % Training Max, AMRAP progression, deloads (ROADMAP Phase 5). Calendar /
weekday scheduling. Multiple saved plans. A routine linked to more than one day.

## 2. Constraints

- Offline-only scope (CLAUDE.md): no server work is started. The synced-column rule (CLAUDE.md §1) still applies, so
  `apps/server/src/db/schema.prisma` gets the two new fields as a text edit only. `prisma migrate dev` is not run
  (no migrations directory exists yet; Phase 8 generates them from the schema).
- All writes to synced tables go through `apps/mobile/src/db/mutate.ts`, as full row snapshots. Never call
  `write()` inside a `write()` builder.
- Every query filters `deleted_at IS NULL`.
- Weights stored in kg; display via `useUnits()`.

## 3. Data

### 3.1 Columns (mobile migration v6)

| Table | Column | Meaning |
|---|---|---|
| `workout_templates` | `plan_day_id TEXT NULL` | The split day this routine belongs to. `null` = not linked. |
| `workout_sessions` | `plan_day_id TEXT NULL` | The split day this workout counted as. Set at start. |

All four places from CLAUDE.md §1: zod schemas + `TABLE_SPECS` column lists in `packages/shared/src/tables.ts`
(`plan_day_id: z.string().min(1).max(32).nullable().default(null)`), migration v6 appended to
`apps/mobile/src/db/migrations.ts`, `schema.prisma` fields `planDayId String? @map("plan_day_id")` on both models,
camelCase `planDayId` = `snakeToCamel('plan_day_id')`.

The session column exists so the rotation still advances when a workout is started for a day without a routine
and the user declines to save it, and so relinking a routine later does not rewrite past rotation.

### 3.2 Setting: `training_plan`

Added to `settingsSchema` in `packages/shared/src/settings.ts` (stored in `users.preferences`):

```ts
training_plan: z.object({
  preset: z.string().max(32).nullable(),          // preset id it started from, null = custom
  days: z.array(z.object({
    id: z.string().min(1).max(32),
    name: z.string().min(1).max(40),
  })).min(1).max(14),
}).nullable().catch(null),
```

`null` = no plan (default; old installs parse to this). Invalid stored values fall back to `null`.

### 3.3 Shared logic: `packages/shared/src/plans.ts` (new, pure)

- `PLAN_PRESETS`: initially one preset, `push_pull_cardio`, days `{ id: 'push', name: 'Push' }`,
  `{ id: 'pull', name: 'Pull' }`, `{ id: 'cardio', name: 'Cardio' }`. Preset day ids are fixed forever.
- `newPlanDayId()`: short random id for user-added days (unique within the plan).
- `nextPlanDay(plan, lastDayId)`: the day after `lastDayId` in `plan.days`, wrapping to the first. Returns the first
  day when `lastDayId` is `null` or no longer in the plan.
- Plan edits are pure helpers (`renamePlanDay`, `addPlanDay`, `removePlanDay`, `movePlanDay`) that keep ids stable.
- `routineFromSession(...)`: builds `template_exercises` from a logged session (see §4.5).

Exported from `packages/shared/src/index.ts`.

### 3.4 Next-day query (mobile)

```sql
SELECT plan_day_id FROM workout_sessions
WHERE deleted_at IS NULL AND end_time IS NOT NULL AND plan_day_id IN (<current plan day ids>)
ORDER BY end_time DESC LIMIT 1
```

The result goes into `nextPlanDay`. Lives in a small hook (`useNextPlanDay`) using `useLiveQuery` on
`workout_sessions`, so the card updates when a workout finishes.

## 4. Screens

### 4.1 Settings → Training plan

- New "Training plan" row in Settings showing the plan's day names (e.g. "Push · Pull · Cardio") or "None".
  Opens a plan screen.
- **Preset picker:** None, Push / Pull / Cardio. Choosing a preset replaces the day list; if routines are linked to
  days that would disappear, confirm first (they get unlinked).
- **Day list:** rename inline, add day, delete day (confirm with the number of routines that will be unlinked),
  move up/down arrows (same pattern as the routine editor; no drag-and-drop library).
- Any edit to a preset's days sets `preset` to `null` (custom). Changes save immediately like other settings.
- Deleting a day (or replacing via preset) unlinks its routines: `plan_day_id = null` through `mutate.ts`.
  Past sessions keep their value; the rotation ignores ids not in the plan.

### 4.2 Routine builder

`RoutineEditor` (`apps/mobile/src/screens/RoutineBuilderScreen.tsx`) gets a **"Plan day"** chip row at the end of
the editor, above Save and next to the folder picker: None + one chip per plan day. Shown only when a plan is
active. Editing a routine preselects its current day.

### 4.3 Workout tab (`StartWorkout` in `ActiveWorkoutScreen.tsx`)

When a plan is active:

- A large card **"Next: Push"** listing the routines linked to that day.
  - One linked routine: tap starts it.
  - Several: a picker sheet, sorted least recently used first (by latest session `start_time` per template).
  - None: opens the draft editor with that day preselected.
- **"Pick another day"** link opens the day list; picking a day behaves like the card for that day.
- Starting from a routine sets the session's `plan_day_id` to the day the workout was started for (the card's day
  or the picked day).

Always:

- **"Start empty workout"** opens the draft editor (it no longer calls `start()` directly).
- The routine list below stays. Starting a routine from the list sets the session's `plan_day_id` to the
  routine's own `plan_day_id` (if that day is in the current plan).

With no plan, only the empty-workout change applies.

### 4.4 Draft editor

`RoutineEditor` in a `draft` mode, opened from the Workout tab:

- Title optional; folder picker hidden; plan-day chips shown (preselected when opened from a day).
- Bottom button **"Start workout"** instead of Save. It calls `startSession` with the draft exercises
  (`template_id = null`, `plan_day_id` = chosen day, title = chosen day name or null). No routine row is written.
- The draft is in memory only. Leaving with exercises added asks to discard.
- If a workout is already active, the Workout tab shows Resume as today; the draft editor cannot start a second one.

`startSession` (`apps/mobile/src/db/repositories/workouts.ts`) gains `StartOptions.draft` (template exercises +
title) and `StartOptions.planDayId`, reusing the same code path that expands a template into session rows.

### 4.5 Finish → "Save as routine?"

After finishing a session with `template_id = null` and at least one completed set, a sheet asks
**"Save as routine?"**: name (default: session title, else "<Day> day", else "Workout"), folder picker, plan-day
chips (preselected from the session). **Save** / **Not now**.

Save, in one `write()` transaction: create the routine from `routineFromSession`, then update the session's
`template_id` to it. The routine keeps what was actually logged:

- Exercises in session order, including ones added mid-workout; exercises with no completed sets are dropped.
- Completed sets only, as per-set targets (`sets`), keeping `set_type` (warm-ups stay warm-ups), reps, weight,
  duration and distance.
- `rest_seconds`, `superset_group` and `auto_next` copied from the session exercise where present.

## 5. Edge cases

- Plan set back to None: Workout tab reverts; `plan_day_id` values are kept, so re-enabling restores links.
- Linked routine deleted: drops out of the day's list (`deleted_at IS NULL`); its past sessions still count.
- Sessions from before v6 have `plan_day_id = null` and are ignored; the rotation starts at day 1.
- Unfinished or deleted sessions never move the rotation.
- Finishing a draft workout with no completed sets: existing empty-workout handling, no save prompt.

## 6. Testing

- `packages/shared` (vitest): `nextPlanDay` (wrap, missing day, null), plan edit helpers keep ids,
  `training_plan` schema fallback, preset ids, `routineFromSession` (dropped empty sets/exercises, warm-ups, timed
  and distance types, supersets).
- `apps/mobile/test` (node:sqlite): migration v6, next-day query (ignores unfinished/deleted/foreign-plan
  sessions), deleting a day unlinks routines, save-as-routine sets the session's `template_id`, starting a draft
  writes no template row.
- Phone (before ticking the roadmap): the success scenario in §1, plus "Pick another day" and the discard prompt.

## 7. Roadmap

Add a new item before Phase 5: **"Training split & next workout"**, pointing at this spec. Note under 5.3 that
"today's workout" builds on it.
