# Food-tracking competitive research

Research date: **2026-10-25**. Scope: food logging, meals, calories, macros, micronutrients, food databases, portions
and the UX around them. Workouts, coaching, community and recipe discovery are excluded. **Research only: no
application code, schema, dependency or config was changed.**

## Deliverables

| File | What it contains |
|---|---|
| [app-selection.md](app-selection.md) | Why MyFitnessPal, Cronometer, Lose It! and MacroFactor; alternatives considered; independent accuracy studies |
| [app-analysis.md](app-analysis.md) | Detailed per-app analysis (entry methods, search and database, nutrition, diary, UI flows, edge cases, tiers, strengths, weaknesses) + appendix on food data sources, EU/US label rules, calorie maths and Expo barcode support |
| [feature-matrix.md](feature-matrix.md) | Feature-by-feature comparison (26 required rows + 10 Gym Log-specific rows) |
| [ux-workflows.md](ux-workflows.md) | Documented user journeys in the 7-step format, patterns that speed up repeat logging, friction to avoid |
| [evidence-and-sources.md](evidence-and-sources.md) | Method, evidence scale, access limits, key findings with levels, conflicts, ~260 source links |
| [product-recommendations.md](product-recommendations.md) | Six product decisions, then MVP / Phase 2 / Advanced recommendations with complexity and risks |
| [proposed-tracking-experience.md](proposed-tracking-experience.md) | End-to-end spec for the 12 required workflows: states, validation, calculations, errors |
| [codebase-integration.md](codebase-integration.md) | Read-only inventory of the Gym Log repo and how food tracking fits (entities, screens, risks, MVP-to-code map) |

## Executive summary

1. **The four apps represent four different approaches.** MyFitnessPal: largest crowd database (19–22M), meal slots,
   paywalled basics. Cronometer: curated lab data, 84–95 nutrients, generous free tier. Lose It!: simplest meal-based
   logging, now aggressively paywalled. MacroFactor: speed-first, curated database, hourly timeline, subscription-only.
2. **None of them can search food offline.** MFP, Cronometer and MacroFactor say so in their own docs; Lose It! has
   no offline-search statement. Gym Log is offline-first, so **a small curated food set bundled in the app, plus the
   user's own foods, is both its differentiator and a requirement**. USDA FoodData Central (CC0) and UK CoFID (OGL v3)
   can legally be bundled; Open Food Facts (ODbL) suits optional online barcode lookup.
3. **Speed comes from history, not search.** Every app puts recent foods for this meal (or this hour) before the
   search box and offers a one-tap re-log at the last-used portion. Repeating yesterday's meal is one gesture in
   MFP, Lose It! and Cronometer.
4. **The best apps never change history.** MFP (foods, meals) and MacroFactor (foods, recipes) keep past entries as
   snapshots. Cronometer's prompt can rewrite past days with no undo, and users complain about it. Snapshotting
   nutrients onto each entry also fits Gym Log's full-row `mutate.ts` model.
5. **A barcode miss must never be a dead end.** MacroFactor switches to a label scanner and saves a custom food that
   keeps the barcode; Cronometer photographs the label and fills a custom food with AI. MFP instead lets any user
   re-link a barcode for everyone, which spreads errors.
6. **Paywalling basics causes backlash** (MFP barcode since 2022; Lose It! barcode, label scanner and macros in
   2025–26). Gym Log's "no paywall on basics" rule is a competitive advantage here.
7. **Crowd data and AI photos under-count.** Peer-reviewed studies found MFP and Lose It! low on protein, fat and
   sodium. A 2026 NIH abstract (not yet peer-reviewed) found photo logging 250–345 kcal per meal too low. AI logging
   belongs in "Advanced", and should produce a draft the user edits.
8. **Gym Log has no food code yet.** The data layer (`mutate.ts`, tombstones, zod contract, backup through
   `SYNC_TABLES`), `ExerciseSelector`, bottom sheets and the settings store can all be reused. Missing pieces: a
   local-day key (today's analytics bucket by UTC weeks), a toast/undo component, a camera dependency, and a ROADMAP
   entry. Nutrition isn't in ROADMAP at all.

## Top 10 features to build, by priority

| # | Feature | Phase | Main reference |
|---|---|---|---|
| 1 | Daily diary: meal sections, date navigation, kcal + P/C/F against goals, Consumed↔Remaining | MVP | MFP Today, Cronometer, MacroFactor |
| 2 | Offline search over bundled common foods + my foods, **history-first** for the current meal | MVP | MacroFactor, Lose It!, MFP |
| 3 | Portion sheet: grams always available, named servings, last-used portion remembered, live preview | MVP | MacroFactor, Cronometer |
| 4 | One-tap "+" re-log from search, Undo toast, search stays open | MVP | MFP Quick Log, MacroFactor multi-add |
| 5 | Custom food: per 100 g / per serving, EU label order, kJ and salt conversion, blanks not zeros | MVP | MacroFactor, Cronometer |
| 6 | Free Quick Add (kcal + optional macros + name) | MVP | MacroFactor, MFP |
| 7 | Copy / repeat: yesterday's meal, item, meal and day copy | MVP | Lose It!, Cronometer, MacroFactor |
| 8 | Edit/move/delete with snapshot history and Undo | MVP | MacroFactor, Cronometer |
| 9 | Saved meals and recipes with cooked weight, explode to ingredients | Phase 2 | MacroFactor, Cronometer |
| 10 | Barcode scan: local lookup, then optional Open Food Facts, cached forever; miss leads to a pre-filled custom food | Phase 2 | MacroFactor, Cronometer |

Close runners-up: nutrition-label OCR (Lose It! runs it on-device and offline), Plate multi-add, log-by-calories,
fibre/sugar/salt panel, data-completeness markers.

## Decisions you need to make

Recommendations and reasoning are in [product-recommendations.md](product-recommendations.md#the-six-product-decisions-to-make-first).

1. **Food data source:** bundled curated set (recommended) vs user-created only vs online.
2. **Storage basis:** per 100 g with gram servings (recommended).
3. **History:** snapshot nutrients on entries (recommended) vs live references.
4. **Diary model:** meal slots + hidden timestamp (recommended) vs MacroFactor-style timeline.
5. **Quick add:** free with macros (recommended).
6. **Navigation:** a 6th tab vs merging tabs. Also whether to add barcode (camera permission, online lookup) in
   Phase 2 at all.

## Limitations (short version)

- No app was installed or used; flows are rebuilt from documentation and reports.
- Cronometer and Lose It! help centres blocked direct fetches (read via search excerpts); Reddit was unreachable for
  all four. Lose It! has the weakest evidence; MFP the strongest (full help-centre API).
- MacroFactor's speed figures are self-published. Several vendor numbers (database size, nutrient counts) conflict
  across the vendors' own pages.
- The `find-skills` skill requested in the brief does not exist in this environment; web search/fetch via parallel
  research agents was used instead.
- Full detail: [evidence-and-sources.md](evidence-and-sources.md).
