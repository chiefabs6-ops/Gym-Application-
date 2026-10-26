# UX workflows and interaction patterns

[← Research index](README.md) · Details: [app-analysis.md](app-analysis.md) (section E of each app) ·
Recommended design: [proposed-tracking-experience.md](proposed-tracking-experience.md)

**Important:** no app was installed. These flows are rebuilt from help centres, release notes, store listings and
reviews, as of 2026-10-25. Screen names and button labels are the vendors' own where the docs give them. Where a step
isn't documented, the cell says so; nothing is filled in from assumption. Labels: **V** = Verified (primary source),
**S** = Supported (secondary or consistent reports), **U** = Unverified / undocumented. Per-claim source links are in the
[app analyses](app-analysis.md) and [evidence-and-sources.md](evidence-and-sources.md).

Each flow uses the 7-step format: (1) starting screen, (2) user action, (3) next screen, (4) data requested,
(5) system response, (6) confirm / save, (7) resulting diary and totals update.

---

## 1. The main diary screen (layout, top to bottom)

| App | Layout | Label |
|---|---|---|
| **MyFitnessPal** ("Today" tab since April 2026) | Week/date strip → calories consumed/remaining card → macro card (swipe views; free = % only) → Meals header with *View all* → meal sections (name, ⋯ menu, **Log** button, items; swipe right below a meal name to repeat the last one) → Complete Diary → Healthy Habits → note. Bottom nav: Today, Progress, **+**, Plans, Coach. | V |
| **Cronometer** | Date bar → Energy Summary (Consumed / Burned / Target-or-Balance circles) → macro bars (Consumed↔Remaining toggle) → diary groups with entries (food, amount, kcal), with exercise/biometric/notes mixed in → Nutrient Target Summary. Floating **+** menu (customisable); ⋮ menu: Copy / Paste / Multi-Select / Mark Complete. | V (snippet) / S |
| **Lose It!** | Daily budget header (since late 2025, ~3 nutrient slots) → meal sections each with **Add** → "Add Yesterday's [Meal]" shortcut; planned (future) items greyed with a clock icon. | V (excerpt) / S |
| **MacroFactor** | Week calendar banner (intake vs target per day, never red/orange) → kcal/macro bars (swipe Consumed↔Remaining) → **hourly timeline** rows, each with "+", optional per-hour macro summary and food tiles → bottom "+" quick actions; ⋯ menu → Nutrition Overview, copy day. | V |

**Patterns:** summary on top, entries below, an add action next to each meal (or hour). MFP, Cronometer and MacroFactor
all let the user toggle Consumed↔Remaining.

---

## 2. Add a food by search

| Step | MyFitnessPal | Cronometer | Lose It! | MacroFactor |
|---|---|---|---|---|
| 1 Start | Today → meal's **Log** (or global **+** then pick meal) | Diary → **+** → Add Food | Log → **Add** under a meal | **+** / widget / hour "+" → logger, Search tab |
| 2 Action | Type; History list shown first, filtered to this meal; "Suggested Searches" as you type | Type; tabs All / Favorites / Common / Supplements / Brands / Restaurants / Custom; sort, filter, Multi-Add options | Search tab shows "foods you often eat during the mealtime you pick" before typing; type | Before typing: Favourites → hourly go-tos → Latest. Type: sections History / Custom / Common / Branded |
| 3 Next | Results; each row has **+** (Quick Log) and a green check if verified | Results with **source** label per row | Results with green checks; verified-only filter | Results; each tile has **+** (multi-add to Plate) |
| 4 Data | None for Quick Log (default portion); otherwise serving + number of servings + meal | Amount + unit + group | Serving unit + quantity | None for "+" (last-used serving); otherwise unit + quantity |
| 5 Response | Toast; stays on search for more | Nutrient preview updates live with amount | Nutrition updates as serving changes | Food icon appears under target bars; Plate/Day totals |
| 6 Save | Quick Log is immediate; detail → Log (iOS) / ✓ (Android) | Add | Add (iOS) / Save (Android) → Done | **Add** (stage) or **Log Foods** (commit Plate) |
| 7 Result | Entry in meal; card totals update | Entry in group; energy/macro/nutrient summaries recompute | Entry under meal; budget/remaining update | Tiles appear at the hour; bars update |
| Label | V | V / V (snippet) | V (excerpt) | V |

