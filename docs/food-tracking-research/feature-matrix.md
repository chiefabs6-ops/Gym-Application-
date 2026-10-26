# Feature comparison matrix

[← Research index](README.md) · Details: [app-analysis.md](app-analysis.md) · Sources: [evidence-and-sources.md](evidence-and-sources.md)

Status as of 2026-10-25, from documentation and reports (no app was installed). Values:
**Supported** · **Partially supported** · **Not supported** · **Unknown**. A cell is marked *Not supported* only where a
source says so (or the vendor states it); missing evidence is *Unknown*. Tier notes: **[P]** = MyFitnessPal Premium,
**[G]** = Cronometer Gold, **[LP]** = Lose It! Premium. MacroFactor has no free tier (7-day trial), so every MacroFactor
feature requires a subscription.

Section links in the Notes column point to the matching part of [app-analysis.md](app-analysis.md) (A = entry, B = search
and database, C = nutrition, D = diary, F = edge cases, G = tiers).

## Core matrix

| Feature | MyFitnessPal | Cronometer | Lose It! | MacroFactor | Notes |
|---|---|---|---|---|---|
| Text food search | Supported | Supported | Supported | Supported | MacroFactor groups results History / Custom / Common / Branded; Cronometer uses tabs (All, Favorites, Common, Supplements, Brands, Restaurants, Custom). |
| Barcode scanning | Supported [P] | Supported (free) | Supported [LP] | Supported | MFP paywalled since 2022-10-01. Lose It! is moving it to Premium; older free accounts keep it for now. Cronometer says "completely free". |
| Brand and restaurant foods | Supported | Partially supported | Supported | Partially supported | Cronometer has Brands/Restaurants tabs but reviewers report gaps; MacroFactor states restaurant coverage "is not as strong". |
| Custom food creation | Supported | Supported | Supported | Supported | MacroFactor: Serving / 100 g / 100 ml basis, kJ and salt toggles. Cronometer: label type (US vs EU) remembered. |
| Manual calorie entry (quick add) | Supported | Not supported | Unknown | Supported | Cronometer staff refused quick add on accuracy grounds (workaround: DB entries named "Quick Add"). No Lose It! quick add found in any source. |
| Manual nutrient entry | Supported | Supported | Supported | Supported | Via custom foods everywhere. Quick-add macros: MFP [P], MacroFactor included. |
| Portion-size selection | Supported | Supported | Supported | Supported | Lose It! swipe/scroll adjuster with live nutrition (CSPI 2024). |
| Gram-based entry | Partially supported | Supported | Partially supported | Supported | MFP: only the units the entry's creator added, no general conversion. Lose It!: unit picker exists; "grams on ~99% of foods" is a single user claim. |
| Household measures | Partially supported | Supported | Supported | Supported | MFP same limitation as grams. MacroFactor: cup, tbsp, tsp, fl oz derived where possible; 2 favourite weight + 2 volume units pinned. |
| Recent foods | Supported | Supported | Supported | Supported | MFP filters history to the current meal by default; Lose It! suggests foods usually eaten at that mealtime; MacroFactor shows "hourly go-tos". |
| Favourite foods | Partially supported | Supported | Partially supported | Supported | MFP relies on Recent/Frequent lists; Lose It! "My Foods" fills automatically, no explicit star documented. Cronometer star; MacroFactor heart. |
| Saved meals | Supported | Supported | Partially supported | Partially supported | MFP My Meals log as separate entries. Cronometer Custom Meals (no serving scaling). Lose It!: Meals tab of past meals with per-item checkboxes, no saved-meal object verified. MacroFactor: save as recipe, explode later. |
| Recipes and ingredient-based calculation | Supported | Supported | Supported | Supported | Cooked-weight yield: Cronometer and MacroFactor yes; MFP "can't compute yield"; Lose It! uses Total Recipe Size + portion size. URL import: MFP free (English), Cronometer [G], Lose It! [LP], MacroFactor included. |
| Copying meals between days | Supported | Supported | Partially supported | Supported | MFP's April 2026 redesign made copy meal-level only. Lose It!: "Add Yesterday's [Meal]" + past meals; arbitrary date copy not documented. MacroFactor: hour/day, To Today/Tomorrow, multi-date paste. |
| Quick-add functionality (fast re-log) | Supported | Supported | Supported | Supported | One-tap "+" on results: MFP Quick Log, MacroFactor multi-add. Repeat: MFP swipe-to-repeat last meal; Cronometer Repeat Items [G]. |
| Voice logging | Supported [P] | Supported [G] | Supported [LP] | Partially supported | MacroFactor: keyboard dictation into Describe on phones; native AI voice on Apple Watch only. Cronometer voice since 2026-04-29. |
| Photo or AI logging | Supported [P] | Supported [G] | Supported [LP] | Supported | MacroFactor AI photo still beta (since v5.0.0, 2025-03-30); also text "Describe". MFP's AI Coach cannot log food. |
| Calorie totals | Supported | Supported | Supported | Supported | MFP: Remaining = Goal − Food + Exercise. Cronometer: Consumed / Burned / Balance circles. |
| Macro tracking | Supported | Supported | Supported [LP] | Supported | MFP free sees macros only as % of calories; grams and gram goals [P]. Lose It! moved macros behind Premium (multiple reports). |
| Micronutrient tracking | Partially supported | Supported | Partially supported | Supported | MFP: vitamin A, C, calcium, iron, potassium goals. Cronometer: 84 (Basic) to 95 (Gold) nutrients, DRI targets. Lose It!: classic label set; 2026 store copy mentions vitamins/minerals [LP]. MacroFactor: Nutrient Explorer, floor/target/ceiling. |
| Meal-level summaries | Supported | Partially supported | Supported | Supported | MFP calories per meal (macros per meal [P]). Cronometer: totals for selected entries; group subtotals unverified. MacroFactor: per-hour macro summaries. |
| Daily nutrition summary | Supported | Supported | Supported | Supported | Lose It!'s late-2025 redesign moved daily summaries behind a calendar (user complaints). |
| Historical diary editing | Supported | Supported | Supported | Supported | MFP and MacroFactor: edits to foods/recipes don't change past entries. Cronometer: recipe save can rewrite history. |
| Food database verification | Partially supported | Supported | Partially supported | Supported | MFP green check = "reviewed", crowd DB. Lose It! green check + verified-only filter on a crowd DB. Cronometer: staff review of submissions. MacroFactor: curated; human vs machine review conflicts across its own sources. |
| Missing-food handling | Supported | Supported | Partially supported | Supported | Cronometer and MacroFactor turn a barcode miss into a pre-filled custom food. MFP: "Create a Food" links barcode for all users. Lose It!: custom food only; no documented barcode-miss prompt. |
| Core logging free (no paywall) | Partially supported | Supported | Partially supported | Not supported | MFP paywalls barcode, macro grams, macro quick add, export. Lose It! paywalls barcode, label scan, macros. MacroFactor has no free tier. |

