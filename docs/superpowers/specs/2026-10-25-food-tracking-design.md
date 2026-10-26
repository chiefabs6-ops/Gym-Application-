# Food tracking, bodyweight & targets — design

Date: 2026-10-25 · Status: draft for review

Background research: [`docs/food-tracking-research/`](../../food-tracking-research/README.md) (competitor teardowns of
MyFitnessPal, Cronometer, Lose It!, MacroFactor; data sources; codebase integration notes).
Mockups the user reviewed and chose from: `.superpowers/brainstorm/719-1792969276/content/` (`navigation.html` → C,
`diary-layout-v2.html`, `meal-tabs.html` → B, `add-food.html` → portion A, `barcode-found.html` → A,
`weight-location.html` → C).

Every decision below marked **(user)** was made by the user in conversation. Items marked **(designer's call)** were
not discussed and can be overridden. Everything else is left to the builder (section 11).

---

## 1. Intent

The user already logs training in Gym Log and wants to log food in the same app instead of a separate one. The model
is **MyFitnessPal's diary**: pick a food, and its calories, macros and serving appear without filling in a form.

A typical day (user's own description):
- **7:30** logs eggs on toast + coffee in **under 30 seconds**; coffee is one tap because it was logged before.
- **12:45** logs chicken, rice, broccoli; wants to save that lunch and log it all at once next time.
- **15:30** glances at calories eaten, calories left, and protein so far. No analytics dashboard.
- **19:00** logs dinner, adjusts portions, sees totals update immediately; reuses a weekly recipe.
- **21:00** checks calories, protein, carbs, fat; fixes entries easily; **must not feel punished** for missing a
  target; wants to reuse today's breakfast or lunch tomorrow.

**Success:** the day above works end to end on the phone. Breakfast of known foods takes under 30 seconds; a saved
meal or leftover is one or two taps; the daily summary answers "how am I doing today?" at a glance.

## 2. Goals, non-goals, anti-goals

**Goals**
- Food diary with four meals, daily calorie/macro targets, and protein visible everywhere.
- Fast logging: recent and frequent foods first, saved meals, recipe leftovers, barcode scanning.
- Accurate food data: a built-in everyday-foods list plus Open Food Facts online.
- Missing products handled by photographing the nutrition label (on-device reading) with a confirmation page.
- Targets calculated from body details and a goal, kept up to date as weight changes.
- Bodyweight log with history.

**Non-goals (this version)**
- Any link between food and training **(user)**: no exercise calories added to targets, no food on workout screens.
- Nutrients beyond calories/protein/carbs/fat on screen **(user)** (they are stored, see 6.3).
- Renaming or adding meals **(user)**; body measurements other than weight **(user)**; kJ display **(user)**.
- Sharing foods back to Open Food Facts **(user)**.
- AI photo-of-plate logging, voice logging, recipe import from URLs, accounts, sync.

**Anti-goals (failure even if it technically works)**
- Logging that feels slower than MyFitnessPal for repeat meals.
- Duplicate-ridden search results (the MyFitnessPal problem).
- Editing a food or recipe silently changing past days.
- Nagging or blocking feedback for being over or under target (over-target numbers are shown in red, user, but
  nothing else happens).

## 3. Constraints

- **Scope change to the offline-only rule (user):** food search and barcode lookup may use the internet (Open Food
  Facts). Everything else stays offline: the built-in list, your foods, the diary, targets, weight. Anything fetched
  online is saved on the phone and works offline afterwards. `CLAUDE.md` "Current scope" and the ROADMAP must be
  updated to say so. Server/sync work is still deferred (Phase 8).
- Plan of record: add a ROADMAP item for food tracking + bodyweight (absorbs the weight part of item 3.5) and §6
  data-model rows, per the ROADMAP "How to use" rules. **It goes to the front of the roadmap (user)**, ahead of the
  still-open items 2.12, 2.14 and Phase 3.
- Architecture rules in `CLAUDE.md` apply in full: one data contract in `packages/shared/src/tables.ts`, all
  synced-table writes through `apps/mobile/src/db/mutate.ts` (full row snapshots, tombstones, every query filters
  `deleted_at IS NULL`), append-only migrations (next is v7), Prisma schema updated as text so typecheck passes, kg
  stored internally and converted with `useUnits()`.
- Design system: tokens in `tailwind.config.js` + `src/theme.ts` (add macro colours to both), bottom sheets, no
  `Alert.alert`, 16px cards.
- New native pieces need a prebuild and a release-APK check (`docs/release-apk.md`): camera permission (keep
  `RECORD_AUDIO` blocked), on-device text recognition for labels.
- Licences: UK CoFID (Open Government Licence v3) and USDA FoodData Central (public domain) attribution, and Open
  Food Facts (ODbL) attribution, shown in Settings next to the existing RepDB credit. Open Food Facts data is kept in
  separate rows from the user's own foods.
- Open Food Facts API rules: custom User-Agent, ~15 product reads/min, ~10 searches/min, no search-on-every-keystroke.

## 4. Navigation (user)

- Bottom tabs become **Workout · History · Routines · Food · Settings**. Food takes the Analytics tab's place.
- **History** gets a switch at the top: **Workouts | Stats | Body**. *Stats* is the existing Analytics screen,
  with four nutrition charts added (section 8.5). *Body* is new (section 8).

## 5. Food tab

### 5.1 Diary screen (user: layout A + protein, meal tab row B)

Top to bottom:
1. **Date row** `‹ Today ›`, tap date for a picker. Past and future days can be viewed and edited.
2. **Summary card**: "Calories remaining" as **Goal − Food = Left** (kcal), then three bars **Protein / Carbs / Fat**
   showing `eaten / target g`.
3. **Meal tab row**: **Breakfast · Lunch · Dinner · Snacks**, each tab showing its kcal. Only the selected meal's list
   is shown. On opening the Food tab, the **last meal tab used** is selected (user).
4. **Selected meal**: header with meal kcal and **protein**; food rows showing name, **amount · protein**, and kcal on
   the right; **+ Add food** at the bottom.

Over-target numbers are shown in **red** (user).

### 5.2 Add food (search) — user approved the mockup

Opened from **+ Add food** in a meal (that meal is preselected; a meal chip at the top can change it).
- Top actions: **Scan barcode · Quick add · Create food**.
- **Before typing:** *Recent* foods for this meal, *Saved meals*, *Leftovers* (section 7.3), *Frequent*. Each row shows
  amount · kcal · protein and a **+** button.
- **+** logs the food immediately at the amount used last time and shows an **Undo** toast; the search stays open for
  the next item (designer's call, accepted in playback).
- **Typing:** your foods and the built-in list filter instantly. Open Food Facts results load **when the user presses
  search or after a 1-second pause** (user).
- Tapping a row opens the portion screen.

### 5.3 Portion screen (user: MyFitnessPal style)

Food name; large kcal with P / C / F; **Serving size** dropdown (named servings such as "1 large egg (50 g)", plus g,
and oz when imperial); **Number of servings** (decimals); **Meal** dropdown; button **Add to [meal]**. Values update
live as the amount changes. The same screen, in edit mode, is used when tapping an existing diary row (change amount,
serving, meal, or delete).

### 5.4 Quick add (user)

**Calories (required), protein (required), name (optional)**, into the selected meal. Not saved as a reusable food.

### 5.5 Copy and reuse (user)

From a meal: copy the **whole meal** to another day/meal, or **pick items** to copy.

### 5.5a Save a meal (user: option A)

From a logged meal's ⋯ menu: **Save as meal** → name it, untick any foods not wanted → **Save meal**. There is no
"build a meal from scratch" screen.

### 5.5b My foods (user)

Reached from the **Food tab** (a "My foods" button at the top right; exact placement is the builder's). Tabs
**Foods · Meals · Recipes** for viewing, editing and deleting your own foods, saved meals and recipes. Creating a
recipe also starts here (**Recipes → + New recipe**, designer's call).

### 5.6 Corrections (user)

- Tap a row to edit it (5.3). Totals update immediately.
- **Delete asks "Are you sure?"** (a bottom-sheet confirm, like the rest of the app).

### 5.7 Late-night logging (user)

Between **12:00 AM and 3:00 AM**, opening the Food tab asks **once**: add to *yesterday* or *today*? That choice applies
to everything logged during that visit.

## 6. Food data

### 6.1 Sources (user)

1. **Built-in everyday foods**, available offline, merged from two datasets by a one-off build script:
   - **UK CoFID** is the main source.
   - **USDA FoodData Central** fills in foods CoFID doesn't have.
   - Duplicates removed so each food appears once; carbohydrates normalised to the same basis (USDA carbs include
     fibre, CoFID's don't).
   - Ships with the app (estimated 1–2 MB); loaded into the database on first launch and when the list version
     changes, not every launch.
2. **Open Food Facts** online, for branded/packaged foods and barcodes.
3. **Your foods**: ones you create, scan, or fetch from Open Food Facts. Saved on the phone permanently, private.

### 6.2 Barcode scanning (user)

1. Scan (retail barcodes: EAN-13, EAN-8, UPC-A, UPC-E).
2. Found on the phone already → portion screen.
3. Found on Open Food Facts → **check page, first scan only** (name, brand, values per 100 g, pack serving, all
   editable; **Looks right**) → saved on the phone → portion screen. Later scans of that barcode go straight to the
   portion screen.
4. Not found (or offline) → **label photo** flow (6.4). Quick add and name search remain available.

### 6.3 What is stored per food

Calories, protein, carbs, fat per 100 g (or 100 ml), named servings in grams, optional barcode and brand, source.
**Fibre, sugar, saturated fat and salt are stored when available but not shown (user)**, so they can be shown later
without rescanning. Unknown values are stored as unknown, not zero.

### 6.4 Label photo for missing products (user)

- Take a photo of the **nutrition table** (not the ingredients list). Text is read **on the phone, free, offline**
  (e.g. Google ML Kit text recognition).
- A **confirmation page** opens pre-filled: name (typed by the user), values per 100 g, serving size. Every value can
  be fixed before saving.
- If the label shows only kJ, it is converted to kcal. Salt/sodium handled per EU labels (salt = sodium × 2.5).
- Saved as a **private** food that keeps the scanned barcode, so the next scan finds it. Not shared to Open Food
  Facts (user).

## 7. Saved meals and recipes (in the first version — user)

### 7.1 Saved meals

A named group of foods with amounts. Logging one adds its foods as **separate diary rows** that can each be adjusted
(user). Appears in the add-food quick options.

### 7.2 Recipes (user: cooked weight)

- A recipe is a saved list of raw ingredients with amounts.
- Calories and macros per gram are calculated from the ingredients and the **cooked weight** of the finished dish.
- **The first time a recipe is added to a meal** (each time it's cooked), the app asks **"One-off or batch?"** (user).
  - **One-off:** enter the cooked weight and the grams eaten; logged once, nothing is tracked afterwards.
  - **Batch:** enter the cooked weight; it becomes a batch (7.3) and the first portion is logged from it.

### 7.3 Batches and leftovers (user)

- A batch is started by choosing **Batch** in 7.2 and entering its **cooked weight** (e.g. 500 g).
- While a batch has food left, it appears in the add-food quick options as e.g. **"Chilli · 250 g left · 52 g
  protein"**.
- Tapping it opens the portion screen with the **remaining weight pre-filled**; logging reduces what's left.
- **Logging more than what's left is blocked** with a message, e.g. "Only 250 g left in this batch" (user).
- **Editing or deleting a diary row that came from a batch puts that amount back** into the batch (user).
- At **0 g** the batch is finished and disappears from the quick options.
- A batch can also be **marked finished by hand** (binned / given away) by **long-pressing its leftover row** on the
  add-food screen (user); it then disappears from the quick options.

### 7.4 History never changes (user)

Editing a food, saved meal or recipe affects **future** logs only. Past diary days stay exactly as logged.

## 8. Body and targets

### 8.1 Body screen (History → Body) (user)

- Current weight, a trend line, and a list of weigh-ins; **+ Log weight**. **Weight only** for now.
- Body details: height, **date of birth** (age is worked out from it, user), sex (**male or female only**, user),
  activity level. Goal: **lose / maintain / gain**, with weekly rate:
  **lose 0.25, 0.5, 0.75, 1 kg/week; gain 0.25, 0.5 kg/week** (user).

### 8.2 Calculating targets (user)

- Maintenance = **Mifflin-St Jeor × activity factor**; shown with the formula and result.
- Daily calories = maintenance − (lose) / + (gain) the weekly rate (≈ 7,700 kcal per kg, so 0.5 kg/week ≈ 550 kcal/day;
  exact constant is the builder's choice).
- **Protein = 2.0 g per kg bodyweight**, **fat = 25% of calories**, **carbs = the rest** (user defaults).
- **Minimum calories: 1,200 kcal (women) / 1,500 kcal (men)**, applied to calculated **and hand-edited** targets (user).
- All targets can be edited by hand (user).
- **Macros always add up to the calorie target** (protein × 4 + carbs × 4 + fat × 9 = calories) (user):
  - Editing **only calories** recalculates protein (2 g/kg), fat (25%) and carbs (the rest) from the new calories (user).
  - Editing **one macro** by hand keeps the total equal to calories; the other, non-edited macros adjust to make room
    (user: "still add up to my calories"; which macro absorbs the change first is the builder's choice, carbs first is
    the obvious default).
  - **If protein at 2 g/kg plus 25% fat leaves nothing for carbs** (likely near the minimum), **fat drops to 12.5% of
    calories** and carbs get what that frees (user: "split the 25% in half"; designer's reading, see section 12).

### 8.3 Keeping targets up to date (user)

- Logging a new weight **automatically recalculates every target the user has not edited by hand**.
- Hand-edited targets are kept. **Once a month, if weight has changed**, a bottom sheet asks whether to recalculate
  **every hand-edited target** (calories, protein, carbs, fat).
- **Past days are compared against the targets in effect on that day**, not today's.

### 8.4 First run

Before body details exist, the diary still works; the summary card shows a prompt to set up targets (designer's call;
logging is never blocked).

### 8.5 Nutrition charts in Stats (user: all four)

Added to the existing Stats screen (mockup `nutrition-charts.html`), all from logged data:
1. **Calories per day this week:** a bar per day against the target line (that day's target); over-target days red;
   today shown as "so far".
2. **Protein per day this week:** same layout against the protein target, with "hit target on X of Y days".
3. **Weekly averages:** average calories, protein, carbs, fat over the last 7 days against targets, as numbers with
   small bars. Averages count logged days only.
4. **Weight vs calories:** weekly weight trend line over average daily calories per week, last 8 weeks.

## 9. Units (user)

Food amounts and bodyweight follow the existing **metric/imperial** setting (g/kg or oz/lb). Energy is **kcal only**.
Stored internally as grams, kg and kcal.

## 10. Backup (user)

- Food logs, foods, saved meals, recipes, batches, weigh-ins and targets are included in the existing backup/restore.
- **Forward-compatibility warning:** from this release on, restoring a backup that contains data this version doesn't
  understand loads what it can and tells the user, e.g. "Some data (food logs) was skipped because this backup is from
  a newer app version. Update the app to restore it." The version on the phone today will still skip silently (accepted).

## 11. Left to the builder

- Table layout and names, which tables are synced vs local reference data, indexes, migration v7 contents, Prisma text
  edits, backup schema changes (within the `CLAUDE.md` rules).
- How snapshots are stored so past days never change; how per-day targets are recorded.
- Dataset build script, matching/dedupe method between CoFID and USDA, choice of nutrients and servings to ship, list
  versioning.
- Search ranking and matching; how online and local results are merged on screen.
- Camera/barcode library (expo-camera supports these barcodes in SDK 54) and text-recognition library; label parsing.
- Open Food Facts client details (User-Agent, timeouts, rate limiting, normalising to per 100 g).
- Toast/undo component, macro colour tokens, empty states, exact copy text.
- How Stats sits inside History (moving the existing screen behind the switch); where the four nutrition charts sit
  on it; chart drawing (no chart library exists; `react-native-svg` is installed).
- Tests: maths (Mifflin-St Jeor, rate deficit, macro split, minimums, unit conversion, per-gram recipe maths, batch
  remaining), migration test bump, backup round-trip, day-boundary logic.

## 12. Designer's calls to check

1. ~~Amber~~ → user chose **red** for over-target numbers.
2. **+** on a search row logs instantly with an Undo toast (deleting from the diary still asks "Are you sure?").
3. ~~No charts~~ → user chose all four nutrition charts (8.5).
4. `CLAUDE.md` offline-only rule changes for food lookup only.
5. First run: diary usable before targets are set; summary card prompts setup.
6. Reading of "split the 25% in half": fat drops to 12.5% of calories when carbs would otherwise be 0.
7. ~~No manual finish~~ → user added a manual **finished** button for batches.
8. Recipes are created from My foods → Recipes → + New recipe.
