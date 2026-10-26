# Food Tracking, Bodyweight & Targets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a MyFitnessPal-style food diary (four meals, search, barcode, label photo, saved meals, recipes with
batches), a bodyweight log, and calorie/macro targets calculated from body details, to Gym Log.

**Architecture:** Six new synced tables (`foods`, `saved_meals`, `recipes`, `recipe_batches`, `food_log_entries`,
`body_metrics`) follow the `CLAUDE.md` four-places rule and flow into backup automatically through `SYNC_TABLES`.
A local, non-synced `builtin_foods` table holds the bundled CoFID+USDA list. Every nutrient value is stored per 100 g
on foods/batches and as an absolute snapshot on log entries, so edits never change past days. Pure maths (targets,
scaling, units, day keys, label parsing) lives in `packages/shared` with tests; DB logic in new mobile repositories;
Open Food Facts behind one service module.

**Tech Stack:** TypeScript, zod, vitest (mobile tests run real SQL on `node:sqlite`), expo-sqlite, expo-router,
Zustand, NativeWind, lucide-react-native, react-native-svg (charts). New: `expo-camera` (barcodes) and an on-device
text-recognition module (see Open question Q8). Python 3 + `openpyxl` for the one-off dataset build script.

**Spec:** `docs/superpowers/specs/2026-10-25-food-tracking-design.md` (read it with this plan; mockups in
`.superpowers/brainstorm/719-1792969276/content/`).

## Open questions (answer before the task that names them)

The user asked that nothing be decided for them. These are not settled by the spec; each task that depends on one
says so. All answered on 2026-10-26 except Q9, which is asked at Task 11.

| # | Question | Blocks |
|---|---|---|
| Q1 | ✅ **No commits.** Checkpoint = tests/typecheck pass. Ask the user before making any commit. | — |
| Q2 | ✅ Sedentary 1.2 · Light 1.375 · Moderate 1.55 · Very active 1.725 · Extra active 1.9 (keys `sedentary`, `light`, `moderate`, `very`, `extra`). | — |
| Q3 | ✅ Imperial shows the kg options converted: lose 0.55 / 1.1 / 1.65 / 2.2 lb, gain 0.55 / 1.1 lb per week (stored in kg). | — |
| Q4 | ✅ Targets use the **7-day average** weight (mean of weigh-ins in the last 7 days; fall back to the latest weigh-in if none in that window). The Body chart line is a **30-day rolling average**. | — |
| Q5 | ✅ Prompt when \|7-day average − `weight_at_last_calc`\| ≥ **goal rate × 2** (two weeks of expected change, e.g. 0.5 kg/week → 1 kg), at most once every **30 days**, only if a target is hand-edited. **Never for a maintain goal.** | — |
| Q6 | ✅ All three macros can be hand-edited; calories then = 4p + 4c + 9f. If that is below the minimum, **block the edit with a message** ("Your macros add up to <n> kcal, below your minimum of <1,200\|1,500> kcal."). | — |
| Q7 | ✅ Not handled (single user). If carbs are still negative after halving fat, clamp carbs to 0; no special UI. | — |
| Q8 | ✅ Add `@react-native-ml-kit/text-recognition` (reads the nutrition-table photo) alongside `expo-camera` (barcodes). | — |
| Q9 | Open Food Facts User-Agent contact (`GymLog/<version> (<contact>)`): **ask the user for the email at the start of Task 11.** | Task 11 |
| Q10 | ✅ The last 7 days (today and the 6 days before). | — |
| Q11 | ✅ Every CoFID food plus USDA gap-fillers. | — |

**Plan calls (not in the spec; the user can override):** recent foods = last 30 days for that meal, frequent = top
10 by count over 60 days; ~~the food form requires kcal, protein, carbs and fat~~ → **user: only kcal and protein are required; carbs, fat and extras optional (blank = unknown, counted as 0 in totals)**; kcal from
weekly rate uses 7,700 kcal per kg (✅ user approved); an edited macro is absorbed by carbs first, then fat (spec §8.2 default).

## Global Constraints

- All writes to synced tables go through `apps/mobile/src/db/mutate.ts` (`write`, `stageCreate`, `stageUpdate`,
  `stageDelete`, `createRecord`, `updateRecord`, `deleteRecord`). Never call `write()` inside a `write()` builder.
- Every query on a synced table filters `deleted_at IS NULL`. Deletes are tombstones.
- Synced table change = zod schema + `TABLE_SPECS` + `SYNC_TABLES` + `SyncRowMap` in `packages/shared/src/tables.ts`,
  appended mobile migration (**v7**, never edit v1–v6), Prisma model text in `apps/server/src/db/schema.prisma`
  (camelCase = `snakeToCamel(column)`), and `PRISMA_MODEL` in `apps/server/src/services/sync/mapping.ts`.
  `prisma migrate dev` is **not** run (server deferred); run `npm run db:generate -w @gym/server` only.
- Every new synced table has a non-null `user_id` (required by `adoptServerUser` and backup re-owning).
- Stored units: grams, kg, kcal. Display follows `users.unit_system` (g/kg or oz/lb). Energy is **kcal only**.
- Design system: tokens in **both** `apps/mobile/tailwind.config.js` and `apps/mobile/src/theme.ts`; bottom sheets;
  no `Alert.alert`; no hard-coded colours; 16px cards.
- Online only for Open Food Facts search and barcode lookup. Everything else works in airplane mode.
- Over-target numbers are **red** (`colors.danger`). Deleting a diary entry asks "Are you sure?" (`ConfirmSheet`,
  `tone: 'destructive'`). "+" on a search row logs instantly with an Undo toast.
- Meals: exactly `breakfast`, `lunch`, `dinner`, `snacks`, labelled Breakfast / Lunch / Dinner / Snacks.
- Late-night window: 00:00–02:59 local time.
- Minimum calories: **1,200 kcal (female) / 1,500 kcal (male)**, also for hand edits.
- Commands from repo root: `npm test`, `npm run typecheck`. Single shared test:
  `cd packages/shared && npx vitest run src/__tests__/<file>.test.ts`. Single mobile test:
  `cd apps/mobile && npx vitest run test/<file>.test.ts`. Pipe long output through `| tail -25`.

## Review Focus

1. **Editing or deleting an entry that came from a batch** must change the batch's remaining grams by exactly that
   amount, and logging must still be blocked against the *new* remaining — test in Task 9.
2. **Changing targets mid-week** must leave earlier days' "Goal − Food = Left" and chart target lines on the old
   targets — test in Task 10 (`getTargetsForDate`).
3. **A food logged at 00:30 after choosing "yesterday"** must land on yesterday's `local_date` and show in yesterday's
   diary and charts — test in Task 2 (`resolveLogDate`) and Task 8.
4. **An Open Food Facts product with values only per serving, only in kJ, or with salt missing** must normalise to
   per 100 g kcal with blanks (not zeros) for missing extras — test in Task 11.
5. **Restoring an old backup (no food tables) into this version, and a backup with an unknown table** must load
   everything known and report the unknown table name — test in Task 5.

---

### Task 1: Roadmap and scope docs

**Files:**
- Modify: `ROADMAP.md` (new item at the front of the open work, §6 rows, 3.5 note, "Last updated")
- Modify: `CLAUDE.md` ("Current scope" paragraph, architecture rule 2 units line, new food notes)

**Interfaces:** none.

- [ ] **Step 1: Add the ROADMAP item.** Insert, in Phase 2 directly above `- [ ] **2.12 Fill illustration gaps**`, the item `- [~] **2.15 Food tracking, bodyweight & targets** (L) — do next (moved ahead of 2.12, 2.14 and Phase 3 on 2026-10-26), spec docs/superpowers/specs/2026-10-25-food-tracking-design.md`, with acceptance criteria copied from spec §1 "Success". Add a line under 3.5: "Bodyweight log + trend moved into 2.15; measurements, body-fat % and finish-sheet quick-log stay here."
- [ ] **Step 2: Add §6 rows:** `| 2.15 | new tables foods, saved_meals, recipes, recipe_batches, food_log_entries, body_metrics (weight only); local builtin_foods; users.preferences.nutrition |` and change the 3.5 row to `| 3.5 | body_metrics types beyond weight |`.
- [ ] **Step 3: Update `CLAUDE.md`.** "Current scope" gains: "Exception (2026-10-26): food search and barcode lookup use Open Food Facts online; anything fetched is saved on the phone. Everything else stays offline." Rule 2 units line gains: "Food amounts in grams, energy in kcal (kcal only), per 100 g on foods; log entries snapshot absolute nutrients." Add a short "Food tracking" bullet list under §4-style architecture rules naming `builtin_foods` (local, not synced, not in backup), snapshot rule, and `packages/shared/src/nutrition.ts` / `targets.ts`.
- [ ] **Step 4: Checkpoint** per Q1.