## Additional rows relevant to Gym Log

| Feature | MyFitnessPal | Cronometer | Lose It! | MacroFactor | Notes |
|---|---|---|---|---|---|
| Offline food search | Not supported | Not supported | Unknown | Partially supported | MFP: "you will not be able to access the food database" offline. Cronometer staff: no offline mode (DB size, licences). MacroFactor: "will likely never support a true offline mode"; during outages it searches history and cached results. Lose It! stores data locally and syncs, but no offline-search statement found. |
| Offline diary edits | Supported | Not supported | Partially supported | Partially supported | MFP syncs later. Lose It!: on conflict you choose device or web data, "merging data is not possible". |
| Nutrition-label OCR | Unknown | Supported | Supported [LP] | Supported | Cronometer: photo label + front + ingredients, AI fills. Lose It!: live on-device ML Kit, under 1 s. MacroFactor: real-time mock label. |
| Snapshot (non-retroactive) history | Supported | Partially supported | Unknown | Supported | MFP explicit for foods and saved meals (recipes undocumented). Cronometer prompts and can rewrite past entries. |
| Blank vs zero for missing nutrients | Unknown | Supported | Unknown | Partially supported | Cronometer shows blanks / N/T and gap-fills with a wand icon. MacroFactor's form says "leave blanks"; display undocumented. |
| Log by calories/macros (compute grams) | Unknown | Unknown | Unknown | Supported | MacroFactor flame switcher. |
| Plate / staged multi-add | Partially supported | Supported | Partially supported | Supported | MFP repeated Quick Log + web checkboxes; Cronometer Multi-Add; Lose It! past-meal checkboxes; MacroFactor Plate with Plate/Day totals. |
| Timestamps / timeline | Supported [P] | Supported [G] | Unknown | Supported | MacroFactor is timeline-only. |
| Renamable / extra meal slots | Supported | Supported | Supported [LP] | Not supported | MFP up to 6 (docs say 5 or 6); Cronometer up to 8 groups; MacroFactor uses hours. |
| Data export | Supported [P] | Supported | Supported | Supported | MFP: 3 CSVs, meal-level, Premium. Cronometer: free-tier export disputed. Lose It!: web full-account export, no exercise. MacroFactor: Quick / Granular export. |

## Reading the matrix

- **Shared table stakes:** search, custom foods, recipes, portion selection, recent foods, daily totals, history
  editing. Every app has these; Gym Log needs all of them in its [MVP](product-recommendations.md#mvp--essential-for-launch).
- **Where the apps differ most:** the paywall line (Cronometer most generous, MacroFactor subscription-only), quick add
  (Cronometer refuses it), the diary model (MacroFactor timeline vs slots), and the history model (snapshots vs
  retroactive).
- **What no app does:** search offline. Every app needs a network to reach its database. This is
  Gym Log's main opening; see [decision D1](product-recommendations.md#the-six-product-decisions-to-make-first).
