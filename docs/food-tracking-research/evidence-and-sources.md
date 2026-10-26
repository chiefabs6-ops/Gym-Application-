# Evidence, sources and limitations

[← Research index](README.md) · Analyses: [app-analysis.md](app-analysis.md) · Matrix: [feature-matrix.md](feature-matrix.md)

## Method

- **Research date:** 2026-10-25. Every source below was accessed on that date unless a publication or update date is
  shown.
- **Tools:** web search and page fetch, through six parallel research agents (one per app, one on food data sources and
  label rules, one inspecting the codebase read-only). The `find-skills` skill the brief asked for **does not exist in
  this environment** (it is not in the skill list or under `~/.claude`), so no extra skills were installed. A browser
  skill (`claude-in-chrome`) was available but not used; static fetches and the MFP help-centre API were enough, and
  logging in to the apps would not have been appropriate.
- **No app was installed, signed into or used.** Every UI flow is rebuilt from documentation and reports. No
  screenshots were captured; the reports link to the vendors' help articles, which contain the official screenshots.
- **Evidence scale:**
  - **Verified:** directly documented by a reliable primary source (vendor help centre, release notes, store listing,
    regulation, peer-reviewed paper) that was read.
  - **Verified (snippet / help-center excerpt):** primary source, but read only as a search-engine excerpt because
    the site blocked direct fetches. Treat menu paths as approximate.
  - **Supported:** credible secondary evidence, or several consistent reports.
  - **Unverified:** plausible but thin: one weak source, a competitor blog, an old forum post, or inference.

## Access limitations by app

| App | What was readable | What was blocked | Effect |
|---|---|---|---|
| MyFitnessPal | All 248 English help articles via the public Zendesk Help Center API (most updated Aug–Oct 2026); Play and App Store listings; JMIR 2020 study | support.myfitnesspal.com direct fetch (403); Reddit | **Strongest evidence of the four.** Reddit sentiment comes only through secondary write-ups. |
| Cronometer | cronometer.com blog, Gold page, dated changelog, App Store listing, official forum | support.cronometer.com (403), so excerpts only; Google Play body; Reddit returned little | Help-centre claims are "Verified (snippet)". Many forum posts are from 2018–2022 and may be stale. |
| Lose It! | App Store listing (strongest primary source on tiers); Google ML Kit case study; CSPI guide (2024); Trustpilot | loseit.com, help.loseit.com, loseit.zendesk.com direct fetches (403), Google Play, Reddit, web.archive.org | **Weakest evidence.** Help-centre text read through excerpts; many 2026 "reviews" are competitor marketing and are labelled Unverified. |
| MacroFactor | Help centre and release notes read in full (45 sources); App Store listing | Google Play body; Reddit (blocked by the search tool) | User complaints come from App Store reviews and aggregators. Much of the speed evidence is self-published. |

## Key findings and their evidence level

