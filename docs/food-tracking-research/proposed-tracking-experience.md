# Proposed food-tracking experience for Gym Log

[← Research index](README.md) · Based on: [product-recommendations.md](product-recommendations.md) ·
[ux-workflows.md](ux-workflows.md) · Fit: [codebase-integration.md](codebase-integration.md)

This is a product spec for later implementation tasks. It assumes the
[six decisions](product-recommendations.md#the-six-product-decisions-to-make-first) are taken as recommended:
offline bundled foods + user foods, per-100 g storage, snapshot history, meal slots with a hidden time, free quick add,
curated data. Engineering assumptions are marked **[assumption]**. The stack is the one already in the repo (Expo/RN,
expo-sqlite, `mutate.ts`, NativeWind tokens, bottom sheets); see [codebase-integration.md](codebase-integration.md).
MVP items are tagged **(MVP)**, later items **(P2)** = Phase 2.

---

## 0. Shared rules (apply to every workflow)

### Data and calculations
- **Food nutrients** are stored per 100 g (or per 100 ml for liquids): `kcal`, `protein_g`, `carbs_g`, `fat_g`, and
  optional `fibre_g`, `sugars_g`, `sat_fat_g`, `sodium_mg`. Optional ones are **nullable**: `null` = unknown,
  `0` = known zero (Cronometer's blank-not-zero).
- **Servings** are named gram weights: `{label: "1 slice", grams: 36}`. Grams (and ml for liquids) are always offered.
- **Entry nutrients** = food per-100 g × `grams` / 100, computed when the entry is logged and **stored on the entry**
  (snapshot). Daily total = `SUM` over entries where `local_date = D AND deleted_at IS NULL`.
- **Rounding:** store full precision; display kcal as whole numbers, macros to 1 decimal under 10 g, otherwise whole
  numbers. Totals are summed from unrounded values, so meal subtotals may differ from the day total by ±1 (accepted;
  every app has this).
- **Day key:** `local_date` (`YYYY-MM-DD`) computed on the device when the entry is logged, plus `eaten_at` epoch ms.
  A food never changes day after travel or a DST change. **[assumption]** a later "day starts at 03:00" preference.
- **Units:** grams/kcal internally. Show oz when `unit_system` is imperial (1 oz = 28.3495 g). Optional kJ display
  (1 kcal = 4.184 kJ) **(P2)**.
- **Missing data:** if any entry in a day has `null` for a nutrient, that nutrient's day total shows "≥ value" with
  an "incomplete" dot. Calories are always present, because creating a food requires energy. Protein, carbs and fat
  may be unknown on a custom food (see §8); the same "≥" marker then applies to the macro totals.

### Feedback
- No `Alert.alert`; confirmations are bottom sheets; destructive actions use an **Undo toast** (5 s) instead of a confirm
  sheet. **[assumption]** a new toast component (none exists today).
- Haptic tick on log (the app already uses `expo-haptics`).
- Over-target values show in a neutral or amber colour, never red (MacroFactor's non-judgemental approach).

---

## 1. Opening today's food diary (MVP)

**Entry point:** a **Food** tab (icon `Apple` or `Utensils` from lucide). **[assumption]** a 6th tab, or replacing one;
this is a navigation decision for the user.

**Layout, top to bottom:**
1. **Date header:** `‹  Today, Sat 25 Oct  ›`. Tap the date for a calendar picker; swipe left/right on the header to
   change day. A "Today" chip appears when viewing another day.
2. **Summary card:** large `1,240 / 2,400 kcal`; tap toggles to `1,160 kcal left` (Consumed ↔ Remaining, remembered
   per user). Three bars: Protein / Carbs / Fat, each `g eaten / g goal`.
3. **Meal sections:** Breakfast, Lunch, Dinner, Snacks (names from settings). Header row: name, kcal subtotal,
   `+ Add`, `⋯`. Items: name, amount ("150 g" or "2 × slice"), kcal. Tapping an item edits it (§11).
4. **Footer:** "Quick add" and "Copy yesterday" links. **(P2)** fibre/sugar/salt expandable panel.

**States:**
| State | What shows |
|---|---|
| First ever open, no goal | Summary card replaced by "Set a daily calorie goal" card → opens Goals sheet (§1a). Meals visible and usable. |
| Goal set, empty day | Summary shows `0 / 2,400`. Each empty meal shows a faint "Add breakfast" row (no zeros, like MFP's "empty meals stay empty"). If yesterday had entries: a one-line "Repeat yesterday's breakfast?" chip per meal. |
| Normal day | As above. |
| Future day | Allowed; entries are **planned** (shown dimmed with a clock icon, Lose It! pattern) until their day arrives. **(P2)** |

**1a. Goals sheet (MVP):** kcal (stepper, step 50), protein/carbs/fat in grams, with live "P/C/F = 30/40/30 % of
kcal". Optional "Help me estimate" → Mifflin-St Jeor (sex, age, height, weight, activity) shows the formula and result,
and the user accepts or edits it (principle 4). **Validation:** kcal 800–8000 **[assumption]**; warn (don't block)
when macro calories differ from the kcal goal by > 10%.
**Goal history:** a goal change applies from today forward; past days keep the goal they had (MFP). **[assumption]**
store goal changes as dated records in preferences, `[{from_date, kcal, p, c, f}]`.

---

## 2. Adding a food through search (MVP)

**Start:** tap `+ Add` on a meal (the meal is now fixed) or the global add button (meal defaults by time of day:
before 10:30 Breakfast, before 15:00 Lunch, before 21:00 Dinner, else Snacks **[assumption]**, changeable at the top).

**Search screen** (full-screen modal like `ExerciseSelector`):
- Top: meal chip (`Lunch ▾`), search field (autofocus only if the user has no history yet), and compact actions
  `Quick add` · `Create food` · **(P2)** `Scan`.
- **Before typing:** *Recent in Lunch* (last 14 days, this meal first, then all meals), then *Frequent*, then
  *Favourites*. Each row: name, last-used amount, kcal for that amount, and a **`+`** button.
- **While typing** (debounced ~150 ms, local SQL): sections *From history*, *My foods*, *Common foods*. Match is
  case- and accent-insensitive, matching any word prefix ("chick bre" → "Chicken breast, grilled"). Ranking: history
  hits first, ordered by count × recency; then my foods; then common foods by name-match quality, then length.
- **No results:** "No match for 'X'" with **Create 'X'** (pre-fills the name) and **Quick add**.

**Actions:**
- Tap **`+`** → logs immediately at the last-used serving (or the food's default serving), toast "Added Oats 60 g ·
  228 kcal · Undo", search stays open, row shows a ✓ for the session (MFP Quick Log / MacroFactor multi-add).
- Tap the **row** → Portion sheet (§3).
- Back/close → return to the diary, where new entries are visible.

**Errors:** a query of one character shows history only (avoids huge result lists).

---

## 3. Selecting a serving size and quantity (MVP)

**Portion sheet** (bottom sheet over search):
- Food name, source tag (`Common` / `My food`), and an "incomplete data" dot if a nutrient is unknown.
- **Quantity** field (decimal keyboard) + **unit** segmented row: `g` · named servings (`slice (36 g)`, `cup (240 ml)`)
  · `oz` (imperial only). Defaults to the last-used unit and amount for this food, else the food's default serving,
  else 100 g.
- **Quick chips:** ½, 1, 1½, 2 (for servings) or 50 / 100 / 150 / 200 (for grams).
- **Live preview:** kcal (large), P / C / F, and "→ 1,468 / 2,400 kcal today" (the effect on the day).
- **(P2)** switcher "Enter by kcal / protein": type 400 kcal → grams computed (MacroFactor).
- Buttons: **Add to Lunch** (primary), meal chip to change the meal.

**Validation:**
| Input | Rule |
|---|---|
| Quantity | > 0 and ≤ 5000 g (or the equivalent); accepts `,` or `.` decimals and `1/2`, `½`; otherwise inline error "Enter an amount" and disabled button |
| 0 | Disabled button, no error text until the user taps it |
| Unit change | Converts the displayed quantity to keep the same grams (150 g → 4.17 slices), rounded to 2 decimals |

**Calculation:** `grams = quantity × unit.grams`; entry nutrients = per-100 g × grams / 100; stored at full precision.

---

## 4. Adding the food to a meal (MVP)

On **Add**: one `write()` creates a `food_log_entries` row (id, user_id, food_id, meal, grams, serving_label,
quantity, eaten_at = now (or the selected day at the meal's default time), local_date, snapshot nutrients). Remember
last-used serving per food **[assumption: derived from the latest entry, no extra table]**. The sheet closes, a toast
appears, and the search stays open for the next item.

**Errors:** a write failure (zod validation in `mutate.ts`) → toast "Couldn't save. Try again". Nothing is shown as
logged until the write succeeds.

---

## 5. Seeing calories and macros update (MVP)

- The diary uses `useLiveQuery` on `food_log_entries` (and goals), so totals update when the modal closes, with no
  manual refresh.
- The meal subtotal and summary card animate the number change (≤300 ms) and briefly highlight the new row.
- Remaining can go negative: shows "180 kcal over" in amber.
- Macro bars cap visually at 100% with a small "+12 g" overflow label.

---

## 6. Adding multiple foods quickly (MVP + P2)

- **MVP:** repeated `+` taps in search (each logs immediately, each has its own Undo). Typical breakfast of 3 known
  foods = open (1) + 3 taps + close (1) = **5 taps**.
- **MVP:** "Repeat yesterday's [meal]" chip = **1 tap**, with Undo.
- **(P2) Plate mode:** long-press `+` or a "Select several" toggle turns `+` into "add to plate". A bottom bar shows
  "3 items · 520 kcal · Log". Plate items can be adjusted before logging. Commit = one `write()` with several entries.
  Leaving with an un-logged plate asks "Discard 3 items?" in a bottom sheet.

---

## 7. Reusing a previous meal (MVP copy; P2 saved meals)

**MVP: Copy.** Meal `⋯` menu:
- **Copy to…** → date picker (default today) + meal picker (default same meal) → copies all items as new entries
  (new ids, target `local_date`, same snapshots and grams).
- **Copy from yesterday** (one tap).
- **Select items** → checkboxes on each row (Lose It! style) → `Copy` / `Move` / `Delete` on the selected items.

**(P2) Saved meals:** `⋯` → **Save as meal** → name (default "Breakfast 25 Oct"). Saved meals appear in search under
*My meals* and in the pre-typing list. Logging one inserts **separate editable entries** (MFP), tagged with the meal
name in a subtle label. Editing a saved meal never changes past entries.

**Edge cases:** copying into a meal that already has the same food adds a second entry (no merge); duplicates are
visible and deletable. Copying to a future day creates **planned** entries **(P2)**.

---

## 8. Creating a custom food (MVP)

**Start:** search → `Create food`, or "Create 'X'" from no results. Opens a full-height bottom sheet, form only.

**Fields (EU label order):**
1. Name (required, ≤ 80 chars, pre-filled from the query), Brand (optional).
2. **Values are per:** `100 g` · `100 ml` · `Serving of [__] g` (segmented; default 100 g, because EU labels always have it).
3. Energy (required) with a `kcal | kJ` toggle. Fat, of which saturates, Carbohydrate, of which sugars, Fibre,
   Protein, Salt (with a `salt g | sodium mg` toggle).
4. Servings (optional, repeatable): label + grams, e.g. "1 bar" = 45 g.
5. Barcode (optional, hidden under "More"; **[assumption]** filled by the scanner in P2).

**Validation and conversion:**
| Rule | Behaviour |
|---|---|
| Name empty or energy empty | Save disabled; the field is highlighted on tap |
| Fat, carbs, protein empty | Allowed but treated as **unknown** (`null`), and the food shows "incomplete" |
| Any value < 0 | Inline error |
| Sub-values > parent (sugars > carbs, saturates > fat) | Inline error |
| Macros > 100 g per 100 g | Inline error |
| kJ entered | Stored as kcal = kJ ÷ 4.184 |
| Salt entered | Stored as sodium_mg = salt_g × 400 |
| Per-serving basis | Stored per 100 g = value × 100 ÷ serving_g; the serving is also saved as a named serving |
| Energy vs 4P + 4C + 9F (+2 × fibre) differs > 20% and > 15 kcal per 100 g | **Soft warning** "Energy doesn't match the macros. Check kJ vs kcal?", saving still allowed (labels round and use specific factors) |
| Duplicate name in My foods (case-insensitive) | Warning "You already have 'X'", with "Use existing" / "Save anyway" |

**Save:** **Save & add** (default when opened from logging: goes straight to the Portion sheet) or **Save**.
**Afterwards:** editing a custom food never changes past entries (snapshot). **Delete = archive**: hidden from search,
past entries intact (Cronometer's "Retire").

---

## 9. Creating a recipe (P2)

**Start:** search → `Create` → `Recipe`, or a meal's `⋯` → "Save as recipe" (pre-fills ingredients).

**Form:**
1. Name.
2. **Ingredients:** add via the same search + portion sheet (amount in raw grams). Each row shows grams and kcal; swipe to remove; drag to reorder.
3. **Yield**, as one of:
   - **Servings:** "Makes [4] servings" → log by servings.
   - **Cooked weight:** "Finished weight [__] g". The raw ingredient sum is shown in grey as a hint and is **not
     auto-filled**, because cooking loses 5–50% water (MacroFactor v5.2.2) → log by grams eaten.
4. Live totals: whole recipe and per serving / per 100 g.

**Calculations:** per-100 g of recipe = Σ ingredient nutrients ÷ (cooked weight or Σ raw grams) × 100. Per serving =
Σ ÷ servings. A recipe is stored as a food (`kind = recipe`) with its computed per-100 g values **plus** its ingredient
list, so search and logging treat it like any food.

**Validation:** ≥ 1 ingredient; servings ≥ 1 (decimals allowed); cooked weight > 0. Warn if cooked weight > raw sum
× 1.5 (water added?) but allow it.

**History:** changing ingredients, servings or cooked weight recomputes the recipe for **future** logs only. Past
entries keep their snapshots (MacroFactor, MFP). **Explode** on a logged recipe entry replaces it with its ingredient
entries scaled to the portion eaten, so one meal can be tweaked without touching the recipe.

**Excluded:** nested recipes, URL import, photo import.

---

## 10. Scanning a barcode, with the missing-product fallback (P2)

**Start:** search → `Scan`. First use asks for camera permission with a short explanation first. **Denied:** the
button shows "Camera access is off. Enable it in Settings, or type the barcode" with a manual-entry field.

**Flow:**
1. Camera view restricted to EAN-13, EAN-8, UPC-A, UPC-E (expo-camera SDK 54 supports these). Normalise UPC-A to
   13 digits. Vibrate on detection.
2. **Local lookup** (my foods + cached products by `barcode`):
   - **Found:** Portion sheet opens (§3). Done.
3. **Not found locally and online:** query Open Food Facts (custom User-Agent, ≤ 15 product reads/min). Show a
   spinner with "Looking up product…" and a 5 s timeout.
   - **Found with complete per-100 g energy + macros:** show a **review card** (name, brand, values per 100 g, source
     "Open Food Facts") → **Use** saves it locally as a cached food (`source = off`, kept separate from user foods) →
     Portion sheet. ODbL attribution on the card and in Settings.
   - **Found but incomplete:** open the custom-food form (§8) pre-filled with what exists + barcode; missing fields
     highlighted.
4. **Not found, or offline:** "Product not found" (or "You're offline") → **Create food** with the barcode pre-filled
   (§8). Next time this barcode resolves locally (MacroFactor / Cronometer pattern). Secondary: **Quick add** and
   **Search by name**.

**Errors:** an unreadable barcode after 10 s → hint "Try better light or type the number". OFF HTTP 429/503 → treated
as offline. Never block logging on the network.

**Excluded:** label OCR (Advanced), contributing to OFF (needs an account and a server).

---

## 11. Correcting an existing entry (MVP)

- **Tap an entry** → the Portion sheet in **edit mode**: quantity, unit, meal (move), and `Delete` at the bottom.
  **Save** recomputes the snapshot from the source food's **current** per-100 g values × new grams.
  **[assumption]** if the source food was edited since the entry was logged, editing the amount uses the *current*
  food values; the sheet shows "Food details changed since you logged this" so the change isn't silent. If the food was
  archived, the entry's own per-gram ratios are used.
- **Swipe left** → Delete → entry disappears, toast "Deleted · Undo" (tombstone; Undo clears `deleted_at`).
- **Quick add entries** edit their kcal/macros directly.
- **Long-press** → selection mode (copy / move / delete several).

**Validation:** same as §3. **Feedback:** totals update live (§5).

---

## 12. Navigating to and editing a previous day (MVP)

- **Navigate:** header arrows or swipe; tap the date for a month calendar where days with entries have a dot, and
  days at or near goal a filled dot **[assumption]**. "Today" chip to return.
- **Edit:** past days are fully editable (all apps allow it). Totals are compared against **that day's goal**
  (goal history, §1a).
- **Add to a past day:** `+ Add` on a past day logs with `local_date` = that day and `eaten_at` = that day at the meal's
  default time. The toast says "Added to Thu 23 Oct" so the date is never ambiguous.
- **(P2) Mark day complete / partial:** a toggle at the bottom of the day. Partial days are excluded from weekly
  averages (MacroFactor partial logging, Cronometer complete days).

**Edge cases:**
| Case | Behaviour |
|---|---|
| Logging just after midnight | Belongs to the new day unless the **[assumption]** day-start preference says otherwise |
| Timezone change | `local_date` is fixed at log time; entries never move |
| Viewing a day before any goal existed | Summary shows totals without "remaining" |
| Restoring a backup from an older app version | Food tables default to empty (`.default([])` in the backup schema); see [codebase §11.5](codebase-integration.md#115-risks-migrations-data-integrity-back-compat) |

---

## Error and empty-state catalogue

| Situation | Message / behaviour |
|---|---|
| No goal | "Set a daily calorie goal" card; logging still works |
| No history (first search) | Autofocus the search field; show "Common foods" suggestions (eggs, oats, chicken breast, rice, banana, milk) **[assumption]** |
| No search results | "Create 'X'" + "Quick add" |
| Offline | Nothing changes for MVP; barcode lookup (P2) says "You're offline — create the food instead" |
| Write failed | "Couldn't save. Try again" toast; nothing is shown as logged |
| Camera denied (P2) | Manual barcode entry + Settings link |
| Food incomplete | Dot on the food; day totals show "≥" for affected nutrients |
