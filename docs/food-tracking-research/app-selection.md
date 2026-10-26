# App selection: why these four

[← Research index](README.md) · Next: [app-analysis.md](app-analysis.md) · Evidence: [evidence-and-sources.md](evidence-and-sources.md)

Selected on 2026-10-25: **MyFitnessPal, Cronometer, Lose It!, MacroFactor.**

## Selection criteria

Ranked by importance for designing *food logging* (not coaching, community or recipes as a product):

1. Depth of food-logging features (entry methods, portions, meals, recipes, copy/repeat).
2. Database model, size and accuracy approach.
3. Speed of logging repeat meals.
4. Range of entry methods (search, barcode, label, quick add, voice, photo).
5. Nutrient depth (calories, macros, micronutrients) and daily/meal summaries.
6. **How much public evidence exists.** A strong app with no public docs can't be analysed reliably.

## The four selected

Each app stands for a different design approach, so together they cover the main trade-offs.

| App | Approach | Why selected | Evidence quality |
|---|---|---|---|
| **MyFitnessPal** | Huge crowd-sourced database (19–22M items claimed), meal slots, freemium | Market default and the reference most users compare against. Clearest example of the **size vs accuracy** trade-off and of **paywalling basics** (barcode since 2022). Its April 2026 redesign gives current lessons on what adds friction. | **High.** All 248 help articles were pulled through the public Zendesk API, most updated Aug–Oct 2026. Peer-reviewed accuracy study (JMIR 2020). |
| **Cronometer** | Curated lab data (NCCDB, USDA, CoFID, Irish IFCDB…), 84–95 nutrients | The accuracy and micronutrient benchmark. Shows **source transparency**, **blank-not-zero** data, gap-filling, cooked-weight recipes, and a generous free tier (free barcode). Also shows a history pitfall (recipe edits can rewrite past entries). | **Medium-high.** Blog and changelog read in full; help centre blocked (HTTP 403), so read as search excerpts. Forum posts are often 2018–2022. |
| **Lose It!** | Simple consumer calorie budget, meal-scoped logging | The simplicity benchmark: meal-scoped Add, mealtime suggestions, past-meal checkboxes, "Add Yesterday's [Meal]", swipe serving adjuster. Pioneer of photo logging (Snap It, 2016), now on-device. Also a warning case: 2025–26 paywall shift and redesign backlash. | **Medium.** App Store listing fetched; help centre read via excerpts only; many 2026 "reviews" are competitor blogs and are labelled Unverified. |
| **MacroFactor** | Speed-first logger, curated DB, timeline, adaptive targets | Closest match to a **fitness audience**. Publishes its own logging-speed benchmark (self-published). Strongest patterns for speed: Plate staging, multi-add, hourly suggestions, log-by-calories, barcode → label scanner → pre-filled custom food. Uses Open Food Facts for barcode submissions. Explicit snapshot history. | **High.** Help centre and release notes read in full (45 sources). Reddit blocked. |

## Alternatives considered

| App | Distinctive angle | Why not selected |
|---|---|---|
| **Yazio** | German app with strong EU product coverage, free barcode, fasting | The best swap if EU/Irish barcode coverage mattered more than logging UX. It adds little new logging UX beyond the four. |
| **FatSecret** | Free consumer app + data API used by other apps | More relevant as a data supplier, and its API terms (24-hour cache limit) rule it out for offline use. |
| **MyNetDiary** | Staff-verified DB, 108 nutrients in free tier | Overlaps with Cronometer. |
| **Carb Manager** | Keto / net carbs | Niche. |
| **Cal AI** | Photo-first AI logging (owned by MyFitnessPal since 2026) | Needs a server and model; independent testing shows large under-counts (NIH 2026 abstract, not peer-reviewed). Photo logging is already covered by all four selected apps. |
| **Foodvisor** | Photo recognition with portion estimation | Same reasons as Cal AI. |
| **Lifesum** | Meal plans, "Life Score" | Weaker on logging mechanics. |

Details and sources: [app-analysis.md → Appendix §1](app-analysis.md#appendix-food-data-sources-and-label-conventions).

## Independent accuracy evidence

- **Griffiths et al. 2018, *Public Health Nutrition*:** compared MFP, Lose It!, Fitbit, MyPlate and Lifesum with the NDSR
  research system. Every app gave significantly *lower* values for some nutrients (MFP: protein, fat, sodium,
  cholesterol; Lose It!: also sugars and saturated fat). Verified (abstract).
- **Evenepoel et al. 2020, *JMIR*:** MFP was accurate for energy, macros, fibre and sugar, but not for sodium or
  cholesterol. The authors blame entries that have calories but no macros. Verified.
- **NIH/NIDDK 2026 abstract (not peer-reviewed):** photo logging in MFP, Lose It!, Cal AI and Appediet under-counted
  by 250–345 kcal per meal, about one-third too low. Supported.
- **Cronometer:** no peer-reviewed accuracy study found; "most accurate" is the vendor's own claim. Unverified.

**What this means for Gym Log:** crowd-sourced and photo-estimated data both under-count. A small curated base
plus label values the user checks is more accurate, and it is also what works offline.

## Fit with Gym Log

MacroFactor is the closest reference (gym audience, speed, curated data) but has no meal slots and no free tier.
Lose It! and MFP give the mainstream meal-slot mental model. Cronometer gives data-quality patterns. **None of the
four works offline**, which is Gym Log's first product principle. See [product-recommendations.md](product-recommendations.md).
