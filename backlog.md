# Backlog

Ideas, each with a priority (low / medium / high). Reprioritize periodically.

## High

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

- **Drug-level data for NY, VA, DC.** The state map indexes their plans/PBMs/formulary URLs
  (`src/data/state-index.json`); turn those into in-app guides with drug-level cells (start with the
  same two domains, inhalers + menopause HT). The archived PDFs under `sources/` are the starting
  material.
- **Wire `trace` + `build:map` into CI / a pre-commit.** `npm run trace` (static provenance) should
  gate commits so a line item without a resolvable source fails loud; `build:map` should regenerate
  and assert `docs/formulary-map.md` matches the data (generated output must commit with its source).
  `trace:live` is too network-flaky for CI — run it on a schedule instead.
- **Prune dead CSS from the reflow.** `.cost-note*`, `.reject__intro`, `.coverage-panels`,
  `.coverage-panel--covered`, `.detail-stack`/`.detail-block` are now unmatched (see `issues.md`).
- **MD menopause: ship the `combo` class + more payers.** Estrogen–progestogen combination products
  (Combipatch, Bijuva, Climara Pro, generic estradiol/norethindrone) are scaffolded as a disabled
  `combo` tab — source and enable them. Add UnitedHealthcare and Aetna of Maryland as payers.
- **Automate PA Appeal** (currently a disabled button): pre-fill the payer's PA form / appeal letter
  from the selected cell's step-therapy text and reject reasons.
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

## Low

- ESLint + Prettier (kept out of MVP to minimize dependency surface; tsc strict covers types). When
  added, wire the design ban-list regex (no `bg-(indigo|violet|purple)`, `rounded-2xl`, `shadow-lg`,
  gradients) into CI per docs/design.md.
- GitHub Actions Pages deploy (SHA-pinned `actions/*`) as an alternative to the `gh-pages` branch.
- Dark theme — invert to a warm near-black canvas, darken the three status hues one stop to hold AA.
- **Compact Clinic Grid Layout** (Expert/UX): Add a toggle for a compact side-by-side comparison matrix of
  all 5 plans for the active class, optimized for rapid clinical scanning and printing.