**Friction found:** Cronometer rows did not show kcal (2021 complaint), and foods never eaten rank above eaten ones;
MFP's ads overlap search controls on free; MFP's 2026 redesign added taps (S); Lose It! "large panel of redundant
buttons" on add (S, Play review).

**Fastest pattern:** history-first list, filtered to the meal or hour, plus a one-tap "+" that logs at the last-used
serving and keeps search open (MFP Quick Log, MacroFactor multi-add).

---

## 3. Food detail and portion selection

| App | What the screen holds | Units | Label |
|---|---|---|---|
| MyFitnessPal | Serving size (unit picker), number of servings (decimals; fractions in some versions), meal; Premium chips: Timestamp, Add to Multiple Days (≤7); nutrient summary g/%; full nutrition; **Report Food** | **Only the units the entry's creator added**; no general g↔oz↔cup conversion | V |
| Cronometer | Amount, unit dropdown, group, optional time [G], full nutrient panel with % of targets updating live, favourite star, source(s) + magic-wand icon if gap-filled | g, oz, household measures, label serving; extra units need a gram weight; no fractions (2021) | S (layout), V (units) |
| Lose It! | Serving unit + quantity; **swipe to adjust serving with nutrition updating in real time** (CSPI 2024) | Unit picker; grams on most foods (single user claim) | V (CSPI) / U |
| MacroFactor | Name, kcal, macros, unit selector (2 favourite weight + 2 favourite volume units first), quantity, **kcal/macro switcher** (enter 400 kcal → grams computed), Add / Log Foods, **To Custom** (editable copy), full nutrition | g, lb, oz, ml, cup, fl oz, tsp, tbsp derived where possible | V |

**Takeaways:** a live preview is universal. Gram entry should always be possible; MFP's entry-dependent units are a
documented weakness. "Log by calories" (MacroFactor) and favourite units are cheap wins.

---

## 4. Barcode scan, including the missing-product path

