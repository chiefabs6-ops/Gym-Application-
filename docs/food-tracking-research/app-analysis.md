# Individual app analyses

[← Research index](README.md) · Related: [app-selection.md](app-selection.md) · [feature-matrix.md](feature-matrix.md) ·
[ux-workflows.md](ux-workflows.md) · [evidence-and-sources.md](evidence-and-sources.md)

Desk research, 2026-10-25. **None of the apps was installed or used**; every behaviour comes from help centres, release
notes, store listings, reviews and user reports, and each claim carries an evidence label:

- **Verified**: primary source read in full, or clearly documented.
- **Verified (snippet)** / **Verified (help-center excerpt)**: primary source seen only as a search-engine excerpt
  because the site blocked direct fetching (Cronometer and Lose It! help centres returned HTTP 403).
- **Supported**: credible secondary source or several consistent reports.
- **Unverified**: single weak source, dated report, competitor blog, or inference.

Each section follows the same structure: A entry methods, B search and database, C nutrition, D diary organisation,
E UI flows, F edge cases, G free vs paid (food tracking only), then strengths, weaknesses and sources.

Contents:
1. [MyFitnessPal](#myfitnesspal)
2. [Cronometer](#cronometer)
3. [Lose It!](#lose-it)
4. [MacroFactor](#macrofactor)
5. [Appendix: food data sources and label conventions](#appendix-food-data-sources-and-label-conventions)

## Cross-app summary

| | MyFitnessPal | Cronometer | Lose It! | MacroFactor |
|---|---|---|---|---|
| Archetype | Biggest crowd database, market default | Curated lab data, micronutrient depth | Simple consumer weight loss | Speed-first logger, curated DB, adaptive targets |
| Database (vendor claim) | 19–22M (inconsistent) | ~1M (0.97–1.2M) | 50–63M (inconsistent) | ~1.36M + 26.5k NCC common foods |
| Diary model | 4 meal slots (up to 6) | Diary groups (renamable, up to 8) | 4 meals (renaming Premium) | Hourly timeline, no slots |
| Barcode | Premium since 2022-10-01 | Free | Moving to Premium (2025–26) | Included (subscription-only app) |
| Missing barcode | Create a public food linked to it | Photograph label, AI pre-fills custom food | Custom food; label Autofill (Premium) | Auto-switch to label scanner, pre-filled custom food keeps barcode |
| Quick add | kcal free, macros Premium, no label | None (deliberate) | None documented | kcal + P/F/C + alcohol + name |
| Recipe edits vs history | Foods/meals non-retroactive; recipes undocumented | Saving original can rewrite past entries | Undocumented | Snapshots, never retroactive |
| Offline | No DB offline; diary syncs later | None | Device-vs-cloud choice, no merge | No true offline |
| AI | Meal Scan, Voice (Premium) | Photo, Voice (Gold) | Snap It, Say It (Premium) | Describe, AI photo (beta) |


---

## MyFitnessPal


Scope: food logging only (Android and iOS, with web notes where they explain app behaviour). Workouts, coaching (except where it touches logging), community and social features are out of scope.

Method: The app was **not** installed. Primary evidence is the official MyFitnessPal Help Center (Zendesk). All 248 English articles were pulled through the public Zendesk Help Center API (`support.myfitnesspal.com/api/v2/help_center/en-us/articles.json`) on 2026-10-25. Most food articles were last updated in Aug–Oct 2026, so they reflect the current "Today tab" app. Secondary sources: Google Play and App Store listings (fetched 2026-10-25), press releases, one peer-reviewed validation study, and review/analysis sites. Reddit could not be fetched directly (blocked), so Reddit-sourced claims come only through secondary write-ups and are marked as such.

Evidence labels:
- **Verified**: primary source or clearly documented.
- **Supported**: credible secondary source, or several consistent reports.
- **Unverified**: single, weak or competitor source, or inferred.

---

### 0. Context that shapes everything (2025–2026)

- **The Diary became the "Today" tab.** It was tested from Oct 2025 and shipped broadly in the "April 2026 New App Design", which needs app v26.16.0+ for the related Progress tab. Today is the home screen. It shows calories consumed/remaining, a macro card, meal sections with a **Log** button each, a Streaks view, and a "Healthy Habits" section (water, exercise, steps). The old "More" tab moved behind a profile icon (top right). **Verified**: [Your Today tab](https://support.myfitnesspal.com/hc/en-us/articles/39985611667341), [New App Experience](https://support.myfitnesspal.com/hc/en-us/articles/45276346234637), [Progress Overview](https://support.myfitnesspal.com/hc/en-us/articles/45246617814669).
- **Backlash.** Third-party reports say v26.16.0 shipped on 2026-04-21 and app ratings dropped sharply. Users report more taps per log, loss of item-level copy, and a full-day view hidden behind "View All". MFP reportedly said the new UI is "our path forward", with no revert. **Supported** (several secondary sources agree; the rating numbers are **Unverified**): [Callie blog, 2026-10-12, competitor](https://www.mycallie.app/en/blog/myfitnesspal-new-update-today-screen), [Unstar analysis, 2026-07-27](https://unstar.app/blog/is-myfitnesspal-premium-worth-it-paywall-app-reviews-2026). The official FAQ confirms that copying is meal-level only.
- **AI push.** MFP acquired Cal AI (photo calorie app) in March 2026. **Supported**: [Fitt Insider, 2026-03-02](https://insider.fitt.co/myfitnesspal-acquires-rival-food-tracker-cal-ai/), [Wikipedia](https://en.wikipedia.org/wiki/MyFitnessPal). An AI "Nutrition Coach" exists (Premium, iOS, English, 6 countries) but **cannot log food**. **Verified**: [Nutrition Coach](https://support.myfitnesspal.com/hc/en-us/articles/45212266254221).
- **Database size claims vary:** "19 million" in the Check Marked article, "20.5M+" on the store listings, "22 million public food database" in the Today tab article. **Verified** as company claims, but they are inconsistent.
- **Store listings (2026-10-25):** Google Play shows 4.4★, 2.92M reviews, 100M+ downloads, "Contains ads", updated Oct 16 2026. App Store shows 4.7★ from 2.4M ratings, latest version 26.42.0. **Verified**: [Google Play](https://play.google.com/store/apps/details?id=com.myfitnesspal.android), [App Store](https://apps.apple.com/us/app/myfitnesspal-calorie-counter/id341232718).

---

### A. Entry methods

All logging starts on **Today**. The user taps **Log** next to a meal section, which opens Recently Logged/History plus search for that meal. Alternatively, the blue **+** (bottom) opens all logging methods; the user then picks the meal at the top of the search screen. **Verified**: [How to log food](https://support.myfitnesspal.com/hc/en-us/articles/360032274592), [Quick Log](https://support.myfitnesspal.com/hc/en-us/articles/360032622491).

The 2025 Summer Release combined "scan, speak, and search" into one search view. **Supported** (press release, republished): [Eastern Progress copy of PR, Aug 2025](https://www.easternprogress.com/myfitnesspal-announces-its-2025-summer-release/article_0c108ad7-c8f9-5cbe-bbc6-eca09b6be312.html).

#### A1. Text search (generic, brand, restaurant), Free
1. Today → **Log** (or +).
2. Type a food name or brand. **Suggested Searches** (ready-made phrases) appear as you type, under your History items. They work only for general search, not My Foods/Meals/Recipes. App v23.3.0+.
3. Result list. Each row has a **+** (Quick Log: logs instantly at the entry's *current/default portion*, shows a toast, and you stay on the page to add more).
4. Or tap the row to open the food detail/portion screen. Set serving size (unit), number of servings and meal. Premium adds a timestamp and "Add to Multiple Days".
5. Tap Log (iOS) or ✓ (Android) to save. The entry appears in the meal and the totals update.

Official search tip: add "cooked", "raw" or "generic" (e.g. "apple generic"). Restaurant dishes are in the same database ("20.5M+ foods, including restaurant dishes"). There is no separate restaurant mode in the docs.
**Verified**: [Log food](https://support.myfitnesspal.com/hc/en-us/articles/360032274592), [Quick Log](https://support.myfitnesspal.com/hc/en-us/articles/360032622491), [Suggested Searches](https://support.myfitnesspal.com/hc/en-us/articles/12338510991117), Play listing.

#### A2. Barcode scan, Premium only (since 2022-10-01)
- **Paywall history:** Barcode Scan became Premium-only on Oct 1, 2022. Per The Verge's report via Slashdot, new free accounts created on or after Sept 1, 2022 lost it earlier. It is still Premium as of Oct 2026: the official tier table shows the Barcode Scanner only in Premium/Premium+, and the help article still says "As of October 1, 2022, Barcode Scan is available only with a Premium subscription." **Verified**: [Barcode Scanner](https://support.myfitnesspal.com/hc/en-us/articles/360032624771), [Free vs Premium vs Premium+](https://support.myfitnesspal.com/hc/en-us/articles/34889191368077). **Supported**: [Droid Life 2022-08-24](https://www.droid-life.com/2022/08/24/myfitnesspal-puts-barcode-scanner-behind-premium-paywall/), [Slashdot/Verge](https://news.slashdot.org/story/22/08/25/1955238/myfitnesspal-paywalls-barcode-scanner-that-made-counting-calories-easy).
- **Flow:** + → **Barcode Scan** (under the search bar; on Android it sits right of "Log Food"), or Log → "Scan a Barcode". Grant camera permission. Fit the barcode in the frame. The food detail screen opens, where you choose meal and serving size, then Log/✓. App only, rear camera required, not on the website.
- **Wrong match:** "Find a better match" (top on iOS, bottom of the food page on Android). Search for the correct food and tap it. **This re-links the barcode for everyone** ("future scans of that barcode will show the corrected food"). **Verified**: [Wrong item](https://support.myfitnesspal.com/hc/en-us/articles/360032270912).
- **Barcode not found:** tap **Create a Food** to link the product to that barcode *for all users*. Enter the nutrition from the label. The entry is public, so it can't be deleted from My Foods later. **Verified**: [Food not in database](https://support.myfitnesspal.com/hc/en-us/articles/360032271992).
- Failed reads: the help article advises better light, flattening the label, or searching by name.

#### A3. Manual nutrition entry / custom foods ("My Foods"), Free
- Flow: Log → **My Foods** tab → **+ Create a Food**. Enter name and servings, then the nutrition info on the next screen, then ✓/Save. The food appears in My Foods and in *your own* future searches. You can also create foods from Profile → My Meals, Recipes & Foods → Foods → Create Food.
- **Private vs public:** foods are private by default. Sharing to the public database happens on the website (choose at creation time) or through an unlinked barcode. Public foods can't be edited or deleted afterwards, and an existing private food can't be made public later.
- **Edits are not retroactive.** "Your changes apply to future logs. Past diary entries keep the details they had when you logged them." Deleting a My Food doesn't remove diary entries.
- The exact field list of the create-food form (which micronutrients) is not documented in the help text. **Unverified**.
**Verified**: [Food not in database](https://support.myfitnesspal.com/hc/en-us/articles/360032271992), [Edit/delete My Food](https://support.myfitnesspal.com/hc/en-us/articles/360032271872), [Adding to My Foods](https://support.myfitnesspal.com/hc/en-us/articles/360032623471).

#### A4. Saved meals ("My Meals"), Free
- **Create** in the app: Profile/More → My Meals, Recipes & Foods → Meals → Create a Meal. Enter a name, an optional photo (and directions), and add food items, then Save. **Create** on the website: log the foods into one meal slot, then Quick Tools → "Remember meal".
- **Log:** + → My Meals tab → choose the meal slot at the top → tap **+** next to the saved meal. A saved meal logs as **separate individual food entries**; the saved meal's name isn't shown in the diary.
- **Copy a saved meal** (app only): Copy, then edit for variations.
- **Edit/delete** is not retroactive: "Past diary entries stay exactly as you logged them." Deleted saved meals can't be recovered.
- A saved meal also locks in an adjusted portion ("Saving it as a remembered meal locks in the adjusted amount").
**Verified**: [Saved meals](https://support.myfitnesspal.com/hc/en-us/articles/360032625331), [Edit/delete saved meals](https://support.myfitnesspal.com/hc/en-us/articles/360032623811), [Serving size](https://support.myfitnesspal.com/hc/en-us/articles/360032272852).

#### A5. Recipes, Free (Recipe Discovery logging is Premium)
There are four build methods. **Verified**: [Create recipes](https://support.myfitnesspal.com/hc/en-us/articles/360032271452).

| Method | Platforms |
|---|---|
| Import from the web (URL) | iOS, Android, website (**English device/site only**) |
| Enter ingredients manually | all |
| Bulk import (paste an ingredient list, auto-matched) | iOS, Android |
| Copy a saved recipe | **website only** |

- **URL importer (app):** Recipes → Create a Recipe → Add from the Web → paste the URL in the in-app browser → Import Recipe. Then Edit Ingredients/Review: fix mismatches, add or delete ingredients. Enter name and **number of servings**, then Save or "Save & Log It". **Verified**: [Recipe Importer apps](https://support.myfitnesspal.com/hc/en-us/articles/360032623231).
- **Website importer:** matched ingredients show a green check, unmatched ones a red X (type a replacement). Hover to Edit quantity, Replace or Remove. A unit conversion tool works **only within the same dimension** (weight↔weight, volume↔volume). The saved recipe keeps a link to the source. **Verified**: [Recipe Importer website](https://support.myfitnesspal.com/hc/en-us/articles/360032271592).
- **Manual entry (app):** name + servings → Next → optional bulk-import toggle ("we'll match them with foods in our database") → add or edit ingredients → Save / Save & Log It. Ingredients come from search; Recent, Frequent and My Foods lists can't be used. **Verified**: [Free version](https://support.myfitnesspal.com/hc/en-us/articles/15457546881805).
- **Nutrition math:** "We add up the nutrition for every ingredient, then divide by the number of servings you entered." MFP **can't compute yield**. Users enter a best guess and edit later. MFP suggests putting the serving weight in the recipe title. **Verified**: [Servings](https://support.myfitnesspal.com/hc/en-us/articles/360032622191).
- **Nested recipes aren't supported.** The only workaround is the website's classic editor plus a saved meal. **Verified**: [Recipe as ingredient](https://support.myfitnesspal.com/hc/en-us/articles/360032622771).
- **Sharing:** recipes can't be shared directly; friends can copy a logged recipe from a shared diary. **Verified**: [Share recipes](https://support.myfitnesspal.com/hc/en-us/articles/360032270532).
- **Recipe Discovery** (MFP's own recipes): browsing is open to US English app users, but **logging and bookmarking are Premium**. **Verified**: [Recipe Discovery](https://support.myfitnesspal.com/hc/en-us/articles/360035864331).
- Reliability: the Known Issues page for iOS lists "Receive an error when trying to save or edit a recipe" (2026-10-14). One Play review (Apr 2026, 210 helpful votes) reports a year of failed recipe saves. **Verified** (known issue), **Supported** (user report).

#### A6. Copy from previous days / copy meal, Free
- **Today tab (current):** the "•••" next to a meal name copies a previously logged meal *into* this meal, or copies this meal's foods *to* another meal/date. "Copying works at the meal level… Copying individual items or entire days isn't supported, but editing a copied meal afterward is always an option." **Verified**: [Today tab](https://support.myfitnesspal.com/hc/en-us/articles/39985611667341).
- **Swipe right just below a meal name** to "bring forward the foods last logged under that meal" (a log-yesterday's-meal gesture). **Verified** (same source). Users report accidental triggers that then need item-by-item deletes. **Supported**: Unstar.
- **Conflict:** an older article, "[How do I copy a meal from one day to another?](https://support.myfitnesspal.com/hc/en-us/articles/360032622131)" (updated 2026-10-04), still describes Edit Diary → tick individual items (even across meals) → Copy to a date. That matches the pre-redesign behaviour and contradicts the Today-tab FAQ. Treat item-level copy as **removed in the new UI**. **Supported** by multiple secondary reports.
- **Copy from a friend's shared diary:** "•••" under the meal → Copy to Date. **Verified**: [Copy from friends](https://support.myfitnesspal.com/hc/en-us/articles/360032274452).
- Website: Quick Tools → copy to/from dates.

#### A7. Quick Add, calories Free / macros Premium
- Flow: Today → meal **Log** → **Quick Add** (upper right of Recently Logged, next to Meal Scan). Enter calories; fat, carbs and protein are optional (Premium). With Net Carbs on, you can also enter fibre and sugar alcohols. On the website: Quick Tools → Quick Add Calories.
- You **can't label** a Quick Add entry ("difficult… for technical reasons"); users write labels in Food Notes. You can edit it like any entry.
**Verified**: [Quick Add](https://support.myfitnesspal.com/hc/en-us/articles/360032621971), tier table ("Quick-Add Macros" = Premium).

#### A8. Voice logging, Premium
- + → **Voice Log** → mic and speech permissions → "Talk when you're ready…" → describe the food. Best results come from food, quantity and meal, e.g. "For breakfast, I had one cup of plain Greek yogurt, honey, and some blueberries." Tap the blue arrow to see results. Several foods come back as separate entries. Tap each to adjust serving, number of servings or meal → **Log**, or **Try again**.
- It searches the public DB only. It does **not** match My Foods, Recipes, Meals or Quick Add. It needs a connection. iOS/Android, English, v24.35.0+, not on the web.
**Verified**: [Voice logging](https://support.myfitnesspal.com/hc/en-us/articles/30332897072269).

#### A9. Meal Scan (photo AI), Premium
- + → **Meal Scan** → first-use walkthrough → shutter. On iOS you can also "Upload photo" (the 2026 Winter Release added log-later photo upload for iOS). You get a **list of suggested foods**: pick one or more, adjust serving or number of servings → ✓ → Log. "Add more" searches the DB without leaving the screen.
- The help article frames suggestions as "a starting point, not a final answer". It recommends scanning one dish at a time for multi-item plates.
- Requirements: iOS 18 / Android 13+, app 22.17+, English, not on the web.
**Verified**: [Meal Scanner](https://support.myfitnesspal.com/hc/en-us/articles/360045761612). **Supported**: [2026 Winter Release PR](https://lite.aol.com/sports/other/story/0022/20260224/9659625.htm).

#### A10. Natural-language / conversational logging
- Voice Log is the natural-language path: speech, then multiple matched items.
- The **Nutrition Coach chatbot cannot log food**. The docs say: "Coach cannot log food for you… you'll still need to add it to your diary yourself." **Verified**.
- No typed NL ("2 eggs and toast") parser for the text box is documented. **Unverified/absent**.
- The Oct 2026 App Store notes add AI Coach multi-image upload and fridge-photo meal suggestions. These suggest meals; they don't log. **Verified** (App Store notes).

#### A11. Multi-Day Logging, Premium
On the food detail screen, "Add to Multiple Days" lets you pick up to 7 days. It works for database foods, My Foods and Recipes, **not My Meals**. There is no bulk undo: each day's entry must be deleted separately. **Verified**: [Multi-Day](https://support.myfitnesspal.com/hc/en-us/articles/33535658002061).

#### A12. Import from other sources
- Recipe URLs and the MFP Blog (A5).
- **Partner apps** (40+) sync exercise and calories *into* MFP. Some (e.g. Meal Planner, Premium+) add meals "directly from your plan". No food-diary import from other trackers is documented. **Verified** (Premium+ article), **Unverified** for third-party diary import.

---

### B. Search and database

- **Source:** a mix of MFP-added foods and user-added foods; users can add and share to the public DB. **Verified**: [Food data source](https://support.myfitnesspal.com/hc/en-us/articles/360032271252).
- **Green check mark:** "reviewed or added by MyFitnessPal and is considered accurate and complete". However, "items without a check mark are not always wrong, and even verified entries can sometimes have mistakes." **Verified**: [Check Marked items](https://support.myfitnesspal.com/hc/en-us/articles/360032273292). Meal Scan suggests "verified foods".
- **Ranking:** the order is not documented. History (recent/frequent) shows above suggestions on the search page. The history list can be sorted by Most Recent, Most Frequent, A–Z or Z–A, and the choice persists. By default, history lists are **filtered to the meal you're logging**; "All Meals" filter / "Show All Food in Lists" turns that off (Free). **Verified**: [Sort lists](https://support.myfitnesspal.com/hc/en-us/articles/360032621811), [Favorite foods](https://support.myfitnesspal.com/hc/en-us/articles/360032622651), [Recent/Frequent](https://support.myfitnesspal.com/hc/en-us/articles/360032622071).
- **Duplicates and inconsistency:** this is the most-cited weakness. Reviewers commonly report many entries for one food with different calories (e.g. "banana", "brown rice cooked"). **Supported** (several secondary sources, some by competitors): [calorie-trackers.com review](https://calorie-trackers.com/reviews/myfitnesspal/), [Nutrola blog, competitor](https://nutrola.app/en/blog/why-does-myfitnesspal-have-so-many-wrong-entries). "Duplicate of Existing Entry" is a report category.
- **Quality controls:** a **Report Food** button sits at the bottom of the food's nutrition. Categories: Incorrect Food name, Incorrect Brand, Wrong/Missing Nutritional Information, Duplicate of Existing Entry, Inappropriate Listing, Preferred Serving Size Not Available. Then you enter corrected values. Reports are reviewed by the nutrition team and are not applied instantly. On the website: "Is this data accurate? No". **Verified**: [Report incorrect food](https://support.myfitnesspal.com/hc/en-us/articles/360032274312). Barcode re-linking by any Premium user is a quality risk (A2).
- **Serving units / switching:** "Serving size choices are limited to the options entered when the food item was created." MFP-created entries often have several units; user entries often have one. Official workarounds: change *number of servings* (0.75 cup → 0.75; "Some app versions accept both fractions and decimals"), use a 1-unit option as a multiplier, find another entry with the needed unit, save as a meal, or create a new food. **There is no general automatic g↔oz↔cup conversion** for a food, apart from the same-dimension converter in the web recipe importer. **Verified**: [Serving size](https://support.myfitnesspal.com/hc/en-us/articles/360032272852).
- **Raw vs cooked:** handled only by separate entries and the search tip "add cooked/raw/generic". **Verified** (tip); there's no dedicated toggle (**Unverified/absent**).
- **Package sizes:** no specific feature is documented. **Unverified**.
- **Preview before logging:** on mobile you open the food in the log flow and cancel; the website has a separate Database browser. **Verified**: [Preview](https://support.myfitnesspal.com/hc/en-us/articles/360032621791).
- **Search outages:** 2026 reviews report "No Results" for common foods while saved foods still appear. **Supported**: Unstar analysis.
- **Accuracy evidence:** Evenepoel et al., JMIR 2020 (n=50, Belgium, trained participants) found strong correlation with a reference DB for energy (r=0.96) and for macros, fibre and sugar (r≈0.79–0.90). Correlation was weak for cholesterol (ρ=0.51) and sodium (ρ=0.53). The authors blame entries that "only have a value for total energy content without values for macronutrient composition". They note poor results in untrained "naturalistic" use (r 0.21–0.42 in another study). **Verified** (peer-reviewed): [JMIR 2020;22(10):e18237](https://www.jmir.org/2020/10/e18237).
- **Trade-off:** the huge crowd-sourced DB gives high hit rates for regional and branded items, at the cost of duplicates and incomplete micronutrients. MFP's mitigations are check marks, reports and a "verified foods" bias in AI features.

---

### C. Nutrition

- **Formula:** goals are in **Net Calories**: "Calories Consumed (Food) − Calories Burned (Exercise) = Net Calories". In practice this gives Remaining = Goal − Food + Exercise. Logged cardio raises the day's goal, and the extra calories are split across macros by the chosen ratio. Premium can turn exercise calories off or redistribute them. Tracker "Calorie Adjustment" adds positive adjustments by default; negative adjustments are opt-in. Today shows consumed and remaining, with an emoji marker when exercise calories were earned. **Verified**: [Net Calories](https://support.myfitnesspal.com/hc/en-us/articles/360032273692), [Exercise changes goals](https://support.myfitnesspal.com/hc/en-us/articles/360032623851), [Calorie Adjustment](https://support.myfitnesspal.com/hc/en-us/articles/360032623871).
- **Goal setup:** age, height, weight, sex and activity give maintenance calories, then ± the weekly-rate goal. Goal weight doesn't affect calories. Floors are 1200 kcal (women) and 1500 kcal (men). Changing a goal applies **from today forward**; past days keep their old goals, and past goals can't be edited. **Verified**: [Initial goals](https://support.myfitnesspal.com/hc/en-us/articles/360032625391), [Historical goals](https://support.myfitnesspal.com/hc/en-us/articles/360032624071).
- **Macro goals:** Free sets percentages in **5% steps that must total 100%**. Premium allows gram-level goals, different goals by day of week, Calorie Goals by Meal (also per weekday), and Macros by Meal (on by default for Premium). iOS has macro presets: Default, High protein, Low carb, Keto, Paleo, Custom. **Verified**: [Customize goals](https://support.myfitnesspal.com/hc/en-us/articles/360032274432), [Calorie goals by meal](https://support.myfitnesspal.com/hc/en-us/articles/360032273792), [Macro goals by meal](https://support.myfitnesspal.com/hc/en-us/articles/360032625151).
- **Macro card display by tier:** Free sees **only the percentage of calories** from carbs, protein and fat on Today. Premium taps to toggle grams consumed, grams remaining and %. Premium can add a 4th view: "Heart Healthy" (sat fat, sodium, fibre) or "Carb Conscious" (carbs, sugar, fibre). The old custom 3-nutrient dashboard was retired in the app (it remains on the website). **Verified**: [Nutrient Dashboard](https://support.myfitnesspal.com/hc/en-us/articles/360032272532). *Conflict:* a competitor blog says a Feb 2026 MFP blog post promised free users the daily macro breakdown on Today. **Unverified**; the current help text says percentages only.
- **Pie chart:** shows the calorie share of macros and always sums to 100%; it is not progress-to-goal (4/4/9 kcal per g). **Verified**: [Pie chart](https://support.myfitnesspal.com/hc/en-us/articles/360032623691).
- **Other nutrients:** Nutrition/Progress → Nutrients tab shows total, goal and remaining per nutrient for a day or week. The website/landscape diary can show **up to 5 nutrients + calories** as diary columns (set on the website). Micronutrient goals cover vitamin A, vitamin C, calcium and iron (as % of 2010 Daily Values) plus potassium (3500 mg). Fibre, sugar, sat fat, sodium and cholesterol are tracked. **Verified**: [Change tracked nutrients](https://support.myfitnesspal.com/hc/en-us/articles/360032621991), [Vitamins & Minerals](https://support.myfitnesspal.com/hc/en-us/articles/360032625091). Oct 2026 Play notes fixed "Cholesterol, Sodium, and Potassium goals were showing in grams instead of milligrams". **Verified**.
- **Net Carbs (Premium):** Total Carbs − Fibre − Sugar Alcohols. This replaces "Carbohydrates" everywhere. Apps only, US/Canada. iOS outside the US/CA follows local label conventions (fibre excluded); Android and web always include fibre. **Verified**: [Net Carbs](https://support.myfitnesspal.com/hc/en-us/articles/360032622531).
- **Totals:** per food (detail screen shows macros in g and %, then micros), per meal (calories per meal; macros per meal for Premium), and per day (top of Today). **Food Lists** (foods ranked by calories or a nutrient) are Premium; free users see a *sample* list. **Verified**: [Food Lists](https://support.myfitnesspal.com/hc/en-us/articles/360032272712).
- **Per serving vs per 100 g / rounding / missing values:** nutrition is stored per the entry's serving(s) and scales by number of servings. Neither per-100 g normalisation nor a rounding policy is documented. Missing values in user entries are a known source of under-counting (JMIR). There is no documented "incomplete data" warning in the UI. **Unverified** (absence of documentation).
- **Diary Food Insights:** in-context RD-based nudges after logging some foods; they can be turned off in Diary Settings. **Verified**: [Food Insights](https://support.myfitnesspal.com/hc/en-us/articles/360032270352).

---

### D. Diary organisation

- **Meals:** the default slots are Breakfast, Lunch, Dinner and Snacks. Renaming is global (all days), and default slots can be renamed but not removed. **Extra meals:** "up to two extra… limit of 6 possible meals". *Conflict:* the same article's FAQ says "Up to five: the default three… plus two". The "Track beverages" article says "two additional meals beyond the default four", which supports **6 total**. Settings path: Diary Settings → Customize Meal Names. **Verified** (with internal inconsistency): [Meal names](https://support.myfitnesspal.com/hc/en-us/articles/360032622311), [Beverages](https://support.myfitnesspal.com/hc/en-us/articles/360032271052). MFP itself recommends extra slots as workarounds ("Beverages", "Alcohol", "Fruits and Vegetables" for natural sugar).
- **Edit quantity:** tap the logged item, change serving or number of servings, then save. Quick Add and voice entries are edited the same way. **Verified** (Quick Add / Voice FAQs).
- **Delete:** iOS swipe left → trash. Android long-press → Delete. Both via "View all/View diary". **Verified**: [Delete entry](https://support.myfitnesspal.com/hc/en-us/articles/360032624311).
- **Move/reorder:** View Diary → Edit → press and drag the item to another meal → Done. Moving doesn't change the timestamp. Reordering within a meal isn't documented. A Play review (Apr 2026, 153 helpful) says the diary "doesn't show the items in the accurate order anymore". **Verified** (move), **Supported** (order complaint): [Move item](https://support.myfitnesspal.com/hc/en-us/articles/360032270952).
- **Date navigation:** a week strip at the top: tap a day, or tap "Today" for a date picker; swipe to change week. Future days are allowed. Start of week is configurable on iOS (rolling out to Android). **Verified**: Today tab FAQ.
- **Tabs in add-food:** History/Recently Logged (sortable), My Meals, My Recipes, My Foods. Frequent is automatic. Items can be hidden from Recent/Frequent and restored on the website. In non-English locales these lists may merge into one tab. **Verified**: [Recent/Frequent](https://support.myfitnesspal.com/hc/en-us/articles/360032622071), [Free version](https://support.myfitnesspal.com/hc/en-us/articles/15457546881805).
- **Multi-add:** the app has repeated Quick Log "+" taps without leaving search. The website has checkboxes + "Add Checked". Voice and Meal Scan return several items in one go. **Verified**.
- **History edits:** any past day can be opened and edited. Goals for past days stay frozen. Saved-meal and My Food edits don't rewrite history. **Verified**.
- **Daily summary / "Complete diary":** appears after ≥1 food, below meals. It gives a **5-week weight projection** assuming every day matches today. Under-eating warnings appear below 1200/1500 kcal, and no projection is shown below 1000/1200. You can keep logging after completing. Completion isn't needed for streaks. **Verified**: [Complete entry](https://support.myfitnesspal.com/hc/en-us/articles/360032624131).
- **Streaks:** the food-logging streak means ≥1 food per day and can be backfilled. It is separate from the login streak. **Verified**: [Streaks](https://support.myfitnesspal.com/hc/en-us/articles/360032624931).
- **Notes:** daily Food Notes (Today bottom → Add a note). **Verified**: [Notes](https://support.myfitnesspal.com/hc/en-us/articles/360032270392).
- **Timestamps (Premium, apps):** off by default and enabled in Diary Settings. Entries default to the current time and are editable; "No Time" is allowed. Items logged together are grouped under one time. **Verified**: [Timestamps](https://support.myfitnesspal.com/hc/en-us/articles/360036224752).
- **Empty states:** meals with no food show no macro breakdown ("Empty meals stay empty, so your screen does not fill up with zeros"). Food Lists are empty on unlogged days. **Verified**.

---

### E. UI flows (as documented; screen names from help text)

- **Diary (Today) screen**, top to bottom: week/date strip → calories consumed/remaining card → macro card (swipe through views) → "Meals" header with **View all / View diary** → meal sections (name, ••• menu, **Log** button, logged items; swipe-right gesture to repeat the last meal) → **Complete Diary** → Healthy Habits (water, exercise, steps) → latest weight → Add a note. A bottom nav has Today, Progress, **+**, Plans (Premium+) and Coach (Premium iOS). **Verified**: Today tab FAQ, Coach and Progress articles.
- **Add-food flow:** Log/+ → search screen. It has a meal selector at the top, a search bar, and method buttons under the bar (Barcode Scan, Voice Log, Meal Scan, Quick Add). Below that are the History (Recently Logged) list with a sort/filter bubble and tabs (My Meals / My Recipes / My Foods). Typing shows suggested searches. **Verified** (Quick Add, Barcode, Sort, Suggested Searches articles).
- **Search results:** rows with a **+** for one-tap log at the default portion, plus a confirmation toast. A green check marks verified entries. Tap a row for detail. **Verified**.
- **Food detail / portion screen:** serving size (unit picker limited to the entry's units), number of servings (decimals; some versions take fractions), meal. Premium adds Timestamp and "Add to Multiple Days" chips above the nutrients. Next comes the nutrient summary (macros g/%), then the full nutrition list, then **Report Food** at the bottom. Save via Log (iOS) or ✓ (Android). **Verified**.
- **Barcode scan:** camera with a scanning frame → food detail (same portion screen) with "Find a better match", or "Create a Food" if unlinked. **Verified**.
- **Custom food creation:** two steps: (1) name, brand and servings; (2) nutrition facts → ✓/Save. **Verified** (field-level detail **Unverified**).
- **Meal creation:** name, optional photo, optional directions, add food items (+), then Save. **Verified**.
- **Recipe creation:** method choice (Web / Manual) → name + servings (+ bulk-import toggle) → ingredient list with add/edit → arrow → Save / Save & Log It. **Verified**.
- **Nutrition summary:** tap the Calories card for the Calories tab (pie by meal, Day view). Tap the Macros card for the Macros tab (pie; Day/Week). Nutrients tab shows total/goal/left per nutrient. Below these sit Food Lists (Premium). The Progress tab gives a weekly overview: calories vs goal, weight, macros (tips are Premium), and reports. **Verified**.

---

### F. Edge cases

| Case | Behaviour | Evidence |
|---|---|---|
| Food missing | Create a private My Food, or a public one via website/barcode; or Quick Add calories | Verified |
| Conflicting entries | Prefer check-marked entries; report duplicates; no merge feature | Verified / Supported |
| Wrong serving size on an entry | Change number of servings, use a 1-unit option, pick another entry, report "Preferred Serving Size Not Available", or create a food | Verified |
| Decimals / fractions | Decimals everywhere; fractions in "some app versions" | Verified |
| Unit conversion | Only among the units on the entry; web recipe importer converts within weight or volume only | Verified |
| Incomplete nutrients | Entries may have calories only and no macros/micros; that silently under-counts; no UI flag documented | Verified (JMIR), Unverified (UI) |
| Edit / delete logged item | Tap to edit; swipe (iOS) / long-press (Android) to delete; multi-day entries are deleted one by one | Verified |
| Wrong barcode match | "Find a better match" changes it globally | Verified |
| Duplicate logging | No duplicate detection documented; tracker syncs can double-count exercise (Samsung/Garmin reports) | Supported |
| Recipe servings changed | Per-serving nutrition is recomputed for future logs. **Whether past diary entries recalculate is not documented for recipes.** My Foods and Saved Meals are explicitly *not* retroactive, so recipes are probably snapshots too | Unverified (recipes), Verified (foods/meals) |
| Goal changed | Applies from today forward; history keeps old goals | Verified |
| Offline | "You will not be able to access the food database" offline. Diary changes made offline sync later. Voice and Meal Scan need a connection. There is no offline food cache beyond what the app shows (not documented) | Verified |
| Sync failures | Android 26.18.x had "Data is not syncing from Android to Web" (fixed in 26.18.2); users report logouts and lost history from broken social login | Verified / Supported |
| Export | **Premium only.** Nutrition/Progress → Export → date range → emailed ZIP of 3 CSVs (Meal-level nutrition incl. micros, timestamps, food notes; Progress; Exercise). Free gets a website-only printable report and diary sharing | Verified: [Export](https://support.myfitnesspal.com/hc/en-us/articles/360032273352), [Free alternatives](https://support.myfitnesspal.com/hc/en-us/articles/360032623371) |

Note: the export is **meal-level** ("summarized by meal"), not per food item. A third-party guide claiming a per-food CSV row conflicts with the official description. **Verified** (official), **Unverified** (third-party claim).

---

### G. Free vs Premium (food tracking only)

Prices are about $19.99/mo or $79.99/yr for Premium and $99.99/yr for Premium+ (US). Prices vary by country (€19.99 / €79.99 on the EU premium page). A 7-day trial is offered. **Supported**: 2026 Winter Release PR, [myfitnesspal.com/premium](https://www.myfitnesspal.com/premium).

| Capability | Free | Premium | Premium+ |
|---|---|---|---|
| Text search & log, Quick Log, unlimited entries | ✓ | ✓ | ✓ |
| Create foods, saved meals, recipes (URL/manual/bulk import) | ✓ | ✓ | ✓ |
| Copy meal / swipe-repeat / copy from friend | ✓ | ✓ | ✓ |
| Quick Add calories | ✓ | ✓ | ✓ |
| Quick Add macros (+fibre/sugar alcohols in Net Carbs mode) | – | ✓ | ✓ |
| Barcode Scan | – | ✓ | ✓ |
| Meal Scan (photo) | – | ✓ | ✓ |
| Voice Log | – | ✓ | ✓ |
| Multi-Day Logging (≤7 days) | – | ✓ | ✓ |
| Food timestamps | – | ✓ | ✓ |
| Macro goals in grams; goals by weekday | – (5% steps) | ✓ | ✓ |
| Calorie goals by meal; macros by meal | – | ✓ | ✓ |
| Macro card: grams consumed/remaining toggle; Heart Healthy/Carb Conscious view | % only | ✓ | ✓ |
| Net Carbs mode | – | ✓ | ✓ |
| Food Lists / Food Analysis (ranked foods) | sample only | ✓ | ✓ |
| Exercise calorie settings | – | ✓ | ✓ |
| Data export (CSV) | – (print report on web) | ✓ | ✓ |
| Ad-free | – (ads) | ✓ | ✓ |
| Recipe Discovery log/bookmark | – | ✓ | ✓ |
| Meal Planner w/ automated logging from plan | – | – | ✓ |

**Verified**: [Tier table](https://support.myfitnesspal.com/hc/en-us/articles/34889191368077), [Premium features](https://support.myfitnesspal.com/hc/en-us/articles/360032625951), [Premium+](https://support.myfitnesspal.com/hc/en-us/articles/34347930588557). A claim that Free is capped at 5 entries/day appears in some 2026 blogs. It is **not** in the official table, and a 2026 review explicitly calls it stale ([amyfoodjournal, competitor, upd. 2026-09-19](https://amyfoodjournal.com/blog/myfitnesspal-review)). Treat it as **Unverified/likely false**.

---

### Strengths to borrow (for an offline-first logger)

1. **Two distinct fast paths:** *Quick Log* (one-tap "+" at the default portion, toast, stay in search for more) and *Quick Add* (bare calories, optional macros). Keeping them clearly separate removes a lot of friction. (Verified)
2. **Per-meal "Log" buttons**, so the meal context is set before search, plus a global "+" with a meal picker. (Verified)
3. **History-first search screen:** recent/frequent above results, filtered to the current meal by default with an "All meals" toggle, and a sticky sort preference (Recent/Frequent/A–Z). (Verified)
4. **Repeat-last-meal gesture** and **meal-level copy to/from dates**. Item-level copy should be kept too: MFP's removal of it is a top complaint. (Verified / Supported)
5. **Saved meals expand into individual entries** when logged, so each item stays editable. Recipes collapse into one item with servings. Both models are useful. (Verified)
6. **Non-retroactive edits** for custom foods and saved meals (history is a snapshot). This is simple and predictable, and it fits full-row snapshots. (Verified)
7. **Serving-size workarounds built into the UX:** number-of-servings multiplier with decimals and fractions, and "1-unit" serving options. (Verified)
8. **Recipe builder with bulk paste + auto-match + per-line fix** (green check / red X). The "best-guess servings, edit after cooking" guidance and "put serving weight in title" tip show a real need: support a **total cooked weight → per-gram serving** mode, which MFP lacks. (Verified)
9. **Report Food categories** (wrong nutrition, duplicate, missing serving size). These map well to a local "flag/fix this entry" flow. (Verified)
10. **Goal changes apply forward only**; past days keep their goals. (Verified)
11. **Complete-diary projection with safety thresholds** (under-eating warnings, no projection below a floor). (Verified)
12. **Optional timestamps with "No Time"**, grouped by time. (Verified)
13. **Meal-slot renaming plus up to 6 slots**, which also serves as a cheap "category" feature (Beverages, Alcohol). (Verified)
14. **Voice/photo results as an editable multi-item list**, never auto-committed ("a starting point, not a final answer"). (Verified)

### Weaknesses / user complaints

1. **Paywalled basics:** barcode scanning (Premium since Oct 2022), grams-based macro goals, per-meal macros, gram display on the macro card, macro Quick Add and export. This is the single most consistent complaint. (Verified tiering; Supported sentiment: Unstar, Play reviews)
2. **Database noise:** duplicates and inconsistent calories for the same food; user entries with only calories (no macros or micros), which under-count; check marks are not a guarantee. Peer-reviewed data shows sodium and cholesterol are unreliable. (Verified / Supported)
3. **Global barcode re-linking by any user** can propagate errors. (Verified mechanism)
4. **2026 redesign friction:** more taps; full-day list hidden behind "View All"; item-level copy removed; per-meal detail harder to see; streaks can't be hidden; diary item order complaints; app jumps back to Today mid-log. (Supported)
5. **Ads** on Free: full-screen, and a banner overlapping search/add controls. (Supported)
6. **No offline food database:** you can't search offline. (Verified)
7. **Limited unit conversion:** only the units the entry's creator added; no density-based cup↔gram. (Verified)
8. **Recipes:** no nested recipes; copy only on the website; importer English-only; no yield calculation; a known recipe save/edit error on iOS (Oct 2026). (Verified)
9. **Quick Add can't be labelled**; Voice Log can't reach My Foods/Meals/Recipes; Multi-Day can't do My Meals and has no bulk undo. (Verified)
10. **Inconsistent docs and platform parity:** meal-slot limit stated as both 5 and 6; copy instructions contradict across articles; many features are English-, country- or iOS-only (Coach, photo upload, Net Carbs US/CA, Recipe Discovery US). (Verified)
11. **Sync reliability:** Android→Web sync bug in 26.18; tracker double-counting; logouts from social login. (Verified / Supported)
12. **Search outages** returning "No Results" (2026 reviews). (Supported)

---

### Sources

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

---

## Cronometer


Scope: food, meal, calorie and nutrient logging on Android, iOS and web. Workouts, coaching, community and biometrics are excluded unless they feed food tracking.

### Method and evidence rules

- The app was **not** installed. Every behaviour below comes from documentation, release notes, store listings, reviews or forum reports.
- **support.cronometer.com returned HTTP 403 to direct fetches.** Claims attributed to help-centre articles come from the article titles and excerpts shown in search results. They are labelled **Verified (snippet)**. Treat them as primary-source text that was not read in full.
- Pages fetched in full: cronometer.com/gold, the "Updates" changelog post, and blog posts on photo logging, four logging methods, barcode scanner, accurate data, recipes, targets and tips. Also fetched: the App Store listing, the calorie-trackers.com review, and the forum "pet peeves" thread.
- The Google Play page fetch returned no content. Play-listing claims come from APKMirror mirrors of the store text, seen in search results.
- Reddit gave almost no direct results. Most user-behaviour evidence comes from forums.cronometer.com, the official community forum. Many posts are from 2018 to 2022 and may be stale.
- Labels: **Verified** = primary source, read in full. **Verified (snippet)** = primary source, seen only as a search excerpt. **Supported** = credible secondary source or several consistent user reports. **Unverified** = a single report, dated, or inferred.

---

### A. Entry methods

#### A1. Text search ("Add Food")
- **Workflow:** On the Diary, tap the **+** button (bottom of the screen on mobile) and choose **Add Food**. The search screen has tabs: All, Favorites, Common, Supplements, Brands, Restaurants, Custom. Type a query and pick a result. The food detail screen opens with a serving amount, a unit picker and a nutrient preview. Tap Add. The entry lands in the Diary (in the selected diary group), and the Energy, Macro and Nutrient summaries recompute. **Verified (snippet)** for the tabs ([support 360018193011](https://support.cronometer.com/hc/en-us/articles/360018193011)). **Verified** for the + flow and the sort/filter/Multi-Add options ([Four ways to log, 14 May 2026](https://cronometer.com/blog/?p=58829)).
- **Search options:** The search bar has an options menu to sort, filter by database, and turn on **Multi-Add**, which lets you select several foods before adding them. Filters, sorting, multi-add and swipe-to-delete of recent items arrived in mobile 3.11.0 (5 Oct 2021). The full database became searchable from the Foods tab in 4.3.0 (7 Mar 2023). **Verified** ([Updates post](https://cronometer.com/blog/cronometer-updates-whats-new-improved)).
- **Pre-populated tabs:** The tabs "start to remember the foods you use most often/most recently". **Verified (snippet)** (support 360018193011).
- **Auto vs user:** The app calculates all nutrients from amount × per-gram data. The user must pick the right entry and the amount. Android remembers the last amount logged for a food. The web app did not, and staff logged that as a bug. **Unverified** (dated forum, [thread](https://forums.cronometer.com/discussion/4384/can-you-set-a-default-amount-for-a-food)).
- **Tier:** Free.

#### A2. Brand and restaurant search
- These are dedicated **Brands** and **Restaurants** tabs in search. Branded data comes from Nutritionix and the USDA Branded (UPC) database. It is usually limited to the nutrients printed on the label. **Verified** ([Accurate data tips, 24 Nov 2023](https://cronometer.com/blog/accurate-data-tips/)). **Verified (snippet)** ([data sources 360018239472](https://support.cronometer.com/hc/en-us/articles/360018239472-data-sources)).
- Reviewers report gaps for niche restaurants and regional cuisine. **Supported** ([calorie-trackers.com review](https://www.calorie-trackers.com/reviews/cronometer/)).

#### A3. Barcode scan
- **Workflow:** Tap **+**, then **Scan Food**. The camera reads the code automatically. If the scan fails, use **Type Barcode**. Once matched, enter the serving size and add to the Diary. **Verified** ([Barcode blog, 1 Aug 2024](https://cronometer.com/blog/how-to-use-the-barcode-scanner/)).
- **Free:** "available to all users, completely free of charge". **Verified** (same blog, [App Store listing](https://apps.apple.com/us/app/cronometer-calorie-counter/id1145935738), [Gold page](https://cronometer.com/gold)).
- Scanning works from any angle, with manual code entry if a scan fails (3.17.0, 28 Jan 2022). **Verified** (Updates post).
- **Platform:** Mobile only. **Verified** ([Tips blog](https://cronometer.com/blog/tips-tricks-level-up/)).

#### A4. Nutrition label scanner (barcode-missing flow)
- **Workflow:** The scan finds no match. Tap **Create New**. Photograph the **nutrition label and front of package** (the May 2026 post adds the ingredients list). AI reads the label and **auto-fills name, serving size and nutrients**. The user completes "a few additional details" and saves. The item becomes a **Custom Food** that can be logged immediately. Submitting it to the curation team for the public database is **optional**. **Verified** (Barcode blog, [Four ways to log](https://cronometer.com/blog/?p=58829), [Tips blog](https://cronometer.com/blog/tips-tricks-level-up/)).
- Auto-fill from label photos launched 16 Jul 2024, with "international nutrition labels" support. **Verified** (Updates post).
- **Tier:** Not stated as Gold. It sits inside the free barcode flow. No source found that restricts it. **Supported.** There is no separate stand-alone "label scanner" entry point; it is part of barcode and custom-food creation.
- Custom foods default to the user's most recent label type (US/CA vs EU/AU), from 4.8.0. **Verified** (Updates post). This matters because EU/AU labels report carbohydrate differently. **Verified (snippet)** ([support 360018240312](https://support.cronometer.com/hc/en-us/articles/360018240312)).

#### A5. Manual entry and custom foods
- **Workflow:** Go to Foods tab, then Custom Foods, then Add Food. Choose a label type. Enter the name, the serving size as printed at the top of the label, and the nutrient values. Extra serving sizes are allowed **only if a gram weight is entered**. Save. You can log the food right away or submit it for review. **Verified (snippet)** (support 360018240312).
- Custom foods and recipes support weight- or volume-based serving sizes (4.23.0, 15 May 2024). **Verified** (Updates post).
- **Deleting vs retiring:** Delete removes the food from past diary entries too. **Retire** hides it from lists but keeps history. **Supported** (staff forum replies, via search).
- **Tier:** Free. Sharing custom foods and recipes with other users is Gold. **Verified** (Gold page).

#### A6. Saved meals ("Custom Meals")
- Custom Meals arrived in 4.9.0 (1 Aug 2023) as "a simplified version of a Custom Recipe" for all users. **Verified** (Updates post).
- **Limits:** No whole-meal serving count and no cooked weight. Users cannot log "half a meal". The workaround is to explode the meal and edit each ingredient. **Verified** ([Custom meals blog](https://cronometer.com/blog/custom-meals/), via search). **Supported** (forum thread "Custom Meals - 1/2 the portion size").
- **Create from diary:** Multi-select diary entries, open the ⋮ menu and choose "Create Recipe from Selected Items". **Verified** ([Recipes blog, 23 Sep 2022](https://cronometer.com/blog/how-to-recipes/), which frames it as a Gold shortcut). Gold gating of create-from-selection is **Unverified** for 2026.

#### A7. Recipes
- **Manual recipe:** Create it from the Foods tab. Add ingredients from the database, set the number of servings or switch to weight-based, and add tags and categories. The app shows "the nutritional breakdown of the recipe as a whole and for a serving size". **Verified** (Recipes blog). Servings-based vs weight-based choice: **Verified (snippet)** ([support 360018510311](https://support.cronometer.com/hc/en-us/articles/360018510311-Create-Custom-Recipe)).
- **Cooked weight / yield:** Weigh the finished dish and enter that weight. It becomes a serving option, and nutrients scale to the grams logged. Advanced Settings let you edit it or revert to the original. **Verified (snippet)** ([support 4407646573588](https://support.cronometer.com/hc/en-us/articles/4407646573588-Mobile-Set-a-Cooked-Recipe-Weight), [4406291608724](https://support.cronometer.com/hc/en-us/articles/4406291608724)).
- **Changing serving type:** You cannot convert a recipe in place between serving-based and weight-based. Use gear menu, then **Edit a Copy**. **Supported** (staff forum reply, via search).
- **Recipe Importer (Gold):** Foods, then Import Recipe. Paste a URL, or since 3.16.0 type or paste ingredient text. The app parses ingredients and servings and **flags unmatched ingredients**, which must be resolved before saving. Review the nutrition summary, then save. **Verified (snippet)** ([support 4403966087828](https://support.cronometer.com/hc/en-us/articles/4403966087828-Mobile-Recipe-Importer)). Gold-only: **Verified** (Gold page). The parser was retrained in 4.5.0 (Apr 2023). **Verified** (Updates post).
- **Edit from diary:** You can edit a recipe directly from the diary (3.22.0, Jun 2022). **Verified** (Updates post).
- **Explode:** Swipe right, then ⋮, then Explode (mobile), or right-click (web). Each ingredient becomes its own entry, and edits do not touch the saved recipe. "Always explode" setting arrived in 4.18.0 (Feb 2024). **Verified** (Updates post, Recipes blog).

#### A8. Copy previous day and copy entries
- Diary ⋮ menu: **Copy Current Day / Copy Previous Day**. Multi-Select, then Copy. Single entry: swipe right, then the blue menu, then Copy. Go to the target date, open ⋮ and choose **Paste**. Also **Copy to Today** on past dates, and **Copy Yesterday's Group** for one diary group. **Verified (snippet)** ([support 360018695932](https://support.cronometer.com/hc/en-us/articles/360018695932-Mobile-Copy-Paste)).
- Whole-day copy brings everything, so users then delete extras. **Unverified** (single forum report).
- **Tier:** Free (no Gold gating found).

#### A9. Quick add
- **No native quick-add.** Staff refused it because it "would promote using less accurate, more incomplete data". The workaround is database entries named "Quick Add, Calorie / Carbohydrate / Fat / Protein", logged with grams as the amount. **Supported** (several staff forum replies, e.g. [thread 1693](https://forums.cronometer.com/discussion/1693/quick-add-feature)). The workaround's 2026 status is **Unverified**.
- "Quick add" in release notes means iOS home-screen quick actions and a customisable + menu, not calorie quick add. **Verified** (Updates post).

#### A10. Voice logging (Gold)
- Describe the meal in natural language. Cronometer matches the spoken foods to database entries for review. **Verified** ([Four ways to log](https://cronometer.com/blog/?p=58829), Gold page: "Speak to us or Siri and we'll match the key ingredients").
- Changelog: Voice Logging in 4.53.1 (**29 Apr 2026**), Gold only. **Verified** (Updates post).
- iOS **Siri Voice Logging** via a Shortcut logs without opening the app. Siri-logged items are **tagged in the diary for later review**. **Verified (snippet)** ([support 47664884315412](https://support.cronometer.com/hc/en-us/articles/47664884315412-Mobile-Siri-Voice-Logging)).
- Android was in beta per earlier forum posts. **Unverified** (undated).

#### A11. Photo AI logging (Gold)
- **Timeline:** Beta in 4.41.0 (1 Jun 2025). Launch for Gold in 4.43.0 (1 Aug 2025). The blog post is dated 8 Sep 2025. 4.53.0 (**21 Apr 2026**) brought easier review and editing plus **AI Ingredient Suggestions** for hidden extras (for example, butter on toast). Later builds made it faster: matching time fell from 10–15 s to 5–7.5 s per the blog, and 4.47/4.48 notes mention speed. **Verified** (Updates post, [Photo logging blog](https://cronometer.com/blog/photo-logging/)). Speed figures come from search excerpts: **Verified (snippet)**.
- **Workflow:** Tap +, then **Photo Log**. Snap or upload a photo. A review screen lists detected foods with servings. The user can **swap** an item for an alternative (for example, bread type), **add suggested missing ingredients** (oil, butter, condiments), adjust servings, or use **Search For More** (including barcode) for branded items. Add to Diary. **Verified** (Photo logging blog).
- **Data:** Matches only **NCCDB and CFCD** generic entries. For packaged foods, Cronometer recommends the barcode scanner. **Verified** (same).
- **Deferred review:** You can photograph now and review later; "the timestamp updates automatically". **Verified** (Four ways to log).
- Photos can also seed **recipes and meals**. **Verified (snippet)** (Photo Logging support article title and excerpt).
- **User must confirm:** Cronometer says it "can't guess everything perfectly". A size reference (fork, scale reading) improves estimates. **Verified.**
- An independent reviewer calls it "not comparable to dedicated AI-first apps". **Supported** (calorie-trackers.com). No Reddit accuracy evidence found.

#### A12. Natural-language text logging
- No typed natural-language parser found apart from the Recipe Importer's paste-ingredients mode and voice. **Unverified** (absence of evidence).

#### A13. Import
- **No food-diary import** from MyFitnessPal or CSV. Staff said it was unsupported (2018–2019). **Supported** (forum). No 2026 evidence of a change. Health-app backfill covers activity and biometrics, not food. **Supported.**

---

### B. Search and database

- **Sources:** NCCDB (University of Minnesota; about 17,000 foods with about 70 nutrients) and USDA SR28 (8,000+ foods) are the core lab-analysed sets, plus CNF, NUTTAB, CoFID, NEVO, IFCDB and CFCD. Label-level sources: **CRDB** (Cronometer's curated user-submitted database), **UPC** (USDA Branded) and **Nutritionix**. **Verified** (Accurate data tips). **Verified (snippet)** (data sources 360018239472).
- **Source labels:** Each result shows its **source**. Cronometer advises checking the source column and the **nutrient count**: an entry with 50 or fewer nutrients is probably label-only, and 70+ means a full profile. **Verified** (Accurate data tips).
- **Auto-gap-fill:** When a similar lab-analysed entry exists, Cronometer "cross reference[s] and automatically add[s] the nutrients that the entry is missing". This shows as **two listed sources and a magic-wand icon**. **Verified** (same). AI-estimated water content for branded items arrived in 4.16.0 (Dec 2023). **Verified** (Updates post).
- **Lab data on branded foods:** "Many branded foods now include lab-analyzed nutrient data" (4.1.0, Jan 2023). **Verified.**
- **Curation:** CRDB entries are "checked by a staff member before being made readily available". Unverified foods are not auto-added to the public database. **Verified** (Accurate data tips, Barcode blog). This contrasts with crowdsourced competitors.
- **Conflict:** The support article calls CRDB "the most accurate and complete". The blog says CRDB is "typically limited to the nutrients listed on the nutrition label". Both are Cronometer sources. **Conflict noted.**
- **Filters:** Use the filter button, or the **Common** tab for the richest data. One forum user said Common still showed user items. **Supported**/**Unverified.**
- **Size:** "Over 1M lab-analyzed or verified foods" (Gold page). "1.1 million verified foods" (App Store). "1.2 million" (Play text mirror). A reviewer cites 970k. **Conflict**, but all are an order of magnitude below MyFitnessPal's ~14M. The large-DB vs accuracy trade-off is explicit in Cronometer's positioning.
- **Nutrients:** "Up to 84" (Gold page Basic column), "up to 95" (Gold page and App Store), "up to 92 nutrients and compounds" (4.51.1, 25 Feb 2026), "82" (an older listing). **Conflict.** The likely explanation is that new compounds were added over time and listings were not synced. Cronometer's own pages disagree with each other.
- **Duplicates:** Search can surface many near-identical entries and foods the user never ate, ranked above eaten ones. **Supported** (forum pet-peeves thread, 2021).
- **Serving units and switching:** Each food has a unit picker (g, oz, household measures, label serving). Extra custom units need a gram weight. Fractions are not supported, and some liquids lack 1 mL units. **Supported** (forum 2021; may be outdated).
- **Raw vs cooked:** These are separate generic entries (NCCDB/USDA naming). Cronometer advises weighing food in grams to avoid volume ambiguity. **Verified** (Accurate data tips). There is no automatic raw-to-cooked converter except recipe cooked weight. **Unverified.**
- **Package sizes:** Some products default to 100 g instead of the package weight. **Unverified** (forum 2021).
- **Editing foods:** Public foods cannot be edited. Use Edit a Copy to make a custom food. **Supported.**

---

### C. Nutrition

- **Energy target:** Calculated by default from the **Weight Goal** (rate of change). Advanced settings allow a fixed custom target and the choice to add exercise above baseline. **Verified (snippet)** ([support 31975503009044](https://support.cronometer.com/hc/en-us/articles/31975503009044)).
- **Energy expenditure:** **BMR** from profile age, height, weight and sex. **Baseline activity** is a lifestyle multiplier; sedentary is about 0.2×BMR per a forum post. Logged or synced exercise is added. **TEF** is optional. Staff suggest setting baseline to sedentary when a tracker measures activity. **Supported** (staff forum replies).
- **Energy Summary UI:** Three interactive circles at the top of the Diary: **Consumed** (tap for a macro breakdown with %), **Burned** (BMR + baseline + exercise), and **Target / Balance**. Balance shows the net deficit or surplus. Toggle top-right. **Verified (snippet)** ([Diary Overview 360018171731](https://support.cronometer.com/hc/en-us/articles/360018171731-Diary-Overview), [Energy Summary blog](https://cronometer.com/blog/cronometers-energy-summary/)).
- **Macro targets:** Under More > Targets: **Macro Ratios** (% of energy, auto-adjust when energy changes), **Fixed Targets** (grams; defaults to DRI macro RDAs), and **Keto Calculator** (Rigorous / Moderate / Relaxed / Custom; protein from lean body mass). Choice of **total vs net carbs**. **Verified** ([Targets blog, 21 Aug 2024](https://cronometer.com/blog/how-to-set-your-macro-and-micronutrient-targets)).
- **Macro Scheduler** (different targets per weekday) is Gold. **Verified** (Gold page).
- **Macro bars:** Each bar shows % of the daily target. Tap Consumed to switch to **Remaining**. **Verified (snippet)** (Diary Overview). A 2023 App Store review still complained that remaining macros were not shown. This may be a widget or platform gap. **Unverified.** Bars can exceed 100%. **Supported.**
- **Micronutrient targets:** Default to DRI (RDA/AI) by age and sex, with **UL as Max Threshold**. Customise per nutrient (toggle Custom, then Daily Target + Max Threshold). You can also edit from the Nutrition Report. A **Visible** checkbox controls which nutrients show in the Diary. **Verified** (Targets blog). **Verified (snippet)** ([DRI article 360038286012](https://support.cronometer.com/hc/en-us/articles/360038286012-Mobile-Dietary-Reference-Intakes-DRIs)).
- **Nutrient Target Summary:** Grouped bars (General, Carbohydrates, Lipids, Protein/amino acids, Vitamins, Minerals) showing % of target per nutrient for the day. This is the signature screen. **Verified (snippet)** (Diary Overview lists the Nutrient Target Summary and Nutrient Balance Charts). The exact grouping comes from review descriptions: **Supported.**
- **Per food / meal / day:** The food detail screen shows the full nutrient panel for the chosen amount. The Diary shows day totals. Selecting entries shows the totals for that subset. Diary-group subtotals: **Unverified.** Recipes show whole-recipe and per-serving breakdowns. **Verified** (Recipes blog).
- **Missing data handling:** Label-only foods have blank (not zero) values for untracked nutrients. A third-party tool notes that blank means "no data" and 0 means a recorded zero, and exports can collapse blanks to 0. The desktop diary shows **N/T** markers for nutrients without data (a forum complaint about grey circles on N/T nutrients). Some nutrients with scant data (fluoride, iodine, molybdenum) are hidden by default. **Supported** (forum and third-party). No official "data completeness %" indicator found.
- **Mark day complete** affects averages. Reports offer All / Non-Empty / Complete days. **Supported.**
- **Rounding / per 100 g:** No documentation found. **Unverified.**
- **User corrections:** You cannot override a nutrient on a public entry. Use a copy. Editing calories in the web diary rescales the serving amount instead. **Supported** (staff forum).

---

### D. Diary organisation

- **Diary groups:** These are labels such as Breakfast / Lunch / Dinner / Snacks. They are renamable in Diary Settings (tap the text), with a reported maximum of 8. They became **available to all users** in May 2024 (4.22.x). **Verified** (Updates post, 6 May 2024; Gold page lists groups under Basic). Older forum posts calling groups Gold-only are **outdated (conflict resolved by date)**. Groups cannot be reordered. **Unverified** (dated forum).
- **Timestamps (Gold):** More > Display > "Show timestamps in diary". The time-of-day box is then ticked by default when adding. **Verified (snippet)** ([support 360021811032](https://support.cronometer.com/hc/en-us/articles/360021811032)). Gold page lists it. **"Sort All Entries By Time"** for Gold came in 4.8.0. **Verified** (Updates post).
- **Edit quantity:** Tap the entry, change the amount or unit, save. **Supported.**
- **Delete:** Swipe, then delete, with an **Undo** prompt (4.3.0, Mar 2023). **Verified** (Updates post).
- **Reorder:** Drag within or between groups on web and app. Awkward on mobile because the list does not auto-scroll while dragging. **Supported** (forum). Android bug: editing reordered entries within a group. **Unverified.**
- **Date navigation:** Arrows and a date picker at the top of the Diary. Android off-by-one bugs reported in 2021. **Unverified.**
- **Favourites / recent / custom:** These are tabs in search. Star a food on its detail screen to favourite it. **Verified (snippet)** (support 360018193011).
- **Repeat Items (Gold):** Swipe right, then ⋮, then Repeat (mobile), or right-click (web). Set amount, serving, time, group and weekdays. A Diary **banner** prompts you to log today's repeats, so they are not auto-logged silently. Items can be paused or deleted. **Verified (snippet)** ([support 16510562495764](https://support.cronometer.com/hc/en-us/articles/16510562495764-Mobile-Set-Repeating-Foods)). Prompts are for today only. **Supported.**
- **Mark Day Complete:** Locks the day against edits (it can be reversed) and filters reports and trends to complete days. All days default to Incomplete. **Supported** (staff forum).
- **Fasting timer:** Gold. **Verified** (Gold page). Out of scope beyond that.
- **Water:** Diary water widget, 4.27.1 (Aug 2024). **Verified.**
- **History edits:** Free users can open and edit any past day. Gold "unlimited historical data" refers to reports and charts beyond the 7-day window. **Verified** for the 7-day report limit (Gold page). Free diary-browsing limits: **Unverified**; no source says past days are locked.
- **Empty states:** No documentation found. **Unverified.**

---

### E. UI flows (as documented; not observed)

1. **Diary screen:** Date bar. Energy Summary (3 circles) plus macro bars (Consumed/Remaining toggle). Diary groups with entries (food, amount, kcal). Exercise, biometric and note entries interleave in the same list. Nutrient Target Summary below. Floating orange **+** menu, customisable with long-press-wiggle reordering. Top-right ⋮ menu: Copy / Paste / Multi-Select / Mark Complete.
2. **Add-food flow:** **+** opens a menu: Add Food, Scan Food, Photo Log, Voice Log, plus others. Choosing Add Food opens search with tabs, then the food detail screen, then Add, then back to the Diary.
3. **Search results:** List rows show food name and **source** label. Older complaint: calories not shown in rows, so you must open each one (2021). The options menu offers sort, database filter and Multi-Add.
4. **Food detail / portion:** Amount field and unit dropdown. Diary-group selector. Optional time (Gold). Full nutrient panel with % of targets, live-updating with the amount. Star (favourite). Source(s), with a magic-wand icon if gap-filled. **Supported**; exact layout unverified.
5. **Barcode scan:** Camera viewfinder plus a Type Barcode fallback. On a match, the food detail screen opens. On no match, a Create New prompt leads to label/front/ingredients photos, then a pre-filled custom food form, then save, optionally submitting for review.
6. **Custom food creation:** Label type, name, serving, nutrient fields (label-style), extra servings (gram weight required), save.
7. **Recipe creation:** Name, servings or weight basis, ingredient list (search-add each), cooked weight (Advanced), tags and categories, live nutrition for whole recipe and per serving, save. The Importer variant shows parsed ingredients with unmatched flags to resolve.
8. **Nutrition summary / report:** Diary Nutrient Target Summary (daily). The Nutrition Report is the multi-day average: 7 days on Basic, any range on Gold, plus Custom Charts, Nutrition Scores and PDF reports on Gold.

---

### F. Edge cases

| Case | Behaviour | Label |
|---|---|---|
| Missing food (no barcode) | Create New, photograph the label, AI pre-fills a custom food, log now, optional curation submit | Verified |
| Missing food (generic) | Staff advise the closest Common Foods match, or a custom food | Supported |
| Conflicting data | Several entries from different sources. User picks by source and nutrient count. Lab entries preferred | Verified |
| Wrong serving size | Some products default to 100 g. User changes unit or amount. Custom units need grams | Unverified (2021) |
| Decimals / fractions | Decimals accepted. Fractions not supported (2021 complaint) | Unverified |
| Unit conversion | Mass and volume units per food. Custom-unit gram maths is on the user | Supported |
| Incomplete nutrient data | Blank, not zero. Auto gap-fill from similar lab foods (wand icon). N/T markers on web | Verified / Supported |
| Edit/delete logged item | Tap to edit. Swipe to delete with Undo | Verified |
| Duplicates | Many similar entries. Source filter and Common tab mitigate | Supported |
| Recipe changed later | On save of the **original**, a dialog asks whether to **update past diary entries**. **Edit a Copy** avoids it. No true undo: revert values and update again. **Explode** for one-offs | Supported (multiple staff forum replies) |
| Deleting a custom food | Removes it from past entries. **Retire** preserves history | Supported |
| Offline | **No offline mode.** Staff cited database size and licences that forbid on-device storage (2019–2022) | Supported; 2026 status Unverified |
| Sync across devices | Cloud account. Some reports of web entries not appearing on the phone (2021) | Unverified |
| Export | Settings/More > Account > Account Data > Export Data: **Food & Recipe Entries (servings, with timestamps)**, **Daily Nutrition**, exercises, biometrics, notes as CSV | Supported (staff forum 2024 path) |
| Export on free tier | **Unclear/conflicting.** Older staff reply says free users can export CSV. Another commenter says it is not available on free | Conflict |
| Midnight boundary | Foods logged just after midnight landed in the next day (Android, 2021) | Unverified |

---

### G. Free (Basic) vs Gold, food tracking only

Gold costs **$10.99/month or $59.99/year** (USD) on both the Gold page and the App Store. **Verified.**

| Food feature | Basic | Gold | Source |
|---|---|---|---|
| Search, logging, unlimited entries | Yes | Yes | Gold page |
| Barcode scanner | Yes (free) | Yes | Barcode blog, App Store |
| Label-photo auto-fill when barcode is missing | Yes (no gating found) | Yes | Barcode blog (Supported) |
| Custom foods, Custom Meals, Recipes (manual) | Yes | Yes | Gold page, Updates |
| Cooked recipe weight | Yes (no gating found) | Yes | support snippet |
| Diary groups | Yes (since May 2024) | Yes | Updates post |
| Copy/paste days and entries | Yes | Yes | support snippet |
| Macro and micronutrient custom targets | Yes | Yes | Gold page |
| Nutrients tracked | "up to 84" (page) | "up to 95" (page) | **Conflict** |
| Reports / Nutrition Report window | 7 days | Any range, custom charts | Gold page |
| Photo Log (AI) | No | Yes | Gold page, Photo blog |
| Voice Log / Siri | No | Yes | Gold page, Updates |
| Recipe Importer | No | Yes | Gold page |
| Timestamps, sort by time | No | Yes | Gold page, support |
| Repeat Items | No (Gold page ambiguous) | Yes | App Store lists it under Gold |
| Macro Scheduler | No | Yes | Gold page |
| Oracle nutrient search, Food Suggestions (AI) | No | Yes | Gold page |
| Share custom foods/recipes | No | Yes | Gold page |
| PDF print reports | No | Yes | Gold page |
| Ads | Yes | No | Gold page |
| Offline | No | No | forum |

---

### Strengths to borrow (for an offline-first logger)

1. **Source transparency per entry:** a source label plus nutrient count on every result. Users can judge completeness before logging.
2. **Gap-fill with provenance:** missing nutrients are borrowed from a similar lab food and marked with a second source and an icon. The result is honest and still useful.
3. **Blank is not zero:** missing nutrient values are distinct from recorded zeros. Mirror this in the schema (nullable columns, not default 0).
4. **Consumed / Remaining toggle** on macro bars, and **Target vs Balance** mode on energy.
5. **Barcode miss becomes a custom food in one flow.** The user can log immediately, so the miss never blocks the meal. Label type (US vs EU carbs) is remembered.
6. **Explode recipe/meal into ingredients** for one-off edits without mutating the saved recipe.
7. **Edit a Copy vs Save, with an explicit "update past entries?" prompt** when a recipe changes. This makes history semantics visible. Better still: default to snapshotting, so past entries never change silently.
8. **Retire vs delete** for custom foods preserves history.
9. **Cooked-weight yield** on recipes, logged by grams eaten.
10. **Copy day / copy group / multi-select copy-paste** and **Copy to Today**.
11. **Repeat items surfaced as a confirm banner**, not silent auto-logging.
12. **Undo after delete**, swipe actions, and a customisable + menu.
13. **Mark Day Complete** to exclude partial days from averages.
14. **AI photo/voice as a draft:** results always go through an editable review screen, matched to curated generic foods only, with "suggested hidden ingredients" (oil, butter).

### Weaknesses (user complaints and gaps)

1. **No offline mode at all.** Staff blamed DB size and licensing. This is a clear differentiator for an offline-first app.
2. **No native quick-add calories/macros.** The policy is deliberate, but users keep asking for it.
3. **Slow manual logging:** a reviewer measured 45+ s per meal. Forum reports describe slow search, typing lag and slow diary loads; App Store 4.60.1 notes still mention "improved Diary loading".
4. **Search ranking:** foods never eaten rank above eaten ones. Partial-match handling is weak. Older complaints: no calories and no favourite star in result rows.
5. **Smaller database:** gaps for restaurants, regional and niche foods.
6. **Serving friction:** no fractions, gram weight required for custom units, 100 g defaults on some products, and no scaling of Custom Meals.
7. **Recipe history trap:** editing the original recipe can rewrite past diary entries, with no undo.
8. **Diary ordering quirks:** unstamped entries jump to the top, synced entries land out of order, and mobile drag lacks auto-scroll.
9. **Inconsistent marketing numbers:** nutrient count (82/84/92/95) and DB size (0.97M–1.2M) vary across Cronometer's own pages.
10. **Free/Gold boundary confusion:** CSV export on the free tier is unclear, and Repeat Items is ambiguous on the Gold page.
11. **Dense UI:** reviewers say it can overwhelm new users. No food-diary import from other apps.

---

### Sources

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

---

## Lose It!


Scope: food, meal and calorie logging only (Android + iOS; web noted where relevant). Workouts, challenges, community and social features are excluded.

### Method and access limitations (read first)

- The app was **not** installed. Nothing below comes from hands-on use.
- Several primary sources blocked automated fetching: `loseit.com`, `help.loseit.com`, `my.loseit.com`, Google Play listing pages (returned truncated), `reddit.com` / `old.reddit.com`, `web.archive.org`, and direct fetches of `loseit.zendesk.com` articles (HTTP 403).
- The official help center is now **loseit.zendesk.com/hc/en-us**. Its article text was read through search-engine indexed excerpts, not full-page fetches. Claims sourced this way are labelled **Verified (help-center excerpt)**. Wording may be paraphrased by the search tool; menu paths may differ slightly by app version.
- The Apple App Store listing (US) was fetched directly and is the strongest primary source for tier split.
- Many 2026 "reviews" are competitor content-marketing blogs (Nutrola, NutriScan, Macros.gg, Amy Food Journal, FitBudd, calorie-trackers.com). They often contradict each other and some read as auto-generated. They are used only as **Supported** (if consistent with primary or each other) or **Unverified**.
- Reddit could not be read directly. User-reported behaviour comes from Trustpilot, App Store / Play review quotes surfaced in search, forum posts, and secondary summaries.

Evidence labels: **Verified** = primary source / clearly documented. **Supported** = credible secondary or multiple consistent reports. **Unverified** = single weak source or inference.

---

### Headline findings

1. **Massive 2025–2026 paywall shift.** The official help center says Lose It! is "in the process of moving the barcode scanner (Scan It) and nutrition label scanner to part of our Premium features. Some free members will still have access as we transition, while others will not." The US App Store listing now puts Barcode Scanner, Photo Meal Logging, AI Voice, macro tracking ("Advanced Tracking") and Meal Planning under **PREMIUM PLAN FEATURES**. The free tier is listed as only: Calorie Tracking, Weight Loss Plan, Community Support. **Verified.**
2. **Macros moved behind Premium** in a recent update (free shows calories only, per multiple reports). **Supported** (App Store lists macro tracking as Premium; user quotes and several blogs agree).
3. **Premium price rose to $79.99/yr** (help-center "Membership Tiers & Pricing"; earlier widely quoted at $39.99). **Verified (help-center excerpt).**
4. **Late-2025 redesign** of the log header limits on-screen nutrient display to ~3 values and moved daily summaries behind a calendar. This drew heavy 1-star complaints (Trustpilot Nov 2025–Mar 2026). **Supported.**
5. Core speed patterns remain: meal-scoped Add Food, Search tab that pre-suggests foods you usually eat at that mealtime, a Meals tab of recently logged meals with per-item checkboxes, an "Add Yesterday's [Meal]" shortcut, verified-food green checks with a filter, and swipe-to-adjust serving with live nutrition. **Verified / Supported.**

---

### A. Entry methods

All methods start from the same place. In the app: **Log tab → tap "Add" (Add Food) under a meal (Breakfast / Lunch / Dinner / Snacks)**. The Add Food screen has tabs **Search, My Foods, Meals, Recipes**. Scan It / Snap It / Say It are launched from the Search tab. **Verified (help-center excerpt: "How to Log Food in Lose It!").**
Language limit: "Scan It, Snap It, and Say It are currently only available in English" (device language must be English). **Verified (help-center excerpt).**

#### A1. Text search
- Flow: Log → Add under meal → Search tab → type keyword → results list (green check on verified foods) → tap food → choose **serving unit and quantity** → tap **Add (iOS) / Save (Android)** → Done → food appears under that meal; daily budget/remaining updates. **Verified (help-center excerpt).**
- Before typing, the Search tab shows suggestions: "foods you often eat during the mealtime you pick and your recent meals for that time." Suggestions improve with use. **Verified (help-center excerpt).**
- Web: Home tab → Add Food → pick meal → choose tab → pick food → select serving unit + quantity → Add Food. **Verified (help-center excerpt).**
- Auto vs user: the app calculates nutrition from serving × quantity; the user confirms food, unit and amount.
- Weakness: no spell-correction reported ("when you type in the name of something it doesn't even have like proper spellcheck", Trustpilot, 2026-02-17). **Unverified (single user).**

#### A2. Brand / restaurant search
- Same search box; brand and restaurant entries are in the shared database. No dedicated location-based restaurant menu browser (unlike MyFitnessPal). **Supported** (NutriScan 2026-08-07; competitor source).
- Restaurant user entries vary widely (e.g. a Chipotle bowl entries ranging 500–1,100 kcal). **Unverified** (Amy Food Journal, competitor).

#### A3. Barcode scan ("Scan It")
- Flow: Log → Add Food under meal → **Scan It** → point camera at barcode → matched food opens → pick serving size and quantity → **Add (iOS) / Save (Android)**. **Verified (help-center excerpt: "How to Use the Barcode Scanner").**
- Tier: being moved to Premium; existing free accounts may keep access during transition, then lose it ("Once these features are locked on your account, a Premium membership will be required"). **Verified (help-center excerpt: "Unlocking the Barcode Scanner/Scan It").** App Store lists it under Premium. **Verified.** CSPI already listed the scanner as paid in Jan 2024. **Supported.** Macros.gg reports a fresh account in Aug 2026 saw it paywalled while older accounts are grandfathered. **Supported (competitor, but consistent with official text).**
- Requires device language English. **Verified.**
- Quality: reviewers call it fast and reliable for North American packaged goods. **Supported.** Some users report wrong matches ("90% of the time it pulls up the wrong food", Play review quoted in search). **Unverified.**
- Missing-barcode flow: no official article found describing a "not found → create food" prompt. **Unverified.** The documented fallback is creating a custom food (A9) with the label scanner.

#### A4. Snap It (photo logging)
- **History:** beta launched 2016-09-29. Original flow: choose meal → take photo → see best-guess matches → confirm food → add detail (e.g. protein type) → confirm approximate serving → logged. Trained on Food-101; company claimed 87.3% top-1 / 97.1% top-5 on that dataset. CES 2017 Innovation Honoree. **Verified** (TechCrunch 2016; Wikipedia).
- Model later moved on-device (quantized, hosted via Firebase/ML Kit), runs "without a data connection", and can be updated without an app release. **Verified** (Google ML Kit case study).
- **Current version:** April 2025 press release says "the latest Snap It! model" can identify **all foods of a meal**, using the same food-matching as voice against the database. **Supported** (press release seen via search snippets; direct fetch blocked).
- **Current flow:** grant camera access → Log → Add Food → **Snap It at the top of the Search tab** → take photo or pick from camera roll (icon bottom-left) → app lists **detected foods with estimated serving sizes** → if several matches exist from your My Foods, a **Swap** option lets you change the match → tap **Save**. Tips: keep all food in frame, good light, flash top-left. **Verified (help-center excerpt: "How to Use Snap It").**
- Auto vs user: AI detects items and portions; user reviews, swaps and confirms.
- Tier: "exclusively available to Premium members", English only. **Verified (help-center excerpt).** NutriScan reports 3 free trial uses before the upgrade prompt. **Unverified.**
- Accuracy: reviewers report ~70% category hit rate and unreliable portions (one pasta bowl 400 vs 700 kcal depending on angle). Mixed dishes get generic labels like "stir fry". **Unverified** (competitor tests).

#### A5. Voice logging ("Say It")
- Announced June 2024 ("AI-powered speech-to-text delivering over 98% accuracy", Lose It! on X). **Supported** (X post seen in search results).
- Branded "Say It!" in the April 2025 press release: user describes food, app "immediately matches their selections with the most appropriate food from the database of over 63 million food items." **Supported.**
- App Store example: "Say 'I had 2 eggs, toast with butter and jam' to log your meal" (Premium). **Verified.**
- Help center frames Say It as "search for a food by voice": after speaking, the user picks food, unit and quantity, then Add/Save → Done. **Verified (help-center excerpt).** Whether multi-item utterances become several pre-filled entries in one step is not documented in what I could read. **Unverified.**
- Oct 2026 store promo: "This Fall, Try Voice Logging". **Verified** (App Store).
- Tier: Premium. **Verified** (App Store).

#### A6. Natural-language / AI text logging
- No official evidence of a typed natural-language or chat logger as of 2026-10. Macros.gg lists "photo and typed logging: Premium" without detail. **Unverified.** Treat voice (A5) as the NL entry point.

#### A7. Manual entry / Quick add calories
- I found **no primary documentation** of a calorie-only "Quick Add" in Lose It!. Searches of help-center excerpts returned nothing. One review mentions a "quick-add food log" on the dashboard with no detail. **Unverified.** Do not assume Lose It! has an MFP-style quick add. The documented route for unknown items is a custom food.

#### A8. Custom foods
- Create (web): Settings → Custom Foods → New. Edit (app): Profile → Foods → Custom Foods → select → edit → save. Delete: iOS three-dot menu next to the food; Android checkbox → trash icon. **Verified (help-center excerpt: "Custom Foods").**
- Create (app, with label scanner): iOS Profile → Custom Foods → **+** → camera **Autofill** → align over Nutrition Facts → values fill in → save. Android: New → Use Autofill. Label scanner was integrated into create/edit flows from **app v16.6.601**. Autofill needs Premium. **Verified (help-center excerpt: "How to Use the Nutrition Label Scanner").**
- Label OCR is on-device ML Kit text recognition, usually under a second, read from the live camera view without taking a photo. **Verified** (ML Kit case study).
- Whether custom foods are shared to the public database is not documented. **Unverified.**

#### A9. Saved meals / previous meals
- Lose It! has no separate "create a meal" object that I could verify. The reusable unit is the **Meals tab**: it "lists meals you've logged in the past few weeks"; select a previous meal and **check off which food(s)** to log today. **Verified (help-center excerpt).**
- Shortcut: **"Add Yesterday's [Meal]"** under today's date. **Supported** (help-center excerpt surfaced via search; exact label not independently confirmed).
- Users long praise one-tap previous meals. **Supported** (forum posts, 2012 review, 2024 Fitbit community post).

#### A10. Recipes
- Create: Profile → Recipes → **+** (Create Recipe) → name → **Total Recipe Size** (how much it makes + serving type) → **Add Food** for each ingredient in full amounts (e.g. 1 lb ground beef, 1 cup refried beans, 2 medium tomatoes) → **Portion Size** (under Nutrition) to set one serving → Done/Save. Also on the website. Recipes are available to every account. **Verified (help-center excerpt: "Using Recipes in Lose It!").**
- After save the app calculates calories and macros per serving every time you log it. **Verified (help-center tutorial excerpt).**
- **Import:** "Premium members can import a recipe, or you can create one from scratch." **Verified (help-center tutorial excerpt).** There is a URL **Recipe Importer** and a **Text Importer** (paste ingredient list) fallback for "Unable to locate recipe" / "Unable to reach website" errors. **Verified (help-center excerpt: "Troubleshooting Recipe Importer Error Messages").** CSPI (2024) also lists recipe import as paid. **Supported.**
- Logged like any food from the Recipes tab.

#### A11. Copy previous day/meal
- See A9: Meals tab with item checkboxes plus "Add Yesterday's [Meal]". No whole-day copy documented. **Supported / Unverified (whole-day).**

#### A12. Planned (future) logging
- Premium. Log foods on a future date → they enter **"planned mode"**: greyed out with a **clock icon**. Planning for the *current* day is app-only. **Verified (help-center excerpt: "How to Plan Food in Lose It!").** It does not generate plans or suggest meals. **Supported.**

#### A13. Import from other apps
- No food-log import found. **Unverified (absence).**

---

### B. Search and database

- **Size:** App Store: "56+ million items and recipes"; version notes "over 50 million foods"; April 2025 press release: "over 63 million". Reviewers quote 27M (older). **Verified** (store) / conflicting figures noted.
- **Sources:** USDA records, member-created foods, barcode submissions, and staff-verified entries. **Supported** (CravingWise, citing official pages).
- **Verified foods:** "green check marks can appear next to some search results… Verified Foods." Staff add and update them; they are accurate and more likely to include full nutrition. Results can be **filtered to verified only** from the Search tab. **Verified (help-center excerpt).** CSPI quotes the meaning as "nutritional information reviewed for accuracy and completeness." **Verified (CSPI 2024).** One blog claims the verified filter is Premium. **Unverified (conflicts with help center, which lists no tier).**
- **User-submitted entries:** range from complete to calories-only. **Verified (CSPI).** Complaints of entries with no explanation of serving ("Why do you allow people to put in calories as per serving with no explanation of what that serving is", Trustpilot 2026-02-17). **Supported.**
- **Ranking:** personalised. Pre-search suggestions are mealtime-aware; results are a mix of verified and user foods. Exact ranking logic undocumented. **Verified (suggestions) / Unverified (ranking).**
- **Duplicates:** many near-duplicate user entries reported; no dedup UI documented. **Unverified.**
- **Serving units / switching:** pick serving unit and quantity on the food screen. User claim: grams are available on ~99% of foods. **Verified (unit picker exists) / Unverified (99%).**
- **Raw vs cooked, package sizes:** no specific handling documented. **Unverified.**
- **Serving Size Guide:** compares portions to everyday objects (cards, baseball, dice). **Verified (CSPI 2024).**
- **Editing foods:** you can edit your own custom foods (A8). Removing a food from **My Foods** "does not delete it from search results for other members." **Verified (help-center excerpt).** No public report-food flow found. **Unverified.**
- **Trade-off:** huge crowd-sourced DB gives coverage. A verified badge + filter is the quality lever. Lifetime users still report missing foods ("there are A LOT of foods that just aren't on here", quoted by NutriScan). **Supported.**

---

### C. Nutrition

- **Calorie budget:** computed from starting weight, height, age and gender to estimate baseline burn, minus a deficit for the chosen weekly rate. Visible under Profile → Goals; change via **Weekly Rate**. **Verified (help-center tutorial excerpt).** Calorie schedule (eat more on weekends) is mentioned in store copy. **Supported.** CSPI (2024) lists "customizing your calorie budget" as paid. **Supported.**
- **Remaining:** budget minus food plus any bonus, shown on the Log header. **Supported.**
- **Exercise / Calorie Bonus:** a bonus is earned only once total burn exceeds the **Target Burn**, which equals maintenance calories. Two sources: phone steps (Apple Health / Google Fit / Health Connect) or tracker total burn. Garmin/Fitbit integration requires Premium (Apple Watch excepted). Workouts synced from Apple Health are excluded to prevent double counting, with an "Exclude from Total Calories" toggle. Maintenance is under Log → Budget → Plan (iOS) / Weekly Rate (Android). **Verified (help-center excerpts: "The Calorie Bonus").** Bonuses tend to appear late in the day. **Supported.**
- **Nutrients tracked:** the classic label set is calories, fat, saturated fat, cholesterol, sodium, carbs, fiber, sugar, protein. CSPI said no vitamins, minerals or added sugar in 2024. **Verified (CSPI 2024).** The 2026 App Store copy mentions "vitamins, minerals" under Advanced Tracking, and one review says 25 nutrients. **Supported / conflicting.**
- **Macros:** Premium per App Store. Free shows calories only after a recent update ("The lose it app now doesn't let you see your daily macros without a subscription", r/1200isplenty quote via NutriScan). **Supported.**
- **Nutrient goals:** Premium: "custom goals for water, sleep, and nutrients." **Verified (help-center excerpt: Membership Tiers).**
- **Totals:** per food (on food screen), per meal and per day on the log. Redesigned header shows only ~3 nutrients at once; daily summaries now require clicking through a calendar; weekly summary removed per users; net carbs no longer visible during logging. **Supported** (multiple Trustpilot reviews Nov 2025–Mar 2026).
- **Per serving vs per 100 g:** entries are serving-based with unit options; per-100 g display not documented. **Unverified.**
- **Rounding / missing values:** user foods can be calories-only. The app has no documented handling of blank nutrients. **Verified (incompleteness) / Unverified (handling).**

---

### D. Diary organisation

- **Meals:** Breakfast, Lunch, Dinner, Snacks (default). **Supported.**
- **Custom meal names:** **Premium.** Profile → Settings → **Meal Settings** → set meal names + timed logging reminders. **Supported (help-center tutorial excerpt via search)**; older official X post gives the path "Meal Settings → Change Meal Names". **Supported.**
- **Multiple foods:** each food is added individually; Meals tab and Snap It can add several at once. **Verified.**
- **Edit quantity / delete:** tap a logged item to edit details; swipe to delete (older reviews). Official article "Delete food or exercise from log" exists but its text could not be read. **Supported.**
- **Reorder:** not documented. **Unverified.**
- **Date navigation:** day-by-day on the Log; future dates enter planned mode (Premium). **Verified (planned mode).**
- **Recent / frequent / favourites / My Foods:** My Foods "fills up as you log foods or create custom foods"; items can be removed (iOS: Edit → check → trash). Search pre-suggests frequent and recent foods by mealtime. No explicit "favourites" star documented. **Verified (help-center excerpts).**
- **History edits:** past days are editable. **Supported.**
- **Daily / weekly summary:** in-app Export Data section can schedule automated daily or weekly reports. **Verified (help-center excerpt).** Users report weekly summary view removed in the redesign. **Supported.**
- **Empty states, meal timing:** not documented. Meal reminders can be timed (Premium, Meal Settings). **Supported.** "Nutrient timing" listed as Premium by one review. **Unverified.**

---

### E. UI flows (only what sources describe)

- **Log / diary screen:** daily budget header (redesigned late 2025, ~3 nutrient slots), meal sections each with an Add button, an "Add Yesterday's [Meal]" shortcut, planned items greyed with a clock icon. **Verified / Supported.**
- **Add-food flow:** meal-scoped. Tabs: Search (with Scan It / Snap It / Say It entry points at top), My Foods, Meals, Recipes. **Verified.** A Nov 2025 Play review complained "Now a large panel of redundant buttons pops up when you add food" (148 upvotes). **Supported.**
- **Search results:** list with green checks; verified-only filter. **Verified.**
- **Food detail / portion selection:** choose serving unit and quantity; CSPI describes **swiping to adjust serving size with nutrition updating in real time**. **Verified (CSPI 2024).** I found no source naming the exact wheel layout, so no further detail is claimed.
- **Barcode scan:** camera → match → serving/quantity → Add/Save. **Verified.**
- **Custom food creation:** form with name, serving and nutrient fields, plus optional camera Autofill (Premium). **Verified.**
- **Recipe creation:** name → Total Recipe Size → Add Food per ingredient → Portion Size → Done. **Verified.**
- **Nutrition summary:** per-day totals; deeper breakdown now behind calendar navigation per users. **Supported.**

---

### F. Edge cases

| Case | Behaviour | Label |
|---|---|---|
| Missing food | Create a custom food (manual, or Premium label Autofill). No documented barcode-miss prompt. | Verified / Unverified |
| Conflicting data | Prefer green-check items; filter to verified. | Verified |
| Wrong serving sizes | Common in user entries; users advised to weigh in grams (e.g. 85 g listed as 10 shrimp vs 13 actual). | Supported |
| Decimals / fractions | Quantity + unit picker; fraction handling not documented. | Unverified |
| Unit conversion | Unit picker with grams available on most foods (user claim). | Unverified |
| Incomplete nutrients | User entries may be calories-only. | Verified (CSPI) |
| Edit / delete logged item | Tap to edit; delete via swipe or official delete article. | Supported |
| Remove from My Foods | Does not remove from others' search results. | Verified |
| Duplicates | Many; no dedup tool documented. | Unverified |
| Recipe edits vs past entries | Third-party guides claim edits affect future logs only; official text not readable. | Unverified |
| Offline logging + sync | Local data is stored on the device and synced to loseit.com. On re-login or reconnection the user must choose device data **or** loseit.com data: "merging data is not possible". Un-synced data can be lost when switching sign-in method. Snap It and label OCR run on-device. A general "works offline" statement was not found. | Verified (sync semantics) / Unverified (full offline logging) |
| Sync across devices | All devices must be signed into the same loseit.com account. | Verified |
| Export | Web: sign in at my.loseit.com → go to `loseit.com/export/data`, download starts automatically (full account export). Insights tab (old export) removed. Exercise export not available; no weight-only export. App: Profile → Export Data → automated daily/weekly reports. CSV file names in blogs not confirmed. | Verified (help-center excerpts) |

---

### G. Free vs Premium (food tracking only)

| Feature | Free | Premium | Label |
|---|---|---|---|
| Text search, logging, daily calorie budget | Yes | Yes | Verified |
| Verified-food green checks + filter | Yes (no tier noted officially) | Yes | Verified / one conflicting blog |
| My Foods, Meals tab, previous meals | Yes | Yes | Supported |
| Custom foods (manual) | Yes | Yes | Supported |
| Recipe builder (manual) | Yes ("available to every account") | Yes | Verified |
| Recipe import (URL / text) | No | Yes | Verified |
| Barcode scanner (Scan It) | Legacy accounts only, during transition | Yes | Verified |
| Nutrition label scanner (Autofill) | No (transitioning) | Yes | Verified |
| Snap It photo | No (possibly 3 trial uses) | Yes | Verified / Unverified trial |
| Say It voice | No (possibly 3 trial uses) | Yes | Verified / Unverified trial |
| Macro display / tracking | Removed from free recently | Yes | Supported |
| Custom nutrient goals | No | Yes | Verified |
| Custom meal names + reminders | No | Yes | Supported |
| Future meal planning (planned mode) | No | Yes | Verified |
| Custom calorie budget / schedule | Limited | Yes | Supported (CSPI 2024) |
| Ads | Yes | Ad-free | Supported |
| Price | — | $79.99/yr (help center); lifetime offers seen $49.99–$59.99 in App Store IAP list; promos vary | Verified / Supported |

---

### Strengths to borrow (for an offline-first logger)

1. **Meal-scoped entry.** Tapping Add under a meal pre-sets the meal, so the user never picks a meal again later. Cheap and fast.
2. **Mealtime-aware suggestions before typing.** Show foods usually eaten at this meal plus recent meals for that slot. Many logs need zero typing.
3. **Previous meal with per-item checkboxes**, plus an **"Add Yesterday's [Meal]"** one-tap shortcut. Handles the "I ate almost the same thing" case.
4. **Swipe/scroll serving adjuster with live nutrition preview.** Instant feedback on the calorie impact of a portion.
5. **Verified badge + "verified only" filter.** A simple trust signal on top of a noisy database.
6. **Label OCR inside the create-food form**, on-device and sub-second, from the live camera without a shutter press. Also works offline.
7. **On-device recognition models** that update outside app releases (Firebase-hosted). This fits offline-first.
8. **Recipe model:** total size + ingredients in full amounts + portion size gives auto per-serving nutrition. A text-paste importer is the fallback when a URL import fails.
9. **Planned mode for future entries** (greyed + clock icon). Planned items stay visually distinct from eaten items.
10. **Removing from "My Foods" is non-destructive.** It hides the item personally and never deletes shared data.
11. **Serving Size Guide** with everyday-object comparisons for people without a scale.

### Weaknesses / user complaints

1. **Paywalling core features after sign-up** (barcode, label scanner, macros). Grandfathering makes behaviour inconsistent between accounts. This causes a major trust backlash. (Verified paywall; Supported backlash.)
2. **Price doubled** from ~$39.99 to $79.99/yr. (Supported.)
3. **Redesign regressions:** only ~3 nutrients visible in the header, net carbs gone from the logging view, daily summary behind a calendar, weekly summary removed, cluttered add-food button panel. (Supported, many 1-star reviews Nov 2025–Mar 2026.)
4. **Crowd-sourced data quality:** servings without context, calories-only entries, duplicates, and wide variance for restaurant items. (Supported.)
5. **Search lacks typo tolerance.** (Unverified, single user.)
6. **Snap It accuracy:** portion estimates unreliable and mixed dishes labelled generically. (Unverified, competitor tests.)
7. **English-only** for Scan It / Snap It / Say It. (Verified.)
8. **Sync conflicts force a device-vs-cloud choice with no merge.** Data loss is possible. (Verified.)
9. **No verified calorie-only quick add.** (Unverified absence.)
10. **Limited micronutrients** compared with Cronometer. (Supported.)
11. **Export is coarse:** full-account web export only, no exercise export, and saved meals and recipes reportedly not exported structurally. (Verified / Unverified for recipes.)

---

### Sources

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

---

## MacroFactor


Researched 2026-10-25. Scope: food logging in MacroFactor (Nutrition app) on Android and iOS, by Stronger By Science Technologies. Workouts, coaching-algorithm internals and community are out of scope.

**Method and limits.** Desk research only. The app was not installed or used. Primary sources are the help centre (help.macrofactorapp.com), company articles and release notes (macrofactor.com, which redirects from macrofactorapp.com), and the App Store listing. The Google Play page did not render through the fetch tool. Reddit could not be reached (the search tool blocks reddit.com), so user complaints come from App Store reviews and third-party aggregators. Those aggregators are labelled Supported or Unverified as appropriate.

**Evidence labels.** **Verified** = primary source or clearly documented. **Supported** = credible secondary source or several consistent reports. **Unverified** = a single weak or secondary source, or an inference.

**Product framing.** MacroFactor is subscription-only. It has a 7-day free trial and no free tier (Verified, App Store listing). It sells itself on (1) the fastest food logger, measured by its own "Food Logging Speed Index" (FLSI), (2) a verified database, (3) a timeline-based log in place of meal slots, and (4) adaptive targets. Logging is the main way users interact with the app.

---

### A. Entry methods

All methods sit inside one "unified" logger. A ribbon or tab bar switches between them without leaving the screen. Foods from several methods collect on a **Plate** (a staging area) and are logged together with one "Log Foods" tap. The help centre names five primary methods: Scan (barcode/label), Search, Quick Add, Describe, and Library (custom foods and recipes). AI photo logging is added as an "AI" tab. — **Verified** [S1]

**Ways in to the logger** (Verified [S1]):
- Home-screen widgets (Android and iOS) open food search or the barcode scanner in one tap.
- Long-pressing the app icon offers Search or Scan.
- A customizable toolbar appears on the Dashboard, Food Log and Strategy pages.
- The big "+" quick-actions menu on primary pages.
- The small "+" beside an hour on the timeline logs straight to that hour.
- "Create & Add" in the custom food or recipe creator saves the item and puts it on the plate.

#### A1. Text search
Flow (Verified [S1]): open the logger, then Search.
- **Before typing**, the list shows Favorites at the top, then "hourly go-tos" (foods you often log around the current hour, weighted by recency and frequency), then "Latest". Scrolling down dismisses the keyboard to reveal Latest.
- **While typing**, results are grouped into four sections: **From History, Custom, Common, Branded**. A "+15"-style arrow expands a section.
- Tapping a result opens the food detail screen. It shows the name, kcal and macros, a unit and quantity picker, **Add** (stage on the plate) or **Log Foods** (log everything on the plate now), **To Custom** (copy into an editable custom food), and more nutrition below.
- Tapping the small "+" on a result tile **multi-adds** it to the plate with no detail screen.

What is auto versus confirmed: ranking and suggestions are automatic. The serving is confirmed by the user, or implicitly accepted on multi-add.

#### A2. Brand / restaurant search
There is no separate restaurant mode. Branded items appear in the "Branded" section, and the help centre advises adding the manufacturer or restaurant name to the query (Verified [S1]). The company admits restaurant coverage is weak: "Coverage is not as strong for restaurant food items" (Verified [S5]).

#### A3. Barcode scan
Scan tab: centre the barcode and MacroFactor pulls the food from its barcode database (Verified [S1]). Every branded product in both the standard and legacy databases can be found by barcode. Legacy branded foods act as a barcode backup (Verified [S9]).

**Missing barcode flow** (Verified [S6][S8]): if no match is found, the app "will automatically swap over to the label scanner". The user scans the label and taps Done. The custom-food wizard then opens with the **barcode, serving info and nutrition pre-filled**. The user names the food and logs it. Help article 5 adds that when a barcode scan fails, tapping "Done" brings up "Create Food". From then on, scanning that barcode returns the user's custom food (Supported: search snippet of the help centre / Food Logger page [S2]).

#### A4. Label scanner (nutrition-label OCR)
- Released in v2.5.0. The help page was updated 2024-01-16 (Verified [S8]).
- Flow: Scan tab, then the "label" tab, then point the phone at the label. Values fill a **mock label in real time**. Tap Done to open the pre-filled custom-food wizard (Verified [S6][S8]).
- Reads calories, macros and micronutrients. It makes "a best effort attempt" at serving type and weight (Verified [S6]).
- Optimized for US and Canadian labels. English, German, French and Spanish international labels are supported experimentally (Verified [S8]).
- Known failure modes: dark or over-exposed light, glare, low contrast, round packages and tiny labels. The help centre suggests wavering the phone slightly left and right (Verified [S6]).
- There is also **"Import with AI"** in the custom-food creator. It takes a photo of the package front plus the label, the user taps "Analyze", then reviews and edits the generated fields (Verified [S7][S20]).

#### A5. Manual entry / custom foods
Wizard (Verified [S7]). Entry points: + > New Food, Library > +, the label scanner after a failed scan, or "To Custom" from any food (which shows all steps on one screen).
1. **General:** choose Build from Scratch or Import with AI, then enter an icon, name, brand and barcode (scan it or type it manually).
2. **Serving:** choose a basis of **Serving / 100 g / 100 ml**. Per serving: serving weight (g, switchable to ml), quantity and serving name. Per 100 g/ml: an optional portion weight and name (for example "3 blocks").
3. **Nutrition:** choose the entry order (US label, non-US label, or the in-app detail order). Toggles cover kJ/kcal, sodium/salt (salt is converted to sodium) and IU or mcg/mg for vitamins A, D and E. Micronutrients are optional: "Leave blanks where labels don't list them."
4. Save with **Create** or **Create & Add**.

An optional consent slider submits the food to the public database (see B). Library actions on a custom food: Edit, Share (link), Duplicate, Delete (Verified [S1]).

#### A6. Recipes
Creation flow (Verified [S10]): + > New Recipe > Build from scratch.
1. Enter a name and number of servings.
2. Add Ingredients (using any search method).
3. Optionally add preparation steps and notes.
4. Save with Create or Create & Add.

- **Total Weight (cooked weight):** enter the finished dish weight to log by mass. The raw-ingredient sum shows in grey as a reference. The field accepts grams only, but logging can use any mass unit. Since v5.2.2 (2025-07-29) the field is **no longer auto-filled** with the summed weight, because cooking loses 5–50% of the water (Verified [S10][S11][S12]).
- **Serving Quantity:** for count-based portions, for example "24" cookies so the user logs "1 cookie". Leave it at 1.0 when logging by weight (Verified [S10]).
- **Import:** "Import from Link" (machine-readable recipe formats, with AI best-effort parsing for other sites) and "Import with AI" (photograph a cookbook or handwritten list). Both fill name, servings, ingredients and method (Verified [S10][S12][S13]).
- v5.2.2 also added recipe icons, source URLs, a Recipe/Serving nutrition toggle, and reordering of steps and foods (Verified [S12]).
- **Recipe actions:** To Custom, Prepare, **Explode** (break the recipe into its ingredients on the plate, so they can be adjusted for one meal without editing the saved recipe), and Expand Ingredients on the plate (Verified [S1][S13]).
- **Selected foods to recipe:** select logged foods on the timeline and add them to a new recipe (Verified [S14]). Describe output can also be turned into a recipe (Verified [S10]).
- **Sharing:** a link sends ingredients, notes and steps to another user (Verified [S13]).

#### A7. Saved meals / multi-add
- There is **no separate "meal" object**. The official "save a meal" approach is to save the food group as a recipe and explode it later to swap items (Verified [S13]; help article "Save a Meal for Later Use" seen in search results).
- **Multi-add:** tap the "+" on each search tile, open the plate, adjust quantities, then Log Foods. If the tile highlight is set to something else, swipe a food left-to-right to reveal Multi-Add (Verified [S15]).
- The FLSI article notes: "Multi-add is only faster when a food already has the correct serving and quantity saved from the last time you logged it." This implies the last-used serving is remembered per food (Supported [S3]).

#### A8. Copy / paste from previous days
See D3. Users can copy a single food, several foods, a whole hour or a whole day, and paste to any hour, date or several dates (Verified [S16][S14]).

#### A9. Quick add
Enter Energy, Protein, Fat, Carbs and Alcohol, plus an optional name. Tap Log Foods to log now, or Quick Add to stage it on the plate. Quick-adds are **not saved** for future search (Verified [S1]).

#### A10. "Describe" (AI natural-language logging)
Verified [S17]:
- Flow: logger > **Describe** (the far-right tab, which can be pinned to the toolbar). The user types or dictates with the **keyboard microphone**, taps **Find Foods**, and the matched foods land on the plate. The user reviews, adds or removes items, adjusts quantities, then logs.
- Parses quantities ("one cup", "100g") and **calorie-sized requests** ("500 calorie bean burrito" returns a generic burrito scaled to about 500 kcal, with full micronutrients).
- **Searches only the common/generic database, not branded foods.** "Applebee's cheeseburger" returns the generic cheeseburger.
- Compound descriptions ("bread with added seeds") may be split into separate items with default quantities.
- Results are described as estimates that are "pretty close".

#### A11. AI photo logging
- Launched as an **open beta in v5.0.0 (2025-03-30)**: "will remain in Beta while we improve its accuracy" (Verified [S18]).
- Flow (Verified [S19]):
  1. Tap + > **AI** (it can be added through Shortcuts & Toolbar settings).
  2. Choose **Photo**, **Photo & Text**, or **Upload** (from the gallery).
  3. The analysis opens the **Plate** with estimated items and servings.
  4. Edit quantities and units, Expand Ingredients or Explode recipes.
  5. Tap Log Foods.
- **Database-grounded:** several LLM prompts break the meal into ingredients and recipes, then query MacroFactor's database for real foods, prioritising "real, lab-analyzed results". The output is not a single opaque estimate (Verified [S20]).
- Tips: good light, top-down shot, foods spread out, a fist or object for scale, or the plate on a food scale. Several packaged items in one photo with labels facing the camera works, but **branded items may default to a serving instead of the scale weight** (Verified [S19][S13]).
- No quantitative accuracy figures are published. The company's own examples include rice undercounted (1 cup instead of 2) and sandwich ingredients bundled into one recipe (Verified [S20]).
- The 10-features article (updated 2026-07-13) says a "newer generation" of the AI is in development (Supported [S13] search summary).
- Tier: no separate AI tier or usage cap was found in any source. It appears to be included in the subscription (Unverified, absence of evidence).

#### A12. Voice
- On the phone: dictation through the keyboard microphone into Describe (Verified [S17]).
- On Apple Watch (v5.4.0, 2025-09-09): "log with AI using natural voice input", 8 watch-optimized workflows, favourites, recipes, copy/paste and a compact editor (Verified [S21]).
- No Wear OS equivalent was found (Unverified).

#### A13. Timeline versus meal slots
MacroFactor has **no Breakfast/Lunch/Dinner slots**. Foods are timestamped on a day **timeline**: "The timeline represents the day as it is rather than what it 'should' be." Foods logged from the search toolbar go to the current hour. Timeline 2.0 shows minute-level timestamps. The App Store listing frames this as not requiring "a set number of meals". — **Verified** [S14][S22]. Some App Store reviewers prefer meal-based logging (Supported [S22]).

#### A14. Import
- No import of food-level history from MyFitnessPal or other apps was found.
- Health integrations (Apple Health, Health Connect, Fitbit) import **daily calorie and macro totals only**. These appear on the Nutrition page, not in the food timeline. This allows a "bring your own food logger" setup (Verified [S23]).
- A competitor blog says no tracker offers a one-click MacroFactor import (Unverified, competitor source).

---

### B. Search and database

- **Size:** about 1,360,000 "verified" items in the standard database (about 1,040,000 in legacy) (Verified [S9][S5]).
- **Common foods:** about 26,500 "micronutrient-complete, research-grade" generic foods, largely from the **NCC Food and Nutrient Database** (Verified [S9][S24]).
- **Branded foods:** branded data plus verified user submissions. Coverage is "great in the Anglosphere, and hit-or-miss elsewhere". Barcode coverage is strong in the US, CA, UK, AU, IE, NZ, JP, FR and ES, with Germany improving (Verified [S5]).
- **Legacy versus standard:** the legacy database is run by a third party, so MacroFactor "can't add foods, fix broken entries". Standard is the default since v1.2.4. Standard search is "typo tolerant" and 2–4x faster on regional servers. It can show macros directly in the results. Common foods use icons instead of photos (Verified [S9]).
- **Is it user-submitted? Sources conflict.**
  - The help centre (article 25) says the database is "highly vetted research databases, and verified user-submitted entries … checked for accuracy by other humans before the foods are added" (Verified [S5]).
  - The v2.7.0 release notes (2024-04-08) and help article 246 say submissions are opt-in from the custom-food creator. They are **machine-validated** (an automatic sanity check: "100 Calories and 300 grams of protein" gets flagged), sent to **Open Food Facts**, and "not guaranteed to be manually verified by a human". Accepted foods appear in about 24–48 h (Verified [S25][S26]).
  - Not eligible: Common Foods, recipes, foods created in the past, and "To Custom" copies of licensed entries. Required fields: brand, name, barcode, serving weight or volume, kcal and macros (Verified [S25][S26]).
  - **Conclusion:** the database is not free of user submissions. It is gated, opt-in and validated, and much smaller than MyFitnessPal's crowd-sourced database.
- **Search UI:** sections are From History / Custom / Common / Branded, with expandable counts. Before typing, the list shows Favourites, then hourly go-tos, then Latest (Verified [S1]).
- **Ranking:** "intelligence that surfaces better results". The algorithm is not documented. Personal history and hour-of-day patterns drive the suggestions shown before typing (Verified [S9][S1]).
- **Hourly go-tos** can be pruned (help article 49, "Delete a Food From Your Hourly Go-Tos", listed in [S27]).
- **Serving units:** standard foods offer derived units where possible (g, lb, oz, ml, cup, fl oz, tsp, tbsp) (Verified [S9]). Users can pin up to **two favourite weight units and two favourite volume units** (More > Food Log > Measurements). These move to a priority position in the serving selector (Verified [S28][S29]).
- **Quantity picker:** unit plus quantity. Switcher arrows toggle the input to **kcal or a macro**: pick a unit first, tap the switcher, make sure the flame icon is active, and enter target calories. The app computes the amount (for example grams to cook or serve) (Verified [S30][S13]).
- **Raw versus cooked:** no dedicated raw/cooked toggle is documented. Common foods carry separate entries per preparation (inferred from NCC sourcing: Unverified). For recipes, the cooked-weight guidance is explicit (Verified [S10]).
- **Duplicates and quality:** the company claims curation gives "fewer duplicates and fewer entries with wrong nutrition data" (Verified [S5]). Reviewers say the database is cleaner than crowd-sourced apps (Supported [S31][S32]).
- **Staleness:** entries can lag behind manufacturer reformulations (Verified [S5]).
- **Editing foods:** database foods cannot be edited directly. The user taps **To Custom** to make a private, editable copy, and can link their own barcode to it (Verified [S1][S5]). Corrections go through a new submission. There is no separate "report wrong data" channel in the help centre (Verified [S26]).
- **Size versus accuracy trade-off:** a smaller, curated database gives cleaner results and full micronutrients for generic foods. The cost is missing niche and restaurant items, which forces users to create custom foods. About 20% of analysed feedback mentions this (Supported [S33][S32]).

---

### C. Nutrition display

- **Targets in the food log:** daily calorie and macro **bars** sit at the top of the timeline and the logger. **Swiping** the bars toggles **Consumed and Remaining** (left-to-right goes to remaining). Dashboard widgets ("Nutrition & Targets", "Food Log Focus") have a Consumed/Remaining tap toggle (Verified [S34]).
- While logging, foods appear as icons under the target bars as they are added. Plate totals toggle between **Plate and Day**, and "Show All Nutrients" shows the full micronutrient profile, for planning portions (Verified [S1]).
- The Logger Banner is configurable: which nutrients it shows, current meal or whole day, a plate indicator, and a persistent date/time picker (Verified [S29]).
- **Calendar banner:** shows the week with intake against each day's calorie target. Indicators deliberately **do not turn orange or red** (a non-judgemental design) (Verified [S14]).
- **Hour summaries:** macro summaries above each hour of the timeline. The default view also shows the gaps between feeding windows (fasting periods) with a nutrition profile per window (Verified [S14]).
- **Macros:** energy, protein, fat, carbs and alcohol (alcohol is a quick-add field) (Verified [S1]).
- **Fibre, sugar, saturated fat, sodium and micronutrients:** the **Nutrient Explorer** (updated 2025-09-12) is configurable. The user chooses which nutrients appear across the app (Verified [S24]).
  - **Targets:** auto-set from age, sex, weight and programme, and updated continuously. They show the RDA as the target plus a **floor** and a **ceiling** (upper tolerable limit). Each nutrient can be set to Auto, Custom or None, and a custom goal can set any of floor, target or ceiling (Verified [S24][S35]).
  - Up to **8 nutrients can be pinned** to the dashboard (Verified [S24]).
  - **Contributors:** ranks the day's foods by their share of a chosen nutrient (percent and amount). Weekly and monthly trends are available (Verified [S24][S13]).
- **Nutrition Overview:** opened from the food log's three-dot menu, or by tapping the bar at the top of the timeline. It shows day totals and averages for week, month, quarter or year, and the top 3 contributors (Verified [S36]).
- **Per food:** the food detail screen shows macros and scrolls to micronutrients. Editing a logged food shows the same breakdown (Verified [S1][S37]).
- **Per 100 g versus per serving:** custom foods are entered on one basis, chosen by the user (Verified [S7]). Recipes toggle Recipe and Serving views (Verified [S12]).
- **Missing nutrient values:** branded products often lack micronutrients. The company recommends using Common Foods or breaking branded items into common foods (Verified [S24][S13]). How missing values are shown (blank, zero, or flagged as incomplete) is **not documented** (Unverified).
- **Rounding:** not documented (Unverified).

---

### D. Diary organisation

#### D1. Timeline
- The day is a vertical timeline of hours. Each food tile is timestamped.
- Display options (Verified [S14][S29]):
  - show or hide timestamps, hide empty hours, collapse an hour into one row, toggle hour summaries
  - left or right alignment
  - tile density (Comfort or Compact)
  - tile info (macros, weight, serving)
  - tile **highlight element** (Multi-Add, Energy, Edit, or None)
- The company cites 4,608 combinations of settings.
- **Time logging preferences:** a standard Date Time Picker (default), or a "Time Pad" where one tap sets the time (Verified [S38]).
- To log to a past or future date or time from the plate, tap the calendar icon, then "Log to Date and Time" (Verified [S1]).

#### D2. Edit, delete, move
- **Edit:** tap the food tile, then **Edit** in the bottom menu. Change the serving and quantity and view nutrition. With the Edit highlight enabled, one tap on the tile's edit icon opens the editor directly (Verified [S37]).
- **Delete and move:** these have separate help articles that were not fetched. **Selection mode** offers View / Copy / **Move** / **Remove** for selected foods, plus changing the timestamp of a group of foods (Verified [S14]).
- **Reorder:** foods are ordered by timestamp. Changing the time is the way to reorder (Supported, inferred from [S14]).

#### D3. Multi-select and copy/paste
Verified [S16][S14]:
- **Selecting:** tap foods to build a selection, which persists **across days**. Tap the hour button to select a whole hour, or use "Select Day" / "copy day" from the top-left menu.
- **Copy:** tap a tile, then Copy. Paste options scroll horizontally:
  - the clipboard icon beside any hour
  - **To Now**, **To Today** (same time of day), **To Tomorrow**
  - **Paste Inline** (the day being viewed, at the original time)
  - **Multi-paste Inline** (keeps the clipboard, for pasting to many days)
  - **Date & Time**
  - **To Dates** (a multi-date calendar where the user can tap or press-and-drag)
- **Copy Mode** turns each hour's Add button into a Paste button.
- Use cases include weekly meal planning and pre-logging. Pre-logged foods are edited later (Verified [S14]).

#### D4. Date navigation
- A calendar banner shows the current week.
- Tapping the date expands it to a full-page calendar. Swiping moves weeks at a time.
- Shortcuts jump to today, yesterday, or 7 days ago (Verified [S14]).

#### D5. Favourites, recent, frequent
- Favourites (heart icon) can be reordered in the Library and are shown first in search.
- Hourly go-tos are time-of-day aware. Latest shows the most recent foods.
- The Library holds favourites, custom foods, recipes and foods shared with the user. It can be searched and sorted A–Z, Z–A or by date created (Verified [S1]).

#### D6. "Food log speed": what makes it fast
- FLSI 2025 (updated 2025-10-01) counts discrete actions. MacroFactor speed mode scores **24** (Search 10, Multi-add 6, Scanning 5, Quick-add 3). Context mode scores 28. The nearest competitor needs 25% more actions and the average needs about 70% more. This is **self-published** (Verified as a claim [S3]).
- The mechanisms behind the speed (Verified [S1][S3][S4][S29]):
  - **Speed mode**, the default, returns to the search workflow after each food.
  - Plate batching, with one "Log Foods" for many items.
  - Multi-add "+" on tiles, with the last serving remembered.
  - Suggestions before typing (favourites, then hourly go-tos, then latest).
  - Widgets and app-icon shortcuts.
  - Scan-to-label fallback.
  - Swipe gestures in context mode.
  - No ads (the App Store says "premium, ad-free").
- **Context mode** ("Optimize for context") collapses the search sheet after each food and shows the plate, so the user sees each food's effect on the meal. It relies more on swipes, for example swiping a recipe tile reveals actions (Verified [S39][S29]).

#### D7. History edits
- Logged entries are **snapshots**. Editing a custom food or recipe does **not** change past log entries. To update one, the user must delete and re-log it. This protects history and past expenditure estimates (Verified [S40]).
- **Partial logging:** days with only part of the intake logged can be marked "partially logged" through a check-in module, and the algorithm then ignores them. A blank day is skipped entirely (Verified [S41]).

#### D8. Daily summary and empty states
- Daily summary: see the Nutrition Overview (C).
- Empty states are not documented (Unverified). The timeline can hide empty hours (Verified [S14]).

---

### E. UI flows

1. **Food log screen:**
   - Top: calendar week banner, then daily kcal/macro bars (swipe to toggle consumed and remaining).
   - Below: hour rows, each with a "+" (add to that hour), an optional macro summary, and food tiles.
   - Top-right: customization icon and three-dot menu (Nutrition Overview, copy day, and so on).
   - Bottom: "+" quick actions (Verified [S1][S14][S29][S34][S36]).
2. **Add-food flow:**
   - "+" opens the logger. A method ribbon (Scan / Search / Quick Add / Library / Describe / AI) sits at the top or bottom.
   - The configurable Logger Banner shows target bars and plate contents.
   - Selecting a food leads to Add or Log Foods. Swiping down or tapping the arrow opens the plate, where the user edits quantities, removes items and sees Plate/Day totals.
   - Finish with Log Foods, or the calendar icon for "Log to Date and Time" (Verified [S1][S29]).
3. **Search results:** grouped sections, macros shown inline (optional), tile density and highlight settings, and a "+" multi-add per tile (Verified [S1][S9][S29]).
4. **Food detail / portion selection:** name, kcal, macros, unit selector (favourite units first), quantity, a kcal/macro switcher, Add or Log Foods, To Custom, and scrollable full nutrition (Verified [S1][S28][S30]).
5. **Barcode scan:** camera view with Barcode and Label tabs. A match opens food detail. No match switches to label mode, then a pre-filled custom-food wizard (Verified [S6][S8]).
6. **Custom food creation:** 3 steps (General, Serving, Nutrition), with Import with AI as an alternative start (Verified [S7]).
7. **Recipe creation:** name, servings, ingredients, steps and notes, Total Weight, Serving Quantity, then Create or Create & Add. Import from Link or Import with AI is the alternative (Verified [S10]).
8. **Nutrition summary:** the Nutrition Overview with day, week, month, quarter or year averages and contributors. Nutrient Focus is reached from pinned dashboard tiles (Verified [S36][S24]).

---

### F. Edge cases

| Case | Behaviour | Label / source |
|---|---|---|
| Food missing | Label scanner, then a pre-filled custom food. Or Build from Scratch / Import with AI. Optionally submit to the public database (and OFF) | Verified [S6][S7][S26] |
| Barcode missing | Automatic switch to label scanner. The custom food keeps the barcode, so future scans find it | Verified [S8]; Supported [S2] |
| Conflicting or wrong data | "To Custom" copy to fix it privately. Submit a corrected entry. Entries may lag reformulations | Verified [S5][S26] |
| Wrong serving size | Change unit and quantity on detail, plate or edit screen. Branded AI items may default to the label serving | Verified [S1][S19] |
| Decimals | Quantity entry accepts amounts such as "1.0" serving quantity. Exact decimal handling not documented | Unverified |
| Unit conversion | Mass units auto-convert (recipe g to oz). Salt converts to sodium. kJ and kcal toggle. IU and mcg toggle for A/D/E | Verified [S10][S7] |
| Incomplete nutrients | Optional micro fields left blank. Branded items often lack micros. Display of missing values not documented | Verified [S7][S24]; display Unverified |
| Edit or delete logged item | Tap tile, then Edit. Selection mode Remove | Verified [S37][S14] |
| Duplicates | Curation reduces them. The Custom section is separate in search | Supported [S5][S31] |
| Recipe changes and past entries | Past entries are snapshots and stay unchanged. Re-log to update | Verified [S40] |
| Batch-cooked recipe portions | Weigh the cooked dish (Total Weight) or set Serving Quantity. One user reports portion measurements "always off", possibly user error | Verified [S10]; complaint Supported [S22] |
| Offline | "Will likely never support a true offline mode". During outages: navigation, search of history foods and cached results, and add/edit/delete of any data. Sync behaviour not documented | Verified [S42] |
| Partial days | Mark as partially logged so the algorithm ignores them, or delete the day | Verified [S41] |
| Data export | More > Data Management > Data Export: **Quick Export** (time frame, nutrition and/or workouts, one spreadsheet) or **Granular Export** (chosen datasets). The format is described as a "spreadsheet". CSV is named only by a competitor blog | Supported: search summary of help article 356 [S43]; the direct fetch returned only the title |

---

### G. Tier (as it affects food tracking)

- **No free tier. 7-day free trial** with full access (Verified [S22]; Supported [S44]).
- Prices in USD: $11.99/month, $47.99/6 months, $71.99/year for Nutrition alone. The Nutrition + Workouts bundle is $89.99/year for users starting on or after 2026-01-01. Prices vary by region (Verified [S45]).
- No food-logging feature is paywalled separately. The label scanner is described as "part of the premium food logging suite" (Verified [S8]). No separate tier or cap for the AI was found (Unverified).
- The FLSI benchmark tested competitors' premium versions (Verified [S3]).

---

### Strengths to borrow

1. **Plate staging plus one commit.** Collect foods from any method, review the totals (Plate/Day toggle), then log once. This cuts relaunches.
2. **One logger with a method ribbon.** Scan, search, describe and quick-add can be mixed in a single session.
3. **Pre-typing suggestions keyed to time of day** ("hourly go-tos", weighted by recency and frequency), plus favourites and latest. Users can delete bad suggestions.
4. **Multi-add "+" on result tiles**, reusing the last-used serving.
5. **Log by calories or macros:** enter a kcal target and the app computes grams. Great for "what fits my remaining".
6. **Barcode miss falls through to the label scanner, then a pre-filled custom food** that keeps the barcode. No dead end.
7. **Snapshot semantics:** editing a recipe never rewrites history. This is explicit and explained to users.
8. **Recipe cooked weight versus serving count**, with a raw-sum hint but no auto-fill.
9. **Explode recipe** to tweak one instance, and "selected foods to new recipe".
10. **Copy/paste richness:** whole hour or day, To Today/Tomorrow, multi-date paste, Copy Mode turning "+" into paste.
11. **Consumed/Remaining swipe** on the target bars. A non-judgemental calendar (no red).
12. **Favourite units** pinned to the top of the serving picker.
13. **AI grounded in a real database** that returns editable ingredient-level items, never an opaque total.
14. **Partial-day flag**, so incomplete logs don't corrupt the trend calculations.
15. **Heavy configurability** that still defaults to speed.

### Weaknesses

1. **No meal slots.** Some users want Breakfast/Lunch/Dinner (Supported [S22]).
2. **Coverage gaps** for restaurants, niche brands and non-Anglosphere markets. Users report frequent custom-food creation (about 20% of AI-analysed feedback) (Verified [S5]; Supported [S33][S32]).
3. **Scanned nutrient data sometimes wrong** (about 10% of feedback) and lags reformulations (Supported [S33]; Verified [S5]).
4. **Describe ignores branded foods.** AI portion estimates miss (rice undercount). The AI has been in beta since 2025-03 (Verified [S17][S20][S18]).
5. **Recipe editing is cumbersome**, and batch-recipe portions confuse users (Supported [S33][S22]).
6. **No true offline mode.** The full database needs a network (Verified [S42]).
7. **No food-level import** from other apps (Verified [S23]).
8. **Steep learning curve:** "overwhelming at first", many settings (Supported [S22][S32]).
9. **Subscription-only**, with no free tier after the 7-day trial (Verified [S22]).
10. **Opaque ranking.** Handling of missing nutrients is undocumented (Unverified).

---

### Sources

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

---

## Appendix: food data sources and label conventions


Research for adding food/calorie tracking to an offline-first Expo/React Native app (on-device SQLite, no server yet).
Accessed 2026-10-25. Evidence labels: **Verified** = primary source fetched; **Supported** = secondary source(s)
fetched or search-result summary of a named source; **Unverified** = my inference, estimate or background knowledge
that I did not check against a source this session.

---

### TL;DR for the decision

- **Bundle offline:** USDA FoodData Central (CC0, public domain) Foundation + SR Legacy is the cleanest seed for
  "common/generic foods". UK CoFID (Open Government Licence v3.0 on gov.uk, 4.4 MB Excel) is the best Ireland/UK-relevant
  generic set. Both can ship inside the APK with only an attribution line.
- **Branded/barcode foods:** Open Food Facts (OFF) is the only realistic free source. It has about 80k products on the
  Irish site. ODbL attribution is mandatory. Share-alike triggers if you publicly use an *adapted* OFF database.
  The API is rate-limited (15 product reads/min/IP) and needs a custom User-Agent. Barcode lookup is online-only
  unless you bundle a country subset.
- **Avoid for offline:** Edamam (no caching without explicit permission, paid only), FatSecret (24-hour cache
  limit unless content is marked storable, attribution everywhere), Nutritionix (public free tier ended).
- **Storage model:** store nutrients **per 100 g (or 100 ml)** as canonical. Store servings as named gram weights.
  This matches EU labels (per-100 g mandatory) and converts US per-serving labels with one division.
- **Barcode scanning:** `expo-camera` in SDK 54 supports `ean13`, `ean8`, `upc_a`, `upc_e` on Android. It also offers
  a Google code scanner (`launchScanner`). Scanning works offline. Lookup needs the network unless the data is bundled.

---

### 1. App selection sanity check

The four chosen apps (MyFitnessPal, Cronometer, Lose It!, MacroFactor) cover the main design archetypes well:

| App | Archetype it represents | Evidence |
|---|---|---|
| MyFitnessPal | Huge crowdsourced database (about 20M items per TechCrunch), market default, and now owns Cal AI (deal closed Dec 2025, announced 2 Mar 2026) | **Supported** (TechCrunch, athletechnews) |
| Cronometer | Curated, lab-data-first, micronutrient depth. Names 10 sources: NCCDB, its own CFCD, USDA SR28, CNF 2015, **Irish IFCDB**, NEVO, **CoFID**, NUTTAB, Nutritionix, FDC Branded. Says branded submissions are verified. | **Verified** (cronometer.com page; accuracy claims are vendor claims) |
| Lose It! | Consumer weight-loss UX, streaks, simple budget model | **Unverified** (not researched in depth) |
| MacroFactor | Speed-of-logging plus "verified" database (vendor cites 1.15M to 1.36M foods, inconsistent). Five logging modes: barcode/label scan, search, quick add, AI Describe, custom foods/recipes. Unknown barcodes are submitted to **Open Food Facts** after automatic validation: brand, name, barcode, serving size and macros required, implausible values rejected. Vendor says barcode coverage is strong in Ireland and the UK. | **Verified** (MacroFactor help article for OFF submission); **Supported** (vendor marketing pages for size/coverage) |

**MacroFactor is the most relevant reference for this app.** It is fitness-oriented, uses OFF as its barcode
backbone, and validates submissions at entry.

#### Alternatives considered

| Alternative | Distinctive food-tracking angle | Displace one of the four? |
|---|---|---|
| **Yazio** | EU (German) app with a strong EU product base. Free barcode scanning, fasting timer, in-house recipes. | Maybe as an *EU-coverage* reference. It adds little new logging UX. **Supported** (BGR roundup) |
| **FatSecret** | Free consumer app plus the Platform API used by other apps. The database is broad and global. | No as a UX study. It is relevant as a data vendor (see §2). **Supported** |
| **MyNetDiary** | Staff-verified database (vendor claims 2M+ items from USDA/NCC), 108 nutrients in the free tier | Overlaps with Cronometer. It does not displace it. **Supported** (BGR; vendor page is self-promotional) |
| **Carb Manager** | Keto/net-carb focus, with net-carb per meal | No. It is niche. **Supported** (thin, Reddit-level evidence only) |
| **Cal AI** | Photo-first logging (snap, AI estimate). AI features need a paid subscription. Now owned by MyFitnessPal. | Worth one screen study for photo logging. Accuracy is poor (below) and it needs a server/LLM, so it is out of scope offline. **Supported** |
| **Foodvisor** | Photo recognition (estimates portion from camera autofocus distance), plus barcode and voice | Same as Cal AI. It needs online ML. **Supported** (TechCrunch 2019, older) |
| **Lifesum** | Meal plans, "Life Score", clean design | No. It is weaker on logging mechanics. **Supported** |

**Verdict:** the four are a sound set for *logging functionality*. A defensible swap is **Yazio for Lose It!** if
EU/Irish barcode coverage matters more than US weight-loss UX. Add a quick look at Cal AI only to understand
photo logging, which needs a server and is therefore deferred.

#### Independent accuracy evidence

- **Griffiths, Harnack & Pereira (2018), *Public Health Nutrition* 21(8)**: compared MyFitnessPal, Fitbit, Lose It!,
  MyPlate and Lifesum against **NDSR** (the U. Minnesota research system) using 24-h recalls. Correlations with NDSR
  were 0.73 to 0.96 for energy/macros and 0.57 to 0.93 for other nutrients. Every app gave some significantly
  *lower* means. MFP was low on protein, fat, sodium and cholesterol. Lose It! was low on protein, fat, sodium,
  sugars, cholesterol and saturated fat. **Verified** (Cambridge abstract page).
- **JMIR 2020 (MFP vs a Belgian reference DB)**: accurate for energy, macros, sugar and fibre, but not for
  cholesterol and sodium. **Supported** (search summary; not fetched).
- **UK comparison (JMIR, 2019 preprint)**: FatSecret and Lose It! underestimated protein and sodium. Lose It! was
  least comparable. **Supported** (search summary).
- **NIH/NIDDK, Nutrition 2026 abstract (Hengist & Charles, 25 Jul 2026)**: 102 metabolic-kitchen meals were
  photographed into MFP, Lose It!, Cal AI and Appediet. Calories were underestimated by 250 to 345 kcal per meal
  and fat by about 30 g, roughly one-third too low. Keto/high-fat meals were worst. **This is not yet peer-reviewed.**
  **Supported** (ScienceDaily release).
- **Cronometer:** I found no peer-reviewed accuracy study. Claims of "most accurate" are vendor claims.
  **Unverified**.

**Takeaway:** crowdsourced and photo-estimated entries systematically under-count, especially fat and sodium.
Curated generic data (USDA/CoFID) plus user-checked labels is the more accurate base.

---

### 2. Food data sources usable by an indie app

#### 2.1 Open Food Facts (OFF)

- **Licence:** the database is under **ODbL**, individual contents under **DbCL**, and product images under
  **CC BY-SA**. Some images contain third-party copyrighted graphics. **Verified** (OFF data page, API docs).
- **Attribution:** required for any public use. Suggested wording: *"Contains data from Open Food Facts, available
  under the Open Database License."* OFF recommends a prominent in-app credit with links to OFF and ODbL.
  **Verified**.
- **Share-alike:** if you publicly use an **adapted database** (OFF data you modified or merged), or a work produced
  from one, you must offer that adapted database under ODbL. **Verified** (ODbL summary, OFF data page).
  - *Implication (Unverified, not legal advice):* a filtered/trimmed Ireland/UK subset bundled in the APK is likely an
    adapted database. You would need to publish that subset (or the script that makes it) under ODbL. Keep
    OFF-derived rows in **separate tables** from proprietary/user data, so the user's own custom foods and logs are
    not swept into share-alike. Displaying values in the UI is a "produced work", which needs attribution only.
- **API rules** (**Verified**, OFF API docs):
  - Product reads: **15 req/min/IP**. Search: **10 req/min/IP**; OFF warns against search-as-you-type. Breaking the
    limits can get the IP banned. Global limits return HTTP 503.
  - Reads need no auth but **must send a custom User-Agent**: `AppName/Version (ContactEmail)`.
  - Writes (product submissions, photos) need an account. Include `app_name`, `app_version`, `app_uuid`.
  - Test against **staging**. For more than a few hundred products, use the bulk downloads. High-traffic apps should
    host a local copy fed by daily exports.
  - Data has "no assurance of accuracy, completeness, or reliability".
- **Bulk dumps** (**Verified**, OFF data page): MongoDB dump, JSONL (gzip), Parquet on Hugging Face, daily deltas
  (14 days; deletions not flagged), and RDF (unmaintained). The **food CSV** is tab-separated, UTF-8, about
  **0.9 GB compressed / 9 GB uncompressed**.
- **Size/coverage:** about 3.8M products worldwide (2025 OFF webinar deck), with about 1,500 added per day.
  **Supported**. The Irish country site shows **79,927 products**. **Verified** (ie.openfoodfacts.org, but the
  count's scope is implied rather than stated). Irish shelves carry many UK products, so filtering for
  `countries_tags` Ireland **or** United Kingdom would broaden coverage. **Unverified**.
- **Data quality:** crowd-entered. Expect missing nutrients, unit mistakes (kJ entered as kcal) and stale recipes.
  **Unverified** (general knowledge). I could not load the completeness stats page (HTTP 503). Validate at import:
  check that kcal is roughly equal to 4P + 4C + 9F within a tolerance, and drop rows without energy/macros.
- **Bundle-ability:** feasible as a pre-filtered subset. Example: Irish/UK products with complete energy + 6 macros,
  keeping only name, brand, barcode, serving size and per-100 g values. *Estimate (Unverified):* 80k to 150k rows at
  about 150 B each gives roughly 15 to 25 MB in SQLite (before FTS index), and maybe 5 to 10 MB gzipped. That size
  works as an optional on-demand download, but is too large for the base APK. A smarter pattern: bundle generic foods
  only, look up barcodes online when connected, and **cache every scanned product locally forever**. That is allowed:
  ODbL has no cache-expiry rules, unlike FatSecret/Edamam.

#### 2.2 USDA FoodData Central (FDC)

- **Licence:** public domain under **CC0 1.0**. USDA asks for credit to FDC and, where possible, notice of products
  using the data. Suggested citation: "U.S. Department of Agriculture, Agricultural Research Service. FoodData
  Central, 2019. fdc.nal.usda.gov." **Verified** (FDC API guide).
- **API:** needs a data.gov key. **1,000 req/hour/IP** by default; `DEMO_KEY` allows 30/hour and 50/day. Keys found
  in public repos are deactivated, so **never ship a key in the app**. **Verified**.
- **Downloads** (**Verified**, FDC download page; zipped / unzipped):

| Dataset | Release | JSON | CSV |
|---|---|---|---|
| Foundation Foods | Apr 2026 | 459 KB / 6.5 MB | 3.7 MB / 32 MB |
| SR Legacy | Apr 2018 (final) | 12.3 MB / 205 MB | 6.7 MB / 54 MB |
| FNDDS 2021-2023 | Oct 2024 | 3.7 MB / 64 MB | 200 MB / 1.6 GB |
| Branded | Apr 2026 | 195 MB / 3.1 GB | 428 MB / 2.9 GB |

- **Fit:** Foundation + SR Legacy are ideal "generic foods" seeds (chicken breast, oats, rice, egg). They give
  nutrients per 100 g plus `food_portion` gram weights for household measures. SR Legacy has about 7,800 foods
  (**Unverified**; Cronometer cites "over 8,000" SR28 entries, **Supported**). Branded is US-centric and of little
  use in Ireland.
- **Subset size estimate (Unverified):** 1,500 to 3,000 hand-picked common foods with about 10 nutrients and 2 to 4
  portions each comes to **under 1 MB** of SQLite. That is trivial to bundle and seed at first launch, as the app
  already does for canonical exercises.

#### 2.3 UK CoFID (McCance & Widdowson)

- gov.uk publishes the **2021 CoFID** as an Excel file (4.42 MB). It also has a 37-page user guide and an "old foods"
  file of 2008 items not re-validated. The page states content is under the **Open Government Licence v3.0**
  "except where otherwise stated". **Verified** (gov.uk). Read the user guide's licence wording before shipping.
- The Quadram Institute's newer **CoFID API** is reportedly **CC BY-NC-SA 4.0**, which bars commercial use.
  **Supported** (search summary of the FN-NBRI page; not fetched). **Use the gov.uk Excel file, not the API**, if the
  app might ever be monetised.
- **Fit for Ireland:** high. Irish researchers historically relied on UK composition data. **Supported** (Proc. Nutr.
  Soc. 2008 abstract). The FSAI tells Irish food businesses that McCance & Widdowson is acceptable "generally accepted
  data" for labels. **Verified** (FSAI). OGL needs only an attribution statement, so it is bundle-friendly.

#### 2.4 Irish / EU sources

- **Irish Food Composition Database (IFCDB, UCC):** about 938 foods and 41 components, built to EuroFIR standards
  from 1997-2006 survey foods. **Supported** (2008 abstract). Its current hosting and licence are unknown
  (**Unverified**). Cronometer licenses it (**Verified**, listed as a source). It is not a practical bundle without
  contacting UCC.
- **IUNA Irish Food Portion Sizes Database:** typical Irish portion sizes. It could inform default serving
  suggestions. **Supported**; licence unverified.
- **EuroFIR eSearch** aggregates national databases, but access is generally membership/licence based.
  **Unverified**.
- **NEVO (Dutch)** is another option Cronometer uses. **Verified** as a Cronometer source; NEVO licence not checked.

#### 2.5 Commercial APIs

| API | Free tier | Offline caching | Attribution | Verdict |
|---|---|---|---|---|
| **FatSecret Platform** | "Basic" edition free, 5,000 calls/day; a "Premier Free" tier for startups/students | Content must be deleted or re-fetched **within 24 h** unless marked "storable indefinitely" (§1.5) | Required "in every place that Content is provided or displayed"; links must stay even after you stop using the API | Incompatible with offline-first. ToS also bars using it to give diet/health advice (§1.7(iii)). **Verified** (terms); editions **Supported** |
| **Edamam Food DB** | No free plan listed; Basic $14/mo, Core $69/mo, Plus $299/mo | Not permitted unless Edamam explicitly allows it. When allowed: only ID, label, image and 4 nutrients, behind a password, with an active subscription. Building a copy or a search is not allowed. | Required on all plans; missing it means suspension | Unusable offline. **Verified** |
| **Nutritionix** | **Public free tier discontinued**; limited trial by request only | Not stated on the page | Not stated | Not viable for an indie app. **Verified** |

---

### 3. Nutrition label conventions

#### EU, Regulation (EU) 1169/2011 (applies in Ireland)

- **Mandatory declaration (Art. 30(1)):** energy, fat, saturates, carbohydrate, sugars, protein, salt. **Verified**
  (legislation.gov.uk copy; EUR-Lex returned an empty page). Mandatory for almost all prepacked food since
  **13 Dec 2016**. **Verified** (FSAI).
- **Optional extras (Art. 30(2)):** monounsaturates, polyunsaturates, polyols, starch, fibre, and vitamins/minerals
  present in significant amounts (Annex XIII). The list is **closed**: anything else (e.g. omega-3) goes outside the
  table. **Verified** (legislation.gov.uk, FSAI).
- **Basis (Art. 32):** values **per 100 g or per 100 ml** are mandatory. **Verified**. Per-portion values may be added
  but **not instead of** per 100 g/ml, and portion size and number must be stated nearby. **Verified** (FSAI; FSA
  leaflet **Supported**).
- **Energy** is declared in **both kJ and kcal**. **Verified** (FSAI).
- **Salt (Annex I):** "salt = sodium × 2,5". **Verified**. So sodium (mg) = salt (g) × 1000 / 2.5 = salt (g) × 400.
- **Definitions (Annex I):** carbohydrate *includes* polyols. Sugars = mono- and disaccharides, excluding polyols.
  **Verified**. Fibre is **listed separately and not inside carbohydrate** in the EU. **Unverified** for the exact
  phrasing, but it follows from Annex XIV giving fibre its own factor.
- **Energy conversion factors (Annex XIV), kJ/g / kcal/g** (**Verified**): carbohydrate (except polyols) 17/4,
  polyols 10/2.4, protein 17/4, fat 37/9, salatrims 25/6, alcohol 29/7, organic acid 13/3, **fibre 8/2**,
  erythritol 0/0.
- Values may come from analysis, calculation, or "generally accepted data" such as McCance & Widdowson. **Verified**
  (FSAI).

#### US, FDA 21 CFR 101.9

- Values are declared **per serving**. Labels show **sodium (mg)**, not salt. **Verified** (Cornell LII copy of
  101.9; eCFR redirected to a captcha).
- **Calorie rounding (c)(1):** under 5 kcal may show 0. Up to and including 50 kcal, round to the nearest 5. Above
  50 kcal, round to the nearest 10. **Verified**.
- **Sodium (c)(4):** under 5 mg shows 0. From 5 to 140 mg, round to the nearest 5 mg. Above 140 mg, round to the
  nearest 10 mg. **Verified**.
- **Fat (c)(2):** round to the nearest 0.5 g below 5 g and to the nearest 1 g above. Under 0.5 g may show 0.
  **Carbohydrate (c)(6) / protein (c)(7):** round to the nearest 1 g. "Less than 1 g" is allowed, and under 0.5 g may
  show 0. **Verified**.
- In the US, **total carbohydrate includes fibre**, unlike EU carbohydrate. **Unverified** here, but consistent with
  101.9(c)(1)(i)(C) treating non-digestible carbohydrate separately.

#### Implications for custom-food entry and storage

1. **Canonical storage = per 100 g (solids) or per 100 ml (liquids).** Add a `density_g_per_ml` field only if you
   ever need cross-conversion. EU labels give this directly, and every other basis converts to it linearly.
2. **Servings are separate rows:** `{label: "1 slice", grams: 36}`. The entry form offers a basis toggle
   ("per 100 g" / "per serving of __ g"). Normalise on save and keep the user's original basis for display/editing.
3. **Field order should match the EU label:** energy, fat, of which saturates, carbohydrate, of which sugars, fibre,
   protein, salt. Accept **kJ or kcal**: if only kJ is given, kcal = kJ / 4.184. Accept **salt or sodium** and store
   one of them (sodium mg recommended, salt derived as ×2.5/1000 g).
4. **Carbohydrate semantics differ:** EU carbohydrate excludes fibre, while US total carbohydrate includes it.
   Store an `origin`/`label_region` flag, or always store "available carbohydrate" plus fibre separately. Never sum
   fibre into EU carbs. *Unverified design advice.*
5. **US rounding means per-serving values are imprecise.** "0 g fat" can mean up to 0.49 g. Scaling a rounded
   per-serving label up to 100 g amplifies the error. Accept it, but do not flag the mismatch as an error.
6. Weights stay in grams internally. Honour `useUnits()` at the UI only for body weight. Food is usually g/oz, so
   add a food-unit preference if needed.

---

### 4. Calorie / macro math

- **General Atwater factors:** protein 4, carbohydrate 4, fat 9, alcohol 7 kcal/g (17/17/37/29 kJ/g). **Verified**
  (FAO 2003 report; also EU Annex XIV and 21 CFR 101.9(c)(1)(i)(B)).
- **Why macro-derived kcal ≠ label energy** (**Verified** FAO unless noted):
  - **Specific Atwater factors** vary by food. Protein ranges from 2.44 kcal/g (some vegetable proteins) to
    4.36 kcal/g (egg). Carbohydrate ranges from 2.70 (lemon juice) to 4.16 kcal/g (polished rice). Labels may use
    specific factors (21 CFR 101.9(c)(1)(i)(A)) or bomb calorimetry ((E)). **Verified**.
  - **Fibre:** EU counts it at 2 kcal/g. US method (C) gives soluble non-digestible carbohydrate 2 kcal/g and excludes
    insoluble. Older/general methods count all carbohydrate by difference at 4. **Verified**.
  - **Polyols** (2.4 kcal/g; erythritol 0), **organic acids** (3), **alcohol** (7) are often not shown as macros.
    **Verified**.
  - **Rounding** of label values (US especially). **Verified** (rounding rules above).
  - Size of effect: general factors averaged about 5% higher than specific for a mixed US diet, and 20 to 38% for some
    foods (cabbage, snap beans, lemons). **Verified** (FAO).
- **How apps handle it (Unverified, general practice):** most store **label energy as the source of truth** and show
  macros separately, so totals don't add up exactly. Some (e.g. MacroFactor-style "macro-derived" modes) let users
  compute calories from macros. **Recommendation:** store `energy_kcal` as entered and never recompute it. Use
  4P + 4C + 9F (+2 fibre for EU) only as a **validation warning**, for example when the gap exceeds about 20% and
  15 kcal per 100 g, to catch kJ/kcal mix-ups.
- **BMR:** **Mifflin-St Jeor (1990)** is the usual default. Frankenfield et al. (2005, J Am Diet Assoc) found it the
  most reliable of 4 common equations: within 10% of measured RMR in more people than the others, with errors still
  notable in individuals. **Supported** (search summaries of the review). Formula (**Unverified** from memory; check
  against the 1990 paper): kcal/day = 10·kg + 6.25·cm − 5·age + 5 (male) / − 161 (female). Multiply by an activity
  factor for TDEE. MacroFactor-style adaptive TDEE from weight trend plus intake is the modern alternative.

---

### 5. Barcode scanning on Expo SDK 54

- **`expo-camera` `CameraView` supports barcode scanning on Android, iOS and Web.** Set
  `barcodeScannerSettings={{ barcodeTypes: [...] }}` and handle `onBarcodeScanned`. The result has `type`, `data`,
  `bounds`, `cornerPoints`, plus `extra` (Android only). **Verified** (Expo v54 docs).
- **Supported types include `ean13`, `ean8`, `upc_a`, `upc_e`**, as well as qr, code128, code39, code93, itf14,
  codabar, datamatrix, pdf417 and aztec. **Verified**. Restrict to the four retail types for speed and fewer false
  reads.
- **`launchScanner(options)`**: on Android it uses the **Google code scanner (ML Kit)** as a system UI and dismisses
  itself after a scan. No camera-permission UI of your own is needed (**Unverified** on permission; check Google code
  scanner docs). Check `getSupportedFeatures().isModernBarcodeScannerAvailable` first. **Verified** (Expo docs).
- The `barcodeScannerEnabled` config-plugin option only matters on Android when building `expo-camera` from source.
  Prebuilt modules already include the barcode libraries. **Verified**.
- **Offline implications:**
  - Decoding is on-device and works offline. The ML Kit code scanner model is delivered via Google Play services,
    which may need a one-time download (**Unverified**).
  - **Lookup is online** (OFF API, 15 req/min/IP, with User-Agent) unless a product subset is bundled.
  - Suggested flow (**Unverified design**): scan; check local `foods` by barcode; if online, fetch OFF, normalise to
    per 100 g, and save locally permanently. If offline or not found, open the custom-food form pre-filled with the
    barcode, and optionally queue an OFF lookup for when connectivity returns. UPC-A codes are EAN-13 with a leading
    0, so normalise to 13 digits before lookup and storage (**Unverified**, standard GS1 practice).
  - Optionally let users contribute missing products back to OFF, as MacroFactor does. That needs an OFF account and
    write credentials, so defer it to the server phase.

---

### Sources

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
