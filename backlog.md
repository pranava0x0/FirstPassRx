# Backlog

Ideas, each with a priority (low / medium / high). Reprioritize periodically.

## High

- **Every prescription type should have data for every state selected — DONE for the 5 originally
  listed states (user priority, 2026-07-05; scoped 2026-07-06; completed 2026-07-07).** The
  state/therapeutic-area picker (shipped 2026-07-05) makes the full grid visible; **MA, MD, NY, VA,
  and IL now each have all 5 topics** (inhalers, ACE inhibitors, diabetes, menopause HT, NSAIDs) —
  a perfect 5×5 = 25-guide grid, every cell `verified` or `mixed`, zero gaps left among these 5
  states. IL was last to close (2026-07-07): `il-inhalers`/`il-ace`/`il-diabetes`/`il-menopause`
  shipped new (8 payers each) and the existing `il-nsaids` guide expanded from 1 payer to 8 —
  the largest single gather this project has run (8 payers × up to 15 classes, ~1.43M tokens, zero
  failures). IL's payer roster needed correcting mid-project: the original 3-payer plan
  undercounted IL Medicaid (most members are in a managed-care plan, not FFS — see CLAUDE.md's
  "state Medicaid MCO rosters churn" scar tissue); the real roster is IL Medicaid FFS + 5 Medicaid
  MCOs (Aetna Better Health of Illinois, Blue Cross Community Health Plans, CountyCare, Meridian,
  Molina) + BCBS Illinois commercial + Wellcare Value Script (Medicare Part D).

  **Reusable assets built along the way, still live for any future expansion:**
  [.claude/workflows/formulary-gather.js](.claude/workflows/formulary-gather.js) — a reusable,
  checkpointed gather script (one agent per *payer*, covering all its assigned classes off a
  single fetch), chunked to the hard ≤2-concurrent cap, callable via
  `Workflow({scriptPath: ..., args: {stamp, state, today, payerTasks}})` for any future (state,
  topic) combo. [scripts/validate-coverage.mjs](scripts/validate-coverage.mjs)
  (`npm run validate-coverage`) reports the full national grid plus a payer-roster cross-check
  against `state-index.json`. **Gather per state across every remaining topic in one pass, not one
  gather per topic** (`docs/agent-runs.md` lever #7) — proven across NY/MD/VA/MA/IL to cut token
  cost roughly in half to a third vs. one gather per topic, since the per-payer fetch cost is flat
  regardless of how many classes you pull from it. A guide still can't be committed with partial
  payer coverage (see `validate()`'s count floor), so merge only once a state's full class list
  comes back. `npm run archive-sources` (see CLAUDE.md) archives every cited source with a
  provenance manifest — run it right after every merge, not as an afterthought (it was skipped for
  3 consecutive merges this project before catching up in one pass).

  **Recurring `validate()`-fix patterns, seen across every one of these 5 states' gathers** — worth
  knowing before touching any of this data again: (1) a covered-but-higher-tier drug tagged
  `nonformulary`/`pa` instead of `alternatives` — verify the payer's own data really has no PA/step
  flag before moving it, don't just reword around the regex; (2) a true barrier (real PA required)
  whose reason text happens to contain the trigger phrase "non-preferred" or "higher tier" —
  reword, don't reclassify, when the payer's own binary preferred/non-preferred system genuinely
  gates access (every state Medicaid PDL/MCO seen so far is exactly this — being "non-preferred"
  **is** the PA trigger); (3) the *inverse* case, confirmed for the first time in IL: a real
  multi-tier **commercial** plan's "Tier 3/4, non-preferred" items with no PA/step criteria stated
  anywhere — these genuinely are cost-tier-only and DO belong in `alternatives`. The distinguishing
  signal is the payer's own document structure (binary Medicaid PDL vs. real commercial tiering),
  not the state; (4) a BOGL flag (`boglActive: true`) set on the wrong drug (the `boglNote`
  describes a *different* alternative's brand-preference, not the actually-chosen
  `preferredAgent` — a hard tell is `preferredAgent.brand: null` with `boglActive: true`) or set
  when no generic exists in the class at all — clear it in both cases; (5) the rarer inverse of
  (4): `genericAvailable: false` on a record whose own `paRequired` list names a real generic or
  biosimilar being passed over — here the *field* is the bug, not the flag; correct
  `genericAvailable` to `true` and keep `boglActive` as real BOGL.

  **National grid status 2026-07-07 (`npm run validate-coverage`): 25/255 cells, all at full
  `verified`/`mixed` depth.** Expanding beyond these 5 states to the remaining ~46 is explicitly
  deferred — the saved workflow script is the reusable asset for that future work, not something
  to launch without the user re-confirming scope.
- **New topic areas to cover, beyond the current 5 (inhalers, ACE inhibitors, diabetes, menopause
  HT, NSAIDs) — user-requested 2026-07-07, not yet scoped.** SSRIs; biologics for autoimmune
  conditions (e.g. rheumatoid arthritis, psoriasis, IBD); DOACs (direct oral anticoagulants);
  atypical antipsychotics & ADHD medications; migraine therapeutics (triptans, CGRP
  antagonists/mAbs). Each is a new therapeutic-area topic, same shape as the existing 5 — needs its
  own class taxonomy (see `ma-inhalers`/`ny-ace`/`va-diabetes`/`md-menopause`/`ny-nsaids` as the
  reference guides `formulary-gather.js` reuses class taxonomy from) before any gather can run.
  Before launching a gather for any of these: confirm scope/priority order with the user (which
  topic first, which states), and note biologics in particular already has a disabled `biologics`
  tab scaffolded in the existing inhaler taxonomy (see the separate "Biologics & non-inhaler class"
  item below) — worth checking whether that scaffold should extend to autoimmune biologics too, or
  stay narrowly respiratory-only, before treating this as a clean fifth+ topic.
- **Close the cash-price gap (user flagged directly, 2026-07-06): 219 of ~470 covered-drug names
  still have no GoodRx/Cost Plus rule.** `src/lib/cash.ts`'s `KNOWN_UNPRICED_GAP` tracks this
  precisely (was 232, now 219 after the ma-inhalers fix below). Per-guide breakdown as of
  2026-07-06 (run the scratch query in `cash.test.ts`'s `coveredDrugNames()` helper to refresh):
  **va-diabetes 76/76 (100% unpriced — every diabetes drug shows link-only)**, ny-nsaids 66,
  md-menopause 59, il-nsaids 12, ny-ace 10. `ma-inhalers` (was 13) is now fully closed — see
  issues.md. Do this like the state-data work: real browser session (GoodRx/Cost Plus both block
  plain fetch — see CLAUDE.md), one guide at a time, smallest/highest-impact first. va-diabetes is
  both the largest gap and arguably the highest-value (cash prices matter most for chronic daily
  meds like metformin/insulin/GLP-1s) — good next target. Not every drug will have a Cost Plus
  match (confirmed for all 8 ma-inhalers drugs — Cost Plus's catalog skews toward common generics,
  several specialty inhalers/devices simply aren't carried); that's a legitimate, documented
  outcome, not a research failure — record it in the rule's comment either way.
- **Redesign the omni-search.** The drug search bar (`src/components/Search.tsx`) is parked
  (removed from the App render) pending a rethink. Wanted: layperson synonyms ("HRT", "estrogen
  patch", "rescue spray") mapping to classes/molecules, search scoped to or across guides, and a
  clearer results UI. The lib `searchFormulary` index still exists and is tested.
- **Archive source PDFs + extract from them (`trace:live` content-tracing).** Save each cited
  formulary PDF to a local provenance store with metadata (URL, `fetched_at`, `sha256`, HTTP status,
  content-type, size, method) so we track where/when/how each was scraped; commit the metadata
  manifest + extracted-text excerpts (not the binaries — gitignore those). Then add a PDF text parser
  (devDependency; run the supply-chain advisory check first) so `npm run trace:live` reads inside the
  PDFs and verifies the actual tier/drug lines, not just reachability. User approved the dependency.
- **Backfill MA inhaler `tier`.** The MA cells have no insurance-cost tier, so the options table
  shows "see plan tier" for the recommended row. Read each MA formulary's tier table and set `tier`.
- **Add the remaining MD HealthChoice MCOs.** Johns Hopkins Priority Partners is now sourced
  (`verified`); the MD Medicaid FFS cells stay `partial` because the FFS PDL structurally doesn't
  manage HRT (not a closeable gap — it's a carve-out). Pull the other HealthChoice MCO formularies
  (Maryland Physicians Care, Wellpoint/Amerigroup, Aetna Better Health, UnitedHealthcare Community
  Plan, CareFirst Community Health Plan) so a Medicaid member can pick their actual MCO.
- **Finish verifying the `partial` / `example` cells.** MassHealth and MGB are largely `verified`;
  Tufts and Harvard Pilgrim are `partial` (formulary PDFs verified, per-cell agent inferred); BCBS
  MA is `example` (inhaler policy PDF returned HTTP 403 to the fetcher). Read each formulary PDF,
  confirm the preferred agent + reject list + step text, and flip `verification` to `verified` with
  an updated `verificationNote`. See `data-sources.md`.
- **Biologics & non-inhaler class** (currently a disabled tab). Omalizumab (Xolair, now with the
  Omlyclo biosimilar), mepolizumab, benralizumab, dupilumab, tezepelumab — specialty-pharmacy /
  buy-and-bill with their own PA pathway. Cite FDA + manufacturer; the sources research already
  gathered the key facts.
- **Patient Synonym search mapping** (Newbie/Patient): Support mapping layperson search terms
  (e.g., "rescue spray", "blue inhaler", "steroid pump", "COPD breath") to their clinical drug classes
  or specific molecules in the search index so patients without medical background find what they need.

## Medium

- **PR #6 review nitpicks, deferred rather than blocking merge.** From the two-persona review
  (SW engineer + data reviewer) of the state/topic-picker split and NY/IL NSAID guides:
  - `Controls.tsx`'s state/topic segmented tablists omit `aria-controls` (unlike the existing class
    tabs, which set it to the result panel id) — minor a11y gap; there's arguably no single stable
    panel these two new tabs "control" the way class tabs do, so decide the right target before
    adding it.
  - Rapid double-arrow-key navigation on the state/topic tablist can land focus on a button that's
    mid-fetch-disabled; `.focus()` on a disabled element silently no-ops, dropping focus to
    `document.body`. Narrow today (most combos have no guide yet), will widen as more guides ship.
  - `onTabKeyDown`/`onStateKeyDown`/`onTopicKeyDown` in `Controls.tsx` are copy-pasted
    roving-tabindex logic, differing only in the array/getter/setter — worth one generic factory.
  - The `!activeGuideId` "Not covered yet" panel and the "No record for this payer/class" panel in
    `App.tsx` are two near-identical empty-state JSX blocks — worth one small `EmptyState`
    component (this is the second occurrence of the pattern, per the repo's own "build the helper
    the second time" rule).
  - `findGuideId` re-scans `guideOptions` (currently 6 entries) on every render — not worth a
    `useMemo` at this scale, revisit if the guide count grows a lot.
  - ~~Grouped `paRequired`/`alternatives` entries lose per-drug accountability~~ — **FIXED**: the
    codex bot caught this concretely (IL's original grouped entry misclassified Etodolac,
    Flurbiprofen, and Ketoprofen as PA-required when the PDL lists all three preferred); the
    `il-nsaids` cell now transcribes every PREFERRED/NON_PREFERRED line item individually. Keep this
    per-drug granularity for future guides instead of reverting to grouped entries.
  - Confirm whether Illinois's HFS PDL has an equivalent to NY's "PA required if 2+ concurrent
    NSAIDs" class-wide criterion (captured on NY's record as `preferredRestriction`) or genuinely
    lacks one — the `il-nsaids` cell currently has no `preferredRestriction` set.
  - **Persist the state/topic pick in the URL, not just a valid `?guide=` id** (codex bot, P3).
    Landing on an uncovered (state, topic) combo today only clears a stale `guide` param — it
    doesn't add a `state=`/`topic=` param, so reloading or sharing that URL lands on the default
    guide instead of reproducing the exact gap the user was looking at. Deliberately out of scope
    for the initial picker split (see the "Separate the state and prescription-type selectors"
    item); worth adding `state=`/`topic=` URL params once the gap-browsing use case matters enough.
- **Cash-link rules for the VA diabetes drugs.** The `va-diabetes` guide shipped with no explicit
  GoodRx/Cost Plus rules, raising `KNOWN_UNPRICED_GAP` from 72 to 148 (`src/lib/cash.ts`).
  Metformin, generic dapagliflozin, insulin glargine biosimilars, and generic lispro/aspart are
  exactly the drugs where a cash price beats insurance often enough to matter. Use the browser
  session (GoodRx 403s plain fetch) + `costplusdrugs.com/medications/?query=` slug search;
  guess GoodRx exact-dosage params directly per the CLAUDE.md pattern. **Status 2026-07-06: still
  0/76 priced** — the single biggest remaining chunk of the cash-price gap below.
- **Dosage/strength as a first-class field.** `PreferredAgent.strength` (and every cash-link rule
  in `cash.ts`) pins one representative strength per drug rather than letting a user pick the
  strength actually prescribed and see the sig/price/PA rule for that exact dose. This has bitten
  us twice this session: GoodRx's bare slug page defaults to whichever strength/form it picks
  first (already worked around per-rule via `goodRxParams` deep links — see the HRT-patch and
  ACE-inhibitor price fixes in `issues.md`), and insulin dosing is individualized enough that a
  single `sig` string can't represent it honestly. Some formularies also gate PA/quantity limits
  by strength (e.g. only the highest-dose SKU needs PA), which today's schema can't express at
  all. The VA diabetes guide (shipped 2026-07-02) makes this gap bigger: each cell pins one
  representative strength/sig for drugs whose dosing is inherently titrated (GLP-1 escalation
  schedules, individualized insulin units, metformin ramp-up), and the VA Medicaid PDL itself
  gates metformin differently *by strength* (500 mg PA'd, 1000 mg not) — exactly what this item
  exists to express. Add a strength dimension to `FormularyRecord`/`PreferredAgent` (or a `strengths[]` list of
  `{strength, sig, sigShort, plainSig, tier?, paRequired?}` variants) so a drug can carry more than
  one dose, and have cash-link resolution key off `(name, strength)` instead of name alone. Do
  this *after* — and folding in — the existing low-priority `goodRxParams` structured-fields item,
  since both touch the same "one drug, several dose variants" shape.
- **Separate the state and prescription-type selectors — Phase 1 SHIPPED 2026-07-05.** `Guide`
  gained explicit `stateCode`/`topicId` keys (plus a short `topic` display label); `App.tsx`/
  `Controls.tsx` now expose two independent segmented-button controls (both state and
  therapeutic-area render as `.seg` tab groups — `src/lib/formulary.ts`'s
  `stateOptions`/`topicOptions`/`findGuideId`) instead of one flat guide-switch button row. Picking
  a (state, topic) pair with no guide shows an explicit "Not covered yet" panel instead of hiding
  the combination.
  - **NSAIDs topic added 2026-07-05:** `ny-nsaids` (NY Medicaid/NYRx) and `il-nsaids` (Illinois
    Medicaid/HFS, a brand-new state for this app) shipped, each 1 payer × 1 class (`nsaid-oral`),
    both cells `verified`. See `data-sources.md`. This makes **NY the first state with 2 topics**
    (ace-inhibitors + nsaids) — the Phase 2 trigger condition below has now actually occurred.
  - **Next: fill remaining (state, topic) gaps.** MA/MD/NY/VA/IL × {inhalers, menopause-ht,
    ace-inhibitors, diabetes, nsaids} is a big grid; most cells are still empty. Each missing cell
    needs a full `formulary-data` skill run (every payer × active class in the guide sourced and
    cited) before it can ship — do these one (state, topic) combo at a time, confirming scope
    before any Workflow fan-out (hard ≤2-concurrent-agent cap). Also still open: `ny-ace`'s
    remaining 5 NY commercial payers, NY/IL NSAIDs' remaining commercial payers (tracked in
    `data-sources.md`), and cash-link rules for the 5 NSAID drug names (`KNOWN_UNPRICED_GAP` raised
    148 → 161, see `src/lib/cash.ts`).
  - **Phase 2 (schema change) — trigger condition now met, still not urgent.** Factor `payers[]`
    out of `Guide` into a per-state pool shared across that state's topics, so adding a payer to
    NY's next topic doesn't mean re-entering NYRx's identity a 3rd time. NY now has 2 topics
    (`ny-ace`, `ny-nsaids`) with the exact same single payer object duplicated verbatim between
    them — real but small duplication cost today (1 payer object, not 8). Worth doing next time NY
    gets a 3rd topic or gains more payers, rather than before then.
- **Drug-level data for NY, VA, DC.** The state map indexes their plans/PBMs/formulary URLs
  (`src/data/state-index.json`); turn those into in-app guides with drug-level cells. DC not started.
  **NY ACE inhibitors: 1/6 intended payers shipped** (`ny-ace` guide, NY Medicaid/NYRx only —
  verified, dual-sourced). The other 5 NY payers (Empire BCBS, Excellus BCBS, Cigna, Aetna, UHC
  commercial) need a fresh gather — the `data-gathering/ny-ace-2026-07-01/payer-*.json` checkpoints
  a prior backlog note pointed at no longer exist on disk (see issues.md); there is no shortcut,
  they need re-gathering from scratch.
  **VA diabetes: SHIPPED 2026-07-02** — `va-diabetes` guide, all 8 payers × 4 classes
  (metformin-oral/glp1/sglt2/insulin), every cell `verified` off the payer's own formulary
  document. 6 payers gathered by a fresh chunked (≤2-concurrent) Workflow run; the last 2
  (Sentara Commercial, Wellcare Value Script) hit the session usage limit as agents and were
  finished inline off the same PDFs. Remaining VA follow-up: cash-link rules for the diabetes
  drugs (see below) and a quarterly re-verify.
- **Wire `trace` + `build:map` into CI / a pre-commit.** `npm run trace` (static provenance) should
  gate commits so a line item without a resolvable source fails loud; `build:map` should regenerate
  and assert `docs/formulary-map.md` matches the data (generated output must commit with its source).
  `trace:live` is too network-flaky for CI — run it on a schedule instead.
- **Prune dead CSS from the reflow.** `.cost-note*`, `.reject__intro`, `.coverage-panels`,
  `.coverage-panel--covered`, `.detail-stack`/`.detail-block` are now unmatched (see `issues.md`).
- **MD menopause: ship the `combo` class + more payers.** Estrogen–progestogen combination products
  (Combipatch, Bijuva, Climara Pro, generic estradiol/norethindrone) are scaffolded as a disabled
  `combo` tab — source and enable them. Add UnitedHealthcare and Aetna of Maryland as payers.
- **Deep-link state to the URL** (`?plan=masshealth&class=icslaba`) so a prescriber can bookmark or
  share a specific cell, and the search result can be shared.
- **Freshness badge** that turns amber when a cell's `lastReviewed` is > 90 days old (formularies
  change quarterly).
- **Print / hand-out view** of a plan's full preferred grid for a clinic binder or the patient.
- **Quantity limits** as a first-class field (the formularies carry QL codes alongside PA/ST).
- **Surface the strength/dose in the open answer** (Expert): the patient-first refactor moved the
  strength (e.g. "90 mcg") and clinical sig behind the "Prescription text for clinician" `<details>`.
  That is the one load-bearing number a prescriber needs every time — show it as a quiet line in the
  open answer (DESIGN.md "one surface, two audiences"), without bringing back the rest of the jargon.
- **Inhaler Spacer & Technique instructions** (Patient/Newbie): Show simple device-specific instructions
  (MDI vs. DPI technique) based on the preferred agent's delivery type (e.g. HFA inhalers benefit from
  spacers and slow deep breathing, while dry-powder inhalers need a fast, forceful breath).
- **Insurance Card Helper (Payer finder)** (Newbie): Add a mini-guide explaining how patients can locate
  their plan, PBM, RxBIN, and RxGroup on their physical insurance card to select the correct plan.
- **PA appeal as a payer's own pre-filled PDF form.** The letter now downloads as a real PDF
  (`lib/letterPdf.ts`, jspdf@4.2.1 lazy-loaded on click, shipped 2026-07-01); what remains is
  filling a payer's *official* appeal-form PDF (some plans require their form, not a letter).
  Needs a per-payer PDF form template — jspdf can't fill AcroForms, so that phase wants pdf-lib
  instead (advisory-swept clean 2026-07-01 alongside jspdf).

## Low

- **`goodRxParams` as structured fields.** `src/lib/cash.ts`'s exact-dosage deep links are hand-
  written query strings (`label_override=...&form=...&dosage=...`); worth turning into a
  `{form, dosage, quantity}` object + one shared builder once a 4th/5th rule needs the same
  treatment (only 3 do today — not worth the abstraction yet per "build the helper the second time
  you need it"). Flagged in code review.
- **`cashLinkRule()` per-row re-scan.** Each of `goodRxUrl`/`costPlusUrl`/`goodRxPrice`/
  `costPlusPrice`/`pricesCapturedAt` independently re-scans the ~20-rule regex table for the same
  drug name; harmless at this scale, worth a single `resolveCashLink(name)` if the rule table grows
  much larger. Flagged in code review.
- ESLint + Prettier (kept out of MVP to minimize dependency surface; tsc strict covers types). When
  added, wire the design ban-list regex (no `bg-(indigo|violet|purple)`, `rounded-2xl`, `shadow-lg`,
  gradients) into CI per docs/design.md.
- GitHub Actions Pages deploy (SHA-pinned `actions/*`) as an alternative to the `gh-pages` branch.
- Dark theme — invert to a warm near-black canvas, darken the three status hues one stop to hold AA.
- **Compact Clinic Grid Layout** (Expert/UX): Add a toggle for a compact side-by-side comparison matrix of
  all 5 plans for the active class, optimized for rapid clinical scanning and printing.


- **(low) One reference id per document per guide.** The va-diabetes guide registers the statewide
  DMAS PDL PDF under 2 ids (and the DMAS bulletin under 3) because each payer's gather agent minted
  its own; validation passes but single-source-of-truth favors deduping and remapping sourceIds.
  Flagged by the PR #5 data review.
- **(low) `npm ci --omit=optional` in CI/deploy.** jspdf's optionalDependencies pull core-js (has an
  install script) + canvg/html2canvas/dompurify, all unused by our code path (no `html()`/`svg()`
  calls). Omitting optionals shrinks the install-script and supply-chain surface at zero runtime
  cost. Flagged by the PR #5 SW review.