| # | Finding | App | Level | Source |
|---|---|---|---|---|
| 1 | Barcode scanning has been Premium-only since 2022-10-01 and still is | MFP | Verified | [Barcode Scanner](https://support.myfitnesspal.com/hc/en-us/articles/360032624771), [tier table](https://support.myfitnesspal.com/hc/en-us/articles/34889191368077) |
| 2 | Food database is unavailable offline; diary edits sync later | MFP | Verified | [Offline](https://support.myfitnesspal.com/hc/en-us/articles/360032622851) |
| 3 | Copy is meal-level only in the 2026 Today tab | MFP | Verified (official FAQ; an older article contradicts it) | [Today tab](https://support.myfitnesspal.com/hc/en-us/articles/39985611667341) |
| 4 | Editing a My Food or saved meal doesn't change past entries | MFP | Verified | [Edit My Food](https://support.myfitnesspal.com/hc/en-us/articles/360032271872), [saved meals](https://support.myfitnesspal.com/hc/en-us/articles/360032623811) |
| 5 | Serving units are limited to those the entry's creator added | MFP | Verified | [Serving size](https://support.myfitnesspal.com/hc/en-us/articles/360032272852) |
| 6 | Barcode scanner is free | Cronometer | Verified | [Barcode blog](https://cronometer.com/blog/how-to-use-the-barcode-scanner/), [Gold page](https://cronometer.com/gold) |
| 7 | Barcode miss leads to label photos and an AI pre-filled custom food | Cronometer | Verified | [Barcode blog](https://cronometer.com/blog/how-to-use-the-barcode-scanner/) |
| 8 | Missing nutrients are gap-filled from similar lab foods, marked with a wand icon | Cronometer | Verified | [Accurate data tips](https://cronometer.com/blog/accurate-data-tips/) |
| 9 | No native quick add (staff refused) | Cronometer | Supported (staff forum posts; 2026 status unverified) | [Forum 1693](https://forums.cronometer.com/discussion/1693/quick-add-feature) |
| 10 | Saving an original recipe can update past diary entries | Cronometer | Supported (staff forum replies) | [Forum](https://forums.cronometer.com/discussion/comment/13718) |
| 11 | No offline mode | Cronometer | Supported (2019–2022 staff posts) | [Forum 1094](https://forums.cronometer.com/discussion/1094/offline-use) |
| 12 | Barcode and label scanner moving to Premium; macros Premium | Lose It! | Verified (excerpt + App Store) / Supported (macros) | [App Store](https://apps.apple.com/app/lose-it-weight-loss-program-and-calorie-counter/id297368629), [Unlocking Scan It](https://loseit.zendesk.com/hc/en-us/articles/47773984823700-Unlocking-the-Barcode-Scanner-Scan-It) |
| 13 | Search pre-suggests foods usually eaten at that mealtime; Meals tab with item checkboxes | Lose It! | Verified (excerpt) | [How to Log Food](https://loseit.zendesk.com/hc/en-us/articles/49210381551380-How-to-Log-Food-in-Lose-It) |
| 14 | Label OCR runs on-device, under 1 s, offline | Lose It! | Verified | [ML Kit case study](https://developers.google.com/ml-kit/case-studies/lose-it) |
| 15 | Sync conflicts force a device-or-web choice, no merge | Lose It! | Verified (excerpt) | [Managing Device Syncing](https://loseit.zendesk.com/hc/en-us/articles/47772345677076-Managing-Device-Syncing) |
| 16 | Plate staging, multi-add "+", hourly go-tos, sectioned search | MacroFactor | Verified | [How to log food](https://help.macrofactorapp.com/en/articles/215-how-to-log-food-in-macrofactor) |
| 17 | Barcode miss auto-switches to the label scanner; the custom food keeps the barcode | MacroFactor | Verified | [Label scanner](https://help.macrofactorapp.com/en/articles/213-label-scanner) |
| 18 | Editing a recipe or custom food never changes past entries | MacroFactor | Verified | [Article 240](https://help.macrofactorapp.com/en/articles/240-does-editing-a-recipe-or-custom-food-item-affect-my-food-log-history) |
| 19 | "Will likely never support a true offline mode" | MacroFactor | Verified | [Article 28](https://help.macrofactorapp.com/en/articles/28-does-macrofactor-have-an-offline-mode) |
| 20 | Recipe Total Weight no longer auto-filled (cooking loses 5–50% water) | MacroFactor | Verified | [v5.2.2](https://macrofactor.com/version-5-2-2/) |
| 21 | Fastest logger (FLSI: 24 actions vs ~70% more on average) | MacroFactor | Verified **as a self-published claim** only | [FLSI 2025](https://macrofactor.com/fastest-food-logger-2025/) |
| 22 | Crowd apps under-report some nutrients vs a research DB | MFP, Lose It! | Verified (peer-reviewed abstract) | [Griffiths 2018](https://www.cambridge.org/core/journals/public-health-nutrition/article/assessment-of-the-accuracy-of-nutrient-calculations-of-five-popular-nutrition-tracking-applications/456D6CB0961D86CBEA2E868C52DF7ABF) |
| 23 | Photo logging under-counts 250–345 kcal per meal | MFP, Lose It!, Cal AI | Supported (**not peer-reviewed**) | [ScienceDaily 2026](https://sciencedaily.com/releases/2026/07/260726015237.htm) |
| 24 | USDA FDC is CC0; CoFID is OGL v3; OFF is ODbL (share-alike) | data sources | Verified | [FDC API guide](http://fdc.nal.usda.gov/api-guide/), [CoFID](https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid), [OFF data](https://world.openfoodfacts.org/data) |
| 25 | EU labels: per 100 g/ml mandatory; salt = sodium × 2.5 | labels | Verified | [Art. 32](https://www.legislation.gov.uk/eur/2011/1169/article/32), [Annex I](https://www.legislation.gov.uk/eur/2011/1169/annex/I) |
| 26 | expo-camera SDK 54 scans EAN-13, EAN-8, UPC-A, UPC-E | Gym Log stack | Verified | [Expo camera v54](https://docs.expo.dev/versions/v54.0.0/sdk/camera/) |

## Conflicts and open uncertainties

| Topic | Conflict | How it was handled |
|---|---|---|
| MFP meal-slot limit | Same help article says 5 and 6; the beverages article supports 6 | Reported as "up to 6 (docs inconsistent)" |
| MFP copy | Today-tab FAQ: meal-level only. Older article (updated 2026-10-04): item-level | Treated item-level as removed (secondary reports agree) |
| MFP database size | 19M / 20.5M / 22M across official pages | Reported as 19–22M |
| MFP recipe edits vs history | Foods and meals documented non-retroactive; recipes undocumented | Recipes marked Unverified |
| MFP free macro breakdown | Help: % only; a competitor blog claims a Feb 2026 change | Help-centre text used |
| Cronometer nutrient count | 82 / 84 / 92 / 95 across its own pages | Reported as 84 (Basic) to 95 (Gold) |
| Cronometer DB size | 0.97M to 1.2M | Reported as ~1M |
| Cronometer CRDB quality | Support: "most accurate and complete"; blog: "typically limited to label nutrients" | Both noted |
| Cronometer free CSV export | A staff reply says yes; another commenter says no | Marked as a conflict |
| Lose It! barcode tier | Help + App Store: moving to Premium; one 2026 blog says free | Primary sources used; grandfathering explains mixed reports |
| Lose It! DB size | 27M (old) / 50M / 56M / 63M | Reported as 50–63M |
| Lose It! verified-only filter tier | Help lists no tier; one blog says Premium | Help centre used |
| MacroFactor submission review | Help article 25: human-checked; release notes and article 246: machine-validated, not guaranteed human-checked | Both noted; unresolved |
| MacroFactor export format | "Spreadsheet" (help) vs CSV (competitor blog) | "Spreadsheet" used |
| MacroFactor AI tier | No separate tier or cap found | Marked Unverified (absence of evidence) |

## Things that remain unknown

- Exact search-ranking algorithms (all four).
- Rounding policies and per-100 g display (MFP, Lose It!, MacroFactor).
- How MacroFactor and Lose It! display missing nutrient values.
- Lose It! quick add (none found), delete/reorder details, and recipe-edit history behaviour.
- Whether Cronometer's quick-add workaround entries still exist in 2026.
- Offline search in Lose It! (local data storage is documented, offline search is not).

---

# Full source lists by app

These are the complete source tables from each app's research, copied unchanged from the working notes behind
[app-analysis.md](app-analysis.md).

## MyFitnessPal


All accessed 2026-10-25. "Upd." is the last-updated date shown by the Help Center API.

| URL | Establishes | Label | Date | Conflicts |
|---|---|---|---|---|
| https://support.myfitnesspal.com/hc/en-us/articles/39985611667341 | Today tab layout, Log button, swipe-repeat, meal-level copy only, free % vs premium grams, View Diary, Quick Add path, delete gestures, Complete Diary placement | Verified | upd. 2026-10-02 | Contradicts 360032622131 (item copy) |
| https://support.myfitnesspal.com/hc/en-us/articles/45276346234637 | Today replaced dashboard; April 2026 redesign | Verified | upd. 2026-10-24 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/34889191368077 | Official Free/Premium/Premium+ feature table | Verified | upd. 2026-10-15 | Refutes "5 entries/day" claim |
| https://support.myfitnesspal.com/hc/en-us/articles/15457546881805 | Free features, recipe creation steps, meal creation, nutrient views, macro % in 5% steps | Verified | upd. 2026-09-06 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032625951 | Premium feature list incl. platform and locale limits | Verified | upd. 2026-09-18 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/34347930588557 | Premium+ contents, countries | Verified | upd. 2026-09-20 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032274592 | Core log flow, search tip raw/cooked/generic | Verified | upd. 2026-10-23 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032621971 | Quick Add (calories free, macros premium, no labels) | Verified | upd. 2026-09-25 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032622491 | Quick Log one-tap "+" | Verified | upd. 2026-10-23 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032624771 | Barcode flow; Premium since 2022-10-01; missing-product flow | Verified | upd. 2026-10-15 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032270912 | "Find a better match" changes barcode globally | Verified | upd. 2026-10-01 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032271992 | Create food; private vs public; barcode-linked public food | Verified | upd. 2026-09-30 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032271872 | Edit/delete My Food; not retroactive | Verified | upd. 2026-10-09 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032623471 | Adding to My Foods | Verified | upd. 2026-08-27 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032625331 | Saved meals create/log/copy; logs as individual items | Verified | upd. 2026-09-26 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032623811 | Saved meal edits not retroactive; delete permanent | Verified | upd. 2026-10-08 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032271452 | Recipe methods table; per-serving math | Verified | upd. 2026-09-29 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032623231 | App recipe importer flow; English-only | Verified | upd. 2026-09-29 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032271592 | Web importer: green check/red X, same-dimension unit conversion | Verified | upd. 2026-07-10 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032271372 | Edit/delete recipe | Verified | upd. 2026-10-05 | Silent on retroactivity |
| https://support.myfitnesspal.com/hc/en-us/articles/360032622191 | No yield calculation | Verified | upd. 2026-09-05 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032622771 | No nested recipes | Verified | upd. 2026-08-31 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360039748071 | Recipe copy website-only | Verified | upd. 2026-08-27 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032270532 | Recipes can't be shared directly | Verified | upd. 2026-09-12 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360035864331 | Recipe Discovery; log/bookmark Premium | Verified | upd. 2026-08-27 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032622131 | Copy meal (legacy item-level instructions) | Verified (outdated) | upd. 2026-10-04 | Conflicts with Today tab FAQ |
| https://support.myfitnesspal.com/hc/en-us/articles/360032274452 | Copy meal from friend | Verified | upd. 2026-08-26 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/30332897072269 | Voice Log flow and limits | Verified | upd. 2026-09-21 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360045761612 | Meal Scan flow, requirements | Verified | upd. 2026-09-16 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/33535658002061 | Multi-Day Logging | Verified | upd. 2026-09-16 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360036224752 | Food timestamps | Verified | upd. 2026-09-18 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032273292 | Check-mark meaning; "19 million foods" | Verified | upd. 2026-10-13 | DB size differs from store (20.5M) and Today FAQ (22M) |
| https://support.myfitnesspal.com/hc/en-us/articles/360032274312 | Report Food categories and review | Verified | upd. 2026-10-01 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032271252 | DB = MFP + user entries | Verified | upd. 2026-08-26 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032272852 | Serving-size limits and workarounds; fractions | Verified | upd. 2026-09-24 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032621791 | Preview nutrition | Verified | upd. 2026-09-25 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032622071 | Recent/Frequent lists, hide/restore | Verified | upd. 2026-09-28 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032621811 | Sort food lists | Verified | upd. 2026-09-30 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032622651 | Meal-filtered lists / All Meals | Verified | upd. 2026-09-29 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/12338510991117 | Suggested Searches | Verified | upd. 2026-09-28 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032622311 | Meal names; extra meals | Verified | upd. 2026-09-23 | Internal 5 vs 6 conflict |
| https://support.myfitnesspal.com/hc/en-us/articles/360032271052 | Beverages slot; "two beyond default four" | Verified | upd. 2026-09-25 | Supports 6 total |
| https://support.myfitnesspal.com/hc/en-us/articles/360032270432 | Natural-sugar workaround via meal slot | Verified | upd. 2026-09-23 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032270952 | Move item between meals | Verified | upd. 2026-10-06 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032624311 | Delete entry gestures | Verified | upd. 2026-10-12 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032624131 | Complete diary projection and thresholds | Verified | upd. 2026-10-10 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032624931 | Food-logging streak | Verified | upd. 2026-10-15 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032270392 | Food notes | Verified | upd. 2026-10-12 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032622851 | Offline: no food DB; sync later | Verified | upd. 2026-10-17 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032273692 | Net Calories formula | Verified | upd. 2026-10-11 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032623851 | Exercise raises goal; Premium toggle | Verified | upd. 2026-10-01 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032623871 | Tracker calorie adjustment | Verified | upd. 2026-09-11 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032625391 | Initial goal calculation; floors | Verified | upd. 2026-09-29 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032624071 | Goal changes forward-only | Verified | upd. 2026-10-20 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032274432 | Macro goals, presets, 5% steps | Verified | upd. 2026-08-27 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032273792 | Calorie goals by meal | Verified | upd. 2026-09-17 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032625151 | Macros by meal | Verified | upd. 2026-10-02 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032272532 | Nutrient dashboard views; free % only | Verified | upd. 2026-09-10 | Callie claim re Feb 2026 free macro breakdown |
| https://support.myfitnesspal.com/hc/en-us/articles/360032621991 | Up to 5 nutrients + calories in diary columns | Verified | upd. 2026-09-29 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032625091 | Micronutrients tracked and goals | Verified | upd. 2026-09-29 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032622531 | Net Carbs | Verified | upd. 2026-09-27 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032623691 | Pie chart semantics | Verified | upd. 2026-08-27 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032272712 | Food Lists Premium; sample for free | Verified | upd. 2026-08-27 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032270352 | Diary Food Insights | Verified | upd. 2026-10-08 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032273352 | Export: Premium, 3 CSVs, meal-level | Verified | upd. 2026-08-27 | Conflicts with third-party "per-food row" claims |
| https://support.myfitnesspal.com/hc/en-us/articles/360032623371 | Free: no export; printable report web-only | Verified | upd. 2026-09-12 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/45212266254221 | Coach: Premium iOS, can't log food | Verified | upd. 2026-10-20 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/45246617814669 | Progress tab; v26.16.0+ | Verified | upd. 2026-08-02 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032274332 | Android known issues (sync bug fixed 26.18.2) | Verified | upd. 2026-10-23 | – |
| https://support.myfitnesspal.com/hc/en-us/articles/360032274552 | iOS known issues (recipe save error, carb totals) | Verified | upd. 2026-10-14 | – |
| https://play.google.com/store/apps/details?id=com.myfitnesspal.android | Rating, downloads, tier marketing, 20.5M foods, recent reviews, What's new | Verified | updated 2026-10-16 | – |
| https://apps.apple.com/us/app/myfitnesspal-calorie-counter/id341232718 | iOS rating, version 26.42.0 notes | Verified | ~2026-10-20 | – |
| https://www.myfitnesspal.com/premium | Premium page (EU pricing), feature list | Verified | n/a | No Premium+ shown on that locale |
| https://lite.aol.com/sports/other/story/0022/20260224/9659625.htm | 2026 Winter Release: iOS photo upload; pricing | Supported | 2026-02-24 | – |
| https://www.easternprogress.com/myfitnesspal-announces-its-2025-summer-release/article_0c108ad7-c8f9-5cbe-bbc6-eca09b6be312.html | 2025 Summer Release: unified scan/speak/search (seen via search snippet; fetch returned 429) | Supported | Aug 2025 | – |
| https://www.droid-life.com/2022/08/24/myfitnesspal-puts-barcode-scanner-behind-premium-paywall/ | Barcode paywall Oct 1 2022, $20/$80 | Supported | 2022-08-24 | – |
| https://news.slashdot.org/story/22/08/25/1955238/myfitnesspal-paywalls-barcode-scanner-that-made-counting-calories-easy | Verge report: new accounts from Sept 1 2022 (search snippet) | Supported | 2022-08-25 | – |
| https://www.jmir.org/2020/10/e18237 | Accuracy validation: good for energy/macros, poor for sodium/cholesterol; calories-only entries | Verified (peer-reviewed) | 2020-10 | – |
| https://insider.fitt.co/myfitnesspal-acquires-rival-food-tracker-cal-ai/ | Cal AI acquisition | Supported | 2026-03-02 | – |
| https://en.wikipedia.org/wiki/MyFitnessPal | Ownership, Cal AI, history | Supported | n/a | – |
| https://www.mycallie.app/en/blog/myfitnesspal-new-update-today-screen | Redesign changes, removals, workarounds (competitor) | Supported | 2026-10-12 | Claims free macro breakdown (Feb 2026 blog) |
| https://unstar.app/blog/is-myfitnesspal-premium-worth-it-paywall-app-reviews-2026 | Complaint analysis of 202 negative Play reviews | Supported | 2026-07-27 | – |
| https://calorie-trackers.com/calorie-tracker-app-updates-march-2026/ | Claims March 2026 redesign cut taps 5→3 | Unverified | 2026-03 | Conflicts with user reports of more taps |
| https://calorie-trackers.com/reviews/myfitnesspal/ | Duplicate/inconsistent entries | Supported (weak) | 2026 | – |
| https://nutrola.app/en/blog/why-does-myfitnesspal-have-so-many-wrong-entries | Wrong-entry examples (competitor) | Unverified | 2026 | – |
| https://amyfoodjournal.com/blog/myfitnesspal-review | Rejects "5 entries/day" free cap (competitor) | Supported | upd. 2026-09-19 | Contradicts other blogs |
| https://mwm.ai/articles/myfitnesspal-v26-16-0-replaces-diary-with-new-ui-sparking-rating-drop-in-april-2026 | v26.16.0 date 2026-04-21, rating drop (search snippet only; page returned 410) | Unverified | 2026-04 | – |

## Cronometer


All accessed 2026-10-25 unless noted. "Snippet" = seen only as a search-result excerpt (support site returned 403 to direct fetch).

| URL | Establishes | Label | Pub. date | Conflicts |
|---|---|---|---|---|
| https://cronometer.com/gold | Gold vs Basic list, pricing $10.99/$59.99, 84 vs 95 nutrients, photo/voice/importer/timestamps/Oracle Gold | Verified | n/a | Nutrient count inconsistent on the same page |
| https://cronometer.com/blog/cronometer-updates-whats-new-improved | Dated changelog: photo log beta/launch, voice log 29 Apr 2026, label auto-fill Jul 2024, diary groups for all May 2024, undo, multi-add, 92 nutrients Feb 2026 | Verified | rolling | — |
| https://cronometer.com/blog/photo-logging/ | Photo log workflow, Gold only, NCCDB/CFCD only, swap/add/suggested ingredients | Verified | 8 Sep 2025 | — |
| https://cronometer.com/blog/?p=58829 | Four logging methods, + menu, search sort/filter/Multi-Add, barcode-miss photos incl. ingredients | Verified | 14 May 2026 | — |
| https://cronometer.com/blog/how-to-use-the-barcode-scanner/ | Barcode free, Type Barcode, Create New with label photos, optional curation | Verified | 1 Aug 2024 | — |
| https://cronometer.com/blog/tips-tricks-level-up/ | Barcode free and mobile only, label AI, explode, + menu customisation | Verified | n/a | — |
| https://cronometer.com/blog/accurate-data-tips/ | Source list, nutrient-count heuristic, gap-fill magic wand, CRDB staff review | Verified | 24 Nov 2023 | CRDB completeness vs support article |
| https://cronometer.com/blog/how-to-set-your-macro-and-micronutrient-targets | Macro Ratios/Fixed/Keto, net vs total carbs, DRI defaults, custom micro targets | Verified | 21 Aug 2024 | — |
| https://cronometer.com/blog/how-to-recipes/ | Recipe fields, whole/per-serving breakdown, explode, Custom tab, create-from-selection | Verified | 23 Sep 2022 | Gold gating may be stale |
| https://cronometer.com/blog/custom-meals/ | Custom Meals simplified, no servings or cooked weight | Verified (snippet) | n/a | — |
| https://cronometer.com/blog/cronometers-energy-summary/ | Energy Summary circles, Target/Balance | Verified (snippet) | n/a | — |
| https://apps.apple.com/us/app/cronometer-calorie-counter/id1145935738 | Free barcode, Gold list incl. Repeat Items, 95+ nutrients, 1.1M foods, v4.60.1, 4.8★, review complaints | Verified | v4.60.1 ~3 days before access | DB size vs Gold page |
| https://support.cronometer.com/hc/en-us/articles/360018239472-data-sources | NCCDB/USDA/CRDB/branded descriptions, Common tab | Verified (snippet) | n/a | CRDB "most complete" |
| https://support.cronometer.com/hc/en-us/articles/360018193011 | Search tabs, favourites, tabs remember recent foods | Verified (snippet) | n/a | — |
| https://support.cronometer.com/hc/en-us/articles/360018240312 | Custom food creation, label type, gram weight for extra servings | Verified (snippet) | n/a | — |
| https://support.cronometer.com/hc/en-us/articles/360018510311-Create-Custom-Recipe | Servings- vs weight-based recipes | Verified (snippet) | n/a | — |
| https://support.cronometer.com/hc/en-us/articles/4407646573588-Mobile-Set-a-Cooked-Recipe-Weight | Cooked weight | Verified (snippet) | n/a | — |
| https://support.cronometer.com/hc/en-us/articles/4406291608724 | Cooked weight as serving option, revert | Verified (snippet) | n/a | — |
| https://support.cronometer.com/hc/en-us/articles/4403966087828-Mobile-Recipe-Importer | Importer flow, unmatched flags, Gold | Verified (snippet) | n/a | — |
| https://support.cronometer.com/hc/en-us/articles/360018695932-Mobile-Copy-Paste | Copy day/group/items, paste, Copy to Today | Verified (snippet) | n/a | — |
| https://support.cronometer.com/hc/en-us/articles/39013533811092-Mobile-Photo-Logging | Photo log Gold, review matches, recipes/meals | Verified (snippet) | n/a | — |
| https://support.cronometer.com/hc/en-us/articles/47664884315412-Mobile-Siri-Voice-Logging | Siri logging, tagged for review | Verified (snippet) | n/a | — |
| https://support.cronometer.com/hc/en-us/articles/16510562495764-Mobile-Set-Repeating-Foods | Repeat items flow and banner | Verified (snippet) | n/a | — |
| https://support.cronometer.com/hc/en-us/articles/360021811032 | Timestamps toggle (Gold) | Verified (snippet) | n/a | — |
| https://support.cronometer.com/hc/en-us/articles/360018171731-Diary-Overview | Energy Summary, macro Consumed/Remaining, Nutrient Target Summary | Verified (snippet) | n/a | App Store review says remaining is missing |
| https://support.cronometer.com/hc/en-us/articles/360038286012-Mobile-Dietary-Reference-Intakes-DRIs | DRI defaults | Verified (snippet) | n/a | — |
| https://support.cronometer.com/hc/en-us/articles/31975503009044 | Energy target from weight goal, custom target | Verified (snippet) | n/a | — |
| https://forums.cronometer.com/discussion/comment/14480 | Pet peeves: search ranking, ordering, fractions, mL, 100 g defaults, no offline | Supported (users) | 2021–2022 | may be stale |
| https://forums.cronometer.com/discussion/1693/quick-add-feature | No quick add; "Quick Add" DB workaround; staff rationale | Supported | dated | — |
| forums.cronometer.com "Accidently update(d) past entries" threads (e.g. https://forums.cronometer.com/discussion/comment/13718) | Recipe save prompt updates past entries; Edit a Copy | Supported | dated | — |
| forums.cronometer.com offline threads (e.g. https://forums.cronometer.com/discussion/1094/offline-use) | No offline; licensing reason | Supported | 2019–2022 | 2026 status unknown |
| forums.cronometer.com mark-day-complete threads (https://forums.cronometer.com/discussion/comment/21511) | Locks day, report filter | Supported | dated | — |
| forums.cronometer.com export threads (https://forums.cronometer.com/discussion/comment/21080, /comment/2803) | Export path, servings with timestamps; free-tier dispute | Supported / Conflict | 2019–2024 | free vs Gold |
| forums.cronometer.com import threads (https://forums.cronometer.com/discussion/comment/5992) | No MFP import | Supported | 2018 | — |
| forums.cronometer.com reorder threads (https://forums.cronometer.com/discussion/2285/diary-entries-in-random-order) | Drag reorder, ordering bugs | Supported | dated | — |
| https://www.calorie-trackers.com/reviews/cronometer/ | 45 s/meal, ~970k foods, photo AI weaker than AI-first apps | Supported | 15 Apr 2026 ("tested Sep 2026") | internal date conflict; DB size |
| https://www.apkmirror.com/apk/cronometer-software-inc/calorie-counter-by-cronometer/calorie-counter-by-cronometer-4-14-2-release/ | Play listing text: free barcode, 1.2M foods, 84 nutrients | Supported (snippet) | n/a | DB size |
| https://gummysearch.com/r/cronometer | r/cronometer ~24k members, ads a common topic | Supported (snippet) | Jun 2026 | — |

## Lose It!


Accessed 2026-10-25 unless noted. "Snippet" = content read via search-engine excerpt because direct fetch was blocked.

| # | URL | Establishes | Label | Pub. date | Notes / conflicts |
|---|---|---|---|---|---|
| 1 | https://apps.apple.com/app/lose-it-weight-loss-program-and-calorie-counter/id297368629 | Free vs Premium split (Barcode, Photo, AI Voice, macros, meal planning = Premium); 56M+ DB; 4.8★/782K; v18.5.702; voice promo; IAP prices | Verified (fetched) | Live listing, Oct 2026 | Primary; Play listing could not be fetched |
| 2 | https://loseit.zendesk.com/hc/en-us/articles/47773984823700-Unlocking-the-Barcode-Scanner-Scan-It | Barcode + label scanner moving to Premium; transition; English-only | Verified (snippet) | n/a | Fetch 403 |
| 3 | https://loseit.zendesk.com/hc/en-us/articles/49209634235924-How-to-Use-the-Barcode-Scanner | Scan flow: Log → Add Food → Scan It → serving/quantity → Add/Save | Verified (snippet) | n/a | |
| 4 | https://loseit.zendesk.com/hc/en-us/articles/49210381551380-How-to-Log-Food-in-Lose-It | Add Food tabs, mealtime suggestions, Meals tab checkboxes, green-check Verified Foods + filter, web flow, English-only AI tools | Verified (snippet) | n/a | |
| 5 | https://loseit.zendesk.com/hc/en-us/articles/47771695186580-How-to-Use-Snap-It | Snap It flow, Swap, Premium-only, English | Verified (snippet) | n/a | |
| 6 | https://loseit.zendesk.com/hc/en-us/articles/52164255037588-How-to-Use-the-Nutrition-Label-Scanner | Autofill label scanner in custom food create/edit, Premium, v16.6.601 | Verified (snippet) | n/a | |
| 7 | https://loseit.zendesk.com/hc/en-us/articles/49209748140052-Custom-Foods | Create/edit/delete custom food paths | Verified (snippet) | n/a | |
| 8 | https://loseit.zendesk.com/hc/en-us/articles/49210308470164-My-Foods | My Foods list; removal not global | Verified (snippet) | n/a | |
| 9 | https://loseit.zendesk.com/hc/en-us/articles/47345201948052-Using-Recipes-in-Lose-It | Recipe builder steps; all accounts | Verified (snippet) | n/a | Editing/past-log section not readable |
| 10 | https://loseit.zendesk.com/hc/en-us/articles/51197596722836-Troubleshooting-Recipe-Importer-Error-Messages | URL Recipe Importer + Text Importer fallback | Verified (snippet) | n/a | |
| 11 | https://loseit.zendesk.com/hc/en-us/p/tutorial | Budget calc, Weekly Rate, recipes path, Premium import, Meal Settings (Premium meal names) | Verified/Supported (snippet) | ~Aug 2026 | |
| 12 | https://loseit.zendesk.com/hc/en-us/articles/47273187626260-How-to-Plan-Food-in-Lose-It | Premium planned mode (grey + clock) | Verified (snippet) | n/a | |
| 13 | https://loseit.zendesk.com/hc/en-us/articles/51906523474708-Lose-It-Membership-Tiers-Pricing | $79.99/yr; Premium list incl. nutrient goals, future logging, barcode, photo/voice | Verified (snippet) | 2026 | Older sources say $39.99 |
| 14 | https://loseit.zendesk.com/hc/en-us/articles/47492627092372-The-Calorie-Bonus | Bonus / Target Burn / double-count rules | Verified (snippet) | n/a | |
| 15 | https://loseit.zendesk.com/hc/en-us/articles/47772345677076-Managing-Device-Syncing | Same account; device vs loseit.com data; no merge | Verified (snippet) | n/a | |
| 16 | https://loseit.zendesk.com/hc/en-us/articles/47773393810196-Resolving-App-Performance-Issues | Device data vs web data overwrite on reinstall | Verified (snippet) | n/a | |
| 17 | https://loseit.zendesk.com/hc/en-us/articles/47345185228564-Removal-of-the-Insights-Tab-on-Loseit-com | Export via loseit.com/export/data; in-app daily/weekly reports; no exercise export | Verified (snippet) | n/a | |
| 18 | https://loseit.zendesk.com/hc/en-us/articles/47497914864916-How-to-Download-Your-Data | Web export; no weight-only export | Verified (snippet) | n/a | |
| 19 | https://developers.google.com/ml-kit/case-studies/lose-it | On-device Snap It; label OCR <1 s from live camera; offline | Verified (fetched) | n/a | |
| 20 | https://techcrunch.com/2016/09/29/lose-it-launches-snap-it-to-let-users-count-calories-in-food-photos/ | Snap It 2016 beta flow, accuracy claims | Verified (fetched) | 2016-09-29 | Historical |
| 21 | https://en.wikipedia.org/wiki/Lose_It!_(app) | History; Snap It 2016; CES 2017 | Supported (fetched) | n/a | |
| 22 | https://www.accessnewswire.com/newsroom/en/publishing-and-media/lose-it-finds-ai-powered-logging-boosts-weight-loss-success-and-greater-nutrit-1015267 | Say It / Snap It (latest model identifies all foods), 63M DB, company study claims | Supported (snippet; fetch 403) | 2025-04-22 | Company-reported figures |
| 23 | https://x.com/loseit/status/1806361368691462442 | Voice logging launch, ">98% accuracy" claim | Supported (search result only) | ~June 2024 | Not fetched |
| 24 | https://twitter.com/loseit/status/1169351557395230727 | Meal Settings → Change Meal Names | Supported (search result only) | ~2019 | Path may be outdated |
| 25 | https://x.com/loseit/status/1219025553635803136 | Older export scope | Supported (search result only) | ~2020 | Superseded by #17 |
| 26 | https://www.cspi.org/article/our-guide-food-tracking-apps | Checked items, nutrients list, swipe serving with live nutrition, Serving Size Guide; scanner + recipe import paid | Verified (fetched; reputable NGO) | 2024-01-24 | Older than 2026 changes |
| 27 | https://www.trustpilot.com/review/loseit.com | Redesign complaints (3 macros, net carbs, calendar summaries), serving context, no spellcheck | Supported (fetched) | Nov 2025 – Apr 2026 reviews | User reports |
| 28 | https://nutriscan.app/blog/posts/lose-it-premium-worth-it-2026-who-should-pay-4eb070ea9d | Macros moved to Premium; user quotes (Play "panel of redundant buttons", r/1200isplenty) | Supported (competitor, fetched) | 2026-04-27 | Commercial bias |
| 29 | https://nutriscan.app/blog/posts/best-app-restaurant-meal-logging-2026-dbcccb9473 | 3 free uses of Snap It / voice; no location menu browsing | Unverified (competitor, fetched) | 2026-08-07 | |
| 30 | https://macros.gg/articles/macro-tracking-without-subscription | Fresh-account barcode paywall; legacy grandfathering; $79.99 | Supported (competitor, fetched) | 2026-08-19 | Consistent with #2 |
| 31 | https://www.fitbudd.com/post/lose-it-premium-review | Scanner to Premium for new users 2026; pricing claims | Unverified (competitor, fetched) | 2026-01-13/16 | Internally inconsistent |
| 32 | https://amyfoodjournal.com/blog/lose-it-app-review | Snap It accuracy test; claims barcode free | Unverified (competitor, fetched) | 2026-03-19 | Conflicts with #1, #2 on barcode |
| 33 | https://calorie-trackers.com/reviews/lose-it/ | Barcode reliable; Snap It weak on mixed dishes; 25 nutrients | Unverified (fetched) | 2026-04-15 | Pricing conflicts |
| 34 | https://www.cravingwise.com/reviews/lose-it-weight-loss-app/ | DB sources; green check filter; Premium list; $79.99 | Supported (fetched; cites official pages) | checked 2026-07-05 | |
| 35 | https://nutrola.app/en/blog/is-lose-it-free-anymore | Free tier narrowing | Unverified (competitor, fetched) | 2026-04-19 | Contradicts other sources in places |
| 36 | https://www.active.com/fitness/articles/lose-it-app-review | Custom meals reusable; Premium macro breakdown | Supported (fetched) | 2023-03-04 | Dated |
| 37 | https://www.garagegymreviews.com/equipment/lose-it | Barcode as pro; heavy ads on free | Supported (fetched) | n/a | Thin |
| 38 | https://forums.cronometer.com/discussion/5014/feature-request-scanning-food-labels-to-create-custom-foods-copying-pasting-meals | User praise of Lose It! label scan + previous meals | Unverified (search result) | n/a | |

Sources not reachable: help.loseit.com, loseit.com (incl. /snapit), Google Play listing body, reddit.com (r/loseit, r/LoseItApp), web.archive.org, direct loseit.zendesk.com fetches. Reddit sentiment is therefore second-hand only.

## MacroFactor


All accessed 2026-10-25. "Pub" is the publication or update date where shown.

| # | URL | Establishes | Label | Pub / notes |
|---|---|---|---|---|
| S1 | https://help.macrofactorapp.com/en/articles/215-how-to-log-food-in-macrofactor | Entry points, 5 methods, search sections, plate, Add/Log Foods, multi-add, quick add, library, log to date | Verified | n/a |
| S2 | https://macrofactorapp.com/?p=4543 (search snippet of the Food Logger page) | Custom food linked to barcode pops up on later scans. Timeline customization 4,608 | Supported | Fetch redirected to the 2025 FLSI page, so the claim is from the snippet only |
| S3 | https://macrofactor.com/fastest-food-logger-2025/ (fetched via ?p=4543) | FLSI 2025 scores, speed vs context mode, multi-add serving reuse | Verified (self-published claim) | Updated 2025-10-01 |
| S4 | https://macrofactor.com/fastest-food-logger/ | Original 2022 FLSI | Supported (search result only) | 2022 |
| S5 | https://help.macrofactorapp.com/en/articles/25-how-robust-is-the-database-coverage-in-my-region | DB sources, 1.36M, human-checked submissions, regional and restaurant gaps, reformulation lag | Verified | Conflicts with S25/S26 on human review |
| S6 | https://help.macrofactorapp.com/en/articles/213-label-scanner | Label scanner flow, fields, failure modes, barcode fallback | Verified | n/a |
| S7 | https://help.macrofactorapp.com/en/articles/5-create-and-add-a-custom-food | Custom food wizard, per serving/100g/100ml, unit toggles, Import with AI | Verified | n/a |
| S8 | https://macrofactor.com/label-scanner-announcement/ | v2.5.0 label scanner, pre-filled wizard, intl labels experimental | Verified | Updated 2024-01-16 |
| S9 | https://help.macrofactorapp.com/en/articles/46-food-search-database | Standard vs legacy DB, sizes, NCC common foods, units, ranking | Verified | n/a |
| S10 | https://help.macrofactorapp.com/en/articles/6-create-and-add-a-custom-recipe | Recipe flow, Total Weight, Serving Quantity, importers | Verified | n/a |
| S11 | https://help.macrofactorapp.com/en/articles/127-why-isnt-macrofactor-auto-summing-ingredient-weights-in-my-recipe | Cooking water loss 5–50% | Supported (search snippet) | n/a |
| S12 | https://macrofactor.com/version-5-2-2/ | Recipe import, Total Weight no longer auto-filled, recipe UI changes | Verified | 2025-07-29 |
| S13 | https://macrofactor.com/10-macrofactor-features/ | AI with scale and brands, explode, log by kcal, save meal as recipe, share, copy/paste, contributors | Verified | Updated 2026-07-13 |
| S14 | https://macrofactor.com/timeline-based-food-logger/ | Timeline 2.0, selection, copy/move/remove, calendar, customization | Verified | Updated 2024-09-25 |
| S15 | https://help.macrofactorapp.com/en/articles/40-multi-add-foods | Multi-add flow | Verified | n/a |
| S16 | https://help.macrofactorapp.com/en/articles/95-copy-and-paste | Paste options, multi-select | Verified | n/a |
| S17 | https://help.macrofactorapp.com/en/articles/216-log-foods-with-describe | Describe flow, voice via keyboard, common-only DB, limits | Verified | n/a |
| S18 | https://macrofactor.com/version-5-0-0/ | AI photo open beta | Verified | 2025-03-30 |
| S19 | https://help.macrofactorapp.com/en/articles/258-ai-food-logging | AI flow: Photo, Photo & Text, Upload, Plate edits, tips | Verified | n/a |
| S20 | https://macrofactor.com/ai-food-logging/ | DB-grounded AI, ingredient breakdown, examples of errors | Verified | Updated 2025-04-08 |
| S21 | https://macrofactor.com/version-5-4-0/ | Apple Watch logging, AI voice | Verified | 2025-09-09 |
| S22 | https://apps.apple.com/app/id1553503471 | 7-day trial, no free tier, prices, 4.8 from 24K ratings, v5.8.9, user complaints | Verified (listing); Supported (reviews) | v5.8.9 dated Sep 24 |
| S23 | https://help.macrofactorapp.com/en/articles/36-where-is-my-nutrition-synced | Integrations import daily totals only | Verified | n/a |
| S24 | https://macrofactor.com/micronutrients-nutrient-explorer/ | Nutrient Explorer, floor/target/ceiling, pin 8, contributors, 26,500 common foods | Verified | Updated 2025-09-12 |
| S25 | https://macrofactor.com/version-2-7-0/ | Opt-in submissions, OFF, machine-validated, not guaranteed human-verified | Verified | 2024-04-08. Conflicts with S5 |
| S26 | https://help.macrofactorapp.com/en/articles/246-how-to-submit-new-or-updated-foods | Submission flow, auto quality check, OFF | Verified | n/a |
| S27 | https://help.macrofactorapp.com/en/collections/3-food-logging | Article index (23 food-logging articles) | Verified | n/a |
| S28 | https://help.macrofactorapp.com/en/articles/44-favorite-weight-and-volume-measurements | Favourite units prioritised in picker | Verified | n/a |
| S29 | https://help.macrofactorapp.com/en/articles/219-how-to-configure-your-food-logger | Logger banner, tiles, units, speed vs context | Verified | n/a |
| S30 | https://help.macrofactorapp.com/en/articles/245-log-by-calories-or-macros | Log by kcal or macros | Verified | n/a |
| S31 | https://greenlitcontent.com/resources/macrofactor-review | Cleaner DB, "dietitian-validated" claim | Unverified (secondary, claim unconfirmed) | n/a; seen in search only |
| S32 | https://macaron.im/playbook/macrofactor-reviews | Praise for speed and clean DB. Complaints about restaurant and branded coverage | Supported | Undated; aggregates Reddit, App Store and YouTube without links |
| S33 | https://www.onclarity.com/leaderboard/insight/strongerbyscience | AI-analysed feedback: DB gaps about 20%, wrong nutrients about 10%, recipe editing | Supported (methodology opaque) | 2026-10-20 |
| S34 | https://help.macrofactorapp.com/en/articles/42-switch-between-consumed-and-remaining-views | Consumed/remaining swipe | Verified | n/a |
| S35 | https://help.macrofactorapp.com/en/articles/136-set-custom-nutrient-goals | Auto/Custom/None goals | Supported (search snippet) | n/a |
| S36 | https://help.macrofactorapp.com/en/articles/139-view-a-summary-of-your-nutrient-intake-with-the-nutrition-overview | Nutrition Overview | Verified | n/a |
| S37 | https://help.macrofactorapp.com/en/articles/98-edit-quantities-of-foods-you-ve-already-logged-and-view-nutritional-values-for-foods-on-your-timeline | Edit logged food, one-tap edit | Verified | n/a |
| S38 | https://help.macrofactorapp.com/en/articles/48-time-logging-preferences | Date Time Picker vs Time Pad | Verified | n/a |
| S39 | https://help.macrofactorapp.com/en/articles/45-food-logging-style | Speed vs context mode | Verified | n/a |
| S40 | https://help.macrofactorapp.com/en/articles/240-does-editing-a-recipe-or-custom-food-item-affect-my-food-log-history | Snapshot semantics | Verified | n/a |
| S41 | https://help.macrofactorapp.com/en/articles/241-what-is-partial-logging | Partial logging flag | Verified | n/a |
| S42 | https://help.macrofactorapp.com/en/articles/28-does-macrofactor-have-an-offline-mode | No true offline. Outage behaviour | Verified | n/a |
| S43 | https://help.macrofactorapp.com/en/articles/356-export-your-data | Quick vs Granular export | Supported | Direct fetch returned only the title; details from the search summary |
| S44 | https://www.recime.app/blog/?p=15210 | No fully free version; trial gives full access | Supported (search snippet) | n/a |
| S45 | https://help.macrofactorapp.com/en/articles/393-how-macrofactor-subscriptions-and-bundles-work | Prices, bundle, legacy promo | Verified | n/a |

**Conflicts noted**
1. **Human review of submissions.** S5 says submissions are "checked for accuracy by other humans". S25 and S26 say machine-validated and "not guaranteed to be manually verified". These are possibly different pipelines (legacy versus OFF-era), but this is unresolved.
2. **"Dietitian-validated" database** (S31) is not supported by any primary source.
3. **Export file format.** "Spreadsheet" (primary snippet) versus CSV (competitor blog only).
4. **App Store** lists extra price points ($9.99/month, $59.99/year) that the help centre does not explain. These are possibly legacy or regional prices.

## Food data sources, label rules and Expo barcode support


| URL | Establishes | Label |
|---|---|---|
| https://openfoodfacts.github.io/openfoodfacts-server/api/ | OFF rate limits (15/min reads, 10/min search), User-Agent format, auth for writes, licences, bulk-over-API guidance | Verified |
| https://world.openfoodfacts.org/data | OFF dump formats, CSV 0.9 GB/9 GB, ODbL/DbCL/CC BY-SA, attribution wording, share-alike | Verified |
| https://ie.openfoodfacts.org/ | 79,927 products on Irish OFF site | Verified (scope implied) |
| https://blog.openfoodfacts.org/wp-content/uploads/2025/05/Webinar-Open-Food-Facts-Science.pdf | ~3.8M products, ~1,500/day (via search summary) | Supported |
| https://opendatacommons.org/licenses/odbl/summary/ | ODbL attribute / share-alike / keep-open | Verified |
| http://fdc.nal.usda.gov/download-datasets/ | FDC dataset release dates and sizes | Verified |
| http://fdc.nal.usda.gov/api-guide/ | CC0 licence, API key, 1,000 req/h, DEMO_KEY limits, citation | Verified |
| https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid | CoFID 2021 Excel 4.42 MB, OGL v3.0 | Verified |
| https://fnnbri.quadram.ac.uk/data/ | CoFID API reportedly CC BY-NC-SA 4.0 (search summary only) | Supported |
| https://research.ucc.ie/en/publications/development-of-an-on-line-irish-food-composition-database-for-nut/ | Irish FCDB, 938 foods, EuroFIR, reliance on UK data | Supported |
| https://platform.fatsecret.com/terms | 24 h cache rule, attribution everywhere, 5,000 calls/day, no health-advice use | Verified |
| https://platform.fatsecret.com/api-editions | Basic free edition 5,000 calls/day (search summary) | Supported |
| https://developer.edamam.com/food-database-api | Edamam pricing, no caching without permission, attribution required | Verified |
| https://developer.nutritionix.com/ | Nutritionix public free tier discontinued | Verified |
| https://www.legislation.gov.uk/eur/2011/1169/article/30 | EU mandatory and optional nutrients | Verified (UK-retained copy of EU text) |
| https://www.legislation.gov.uk/eur/2011/1169/article/32 | Per 100 g / 100 ml basis | Verified |
| https://www.legislation.gov.uk/eur/2011/1169/annex/I | Salt = sodium × 2.5; carbohydrate/sugars/fibre definitions | Verified |
| https://www.legislation.gov.uk/eur/2011/1169/annex/XIV | Energy conversion factors | Verified |
| https://www.fsai.ie/business-advice/labelling/labelling-nutrition-information/nutrition-labelling | Irish application: mandatory since 13 Dec 2016, per-portion only in addition, closed list, M&W acceptable | Verified |
| https://www.law.cornell.edu/cfr/text/21/101.9 | US calorie/sodium/macro rounding; calorie calculation methods A-F | Verified |
| https://www.fao.org/4/y5022e/y5022e04.htm | General vs specific Atwater factors, size of discrepancies, fibre energy | Verified |
| https://docs.expo.dev/versions/v54.0.0/sdk/camera/ | Barcode types incl. ean13/upc_a, launchScanner (Google code scanner/ML Kit), Android notes | Verified |
| https://www.cambridge.org/core/journals/public-health-nutrition/article/assessment-of-the-accuracy-of-nutrient-calculations-of-five-popular-nutrition-tracking-applications/456D6CB0961D86CBEA2E868C52DF7ABF | Griffiths 2018: 5 apps vs NDSR | Verified |
| https://sciencedaily.com/releases/2026/07/260726015237.htm | NIH 2026 photo-logging accuracy (preliminary, not peer-reviewed) | Supported |
| https://cronometer.com/features/accurate-databases.html | Cronometer's 10 data sources incl. IFCDB, CoFID | Verified (vendor claims) |
| https://help.macrofactorapp.com/en/articles/246-how-to-submit-new-or-updated-foods | MacroFactor submits to OFF with automatic validation | Verified |
| https://macrofactor.com/new-food-logger/ | MacroFactor logging modes, DB size claims, barcode coverage (search summary) | Supported |
| https://techcrunch.com/2026/03/02/myfitnesspal-has-acquired-cal-ai-the-viral-calorie-app-built-by-teens | MFP acquired Cal AI; MFP DB ~20M items | Supported |
| https://www.bgr.com/2246095/best-food-apps-to-track-your-calories/ | Yazio, MyNetDiary, FatSecret, Lifesum feature summaries | Supported |
| https://techcrunch.com/2019/10/14/foodvisor-automatically-tracks-what-you-eat-using-deep-learning/ | Foodvisor photo/portion estimation | Supported |
| https://www.raftlabs.com/blog/cal-ai-product-teardown | Cal AI method, accuracy claims | Supported |
| https://pure.psu.edu/en/publications/comparison-of-predictive-equations-for-resting-metabolic-rate-in-/ | Frankenfield 2005: Mifflin-St Jeor most reliable | Supported |

All accessed 2026-10-25. Not fetched (blocked): EUR-Lex (empty response), eCFR (captcha), PMC (captcha),
Cronometer support article (403), OFF Ireland completeness page (503).