---

### Task 2: Shared nutrition maths (units, scaling, day keys)

**Files:**
- Create: `packages/shared/src/nutrition.ts`
- Modify: `packages/shared/src/index.ts` (export)
- Test: `packages/shared/src/__tests__/nutrition.test.ts`

**Interfaces:**
- Produces:
  - `MEALS = ['breakfast','lunch','dinner','snacks'] as const; type Meal`; `MEAL_LABELS: Record<Meal,string>`
  - `NUTRIENT_KEYS = ['kcal','protein_g','carbs_g','fat_g','fibre_g','sugars_g','sat_fat_g','salt_g'] as const`;
    `type Nutrients = { kcal: number; protein_g: number|null; carbs_g: number|null; fat_g: number|null; fibre_g: number|null; sugars_g: number|null; sat_fat_g: number|null; salt_g: number|null }`
  - `nutrientsSchema` (zod for `Nutrients`; kcal 0–10000, grams 0–1000, nullable except kcal)
  - `servingSchema = z.object({ label: z.string().min(1).max(60), grams: z.number().positive().max(5000) })`; `type Serving`
  - `scaleNutrients(per100: Nutrients, grams: number): Nutrients` — each non-null value × grams / 100, nulls stay null
  - `per100FromServing(values: Nutrients, servingGrams: number): Nutrients`
  - `kcalFromKj(kj: number): number` (÷ 4.184); `saltFromSodiumMg(mg: number): number` (mg × 2.5 / 1000)
  - `GRAMS_PER_OZ = 28.349523125`; `toDisplayFoodAmount(grams, unit): number`; `fromDisplayFoodAmount(value, unit): number`; `foodAmountLabel(unit): 'g'|'oz'`
  - `toLocalDateKey(d: Date): string` ('YYYY-MM-DD', local time)
  - `isLateNight(d: Date): boolean` (local hour 0–2)
  - `resolveLogDate(now: Date, lateNightChoice: 'yesterday'|'today'|null): string`
  - `addDaysToKey(key: string, days: number): string`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { addDaysToKey, fromDisplayFoodAmount, isLateNight, kcalFromKj, per100FromServing, resolveLogDate,
  saltFromSodiumMg, scaleNutrients, toDisplayFoodAmount, toLocalDateKey } from '../nutrition';

const egg = { kcal: 143, protein_g: 12.6, carbs_g: 0.7, fat_g: 9.5, fibre_g: null, sugars_g: 0.4, sat_fat_g: 3.1, salt_g: null };

describe('nutrition', () => {
  it('scales per-100 values and keeps unknowns unknown', () => {
    expect(scaleNutrients(egg, 100)).toEqual(egg);
    const two = scaleNutrients(egg, 120);
    expect(two.kcal).toBeCloseTo(171.6);
    expect(two.protein_g).toBeCloseTo(15.12);
    expect(two.fibre_g).toBeNull();
  });
  it('converts a per-serving label to per 100 g', () => {
    expect(per100FromServing({ ...egg, kcal: 97, protein_g: 17 }, 170).kcal).toBeCloseTo(57.06, 1);
  });
  it('converts kJ and sodium', () => {
    expect(kcalFromKj(418.4)).toBeCloseTo(100);
    expect(saltFromSodiumMg(400)).toBeCloseTo(1.0);
  });
  it('converts food amounts for imperial', () => {
    expect(toDisplayFoodAmount(28.349523125, 'imperial')).toBeCloseTo(1);
    expect(fromDisplayFoodAmount(2, 'imperial')).toBeCloseTo(56.699);
    expect(toDisplayFoodAmount(150, 'metric')).toBe(150);
  });
  it('builds local date keys and handles late night', () => {
    expect(toLocalDateKey(new Date(2026, 9, 26, 23, 59))).toBe('2026-10-26');
    expect(isLateNight(new Date(2026, 9, 27, 0, 30))).toBe(true);
    expect(isLateNight(new Date(2026, 9, 27, 3, 0))).toBe(false);
    expect(resolveLogDate(new Date(2026, 9, 27, 0, 30), 'yesterday')).toBe('2026-10-26');
    expect(resolveLogDate(new Date(2026, 9, 27, 0, 30), 'today')).toBe('2026-10-27');
    expect(resolveLogDate(new Date(2026, 9, 27, 14, 0), null)).toBe('2026-10-27');
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysToKey('2026-10-25', 1)).toBe('2026-10-26'); // DST change in Ireland that night
  });
});
```

- [ ] **Step 2: Run** `cd packages/shared && npx vitest run src/__tests__/nutrition.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the interfaces above in `packages/shared/src/nutrition.ts`. `addDaysToKey` must use calendar arithmetic on Y/M/D (construct `new Date(y, m-1, d + days)` at local noon), not `+ 86_400_000`. Export from `index.ts`.
- [ ] **Step 4: Run** the test again — Expected: PASS.
- [ ] **Step 5: Checkpoint** per Q1.

---

### Task 3: Shared targets maths and settings field

**Answered:** Q2, Q3, Q6, Q7.

**Files:**
- Create: `packages/shared/src/targets.ts`
- Modify: `packages/shared/src/settings.ts` (add `nutrition` field), `packages/shared/src/index.ts`
- Test: `packages/shared/src/__tests__/targets.test.ts`

**Interfaces:**
- Consumes: nothing from Task 2.
- Produces:
  - `SEXES = ['male','female'] as const`; `ACTIVITY_LEVELS` (keys + multipliers per **Q2**); `GOAL_KINDS = ['lose','maintain','gain'] as const`
  - `LOSE_RATES_KG = [0.25, 0.5, 0.75, 1] as const; GAIN_RATES_KG = [0.25, 0.5] as const` (display in imperial per **Q3**)
  - `KCAL_PER_KG = 7700`; `MIN_KCAL = { female: 1200, male: 1500 }`; `PROTEIN_G_PER_KG = 2.0`; `FAT_SHARE = 0.25`; `FAT_SHARE_LOW = 0.125`
  - `type BodyProfile = { birth_date: string; sex: Sex; height_cm: number; activity: ActivityLevel }`
  - `type Goal = { kind: GoalKind; rate_kg_per_week: number }` (0 for maintain)
  - `type Targets = { kcal: number; protein_g: number; carbs_g: number; fat_g: number }`
  - `type TargetOverrides = Partial<Targets>`
  - `ageOn(birthDate: string, onDateKey: string): number`
  - `bmrMifflinStJeor(p: { sex: Sex; weight_kg: number; height_cm: number; age: number }): number` — `10w + 6.25h − 5a + 5` (male) / `− 161` (female)
  - `calculateTargets(profile: BodyProfile, goal: Goal, weightKg: number, onDateKey: string): Targets`
  - `resolveTargets(calculated: Targets, overrides: TargetOverrides, ctx: { sex: Sex; weight_kg: number }): Targets`
  - `checkMacroOverrides(overrides: TargetOverrides, sex: Sex): { ok: true } | { ok: false; kcal: number; min: number }` — when protein, carbs and fat are all set and `4p + 4c + 9f < MIN_KCAL[sex]`
  - settings: `nutrition: nutritionSettingsSchema.nullable().catch(null)` where
    `nutritionSettingsSchema = z.object({ profile: bodyProfileSchema, goal: goalSchema, overrides: targetOverridesSchema.catch({}), history: z.array(z.object({ from_date: z.string(), targets: targetsSchema })).catch([]), last_prompt_at: z.number().nullable().catch(null), weight_at_last_calc: z.number().nullable().catch(null) })`

**Algorithm (`calculateTargets`):** `bmr × activity` = maintenance; ± `rate × 7700 / 7`; `kcal = max(round, MIN_KCAL[sex])`;
`protein = round(2.0 × weight)`; `fat = round(kcal × 0.25 / 9)`; `carbs = round((kcal − 4·protein − 9·fat) / 4)`; if
carbs < 0 → `fat = round(kcal × 0.125 / 9)` and recompute carbs; if still < 0 → carbs = 0 (Q7).
**`resolveTargets`:** if `overrides.kcal` set (clamped to the minimum) → recompute protein/fat/carbs from it as above
(keeping any overridden macro fixed); an overridden macro is fixed and the others make room — carbs absorb first, then
fat; when all three macros are overridden, `kcal = 4p + 4c + 9f` (Q6); macros always satisfy `4p + 4c + 9f = kcal` within rounding of ±4 kcal.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { ageOn, bmrMifflinStJeor, calculateTargets, checkMacroOverrides, resolveTargets } from '../targets';
import { parseSettings } from '../settings';