| Step | MyFitnessPal [P] | Cronometer (free) | Lose It! [LP] | MacroFactor |
|---|---|---|---|---|
| 1 Start | + → Barcode Scan, or Log → "Scan a Barcode" | + → Scan Food | Log → Add Food → Scan It | Logger → Scan tab (or widget / app-icon shortcut) |
| 2 Action | Grant camera; frame the barcode | Point camera (any angle); fallback **Type Barcode** | Point camera | Centre barcode |
| 3 Match | Food detail opens (same portion screen) | Food detail | Food opens | Food detail |
| 3' Wrong match | **Find a better match** → search → pick; **re-links the barcode for everyone** | U | U | To Custom → link own barcode |
| 3'' Not found | **Create a Food** → enter label nutrition → becomes a **public** food linked to the barcode (can't delete) | **Create New** → photograph label + front (+ ingredients) → AI pre-fills custom food → complete → log now; submit for curation optional | No documented prompt; create a custom food, optionally with label **Autofill** [LP] | **Automatically switches to the label scanner** → live mock label fills → Done → custom-food wizard pre-filled **with the barcode** → name → log; future scans return it; optional OFF submission |
| 4 Data | Serving + servings + meal | Serving size | Serving + quantity | Serving + quantity |
| 6 Save | Log / ✓ | Add | Add / Save | Add / Log Foods |
| Label | V | V | V (excerpt) / U | V |

**Best pattern:** MacroFactor/Cronometer, where a miss never dead-ends and the barcode is kept so the next scan
succeeds. **Pattern to avoid:** MFP's global re-linking by any user, which spreads errors.

---

## 5. Create a custom food

| Step | MyFitnessPal | Cronometer | Lose It! | MacroFactor |
|---|---|---|---|---|
| 1 Start | Log → My Foods → **+ Create a Food** | Foods → Custom Foods → Add Food | Profile → Custom Foods → **+** (web: Settings → Custom Foods → New) | + → New Food, Library → +, failed scan, or **To Custom** |
| 4 Data | Step 1: name, brand, servings. Step 2: nutrition facts (field list undocumented) | Label type (US/CA vs EU/AU; defaults to the last used) → name → serving as printed → nutrients; extra servings need gram weights | Name, serving, nutrients; optional camera **Autofill** [LP], live on-device OCR <1 s | **General:** scratch or Import with AI; icon, name, brand, barcode. **Serving:** basis Serving / 100 g / 100 ml. **Nutrition:** entry order US label / non-US label / app order; kJ↔kcal, salt↔sodium, IU↔mcg toggles; "leave blanks where labels don't list them" |
| 6 Save | ✓ / Save | Save; log now or submit for review | Save | **Create** or **Create & Add** (straight onto Plate) |
| 7 Result | In My Foods + own searches; private by default; edits not retroactive | In Custom tab; Delete removes from history, **Retire** keeps it | In My Foods | In Library; edits never change past entries |
| Label | V | V (snippet) | V (excerpt) | V |

**Takeaways:** a per-100 g / per-serving choice, label-order fields, unit toggles and blanks (not zeros) are the
quality features. "Create & Add" removes a step.

---

## 6. Saved meals and recipes

| App | Saved meal | Recipe | Label |
|---|---|---|---|
| MyFitnessPal | My Meals: name, photo, items → Save. Logs as **separate individual entries** (meal name not shown in diary). Website "Remember meal" from a diary slot. | Web URL import (English), manual, bulk paste with auto-match (green check / red X). Nutrition = sum ÷ servings. **No yield / cooked weight**, no nested recipes. | V |
| Cronometer | Custom Meals: a simple recipe, no serving count or cooked weight; can't log half a meal. Create from multi-selected diary entries. | Servings- or weight-based, **cooked weight** as a serving option, Recipe Importer [G] with unmatched-ingredient flags, **Explode** to ingredients. Saving the original may prompt to **update past entries** (no undo); "Edit a Copy" avoids it. | V / S |
| Lose It! | Meals tab: past meals (few weeks) with **per-item checkboxes**; "Add Yesterday's [Meal]". | Name → **Total Recipe Size** → ingredients in full amounts → **Portion Size** → Done; per-serving maths automatic; URL/Text importer [LP]. | V (excerpt) |
| MacroFactor | No meal object: save the group as a recipe, **explode** when logging to swap items. | Name, servings, ingredients, steps; **Total Weight** (cooked; raw sum shown in grey, not auto-filled since v5.2.2 because cooking loses 5–50% water); **Serving Quantity** for count portions; import from link / photo; selected timeline foods → new recipe. | V |

---

## 7. Copy / repeat previous meals

| App | Mechanism | Label |
|---|---|---|
| MyFitnessPal | Meal ⋯ → copy a previous meal in, or copy this meal to another meal/date. **Meal-level only** since the redesign (item and whole-day copy removed; a top complaint). Swipe right below a meal name to bring forward the last foods logged under that meal (accidental triggers reported). | V / S |
| Cronometer | ⋮ → Copy Current/Previous Day; Multi-Select → Copy; single entry swipe → Copy; Paste on target date; **Copy to Today**; **Copy Yesterday's Group**. Repeat Items [G] shown as a **confirm banner**, never auto-logged. | V (snippet) |
| Lose It! | Meals tab past meals with item checkboxes; "Add Yesterday's [Meal]". No whole-day copy documented. | V (excerpt) / U |
| MacroFactor | Select foods (selection persists across days), hour or day → Copy → paste: hour clipboard, To Now, To Today, To Tomorrow, Paste Inline, Multi-paste, Date & Time, **To Dates** (multi-date calendar). **Copy Mode** turns each hour's "+" into Paste. | V |

---

## 8. Correct an existing entry (edit / move / delete)

| App | Edit | Delete | Move / reorder | Label |
|---|---|---|---|---|
| MyFitnessPal | Tap → change serving / servings → save | iOS swipe left; Android long-press | View Diary → Edit → drag to another meal; order complaints | V / S |
| Cronometer | Tap → amount/unit → save | Swipe → delete with **Undo** (since 4.3.0) | Drag within/between groups (no auto-scroll on mobile) | V / S |
| Lose It! | Tap → edit | Swipe (older reviews) | Undocumented | S / U |
| MacroFactor | Tap tile → Edit (or one-tap edit icon) | Selection mode → Remove | Selection → Move; change time to reorder | V |

---

## 9. Daily nutrition summary

| App | Where | Content | Label |
|---|---|---|---|
| MyFitnessPal | Tap Calories card / Macros card / Nutrients tab; Progress tab weekly | Pie by meal; macro pie (calorie share, always 100%); nutrient total/goal/left; Food Lists [P] | V |
| Cronometer | Nutrient Target Summary under the diary; Nutrition Report (7 days free, any range [G]) | Grouped bars (General, Carbs, Lipids, Protein, Vitamins, Minerals) with % of target; blank/N/T where data is missing | V (snippet) / S |
| Lose It! | Log header; deeper summary behind a calendar since the redesign | ~3 nutrients visible; weekly summary removed (users) | S |
| MacroFactor | ⋯ → Nutrition Overview, or tap the timeline bar | Day totals and week–year averages, top 3 contributors; Nutrient Explorer (floor/target/ceiling, pin 8, contributors) | V |

---

## Interaction patterns that make repeat logging fast

1. **Meal context set before search** (MFP per-meal Log, Lose It! Add under meal, MacroFactor hour "+").
2. **History before typing**, scoped to the meal or time of day (Lose It! mealtime suggestions, MacroFactor hourly
   go-tos, MFP meal-filtered history).
3. **One-tap "+" on a result at the last-used serving**, search stays open (MFP Quick Log, MacroFactor multi-add).
4. **Repeat yesterday's meal** in one gesture (Lose It! "Add Yesterday's [Meal]", MFP swipe, Cronometer Copy
   Yesterday's Group).
5. **Pick items from a past meal** with checkboxes (Lose It!) or multi-select copy (Cronometer, MacroFactor).
6. **Stage then commit** (MacroFactor Plate) for multi-food meals.
7. **Create & Add** from the custom-food form (MacroFactor).
8. **Undo instead of confirm** on delete (Cronometer).
9. **Shortcuts outside the app** (MacroFactor widgets, app-icon long-press).

## Friction and simplification opportunities

| Friction (where) | Simplification for Gym Log |
|---|---|
| Paywalled scanner / macros (MFP, Lose It!) | Everything core is free (Gym Log principle 3). |
| Entry-dependent units (MFP) | Store per 100 g, so grams always work. |
| Retroactive recipe edits with no undo (Cronometer) | Snapshot nutrients on entries; never ask. |
| Meal-level-only copy (MFP 2026) | Keep item, meal and day copy. |
| Calories-only crowd entries, silent zeros (MFP, Lose It!) | Nullable nutrients, "incomplete" marker. |
| Search needs a network (all) | Bundled curated foods + local user foods. |
| Too many options (MacroFactor's 4,608 timeline combinations; Cronometer's dense UI) | Few, fixed, good defaults. |
| Redundant add-food button panel (Lose It!), more taps after redesign (MFP) | One search screen with Quick add / Create / (later) Scan as compact actions. |
