# Product recommendations: food tracking for Gym Log

[← Research index](README.md) · Evidence: [app-analysis.md](app-analysis.md) · [feature-matrix.md](feature-matrix.md) ·
[evidence-and-sources.md](evidence-and-sources.md) · Next: [proposed-tracking-experience.md](proposed-tracking-experience.md) ·
Fit: [codebase-integration.md](codebase-integration.md)

Research date: 2026-10-25. Recommendations are filtered through Gym Log's own rules (`ROADMAP.md:16-32`):
**offline-first**, **fastest logging**, **no paywall on basics**, **transparent smart features**, **your data is yours**,
**Android first**, **one design system**. Where a competitor pattern conflicts with those, the principle wins.

---

## The six product decisions to make first

These shape everything else. Each has a recommendation; none is irreversible except D2 and D3 (data model).

| # | Decision | Options | Recommendation | Why |
|---|---|---|---|---|
| D1 | **Where food data comes from** | (a) user-created only; (b) bundled generic DB; (c) online DB (Open Food Facts) | **(b) + (a) for MVP; add (c) as optional online barcode lookup in Phase 2** | All four competitors need a network to search ([MFP offline article](https://support.myfitnesspal.com/hc/en-us/articles/360032622851), [MacroFactor](https://help.macrofactorapp.com/en/articles/28-does-macrofactor-have-an-offline-mode), Cronometer forum). A bundled curated set is the one thing none of them do, and it matches principle 1. USDA FDC is CC0; UK CoFID is OGL v3 ([datasources](app-analysis.md#appendix-food-data-sources-and-label-conventions)). |
| D2 | **Nutrient storage basis** | per serving vs per 100 g | **Per 100 g (or 100 ml) canonical; servings = named gram weights** | EU labels (Ireland) mandate per-100 g ([Reg. 1169/2011 Art. 32](https://www.legislation.gov.uk/eur/2011/1169/article/32)); MacroFactor's custom-food wizard offers Serving / 100 g / 100 ml; MFP's per-entry serving model causes its "no unit conversion" weakness. |
| D3 | **History semantics** | log entries reference live food (retroactive) vs snapshot nutrients | **Snapshot** kcal + macros (+ tracked micros) onto each log entry | MFP (foods, meals) and MacroFactor (foods, recipes) are explicitly non-retroactive; Cronometer's "update past entries?" prompt is a documented trap with no undo. Snapshots also fit `mutate.ts` full-row semantics and make daily totals a single `SUM`. |
| D4 | **Meal slots vs timeline** | fixed slots (MFP, Lose It!, Cronometer groups) vs hourly timeline (MacroFactor) | **Meal slots (4 default, renamable, up to 6) + an `eaten_at` time stored silently** | Slots are the mainstream mental model, and some MacroFactor users ask for them. Storing time anyway keeps a timeline view possible later without migration. |
| D5 | **Quick Add policy** | none (Cronometer) vs calories only free (MFP) vs calories + macros | **Free kcal + optional P/C/F + optional label** | Principle 3. Cronometer's refusal is a top user request; MFP paywalls macros and can't label quick-adds. Both are complaints. |
| D6 | **Database trust model** | crowd (MFP) vs curated (Cronometer, MacroFactor) | **Curated bundled set + private user foods; no public submissions until a server exists** | Crowd data under-counts and duplicates (Griffiths 2018; JMIR 2020). Offline-only scope means there's no server to share to anyway. |

---

## MVP — essential for launch

The smallest complete daily food diary. Everything works in airplane mode. Target: logging a repeat meal in ≤3 taps,
a new food in ≤6.

### M1. Daily food diary screen
1. **What:** A Food tab with a date header, a calorie summary (goal, eaten, remaining), P/C/F bars, and meal sections
   (Breakfast, Lunch, Dinner, Snacks) each with its own **Add** button and kcal subtotal.
2. **Who does it:** MFP Today tab (per-meal Log buttons, consumed/remaining card); Lose It! meal-scoped **Add**;
   Cronometer diary groups + energy summary; MacroFactor target bars with swipe Consumed↔Remaining.
3. **Value:** The home of the feature; opened several times a day.
4. **Behaviour:** Opens on today. Tapping a meal's Add sets the meal context before search (MFP pattern). Tap the
   summary to toggle Consumed/Remaining. Over-target uses a neutral colour, not red (MacroFactor's non-judgemental
   calendar).
5. **Complexity:** Medium.
6. **Dependencies/risks:** Needs a **local-day key** (none exists today; analytics are UTC-bucketed,
   `AnalyticsScreen.tsx:19`). Adds a 6th tab or replaces one (navigation decision).
7. **Exclude from v1:** streaks, weight projections, healthy-habit widgets, water, per-meal goals.

### M2. Offline food search (bundled generic foods + my foods + history)
1. **What:** A search screen modelled on `ExerciseSelector`, querying a bundled read-only food table plus user foods.
   Before typing, show **Recent** for this meal, then **Frequent**, then **Favourites**.
2. **Who:** MacroFactor pre-typing list (favourites → hourly go-tos → latest) and sectioned results (History / Custom /
   Common / Branded); Lose It! "foods you often eat during the mealtime you pick"; MFP history-first, filtered to the
   current meal; Cronometer tabs.
3. **Value:** Most logs are repeats. History-first removes typing for them.
4. **Behaviour:** Results grouped: *From history*, *My foods*, *Common foods*. Rows show name, default serving and kcal
   (Cronometer users complained when rows lacked kcal). Each row has a **+** that logs instantly at the last-used
   serving, shows an undo toast, and keeps the search open (MFP Quick Log, MacroFactor multi-add). Tap the row for the
   portion screen. Empty result offers "Create '<query>'" (existing `ExerciseSelector` pattern) and "Quick add".
5. **Complexity:** Medium (search) + Medium (data pipeline for the bundled set).
6. **Dependencies/risks:** Licence attribution for USDA FDC / CoFID; APK size (aim < 1–2 MB for 1.5–3k foods);
   `LIKE '%q%'` is fine at a few thousand rows, use FTS5 only if verified in both expo-sqlite and `node:sqlite`.
   Seeding must be versioned, not run every launch like the exercise seed.
7. **Exclude:** branded foods, restaurants, typo-tolerant ranking, online search.

### M3. Portion selection
1. **What:** A bottom sheet with quantity + unit. Units = **g** (always), **ml** where density/volume is known, and the
   food's named servings ("1 medium egg = 50 g"). Defaults to the last serving used for that food.
2. **Who:** MacroFactor favourite units + last serving remembered; Cronometer unit picker with gram-weight servings;
   MFP number-of-servings multiplier with decimals.
3. **Value:** Correct quantity is where accuracy is won or lost.
4. **Behaviour:** Live kcal/P/C/F preview as the number changes. Accept `,` and `.` decimals (reuse `parseNum`,
   `SetRow.tsx:66-69`), and simple fractions (½, 1/2) as a nice-to-have. Oz shown when `unit_system` is imperial.
5. **Complexity:** Low–Medium.
6. **Risks:** Unit conversion bugs; §5 requires tests for conversions.
7. **Exclude:** density-based cup↔gram for foods without a stored portion; "log by calories" (Phase 2).

### M4. Custom food creation
1. **What:** A form: name, brand (optional), basis toggle (**per 100 g / per 100 ml / per serving of __ g**), energy,
   fat, saturates, carbs, sugars, fibre, protein, salt — **in EU label order**. Extra servings require a gram weight.
2. **Who:** MacroFactor 3-step wizard (Serving / 100 g / 100 ml, kJ↔kcal, salt↔sodium toggles, "leave blanks");
   Cronometer label-type choice and gram weight for extra servings; MFP two-step create.
3. **Value:** With a small bundled DB, users will create foods often (MacroFactor's own users report ~20% of feedback
   about missing foods). Speed here is critical.
4. **Behaviour:** Only name + energy are required. Unset nutrients are **blank, not zero** (Cronometer). Accept kJ
   (convert ÷4.184) or kcal; salt or sodium (sodium mg = salt g × 400). Soft warning, not a block, when kcal differs
   from 4P+4C+9F(+2 fibre) by > ~20% (catches kJ/kcal mix-ups). Save → optionally go straight to portion → log.
5. **Complexity:** Medium.
6. **Risks:** EU carbs exclude fibre, US carbs include it; store which label type was used or normalise.
7. **Exclude:** label OCR, sharing, public submission, micronutrients beyond the label set.

### M5. Quick Add
1. **What:** kcal (required) + optional protein/carbs/fat + optional name, into a chosen meal.
2. **Who:** MFP (kcal free, macros Premium, no label), MacroFactor (energy, P, F, C, alcohol, optional name).
   Cronometer refuses quick add; no Lose It! quick add was found in any source.
3. **Value:** Restaurant meals and estimates; the escape hatch that keeps the day complete.
4. **Behaviour:** Two fields visible, rest expandable. Not saved as a food (MacroFactor). Editable later like any entry.
5. **Complexity:** Low.
7. **Exclude:** alcohol field, fibre.

### M6. Edit, move, delete with undo
1. **What:** Tap an entry → same portion sheet in edit mode (quantity, unit, meal, delete). Swipe to delete with an
   **Undo** toast.
2. **Who:** Cronometer swipe-delete + Undo (since 4.3.0); MacroFactor one-tap edit; MFP drag to move meals.
3. **Value:** Corrections are frequent; undo removes the need for confirm dialogs (principle 2).
4. **Behaviour:** Edit recomputes the entry snapshot from the source food's per-100 g values × new grams; totals update
   live. Delete = tombstone (`deleted_at`), so undo is just clearing it.
5. **Complexity:** Low–Medium (a toast/snackbar component doesn't exist yet).
7. **Exclude:** drag-reorder within a meal.

### M7. Copy / repeat
1. **What:** Per-meal ⋯ menu: **Copy to today / to date**, **Repeat yesterday's <meal>**; multi-select items → copy.
2. **Who:** MFP meal-level copy + swipe to bring forward last meal; Lose It! "Add Yesterday's [Meal]" and past meals
   with per-item checkboxes; Cronometer copy day/group/items + Copy to Today; MacroFactor copy hour/day, To
   Today/Tomorrow, multi-date paste.
3. **Value:** Fastest path for people who eat the same breakfast; MFP's removal of item-level copy in its 2026 redesign
   is a top complaint — keep item-level.
4. **Behaviour:** Copies create new entries with new ids and today's `local_date`, same snapshots.
5. **Complexity:** Low.
7. **Exclude:** multi-date paste, copy mode, repeating schedules.

### M8. Nutrition goals
1. **What:** Settings card: daily kcal target, and protein/carbs/fat in **grams** (with an optional % view).
2. **Who:** Cronometer macro ratios / fixed grams; MFP (grams are Premium; free is 5% steps); MacroFactor adaptive.
3. **Value:** Without a target, "remaining" is meaningless.
4. **Behaviour:** Manual entry, with an optional one-time **Mifflin-St Jeor + activity** helper that suggests a number
   and **shows the maths** (principle 4). Goal changes apply from today forward (MFP keeps historical goals) — store goal
   per day or snapshot the goal on the day's first entry.
5. **Complexity:** Low (manual) / Medium (with history of goals).
6. **Risks:** Calorie floors / under-eating messaging if a suggestion helper is added (MFP warns below 1200/1500).
7. **Exclude:** adaptive TDEE, per-weekday goals, per-meal goals.

---

## Phase 2 — improvements

| # | Feature | Pattern from | Value / behaviour | Complexity | Risks / dependencies |
|---|---|---|---|---|---|
| P1 | **Barcode scan with online lookup + permanent local cache** | Cronometer (free scan), MacroFactor (OFF-backed), MFP (Premium) | Scan EAN-13/UPC (expo-camera SDK 54 supports them). Look up local foods by barcode first; if online, fetch Open Food Facts, normalise to per-100 g, show for confirmation, save locally forever. Offline or not found → custom-food form pre-filled with the barcode, so the next scan finds it. | High | New native dep + `CAMERA` permission + prebuild; ODbL attribution; OFF limits (15 reads/min, custom User-Agent); keep OFF rows separate from user data (share-alike). Breaks "offline-first" only if not optional. |
| P2 | **Saved meals** | MFP My Meals (logs as separate entries); MacroFactor "save as recipe, explode later" | Save selected entries from a meal as a named meal; logging it inserts editable individual entries. "Create from today's breakfast" shortcut. | Medium | Template data model (JSON items like `template_exercises`, or child table). |
| P3 | **Recipes with cooked weight** | Cronometer cooked weight; MacroFactor Total Weight (not auto-filled; shows raw sum as hint) + Serving Quantity; MFP lacks yield | Ingredients + either **servings count** or **total cooked weight** → log by grams eaten. Edits never touch past entries (snapshots). **Explode** to tweak one instance. | Medium–High | Recipe-as-food in search; nested recipes excluded. |
| P4 | **Plate / multi-add** | MacroFactor Plate + single "Log Foods" | Stage several foods, see Plate vs Day totals, commit once. | Medium | UX must not slow down single-food logs (MacroFactor's "speed mode" returns straight to search). |
| P5 | **Log by calories/macros** | MacroFactor | Enter "400 kcal" or "30 g protein" on the portion sheet; app computes grams. | Low | Division by zero for foods with 0 of that macro. |
| P6 | **Time-of-day suggestions** | MacroFactor hourly go-tos | Rank history by recency × frequency × hour-of-day. | Low–Medium | Needs `eaten_at`. Allow removing a suggestion. |
| P7 | **Fibre, sugar, sat fat, salt display + targets** | Cronometer, MacroFactor Nutrient Explorer, MFP (Heart Healthy view Premium) | Expandable panel on the day summary; floor/target/ceiling per nutrient. | Low (data already captured in M4) | Missing-data honesty: show "incomplete" when entries lack a value. |
| P8 | **Data-completeness signal + "mark day complete/partial"** | Cronometer source + nutrient count, magic-wand gap-fill; MacroFactor partial-day flag | Show which entries lack a nutrient; exclude partial days from averages and analytics. | Low–Medium | — |
| P9 | **Weekly nutrition view + CSV export** | MFP (export Premium, meal-level), Cronometer (servings + daily), MacroFactor (quick/granular) | Weekly average vs goal; export per-entry CSV and daily totals, free. Extend the existing backup (tables flow through `SYNC_TABLES`). | Low–Medium | Backup version compatibility (see codebase §11.5). |
| P10 | **Favourites, renamable meals, extra meal slots** | MFP 6 slots; Cronometer up to 8 groups; Lose It! renaming is Premium | Rename and add up to 6 meals in Settings; star foods. | Low | — |

---

## Advanced — later

| # | Feature | Pattern from | Why later | Complexity | Notes |
|---|---|---|---|---|---|
| A1 | **Nutrition-label OCR** | MacroFactor label scanner (real-time mock label), Cronometer label-photo auto-fill, Lose It! Autofill (on-device ML Kit, under 1 s, works offline per Google's case study) | Big speed win for custom foods. Lose It! proves it can run **offline** on-device, which fits Gym Log, but EU/US label parsing is real work. Strongest candidate to promote earlier. | High | Always land in an editable form. |
| A2 | **Natural-language "Describe" logging** | MacroFactor Describe (generic only), Cronometer/MFP voice | Needs an LLM or parser + server; breaks offline. Ground results in the local DB and return an editable list. | High | Principle 4: show matches, never a black-box total. |
| A3 | **Photo AI logging** | MFP Meal Scan, Cronometer Photo Log, MacroFactor AI (beta), Lose It! Snap It | Accuracy is poor: NIH 2026 abstract found 250–345 kcal/meal under-count (not yet peer reviewed). Server + model cost. | High | If ever, DB-grounded and draft-only (MacroFactor/Cronometer). |
| A4 | **Adaptive TDEE from bodyweight + intake** | MacroFactor | Depends on ROADMAP 3.5 `body_metrics` and weeks of data. Strong fit for a gym app later. | High | — |
| A5 | **Micronutrient depth (vitamins/minerals)** | Cronometer (84–95 nutrients), MacroFactor 26.5k micronutrient-complete foods | Needs a richer bundled dataset and UI; most gym users care about protein/kcal first. | Medium–High | USDA/CoFID include micros, so the pipeline can grow into it. |
| A6 | **Optional Open Food Facts country subset download** | (none of the four) | 80k Irish products ≈ 15–25 MB est.; an opt-in download makes barcode lookup work offline. | High | ODbL share-alike on the adapted subset. |
| A7 | **Recipe import from URL** | MFP (English only), Cronometer (Gold), MacroFactor | Needs network + parser; ingredient matching quality depends on DB breadth. | High | — |
| A8 | **Sync / multi-device** | all four | Deferred with ROADMAP Phase 8; schema is already sync-ready if built per `CLAUDE.md` §1. | High | — |

---

## Deliberately excluded from the first version (and why)

- **Branded/restaurant database:** needs online data and licensing; Quick Add and custom foods cover the gap.
- **Barcode scanning:** Phase 2, because lookup is online and it adds a native camera dependency. The data model
  should include a nullable `barcode` column from day one so P1 needs no migration.
- **AI photo/voice/describe:** accuracy and offline conflicts (see A2/A3).
- **Public food submissions, sharing, social diary:** no server; out of scope.
- **Timeline view, per-meal goals, per-weekday goals, net carbs:** low frequency of use relative to cost.
- **Streaks, weight projections, gamification:** out of research scope; revisit with ROADMAP 3.3.

## Common weaknesses to avoid

1. **Paywalling the basics** (MFP: barcode, gram macro goals, macro quick-add, export). Gym Log principle 3 forbids it.
2. **Retroactive edits** (Cronometer recipe save prompt rewrites history; deleting a custom food removes it from past
   days). Snapshots + archive instead of delete.
3. **Duplicate-ridden crowd data** (MFP). Keep the bundled set curated and small.
4. **Removing item-level copy / adding taps in a redesign** (MFP April 2026).
5. **Missing = zero** (silent under-count in calories-only crowd entries, JMIR 2020). Use nullable nutrient columns.
6. **No offline mode** (all four). Gym Log's main differentiator.
7. **Limited units** (MFP: only the units the creator entered). Grams always available because storage is per 100 g.
8. **Overwhelming configuration** (MacroFactor's 4,608 timeline combinations; Cronometer's dense UI). Ship fixed,
   good defaults.
