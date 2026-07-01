# Backlog

Ideas, each with a priority (low / medium / high). Reprioritize periodically.

## High

- **Flesh out the PA appeal letter against real prior-appeal examples.** `buildAppealLetter`
  (`src/lib/appealLetter.ts`) currently follows the general shape of 2 published templates
  (Patient Advocate Foundation's sample pre-auth appeal, WA OIC's appeal structure), but a review
  against real successful appeals suggests it's missing several elements those actually include:
  (1) the plan's specific appeal deadline / response-timeframe language (varies by state and
  ERISA vs. non-ERISA plans), (2) an **expedited/urgent appeal** request option when delaying
  treatment risks health, (3) an explicit list of which formulary alternatives were tried and
  failed (or why not clinically appropriate) — the strongest medical-necessity argument and
  currently left entirely to the attached Letter of Medical Necessity, (4) a placeholder for the
  specific denial/procedure code and ICD-10 diagnosis code, (5) a citation to the plan's own
  medical policy criteria for the drug, not just a generic PA-policy URL link, (6) language noting
  the right to external/independent review if the internal appeal is denied. Research actual
  payer appeal-letter requirements (start with a couple of large PBMs' appeal-submission
  checklists + a state DOI appeals guide) and revise the template + its placeholder fields
  accordingly; add fixture-based tests for the new sections.
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

- **Dosage/strength as a first-class field.** `PreferredAgent.strength` (and every cash-link rule
  in `cash.ts`) pins one representative strength per drug rather than letting a user pick the
  strength actually prescribed and see the sig/price/PA rule for that exact dose. This has bitten
  us twice this session: GoodRx's bare slug page defaults to whichever strength/form it picks
  first (already worked around per-rule via `goodRxParams` deep links — see the HRT-patch and
  ACE-inhibitor price fixes in `issues.md`), and insulin dosing is individualized enough that a
  single `sig` string can't represent it honestly. Some formularies also gate PA/quantity limits
  by strength (e.g. only the highest-dose SKU needs PA), which today's schema can't express at
  all. Add a strength dimension to `FormularyRecord`/`PreferredAgent` (or a `strengths[]` list of
  `{strength, sig, sigShort, plainSig, tier?, paRequired?}` variants) so a drug can carry more than
  one dose, and have cash-link resolution key off `(name, strength)` instead of name alone. Do
  this *after* — and folding in — the existing low-priority `goodRxParams` structured-fields item,
  since both touch the same "one drug, several dose variants" shape.
- **Separate the state and prescription-type selectors.** Today `Guide` bundles one region +
  one therapeutic area into a single self-contained unit (`ma-inhalers`, `md-menopause`,
  `ny-ace`), and the top toggle picks a whole guide at once — so a state and a drug class are
  really one combined choice, not two independent ones. This gets worse once a state ships a 2nd
  topic (VA is getting diabetes now; NY could later get inhalers too): today's schema would need a
  whole new guide object that *duplicates* that state's payer list just to pair it with a
  different class list.
  - **Phase 1 (UI only, no schema change):** turn "Choose a guide" into a 2-step picker — pick a
    state first (derived from `guide.region`), then pick a therapeutic area among the guides that
    exist for that state (derived from `guide.topic`). Guides stay exactly as self-contained as
    they are today; this only changes how the existing guide list is grouped and presented. Safe
    to do now, and immediately clearer once VA (diabetes) and NY (ACE inhibitors, eventually more)
    both exist.
  - **Phase 2 (schema change, defer until a state actually has 2+ topics and the payer-duplication
    cost is felt):** factor `payers[]` out of `Guide` into a per-state pool shared across that
    state's topics, so adding a 2nd topic to an existing state doesn't mean re-entering the same
    MCO/PBM/formulary-URL metadata again. `classes[]`/`records[]`/`references[]` stay topic-scoped.
    This is a real data-migration (every existing guide's `payers[]` moves and every `payerId` in
    `records[]` needs to keep resolving), so don't do it speculatively — wait until VA or another
    state actually needs a 2nd topic before touching the schema.
- **Drug-level data for NY, VA, DC.** The state map indexes their plans/PBMs/formulary URLs
  (`src/data/state-index.json`); turn those into in-app guides with drug-level cells. DC not started.
  **NY ACE inhibitors: 1/6 intended payers shipped** (`ny-ace` guide, NY Medicaid/NYRx only —
  verified, dual-sourced). The other 5 NY payers (Empire BCBS, Excellus BCBS, Cigna, Aetna, UHC
  commercial) need a fresh gather — the `data-gathering/ny-ace-2026-07-01/payer-*.json` checkpoints
  a prior backlog note pointed at no longer exist on disk (see issues.md); there is no shortcut,
  they need re-gathering from scratch.
  **VA diabetes: not shipped, 1/8 payers verified this session.** `state-index.json` actually lists
  8 VA payers, not 10 as an earlier note said. A chunked (≤2-concurrent) re-gather this session
  (2026-07-01, Workflow run `wf_20cee55f-82a`) got 1 payer fully done — **VA Medicaid FFS
  (Cardinal Care), all 4 classes (metformin-oral/glp1/sglt2/insulin), `verified` off the real PDL
  PDF** — checkpointed at `data-gathering/va-diabetes-2026-07-01/va-medicaid-ffs.json`. The other 7
  (Anthem HealthKeepers Plus, Sentara Community Plan, UHC Community Plan, Aetna Better Health,
  Anthem BCBS Commercial, Sentara Commercial, Wellcare Value Script PDP) all failed on a resume
  attempt with `FailedToOpenSocket`/`ConnectionRefused` errors — a transient connectivity issue,
  **not** the earlier rate-limit failure mode. The guide still can't ship (count-floor validation
  needs every payer × every active class). Next step: resume the same run
  (`Workflow({scriptPath: .../va-diabetes-gather.mjs, resumeFromRunId: "wf_20cee55f-82a"})`) once
  connectivity is stable — it replays the VA-Medicaid-FFS result from cache at no cost and only
  re-runs the 7 that failed, still in chunks of ≤2. Note: `resumeFromRunId` only works within the
  *same* session that launched the run, so a future session can't reuse that run id — but it can
  still skip re-gathering VA Medicaid FFS by reading the already-checkpointed
  `va-medicaid-ffs.json` directly and only spawning the other 7.
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
- **PA appeal as a downloadable pre-filled PDF form**, phase 2 of the appeal letter shipped in
  `PrescribeOptions.tsx`/`lib/appealLetter.ts`. Needs a per-payer PDF form template and a PDF-fill
  dependency — run the supply-chain advisory check before adding it.

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

