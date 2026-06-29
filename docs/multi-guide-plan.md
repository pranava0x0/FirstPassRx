# Multi-guide refactor + Maryland menopause guide

## Why
The app was a single 2-D grid (`payer × class`) with "Massachusetts" and "inhaler" hardcoded in
the masthead/labels, and a test invariant forcing a full grid. To add a second jurisdiction +
therapeutic area (Maryland · menopause hormone therapy) without nonsense cells, we introduce a
**guide** dimension: each guide bundles its own region, topic, payers, classes, records,
references, and glossary. A top-level toggle swaps guides.

The record/card shape separates formulary policy from clinical guidance: exact benefit product →
formulary first-pass option → covered alternatives → true barriers → claim-specific citations.
The app does not infer patient-specific treatment or dose from a formulary.

## Data shape (src/data/formulary.json)
```
{ meta: { title, disclaimer, version, defaultGuideId },
  guides: [ { id, label, region, topic, classNoun, unitNoun, tagline,
              dataStatus, lastUpdated, capturedAt,
              payers[], classes[], references[], glossary[], records[] } ] }
```
References + glossary are **per-guide** (self-contained; shared terms like PA/BOGL/step-therapy are
duplicated into each guide — small, deliberate duplication keeps sourceId resolution guide-local).

## Code
- `types/formulary.ts` — add `AppMeta`, `Guide`; relax `PayerId`/`ClassId` to `string`
  (guide-scoped, validated at load).
- `lib/formulary.ts` — validate per guide; build a `GuideView` per guide (its own
  getRecord/getPayer/getClass/resolveSources/lookupGlossary/searchFormulary + search index);
  export `guides`, `getGuideView`, `defaultGuideId`, global `meta`, and a `GuideContext`/`useGuide`.
- `App.tsx` — `guideId` state + toggle; reset payer/class on switch; dynamic masthead
  (`{region} {topic}`, `tagline`, `lastUpdated`); wrap subtree in `GuideProvider`.
- `Controls.tsx` / `Search.tsx` / `ResultCard.tsx` — take the active `GuideView` by prop.
- `GlossaryTerm.tsx` — read the lookup from `useGuide()` (it sits deep in the tree).
- `BoglBanner.tsx` / `ResultCard.tsx` — replace hardcoded "inhaler" with `guide.unitNoun`.
- `index.css` — `.guide-switch` segmented toggle in the masthead.
- Tests — make `formulary.test.ts` guide-aware (assert MA guide intact + MD guide present);
  add an App test that the toggle switches to the Maryland menopause guide.

## Maryland menopause guide (data)
Classes: transdermal estrogen, oral estrogen, progestogen, estrogen–progestogen combo,
vaginal (local) estrogen. Payers: Maryland Medicaid (PDL), CareFirst BCBS, Kaiser Permanente
Mid-Atlantic, UnitedHealthcare MD, Aetna MD. First-pass logic: generic transdermal estradiol +
oral micronized progesterone usually ship clean; brand combos / compounded "bioidentical" pellets /
off-label testosterone → PA/non-formulary.

Phase 1 = structural refactor + a small valid MD scaffold (example cells) so it renders end-to-end.
Phase 2 = real cited Maryland data via the `formulary-data` skill, flipping cells to verified/partial.