const male = { birth_date: '1996-01-01', sex: 'male', height_cm: 180, activity: 'moderate' } as const; // 1.55 (Q2)
const sumKcal = (t: { protein_g: number; carbs_g: number; fat_g: number }) => 4 * t.protein_g + 4 * t.carbs_g + 9 * t.fat_g;

describe('targets', () => {
  it('works out age from birth date', () => {
    expect(ageOn('1996-01-01', '2026-10-26')).toBe(30);
    expect(ageOn('1996-10-27', '2026-10-26')).toBe(29);
  });
  it('uses Mifflin-St Jeor', () => {
    expect(bmrMifflinStJeor({ sex: 'male', weight_kg: 80, height_cm: 180, age: 30 })).toBe(1780);
    expect(bmrMifflinStJeor({ sex: 'female', weight_kg: 50, height_cm: 160, age: 40 })).toBe(1139);
  });
  it('calculates calories and macros that add up', () => {
    const t = calculateTargets(male, { kind: 'lose', rate_kg_per_week: 0.5 }, 80, '2026-10-26');
    expect(t).toEqual({ kcal: 2209, protein_g: 160, fat_g: 61, carbs_g: 255 });
    expect(Math.abs(sumKcal(t) - t.kcal)).toBeLessThanOrEqual(4);
  });
  it('never goes below the minimum', () => {
    const f = { birth_date: '1986-01-01', sex: 'female', height_cm: 160, activity: 'sedentary' } as const;
    const t = calculateTargets(f, { kind: 'lose', rate_kg_per_week: 1 }, 50, '2026-10-26');
    expect(t.kcal).toBe(1200);
    expect(t).toMatchObject({ protein_g: 100, fat_g: 33, carbs_g: 126 });
  });
  it('halves fat when carbs would go negative', () => {
    const m = { birth_date: '1956-01-01', sex: 'male', height_cm: 165, activity: 'sedentary' } as const;
    const t = calculateTargets(m, { kind: 'lose', rate_kg_per_week: 1 }, 150, '2026-10-26');
    expect(t).toEqual({ kcal: 1524, protein_g: 300, fat_g: 21, carbs_g: 34 });
  });
  it('recalculates macros from hand-edited calories, clamped to the minimum', () => {
    const calc = calculateTargets(male, { kind: 'lose', rate_kg_per_week: 0.5 }, 80, '2026-10-26');
    expect(resolveTargets(calc, { kcal: 2000 }, { sex: 'male', weight_kg: 80 })).toEqual({ kcal: 2000, protein_g: 160, fat_g: 56, carbs_g: 214 });
    expect(resolveTargets(calc, { kcal: 900 }, { sex: 'male', weight_kg: 80 }).kcal).toBe(1500);
  });
  it('keeps a hand-edited macro and makes room with the others', () => {
    const calc = calculateTargets(male, { kind: 'lose', rate_kg_per_week: 0.5 }, 80, '2026-10-26');
    const t = resolveTargets(calc, { carbs_g: 300 }, { sex: 'male', weight_kg: 80 });
    expect(t).toEqual({ kcal: 2209, protein_g: 160, carbs_g: 300, fat_g: 41 });
  });
  it('lets calories follow when all three macros are edited, and rejects totals under the minimum', () => {
    const calc = calculateTargets(male, { kind: 'lose', rate_kg_per_week: 0.5 }, 80, '2026-10-26');
    expect(resolveTargets(calc, { protein_g: 180, carbs_g: 200, fat_g: 70 }, { sex: 'male', weight_kg: 80 })).toEqual({ kcal: 2150, protein_g: 180, carbs_g: 200, fat_g: 70 });
    expect(checkMacroOverrides({ protein_g: 100, carbs_g: 100, fat_g: 40 }, 'male')).toEqual({ ok: false, kcal: 1160, min: 1500 });
    expect(checkMacroOverrides({ protein_g: 180, carbs_g: 200, fat_g: 70 }, 'male')).toEqual({ ok: true });
  });
  it('parses missing or broken nutrition settings as null', () => {
    expect(parseSettings({}).nutrition).toBeNull();
    expect(parseSettings({ nutrition: { profile: 'x' } }).nutrition).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `cd packages/shared && npx vitest run src/__tests__/targets.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `targets.ts` and the `nutrition` settings field (reuse `.catch` style of `settings.ts`). Activity multipliers from **Q2**.
- [ ] **Step 4: Run** targets and settings tests — Expected: PASS. Run `npm run typecheck | tail -25` — Expected: no errors.
- [ ] **Step 5: Checkpoint** per Q1.

---

### Task 4: New tables, migration v7, Prisma text

**Files:**
- Modify: `packages/shared/src/tables.ts` (schemas, `SYNC_TABLES`, `SyncRowMap`, `TABLE_SPECS`)
- Modify: `apps/mobile/src/db/migrations.ts` (append v7)
- Modify: `apps/server/src/db/schema.prisma` (6 models + `User` relations), `apps/server/src/services/sync/mapping.ts` (`PRISMA_MODEL`)
- Modify: `apps/mobile/src/db/meta.ts` (`MetaKey` gains `'builtin_foods_version'`)
- Test: `apps/mobile/test/db.test.ts` (version 7; downgrade drops new tables), `packages/shared/src/__tests__/sync.test.ts` only if it enumerates tables

**Interfaces:**
- Consumes: `nutrientsSchema`, `servingSchema`, `MEALS` (Task 2).
- Produces (all with `syncColumns` + `user_id: uuid`; nutrient columns spread from `nutrientsSchema.shape`):
  - `foods`: `name` (1–120), `brand` (≤120, null), `barcode` (≤32, null), `source: z.enum(['custom','label','open_food_facts'])`, `basis: z.enum(['g','ml'])`, nutrients **per 100**, `servings: z.array(servingSchema).max(20)`, `archived_at`
  - `saved_meals`: `name`, `items: z.array(mealItemSchema).min(1).max(50)` where `mealItemSchema = { name, food_id: uuid.nullable(), builtin_food_id: z.string().max(40).nullable(), serving_label, servings: number>0, grams: number>0, per100: nutrientsSchema }`
  - `recipes`: `name`, `ingredients: z.array(recipeIngredientSchema).min(1).max(100)` where `recipeIngredientSchema = { name, food_id, builtin_food_id, grams, per100 }`, `archived_at`
  - `recipe_batches`: `recipe_id: uuid`, `cooked_weight_g` (> 0, ≤ 50,000), nutrients **per 100 g cooked**, `finished_at: epochMs.nullable()`
  - `food_log_entries`: `local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`, `meal: z.enum(MEALS)`, `logged_at: epochMs`, `kind: z.enum(['food','builtin','recipe','batch','quick'])`, `food_id`, `builtin_food_id`, `recipe_id`, `batch_id` (all nullable), `name`, `serving_label` (null for quick), `servings` (null for quick), `grams` (null for quick), nutrients **absolute** (quick add: carbs/fat null)
  - `body_metrics`: `local_date`, `measured_at: epochMs`, `metric: z.enum(['weight'])`, `value` (kg, 20–400)
  - `SYNC_TABLES` order: `…, 'sets', 'foods', 'saved_meals', 'recipes', 'recipe_batches', 'food_log_entries', 'body_metrics'`
  - `TABLE_SPECS`: all `lww` except `food_log_entries` and `body_metrics` = `append_only`; refs: `recipe_batches.recipe_id → recipes`, `food_log_entries.food_id → foods (nullable)`, `.recipe_id → recipes (nullable)`, `.batch_id → recipe_batches (nullable)`; timestamp columns add `archived_at`, `finished_at`, `logged_at`, `measured_at`; JSON: `foods.servings`, `saved_meals.items`, `recipes.ingredients`
  - v7 SQL also creates **local** `builtin_foods(id TEXT PRIMARY KEY, name TEXT NOT NULL, name_search TEXT NOT NULL, source TEXT NOT NULL, basis TEXT NOT NULL, kcal REAL NOT NULL, protein_g REAL, carbs_g REAL, fat_g REAL, fibre_g REAL, sugars_g REAL, sat_fat_g REAL, salt_g REAL, servings TEXT NOT NULL)` and indexes `idx_food_log_date ON food_log_entries(local_date, meal)`, `idx_foods_barcode ON foods(barcode)`, `idx_body_metrics_date ON body_metrics(local_date)`, `idx_batches_open ON recipe_batches(finished_at)`

- [ ] **Step 1: Update `db.test.ts`:** expected `user_version` 7; in the v1-downgrade script add `DROP TABLE foods; DROP TABLE saved_meals; DROP TABLE recipes; DROP TABLE recipe_batches; DROP TABLE food_log_entries; DROP TABLE body_metrics; DROP TABLE builtin_foods;` before `PRAGMA user_version = 1;`, and add a test:

```ts
it('v7 food tables accept rows through mutate.ts', async () => {
  const f = await createRecord('foods', { user_id: userId, name: 'Oats', brand: null, barcode: null, source: 'custom', basis: 'g',
    kcal: 375, protein_g: 11, carbs_g: 60, fat_g: 8, fibre_g: 9, sugars_g: 1, sat_fat_g: 1.5, salt_g: 0, servings: [{ label: '1 bowl', grams: 60 }], archived_at: null });
  expect(await getRecord('foods', f.id)).toMatchObject({ name: 'Oats', servings: [{ label: '1 bowl', grams: 60 }] });
  await createRecord('food_log_entries', { user_id: userId, local_date: '2026-10-26', meal: 'breakfast', logged_at: Date.now(), kind: 'quick',
    food_id: null, builtin_food_id: null, recipe_id: null, batch_id: null, name: 'Cafe lunch', serving_label: null, servings: null, grams: null,
    kcal: 650, protein_g: 30, carbs_g: null, fat_g: null, fibre_g: null, sugars_g: null, sat_fat_g: null, salt_g: null });
  const n = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM food_log_entries WHERE deleted_at IS NULL');
  expect(n?.n).toBe(1);
});
```

- [ ] **Step 2: Run** `cd apps/mobile && npx vitest run test/db.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** schemas/specs in `tables.ts`, append v7 in `migrations.ts` (INTEGER timestamps, REAL numbers, TEXT JSON; no foreign keys, matching v1 style), add `MetaKey`.
- [ ] **Step 4: Prisma:** add models `Food`, `SavedMeal`, `Recipe`, `RecipeBatch`, `FoodLogEntry`, `BodyMetric` mirroring `WorkoutSet` style (`@map` snake_case, `serverVersion`, `Json` for JSON columns, `@@map("<table>")`, `@@index([userId, serverVersion])`), relations on `User`; add `PRISMA_MODEL` entries `food`, `savedMeal`, `recipe`, `recipeBatch`, `foodLogEntry`, `bodyMetric`. Run `npm run db:generate -w @gym/server | tail -5`.
- [ ] **Step 5: Run** `npm test | tail -25` and `npm run typecheck | tail -25` — Expected: all pass, no type errors.
- [ ] **Step 6: Checkpoint** per Q1.

---

### Task 5: Backup forward-compatibility and food summary

**Files:**
- Modify: `packages/shared/src/backup.ts` (`ParseBackupResult` gains `skippedTables`), `apps/mobile/src/services/backup.ts` (`summarize`, `PickResult`), `apps/mobile/src/components/BackupSection.tsx` (show the message)
- Test: `packages/shared/src/__tests__/backup.test.ts`, `apps/mobile/test/backup.test.ts`

**Interfaces:**
- Produces: `parseBackup(text) → { ok: true; backup; skippedTables: string[] } | { ok: false; error }`; `skippedDataMessage(tables: string[]): string | null` returning
  `"Some data (<names joined by ', '>) was skipped because this backup is from a newer app version. Update the app to restore it."` (names with `_` → space, e.g. "food logs" mapping not required — use table names as-is); `BackupSummary` gains `foodEntries`, `foods`, `weighIns`.
- Keep `BACKUP_VERSION = 1` (bumping it makes today's installed app reject new backups).

- [ ] **Step 1: Failing tests** (shared):

```ts
it('reports tables it does not know and still parses the rest', () => {
  const file = { ...validBackup(), tables: { ...validBackup().tables, meal_plans: [{ id: 'x' }] } };
  const r = parseBackup(JSON.stringify(file));
  expect(r.ok && r.skippedTables).toEqual(['meal_plans']);
  expect(skippedDataMessage(['meal_plans'])).toBe('Some data (meal_plans) was skipped because this backup is from a newer app version. Update the app to restore it.');
});
it('parses an old backup that has no food tables', () => {
  const old = validBackup(); for (const t of ['foods','saved_meals','recipes','recipe_batches','food_log_entries','body_metrics']) delete (old.tables as any)[t];
  const r = parseBackup(JSON.stringify(old));
  expect(r.ok && r.backup.tables.food_log_entries).toEqual([]);
});
```

(`validBackup()` = the existing fixture in that test file, or add one.) Mobile: extend the round-trip test so a logged food entry, a food and a weigh-in survive backup → wipe → restore, re-owned by the new user.
- [ ] **Step 2: Run** both test files — Expected: FAIL.
- [ ] **Step 3: Implement.** `skippedTables` = keys of the raw `tables` object not in `SYNC_TABLES`. `BackupSection` shows the message (notice `ConfirmSheet`) after a restore when non-empty.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Checkpoint** per Q1.

---

### Task 6: Built-in foods dataset build script

**Answered:** Q11.

**Files:**
- Create: `apps/mobile/scripts/build-food-db.py`, `apps/mobile/scripts/food-merge-overrides.csv` (header `usda_id,action,cofid_code` with `action ∈ {skip, keep}`), `apps/mobile/assets/foods/builtin-foods.json` (generated), `apps/mobile/assets/foods/SOURCES.md`
- Modify: `CLAUDE.md` §5 "Generated assets" (one bullet: command, inputs, output, attributions)

**Interfaces:**
- Produces `builtin-foods.json`: `{ "version": "<YYYYMMDD>", "foods": [{ "id": "cofid:<code>" | "usda:<fdc_id>", "name", "source": "cofid"|"usda", "basis": "g"|"ml", "kcal", "protein_g", "carbs_g", "fat_g", "fibre_g", "sugars_g", "sat_fat_g", "salt_g", "servings": [{label, grams}] }] }`. Ids never change between versions.

- [ ] **Step 1: Write the script.** Inputs (downloaded by the developer into `apps/mobile/scripts/food-data/`, git-ignored): CoFID 2021 Excel (gov.uk) and USDA FDC SR Legacy + Foundation CSV. Steps: read CoFID with `openpyxl` (energy kcal, protein, fat, carbohydrate, AOAC fibre or NSP, total sugars, saturates, sodium mg → salt via ×2.5/1000); read USDA, **carbs = carbohydrate by difference − fibre** (CoFID basis), sodium → salt; portions from USDA `food_portion` to `servings`; normalise names (lowercase, strip accents/punctuation) and **drop a USDA food when its normalised name matches a CoFID food** unless overrides say `keep`; apply `skip` rows; scope per **Q11**; blanks stay `null`; write JSON sorted by id. Print counts (CoFID kept, USDA added, USDA dropped as duplicates).
- [ ] **Step 2: Run** `python apps/mobile/scripts/build-food-db.py` — Expected: prints counts; `builtin-foods.json` exists; spot-check "Egg, whole, raw" style entries appear once.
- [ ] **Step 3: Size check:** file ≤ 2 MB (spec estimate 1–2 MB). If larger, report to the user before continuing.
- [ ] **Step 4: Write `SOURCES.md`** with the OGL v3 attribution for CoFID ("Contains public sector information licensed under the Open Government Licence v3.0"), the USDA FDC citation, and the Open Food Facts ODbL notice.
- [ ] **Step 5: Checkpoint** per Q1.

---

### Task 7: Built-in foods seed and local search

**Files:**
- Create: `apps/mobile/src/db/repositories/builtinFoods.ts`
- Modify: `apps/mobile/src/db/migrations.ts` (`initDatabase` calls `seedBuiltinFoods()` after the exercise seed)
- Test: `apps/mobile/test/builtinFoods.test.ts`

**Interfaces:**
- Consumes: `builtin_foods` table (Task 4), `builtin-foods.json` (Task 6), `getMeta/setMeta('builtin_foods_version')`.
- Produces:
  - `seedBuiltinFoods(data?: BuiltinFoodsFile): Promise<void>` — no-op when the stored version equals `data.version`; otherwise one transaction: `DELETE FROM builtin_foods` then insert all; sets the meta key
  - `searchLocalFoods(query: string, limit = 50): Promise<LocalFoodHit[]>` where `LocalFoodHit = { ref: { kind: 'builtin'; id: string } | { kind: 'food'; id: string }; name: string; brand: string | null; per100: Nutrients; servings: Serving[]; basis: 'g'|'ml' }` — searches `builtin_foods.name_search` and non-archived, non-deleted `foods` (name/brand); every query word must match (`LIKE '%word%'` per word, AND); user foods first, then shorter names first
  - `getBuiltinFood(id: string): Promise<LocalFoodHit | null>`

- [ ] **Step 1: Failing tests:** seeding a two-food fixture inserts 2 rows; seeding the same version again leaves rows untouched (insert a marker row first and check it survives); a new version replaces them; `searchLocalFoods('chick bre')` finds "Chicken breast, grilled" and not "Chickpeas"; a user food named "Chicken breast (Tesco)" ranks first; archived user foods are excluded.
- [ ] **Step 2: Run** `cd apps/mobile && npx vitest run test/builtinFoods.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** Load the asset with `require('../../../assets/foods/builtin-foods.json')` as the default `data` (vitest resolves JSON natively).
- [ ] **Step 4: Run** — Expected: PASS. Also run `db.test.ts` (seed now runs in `freshApp`) — PASS.
- [ ] **Step 5: Checkpoint** per Q1.

---

### Task 8: Food diary repository

**Files:**
- Create: `apps/mobile/src/db/repositories/food.ts`
- Test: `apps/mobile/test/food.test.ts`

**Interfaces:**
- Consumes: Task 2 helpers, Task 4 tables, `LocalFoodHit` (Task 7), `getUserId`.
- Produces:
  - `type FoodRef = { kind: 'builtin'; id: string } | { kind: 'food'; id: string }`
  - `logFood(p: { ref: FoodRef; name: string; per100: Nutrients; serving: Serving; servings: number; meal: Meal; localDate: string }): Promise<string>` (entry id; grams = serving.grams × servings; nutrients = `scaleNutrients`)
  - `quickAdd(p: { kcal: number; protein_g: number; name: string | null; meal: Meal; localDate: string }): Promise<string>` (name defaults to "Quick add")
  - `updateEntry(id: string, p: { serving: Serving; servings: number; meal: Meal; per100: Nutrients }): Promise<void>`; `updateQuickAdd(id, { kcal, protein_g, name, meal })`
  - `deleteEntry(id: string): Promise<void>`; `undoDelete(id: string): Promise<void>` (clears `deleted_at` via `stageUpdate`)
  - `copyEntries(ids: string[], to: { localDate: string; meal: Meal }): Promise<void>` (new ids, same snapshots, `logged_at = now`)
  - `saveMeal(name: string, entryIds: string[]): Promise<string>` (only entries with a `serving_label`; quick adds are skipped)
  - `logSavedMeal(savedMealId: string, meal: Meal, localDate: string): Promise<string[]>` (one entry per item)
  - `lastServing(ref: FoodRef): Promise<{ serving: Serving; servings: number } | null>`
  - `recentFoods(meal: Meal, todayKey: string): Promise<RecentFood[]>` (distinct refs logged in that meal in the last 30 days, newest first) and `frequentFoods(todayKey: string): Promise<RecentFood[]>` (top 10 by count, 60 days); `RecentFood = { ref; name; serving; servings; kcal; protein_g }`
  - `createFood(input)`, `updateFood(id, patch)`, `archiveFood(id)`, `findFoodByBarcode(code: string): Promise<SyncRow<'foods'> | null>`
  - `normaliseBarcode(code: string): string` (UPC-A 12 digits → prefix `0`; EAN-13/EAN-8 unchanged)

- [ ] **Step 1: Failing tests** (use `freshApp()`; seed a fixture builtin list; `zero` = a `Nutrients` object with `kcal: 0` and every other key `null`):

```ts
it('snapshots nutrients so editing the food never changes past entries', async () => {
  const f = await createFood({ name: 'Granola', brand: null, barcode: null, source: 'custom', basis: 'g', per100: { ...zero, kcal: 450, protein_g: 10, carbs_g: 60, fat_g: 18 }, servings: [{ label: '1 bowl', grams: 50 }] });
  const id = await logFood({ ref: { kind: 'food', id: f.id }, name: 'Granola', per100: f.per100, serving: { label: '1 bowl', grams: 50 }, servings: 2, meal: 'breakfast', localDate: '2026-10-26' });
  await updateFood(f.id, { kcal: 500 });
  expect(await getRecord('food_log_entries', id)).toMatchObject({ grams: 100, kcal: 450, protein_g: 10 });
});
it('quick add stores calories and protein only', async () => { /* carbs_g, fat_g null; name 'Quick add' when null */ });
it('copies a whole meal or picked items to another day', async () => { /* copyEntries([a]) → 1 new entry on 2026-10-27 lunch, original untouched */ });
it('saved meal logs its foods as separate entries', async () => { /* saveMeal of 3 entries → logSavedMeal → 3 entries, same grams/kcal */ });
it('remembers the last serving per food', async () => { /* log 2 × slice then 3 × slice → lastServing = 3 × slice */ });
it('lists recent foods for the meal, newest first, one row per food', async () => {});
it('delete is a tombstone and undo restores it', async () => {});
it('normalises UPC-A to EAN-13', () => { expect(normaliseBarcode('012345678905')).toBe('0012345678905'); });
it('logs a late-night entry on the chosen day', async () => {
  const id = await quickAdd({ kcal: 200, protein_g: 5, name: null, meal: 'snacks', localDate: resolveLogDate(new Date(2026, 9, 27, 0, 30), 'yesterday') });
  expect((await getRecord('food_log_entries', id))?.local_date).toBe('2026-10-26');
});
```

- [ ] **Step 2: Run** `cd apps/mobile && npx vitest run test/food.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** with `write()`/`commit()`; multi-row operations (copy, log saved meal) are one `write()` with several `stageCreate`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Checkpoint** per Q1.

---

### Task 9: Recipes and batches repository

**Files:**
- Create: `apps/mobile/src/db/repositories/recipes.ts`
- Test: `apps/mobile/test/recipes.test.ts`

**Interfaces:**
- Consumes: Task 8 `FoodRef`, Task 2 helpers.
- Produces:
  - `recipePer100(ingredients: RecipeIngredient[], cookedWeightG: number): Nutrients` (Σ scaled ingredients ÷ cooked weight × 100; extras null if any ingredient's value is null)
  - `createRecipe(name, ingredients)`, `updateRecipe(id, patch)`, `archiveRecipe(id)`
  - `logRecipeOneOff(p: { recipeId; cookedWeightG; gramsEaten; meal; localDate }): Promise<string>` (kind `recipe`)
  - `startBatch(p: { recipeId; cookedWeightG; firstPortionG; meal; localDate }): Promise<{ batchId: string; entryId: string }>`
  - `batchRemaining(batchId: string): Promise<number>` = `cooked_weight_g − SUM(grams of live entries with that batch_id)`
  - `logFromBatch(p: { batchId; grams; meal; localDate }): Promise<string>` — throws `BatchOverdrawError` with `remainingG` when `grams > remaining`; sets `finished_at` when remaining becomes 0 (same `write()`)
  - `updateBatchEntryGrams(entryId: string, grams: number): Promise<void>` — same over-draw check (remaining + the entry's old grams); clears `finished_at` if remaining rises above 0
  - `deleteBatchEntry(entryId)` — tombstone + clear `finished_at` (amount goes back)
  - `finishBatch(batchId)` (manual); `openBatches(): Promise<Leftover[]>` with `Leftover = { batchId; recipeName; remainingG; per100: Nutrients }` (unfinished, remaining > 0)

- [ ] **Step 1: Failing tests** (fixture `chilliIngredients`: 400 g raw mince 250 kcal/100 g, 400 g tomatoes 20 kcal/100 g → 1,080 kcal total; `recipeId` from `createRecipe('Chilli', chilliIngredients)` in `beforeEach`; `batchId` from a `startBatch` of 500 g with a 250 g first portion):

```ts
it('per-100 g comes from ingredients and cooked weight', () => {
  expect(recipePer100(chilliIngredients, 600).kcal).toBeCloseTo(180);
});
it('one-off logs grams eaten without tracking leftovers', async () => { /* gramsEaten 300 → kcal 540; openBatches() empty */ });
it('batch tracks what is left and finishes at 0 g', async () => {
  const { batchId } = await startBatch({ recipeId, cookedWeightG: 500, firstPortionG: 250, meal: 'dinner', localDate: '2026-10-26' });
  expect(await batchRemaining(batchId)).toBe(250);
  await logFromBatch({ batchId, grams: 250, meal: 'lunch', localDate: '2026-10-27' });
  expect(await openBatches()).toEqual([]);
});
it('blocks logging more than what is left', async () => {
  await expect(logFromBatch({ batchId, grams: 300, meal: 'lunch', localDate: '2026-10-27' })).rejects.toMatchObject({ remainingG: 250 });
});
it('editing or deleting a batch entry puts the amount back', async () => {
  // log 250 of 500 → edit to 100 → remaining 400 → delete → remaining 500; a finished batch reopens after delete
});
it('manual finish hides the leftover', async () => {});
it('editing the recipe never changes past entries or open batches', async () => {});
```

- [ ] **Step 2: Run** `cd apps/mobile && npx vitest run test/recipes.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** Batch per-100 is snapshotted on the batch row at `startBatch`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Checkpoint** per Q1.

---

### Task 10: Body and targets repository

**Answered:** Q4, Q5.

**Files:**
- Create: `apps/mobile/src/db/repositories/body.ts`
- Test: `apps/mobile/test/body.test.ts`

**Interfaces:**
- Consumes: Task 3 (`calculateTargets`, `resolveTargets`, settings `nutrition`), `useSettingsStore.getState().update`.
- Produces:
  - `logWeight(kg: number, localDate: string): Promise<void>` — creates a `body_metrics` row, then `recalculateTargets('weight')`
  - `currentWeightKg(): Promise<number | null>` (Q4: mean of weigh-ins in the last 7 days, else the latest weigh-in)
  - `weightHistory(limit = 100): Promise<{ local_date: string; value: number }[]>`; `weightTrend(): Promise<{ local_date: string; value: number }[]>` (Q4: 30-day rolling average per weigh-in date)
  - `saveProfileAndGoal(profile: BodyProfile, goal: Goal): Promise<void>` → recalculates
  - `setOverride(key: keyof Targets, value: number | null): Promise<{ ok: true } | { ok: false; kcal: number; min: number }>` (null clears; rejected without saving when `checkMacroOverrides` fails)
  - `recalculateTargets(reason: 'weight'|'profile'|'override'|'prompt'): Promise<void>` — computes `resolveTargets(calculateTargets(…), overrides)`; appends `{ from_date: today, targets }` to `history` (replacing an entry with the same `from_date`); updates `weight_at_last_calc` unless reason is `'weight'` with overrides present
  - `getTargetsForDate(localDate: string): Targets | null` — latest history entry with `from_date ≤ localDate`, else null
  - `shouldPromptRecalc(now: Date): boolean` (Q5: goal is not maintain, at least one override, |7-day average − `weight_at_last_calc`| ≥ rate × 2, and ≥ 30 days since `last_prompt_at`); `markPrompted(now)`; `acceptRecalcPrompt()` clears all overrides then recalculates

- [ ] **Step 1: Failing tests:**

```ts
it('new weight recalculates targets that were not hand-edited', async () => { /* profile male 180 cm moderate, lose 0.5, weight 80 → protein 160; logWeight(78) → protein 156 */ });
it('keeps hand-edited targets when weight changes', async () => { /* setOverride('protein_g', 180) → logWeight(78) → protein 180 */ });
it('past days keep the targets they had', async () => {
  // targets on 2026-10-20, change goal on 2026-10-26 → getTargetsForDate('2026-10-22') = old, ('2026-10-26') = new
});
it('asks monthly only when weight moved two weeks of goal rate and something was hand-edited', async () => {
  // lose 0.5 kg/week, override protein, weight_at_last_calc 80: average 79.2 → false; 79.0 → true; markPrompted → false for 30 days; goal maintain → always false
});
it('accepting the prompt recalculates every hand-edited target', async () => {});
it('minimum still applies to a hand-edited calorie target', async () => { /* setOverride('kcal', 900) female → 1200 */ });
```

- [ ] **Step 2: Run** `cd apps/mobile && npx vitest run test/body.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** Settings writes go through `useSettingsStore.getState().update({ nutrition })` (already uses `mutate.ts`). Use the device's local date via `toLocalDateKey(new Date())`, injectable for tests.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Checkpoint** per Q1.

---

### Task 11: Open Food Facts client

**Blocked by:** Q9 (ask the user for the contact email before starting).

**Files:**
- Create: `apps/mobile/src/services/openFoodFacts.ts`
- Test: `apps/mobile/test/openFoodFacts.test.ts` (stub `fetch` with `vi.stubGlobal`)

**Interfaces:**
- Produces:
  - `type OffProduct = { barcode: string; name: string; brand: string | null; basis: 'g'|'ml'; per100: Nutrients; serving: Serving | null; complete: boolean }` (`complete` = kcal and protein present)
  - `lookupBarcode(code: string): Promise<OffProduct | null | 'offline'>` — `GET https://world.openfoodfacts.org/api/v2/product/<code>.json?fields=code,product_name,brands,nutriments,serving_quantity,serving_size,quantity`
  - `searchProducts(query: string): Promise<OffProduct[] | 'offline'>` — `GET https://world.openfoodfacts.org/cgi/search.pl?search_terms=<q>&search_simple=1&json=1&page_size=20&fields=…`
  - `normaliseOffProduct(raw: unknown): OffProduct | null` (pure; exported for tests)
  - Headers: `User-Agent: GymLog/<expo version> (<contact per Q9>)`. Client-side limits: ≤ 10 searches/min and ≤ 15 product reads/min (calls beyond the limit wait, then resolve); 8 s timeout; network error, timeout, HTTP 429/503 → `'offline'`.

- [ ] **Step 1: Failing tests:**

```ts
it('uses per-100 g values when present', () => { /* nutriments energy-kcal_100g 57, proteins_100g 10 → per100.kcal 57 */ });
it('converts kJ-only energy to kcal', () => { /* energy-kj_100g 418.4, no kcal → 100 */ });
it('converts per-serving-only values using serving_quantity', () => { /* energy-kcal_serving 97, proteins_serving 17, serving_quantity 170 → per100.kcal ≈ 57.06 */ });
it('derives salt from sodium and leaves missing extras null, never 0', () => {});
it('marks a product incomplete when a main value is missing', () => {});
it('returns null for status 0 (not found) and "offline" on network failure or 503', async () => {});
it('sends the custom User-Agent', async () => {});
```

- [ ] **Step 2: Run** `cd apps/mobile && npx vitest run test/openFoodFacts.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Checkpoint** per Q1.

---

### Task 12: Nutrition label parser

**Files:**
- Create: `packages/shared/src/labelParser.ts`, `packages/shared/src/__tests__/fixtures/labels.ts`
- Test: `packages/shared/src/__tests__/labelParser.test.ts`

**Interfaces:**
- Produces: `parseNutritionLabel(lines: string[]): { per100: Partial<Nutrients>; servingGrams: number | null; found: (keyof Nutrients)[] }` — finds rows by keyword (energy/kcal/kJ, fat, saturates/of which saturates, carbohydrate, sugars/of which sugars, fibre, protein, salt, sodium), takes the **per 100 g/ml** column when the label has per-100 and per-portion columns, converts kJ→kcal when kcal is absent, sodium→salt, accepts comma decimals ("2,5 g"), reads "Serving/portion (30g)" for `servingGrams`.

- [ ] **Step 1: Failing tests** with three fixtures (OCR text lines as ML Kit returns them): a two-column EU label (per 100 g + per 30 g), a kJ-only label, a label with "<0.5 g" values (→ 0.5) and comma decimals. Assert exact numbers, e.g. EU fixture → `{ kcal: 389, fat_g: 7.0, sat_fat_g: 1.2, carbs_g: 60.0, sugars_g: 1.0, fibre_g: 9.0, protein_g: 13.0, salt_g: 0.02 }`, `servingGrams: 30`.
- [ ] **Step 2: Run** `cd packages/shared && npx vitest run src/__tests__/labelParser.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Checkpoint** per Q1.

---

### Task 13: Navigation, History switch, toast, macro tokens

**Files:**
- Create: `apps/mobile/src/app/(tabs)/food.tsx` (re-export `screens/FoodScreen`), `apps/mobile/src/components/Toast.tsx`, `apps/mobile/src/state/toastStore.ts`
- Delete: `apps/mobile/src/app/(tabs)/analytics.tsx`
- Modify: `apps/mobile/src/app/(tabs)/_layout.tsx` (tabs: index Workout · history History · routines Routines · food Food (lucide `Apple`) · settings Settings; colours from `colors`), `apps/mobile/src/screens/HistoryScreen.tsx` (segmented `Workouts | Stats | Body`; Stats renders the existing Analytics content; Body renders `BodyScreen` placeholder until Task 18), `apps/mobile/src/screens/AnalyticsScreen.tsx` (export the content as `StatsView` without its own `SafeAreaView`/title), `apps/mobile/tailwind.config.js` + `apps/mobile/src/theme.ts` (tokens `macro.protein #60A5FA`, `macro.carbs #FBBF24`, `macro.fat #A78BFA` / `colors.protein`, `colors.carbs`, `colors.fat` — values from the approved mockups), `apps/mobile/src/app/_layout.tsx` (mount `<Toast />`)

**Interfaces:**
- Produces: `showToast(p: { message: string; actionLabel?: string; onAction?: () => void; durationMs?: number }): void` (default 5 s); `FoodScreen` default export (placeholder until Task 14).

- [ ] **Step 1: Implement** the files above. Toast sits above the tab bar, uses tokens, one at a time (a new toast replaces the old).
- [ ] **Step 2: Run** `npm run typecheck | tail -25` and `npm test | tail -25` — Expected: pass.
- [ ] **Step 3: Verify on emulator:** five tabs as listed; History switch shows workouts, the unchanged Analytics content under Stats, and a Body placeholder. Screenshot.
- [ ] **Step 4: Checkpoint** per Q1.

---

### Task 14: Food diary screen

**Files:**
- Create: `apps/mobile/src/screens/FoodScreen.tsx`, `apps/mobile/src/components/food/DiarySummaryCard.tsx`, `apps/mobile/src/components/food/MealTabs.tsx`, `apps/mobile/src/components/food/EntryRow.tsx`, `apps/mobile/src/components/food/CopyEntriesSheet.tsx`, `apps/mobile/src/components/food/SaveMealSheet.tsx`, `apps/mobile/src/components/food/LateNightSheet.tsx`, `apps/mobile/src/state/foodUiStore.ts`

**Interfaces:**
- Consumes: Task 8 (`deleteEntry`, `copyEntries`, `saveMeal`), Task 10 (`getTargetsForDate`), Task 2 (`resolveLogDate`, `isLateNight`, `addDaysToKey`, `MEAL_LABELS`), `PortionSheet` (Task 15) for edits.
- Produces: `useFoodUiStore` (zustand, persisted with `kvStorage`): `{ lastMeal: Meal; setLastMeal(m) }` and non-persisted `{ lateNightChoice: 'yesterday'|'today'|null; setLateNightChoice }` (reset on blur of the Food tab).

- [ ] **Step 1: Implement** per spec §5.1 and the mockup `diary-layout-v2.html` + `meal-tabs.html` option B:
  - Date row `‹ Today ›` (+ picker); summary card "Calories remaining" **Goal − Food = Left** with P/C/F bars (`eaten / target g`); totals from one `useLiveQuery` `SUM` over `food_log_entries WHERE local_date = ? AND deleted_at IS NULL GROUP BY meal`; target from `getTargetsForDate(date)`; over-target numbers red; no targets → card shows "Set up your targets" linking to History → Body.
  - Meal tab row with each meal's kcal; selected tab = `lastMeal`; tapping sets it.
  - Selected meal: header `<kcal> kcal · <protein> g protein`; rows `name`, `amount · <protein> g protein`, kcal right; amount uses servings/serving label or `toDisplayFoodAmount`; quick adds show "Quick add".
  - Tap a row → `PortionSheet` edit mode (batch entries use `updateBatchEntryGrams`; quick adds open `QuickAddSheet` in edit mode).
  - Delete (from the edit sheet) → `ConfirmSheet` "Delete <name>?" destructive → `deleteEntry` / `deleteBatchEntry`.
  - Meal header ⋯ menu: **Save as meal** (`SaveMealSheet`: name + tickboxes), **Copy to another day** (whole meal), **Copy selected items** (tickboxes) → `CopyEntriesSheet` (date + meal).
  - **+ Add food** → `router.push({ pathname: '/food/add', params: { meal, date } })`.
  - On focus between 00:00 and 02:59 with no choice yet → `LateNightSheet` "Add food to yesterday (<weekday>) or today?"; choice sets the diary date and `lateNightChoice`.
- [ ] **Step 2: Run** `npm run typecheck | tail -25` — Expected: pass.
- [ ] **Step 3: Verify on emulator** with seeded entries: totals, tab memory across app restart, red over target, delete confirm, copy and save-as-meal, late-night sheet (set device clock to 00:30). Screenshot.
- [ ] **Step 4: Checkpoint** per Q1.

---

### Task 15: Add-food screen, portion sheet, quick add

**Files:**
- Create: `apps/mobile/src/app/food/add.tsx` (re-export), `apps/mobile/src/screens/AddFoodScreen.tsx`, `apps/mobile/src/components/food/PortionSheet.tsx`, `apps/mobile/src/components/food/QuickAddSheet.tsx`, `apps/mobile/src/components/food/RecipeLogSheet.tsx`, `apps/mobile/src/components/food/FoodSearchRow.tsx`
- Modify: `apps/mobile/src/app/_layout.tsx` (register `food/*` stack screens, modal presentation)

**Interfaces:**
- Consumes: Tasks 7, 8, 9, 11; params `meal: Meal`, `date: string`.
- Produces: `PortionSheet` props `{ visible; food: { name; per100; servings: Serving[]; basis }; initial?: { serving; servings; meal }; mode: 'add'|'edit'; maxGrams?: number; onSubmit(p: { serving; servings; meal }); onDelete?(); onClose() }`. Serving list = the food's named servings + `100 g`-style "g" unit (servings field then means grams) + `oz` when imperial.

- [ ] **Step 1: Implement** per spec §5.2–5.4 and `add-food.html` (portion option A):
  - Header meal chip; actions **Scan barcode** (→ `/food/scan`), **Quick add**, **Create food** (→ `/food/edit?mode=new`).
  - Before typing, sections in order: **Leftovers** (`openBatches()`; row "Chilli · 250 g left · 52 g protein"; tap → `PortionSheet` grams pre-filled with remaining, `maxGrams` = remaining; **long-press → ConfirmSheet "Mark batch finished?"** → `finishBatch`), **Recent** (this meal), **Saved meals** (+ logs all items), **Frequent**.
  - Typing: `searchLocalFoods` on every keystroke; Open Food Facts `searchProducts` on submit or after 1,000 ms without typing; results in a separate "Online" section with a spinner; `'offline'` → a muted line "Online results need internet" (local results stay).
  - "+" on a row → `logFood` at `lastServing` (else the food's first serving, else 100 g) → `showToast({ message: 'Added <name>', actionLabel: 'Undo', onAction })` where `onAction` calls `deleteEntry(newEntryId)`; search stays open.
  - Tapping an Online result → if `complete`, the check page (`/food/edit?mode=check`, Task 16); else the same page with missing fields highlighted.
  - Recipes in search (user recipes matched by name) → `RecipeLogSheet`: **One-off** (cooked weight + grams eaten → `logRecipeOneOff`) or **Batch** (cooked weight + first portion → `startBatch`).
  - Over-draw → inline message "Only <remaining> g left in this batch" and disabled Add.
  - `QuickAddSheet`: Calories (required), Protein g (required), Name (optional) → `quickAdd`.
- [ ] **Step 2: Run** `npm run typecheck | tail -25` — Expected: pass.
- [ ] **Step 3: Verify on emulator:** breakfast of three known foods logged from Recent in under 30 seconds; airplane mode → local search works, online line shows; leftover long-press finish; batch over-draw message. Screenshot.
- [ ] **Step 4: Checkpoint** per Q1.

---

### Task 16: Food form (create / check / label confirm), My foods, recipe editor

**Files:**
- Create: `apps/mobile/src/app/food/edit.tsx`, `apps/mobile/src/screens/FoodFormScreen.tsx`, `apps/mobile/src/app/food/my-foods.tsx`, `apps/mobile/src/screens/MyFoodsScreen.tsx`, `apps/mobile/src/app/food/recipe/[id].tsx`, `apps/mobile/src/screens/RecipeEditorScreen.tsx`
- Modify: `FoodScreen.tsx` (top-right **My foods** button)

**Interfaces:**
- Consumes: Task 8 (`createFood`, `updateFood`, `archiveFood`), Task 9 (`createRecipe`, `updateRecipe`, `archiveRecipe`, `recipePer100`), `searchLocalFoods`, `PortionSheet`.
- Produces: `FoodFormScreen` params `mode: 'new'|'edit'|'check'|'label'`, optional `foodId`, `barcode`, and a prefill passed through a small zustand `foodFormDraftStore` (`{ draft: Partial<FoodDraft> | null }`) to avoid URL-encoding nutrient objects; `FoodDraft = { name; brand; barcode; basis; per100: Nutrients; servings: Serving[]; source }`.

- [ ] **Step 1: Implement:**
  - Form fields: Name, Brand, Values per (100 g / 100 ml), Energy (kcal) and Protein (required), then Carbohydrate, Fat, Fibre, Sugars, Saturated fat, Salt (optional, blank = unknown), Servings (label + grams, repeatable). Mode titles: **New food**, **Edit food**, **Check details** (subtitle "Found online (Open Food Facts). Fix anything that looks wrong."; button **Looks right**), **Check label** (from Task 17). Save → `createFood` with the right `source`, keeps `barcode` → then the portion sheet for the meal the user came from (when opened from logging).
  - `MyFoodsScreen`: tabs **Foods · Meals · Recipes**; tap to edit (meals: rename/remove items); delete → `ConfirmSheet` → archive (foods, recipes) or tombstone (saved meals). **Recipes → + New recipe**.
  - `RecipeEditorScreen`: name, ingredient list (add via the add-food search in a picker mode + `PortionSheet` raw grams), totals for the whole recipe; save → `createRecipe`/`updateRecipe`.
- [ ] **Step 2: Run** `npm run typecheck | tail -25` — Expected: pass.
- [ ] **Step 3: Verify on emulator:** create food → log it; edit food → yesterday's entry unchanged; recipe create → one-off and batch logging. Screenshot.
- [ ] **Step 4: Checkpoint** per Q1.

---

### Task 17: Barcode scanning and label reading

**Answered:** Q8.

**Files:**
- Modify: `apps/mobile/package.json` (via `npx expo install expo-camera` and the text-recognition module per **Q8**), `apps/mobile/app.json` (`CAMERA` in `permissions`; `expo-camera` plugin with `"recordAudioAndroid": false`; keep `RECORD_AUDIO` in `blockedPermissions`)
- Create: `apps/mobile/src/app/food/scan.tsx`, `apps/mobile/src/screens/BarcodeScanScreen.tsx`, `apps/mobile/src/app/food/label.tsx`, `apps/mobile/src/screens/LabelScanScreen.tsx`
- Modify: `docs/release-apk.md` (new permission and native modules note)

**Interfaces:**
- Consumes: `normaliseBarcode`, `findFoodByBarcode` (Task 8), `lookupBarcode` (Task 11), `parseNutritionLabel` (Task 12), `foodFormDraftStore` (Task 16).

- [ ] **Step 1: Implement** spec §6.2/§6.4 and `barcode-found.html` option A:
  - Scan screen: `CameraView` with `barcodeScannerSettings={{ barcodeTypes: ['ean13','ean8','upc_a','upc_e'] }}`; first scan only; permission denied → message with a Settings link and **Type barcode** field.
  - Flow: local `findFoodByBarcode` → portion sheet; else `lookupBarcode` → product → check page (`mode=check`, draft prefilled, barcode kept); `null` or `'offline'` → "Product not found — photograph the nutrition table" → label screen; secondary buttons **Quick add**, **Search by name**.
  - Label screen: take a photo of the nutrition table → text recognition → `parseNutritionLabel(lines)` → `mode=label` form prefilled (name empty, barcode kept, missing fields highlighted). Only kJ → converted (parser). Saved as private `source: 'label'`.
- [ ] **Step 2: Prebuild and build:** follow `docs/release-apk.md` (`npm run phone` re-prebuilds on `app.json`/`package.json` change). Confirm the merged manifest has `CAMERA` and no `RECORD_AUDIO`.
- [ ] **Step 3: Verify on the phone:** known barcode → check page once, second scan → portion sheet; unknown barcode → label photo → confirmation → saved → rescan finds it; airplane mode → straight to label flow. Screenshot.
- [ ] **Step 4: Checkpoint** per Q1.

---

### Task 18: Body screen and targets UI

**Answered:** Q2, Q3, Q4, Q6.

**Files:**
- Create: `apps/mobile/src/screens/BodyScreen.tsx`, `apps/mobile/src/components/body/LogWeightSheet.tsx`, `apps/mobile/src/components/body/ProfileGoalSheet.tsx`, `apps/mobile/src/components/body/TargetsCard.tsx`, `apps/mobile/src/components/body/RecalcPromptSheet.tsx`, `apps/mobile/src/components/body/WeightTrendChart.tsx`
- Modify: `HistoryScreen.tsx` (Body tab renders `BodyScreen`), `FoodScreen.tsx` (on focus: `shouldPromptRecalc` → `RecalcPromptSheet`)

**Interfaces:**
- Consumes: Task 10 entirely, `useUnits()` for kg/lb.

- [ ] **Step 1: Implement** per spec §8 and `weight-location.html` option C:
  - Current weight, trend line (`react-native-svg`, per **Q4**), weigh-in list, **+ Log weight** (decimal, kg/lb per unit).
  - Body details: height (cm, or ft/in in imperial), date of birth, sex (Male/Female), activity (per **Q2**); goal Lose / Maintain / Gain with rate chips (per **Q3**). Shows "Maintenance ≈ <n> kcal (Mifflin-St Jeor × <activity>)" and the result.
  - Targets card: kcal, protein, carbs, fat; tap to edit (stepper/typed); edited values marked "edited" with a reset; the minimum enforced with an inline note "Minimum <1,200|1,500> kcal"; all three macros editable; a rejected edit shows "Your macros add up to <n> kcal, below your minimum of <min> kcal." and is not saved.
  - `RecalcPromptSheet`: "Your weight has changed since your targets were set. Recalculate your edited targets?" **Recalculate** / **Keep mine** (both `markPrompted`).
- [ ] **Step 2: Run** `npm run typecheck | tail -25` — Expected: pass.
- [ ] **Step 3: Verify on emulator:** set up profile → diary targets appear; log weight → unedited targets change; edit protein → stays; move clock 31 days with a changed weight → prompt. Screenshot.
- [ ] **Step 4: Checkpoint** per Q1.

---

### Task 19: Nutrition charts in Stats

**Answered:** Q10.

**Files:**
- Create: `apps/mobile/src/components/food/NutritionCharts.tsx`, `apps/mobile/src/db/repositories/nutritionStats.ts`
- Modify: `apps/mobile/src/screens/AnalyticsScreen.tsx` (`StatsView` renders `NutritionCharts` below the existing sections)
- Test: `apps/mobile/test/nutritionStats.test.ts`

**Interfaces:**
- Consumes: `getTargetsForDate` (Task 10), `weightTrend` (Task 10).
- Produces: `dailyTotals(fromKey: string, toKey: string): Promise<{ local_date; kcal; protein_g; carbs_g; fat_g }[]>`; `weekRange(todayKey: string): { from: string; to: string }` (per **Q10**); `weeklyAverages(todayKey)` (logged days only); `weightVsCalories(todayKey, weeks = 8): Promise<{ week_start: string; avg_kcal: number | null; weight_kg: number | null }[]>`.

- [ ] **Step 1: Failing tests:** daily totals skip deleted entries; averages ignore days with no entries; a day before a target change is compared to the old target; weight vs calories returns 8 weeks with nulls for empty weeks.
- [ ] **Step 2: Run** `cd apps/mobile && npx vitest run test/nutritionStats.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** queries, then the four charts per spec §8.5 and `nutrition-charts.html` (bars with the day's target line, over-target red, today "so far"; protein "Hit target on X of Y days"; averages grid; weight line over calorie bars).
- [ ] **Step 4: Run** tests — PASS; `npm run typecheck` — pass. Verify on emulator with a week of entries. Screenshot.
- [ ] **Step 5: Checkpoint** per Q1.

---

### Task 20: Attribution, end-to-end check, roadmap tick

**Files:**
- Modify: `apps/mobile/src/screens/SettingsScreen.tsx` (About card: food data credits next to the RepDB credit — CoFID OGL v3, USDA FoodData Central, Open Food Facts ODbL with link)
- Modify: `ROADMAP.md` (tick 2.15 with date only after the phone check)

- [ ] **Step 1: Add the credits** (text from `assets/foods/SOURCES.md`).
- [ ] **Step 2: Run** `npm test | tail -25` and `npm run typecheck | tail -25` — Expected: all pass.
- [ ] **Step 3: Phone walkthrough of spec §1** (7:30 breakfast < 30 s, saved lunch in one tap, 15:30 glance, dinner recipe batch + leftovers next day, 21:00 corrections, late-night snack, barcode + label photo, weigh-in → targets update, backup → restore round-trip). Screenshots.
- [ ] **Step 4: Tick ROADMAP 2.15** with the date; update `CLAUDE.md` if anything changed during the build.
- [ ] **Step 5: Checkpoint** per Q1.
