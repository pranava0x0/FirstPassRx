# Automated PA drafting — research pass (2026-08-24/25)

One state, one medication, end to end: **Massachusetts × fluticasone propionate HFA** (the
generic of discontinued Flovent HFA, inhaled corticosteroid class). This directory holds the
full research trail: landscape notes with citations, the real payer forms (downloaded, hashed,
validated), a machine-readable drafting template, two filled sample drafts, and the one-click
UX design. Everything cited was captured 2026-08-24/25; provenance lives in
[forms/manifest.json](forms/manifest.json).

**TL;DR — the feature is buildable, the niche is empty, and MassHealth is the durable lane.**
Every MA payer's PA intake for this drug is a *public fillable PDF* (or a portal fed by the
same questions). The blank forms have named AcroForm fields, so a static site can pre-fill
80–90% of a request client-side with `pdf-lib` — no server, no PHI stored — and the app already
curates the two inputs that matter: which payer blocks the drug, and what that payer's own
criteria demand. Nobody in the market does zero-login, zero-PHI, payer-criteria-aware PA
preparation today. Two watch-items temper the commercial lane: Massachusetts' June 2026 DOI
regs may eliminate PA on chronic-condition drugs at fully-insured carriers, and forms drift on
a months-scale cadence (MassHealth revised our pilot form twice in 2026 already).

---

## 1. Why this vertical

The user's candidates were "OB in Maryland" (md-menopause) or "inhalers in Massachusetts"
(ma-inhalers). MA inhalers won on three facts:

- **One drug, four distinct PA pathways.** Our own verified data
  (`src/data/formulary.json`, ma-inhalers ICS records) shows fluticasone propionate HFA is the
  *preferred no-PA Tier-1 agent at BCBSMA* while being step/PA-blocked at MassHealth (age ≥ 12),
  Tufts, Harvard Pilgrim, and MGB Health Plan — each with different criteria. That is the app's
  whole thesis in one row, and a perfect template test matrix.
- **All five payers are state-specific** (the md-menopause roster is half national carriers +
  Part D, which dilutes the state-form story).
- **Massachusetts has the cleanest form landscape in the country**: a statutory standard form
  for commercial plans plus a fully unified Medicaid formulary with numbered per-class forms.

## 2. What's out there (private sector)

Full notes with per-company citations: [notes/private-sector-landscape.md](notes/private-sector-landscape.md).

- **The rails are solved; drafting isn't.** Pharmacy-benefit ePA runs on NCPDP SCRIPT: the PBM
  serves a dynamic question set per transaction through CoverMyMeds (McKesson, ~95% of Rx
  volume) or Surescripts CompletEPA (embedded in Epic). Yet roughly half of drug PAs still move
  by phone/fax, and the published evidence on ePA time-savings is mixed-to-negative.
- **The funded startups split by customer.** Payer-side review automation (Anterior, Cohere,
  Basys, Banjo) doesn't help a prescriber draft. Provider-side pharmacy drafting exists but is
  enterprise/EHR-integrated and often pharma-funded: Latent Health ($80M Series A), Develop
  Health, Forus (fka Tandem — $1B valuation, free to providers *because pharma pays*),
  PrescriberPoint (free, payer-aware, but accounts + chart data + pharma sponsors).
- **The free patient layer is post-denial appeals** (Claimable, Fight Health Insurance,
  Counterforce). **Pre-denial, zero-login, zero-PHI request preparation is an empty niche.**
- **Best design evidence:** a Mar 2026 arXiv benchmark (2603.29366) found LLM-drafted PA letters
  score >97% on clinical content but fail on administrative scaffolding (codes, durations,
  payer specifics). Winners pair deterministic payer/formulary data with narrative — the
  deterministic layer is exactly what FirstPassRx curates.

## 3. What payers and regulators are doing

Full notes: [notes/payer-regulatory-landscape.md](notes/payer-regulatory-landscape.md).

- **CMS-0057-F excludes drugs.** The 2027 FHIR Prior Authorization APIs cover items/services
  only — CMS's own FAQ says drugs were excluded because their standards and timeframes differ.
  The drug gap has its own *proposed* rule (CMS-0062-P, Apr 2026: NCPDP ePA for
  Medicaid/CHIP/FFE-QHP plans starting Oct 2027), not final. Manual drug PA persists through at
  least 2027–28. **This feature is not about to be obsoleted by regulation.**
- **The AHIP June-2025 pledge and payer AI (Optum PreCheck, Caremark sub-6-second ePA, EviCore
  intelliPath, Humana×Cohere) accelerate *adjudication*, not *drafting* — and the pledge's
  celebrated 11% PA reduction is medical-services-only, excluding prescription drugs.**
- **Massachusetts specifics** (the pilot's regulatory spine):
  - **M.G.L. c. 176O § 25** mandates one standard medication-PA form for all DOI-regulated
    carriers, with **deemed approval if the carrier doesn't respond within 2 business days**.
    The form is the "Massachusetts Collaborative — Massachusetts Standard Form for Medication
    Prior Authorization Requests"; the Feb/Apr 2024 revision added Section F, the four
    statutory step-therapy-exception questions.
  - **MassHealth**: UMass Chan Clinical Pharmacy Services runs the benefit, Conduent hosts the
    MHDL; since Apr 2023 one unified formulary binds FFS and every MCO/ACPP; PA decisions are
    due in 24 hours with a 72-hour emergency supply as the bridge.
  - **CA (form 61-211) and TX (NOFR002)** are the natural expansion analogues; 10+ states have
    uniform-form laws.

## 4. The form corpus, validated

Nine documents captured (blank forms + criteria policies), each with URL, sha256, size,
fetch date, and per-form validation evidence in [forms/manifest.json](forms/manifest.json). The
complete 77-form MassHealth per-class registry (every drug class → numbered fillable form +
effective date) is archived in
[masshealth-pa-form-registry-2026-08-24.json](masshealth-pa-form-registry-2026-08-24.json) —
it also covers our other MA guides (Antidepressant → ma-ssris, Antidiabetic Agents →
ma-diabetes, Osteoporosis, Anticoagulant…).

Validation matrix for the pilot drug — **the right form per payer, with evidence**:

| Payer | Blocked? (our data) | Correct intake form | Validation evidence |
| --- | --- | --- | --- |
| MassHealth (FFS + all MCO/ACPP) | Step: trial of 2 no-PA ICS first (aerosol ≥ 12 yr) | **Inhaled Respiratory Agents PA Request** (eff. 07/01/26, 7 pp, 163 fields) | Listed on the MHDL PA-forms index; page 2 names "fluticasone propionate inhalation aerosol ≥ 12 years" as a checkbox; Section IV criteria match MHDL Table 23 + our `mh-pa37` record; page 1 routes all six MassHealth plans (FFS DUR fax 877-208-7428, Tufts Together → PromptPA, MGB → CoverMyMeds/OptumRx…) |
| BCBSMA | **No PA — fluticasone HFA is their preferred Tier-1 ICS** | n/a (contrast column); their vehicle for other drugs is the MA Standard Form as a Provider Central eForm | July 2026 Standard Control formulary (our `bcbsma-std-covered-2026-07`); BCBSMA Pharmacy Policy 023 instructs use of the eForm; their branded April-2024 standard form PDF captured |
| Tufts (Point32, commercial) | Step + age limit (Tier 3) | **MA Standard Form, Feb 2024 v1.0** (Tufts-branded, 3 pp, 133 fields, Section A pre-printed by the plan: fax 617-673-0988, PromptPA) | Linked from point32health.org's "Requesting authorization" page under Tufts commercial, by name |
| Harvard Pilgrim (Point32, commercial) | Step + age limit (Tier 3) | **MA Standard Form, Feb 2024 v1.0** (HPHC-branded, same 133-field template) | Linked from the same Point32 page ("Massachusetts — MA providers only"); the 2019 RxUM legacy copy also captured as evidence carriers brand the state form rather than authoring their own |
| MGB Health Plan | PA (≥ 12): fail BOTH Arnuity + QVAR, or documented MDI+spacer need | "Standard Prior Authorization Form" (MA standard family) + drug-specific criteria policy | MGB's own commercial pharmacy-guidelines page; the fluticasone policy PDF (eff. 09/10/2025) matches our `mgb-flut-hfa-pa` record verbatim, incl. OptumRx fax 844-403-1029 |

The convergence finding: **for commercial MA, one form serves every carrier** (they each host a
branded copy of the same state form and are statutorily bound to accept it), and **for
MassHealth, one form serves all six plans** (routing table printed on the form itself). Two
templates cover the whole state for this drug.

Re-runnable integrity + drift check: `npm run validate-pa-forms` (offline sha256 vs. manifest)
and `npm run validate-pa-forms:live` (re-fetch each source; drift = re-capture signal, not
failure).

## 5. What actually filling them taught us

These are the findings that shape the implementation — all discovered by drafting, none
visible from reading:

1. **Both form families are true fillable AcroForms** — 163 named fields (MassHealth) and
   120–133 (standard form). Client-side fill with `pdf-lib` is mechanically proven; no OCR, no
   overlay hacks.
2. **Field names lie; positions don't.** On the MassHealth form, several "No" checkboxes are
   *named* "Yes. Please list the dates/duration…" (copy-paste artifacts), the Member ID field
   is named `Date of birth` and the DOB field is named `MI`, and the Section XI outcome
   checkboxes are all named "Adverse reaction_N" even where they render as "Inadequate
   response"/"Other". **A template must be built from widget positions verified against a
   rendered page, then pinned — never from field names alone.**
3. **One field-name collision**: on the standard form, `undefined_5` is shared by two different
   questions ("contraindications to alternatives?" and "reauthorization?") — setting it answers
   both. Fine when both answers agree; a hard constraint the template has to encode.
4. **Radio export values are irregular** (`/0`…`/5`, `/On`/`/`, `/True1`/`/False1`,
   `/Sometimes_7`) and at least one fill library misreads them. The template records exact
   export states per option (see [templates/ma-ics-fluticasone-hfa.json](templates/ma-ics-fluticasone-hfa.json)).
5. **Payers already pre-populate** — Tufts ships Section A filled in (plan name, fax, portal
   URL), and the form's own Section A header invites payers to prepopulate. Pre-filling the
   destination + medication + criteria scaffold is squarely within the form's intended use.
6. **The criteria are shallow enough to template.** MassHealth's entire fluticasone gate is one
   question ("trial with two inhaled corticosteroids?") plus a 3-row trial table; MGB's is
   two named brands or an MDI+spacer justification. The app already stores these as
   `stepTherapy`/`paRequired` text with citations.

## 6. The sample drafts

Two filled, position-verified drafts (all data fabricated and stamped NOT FOR SUBMISSION —
see [drafts/README.md](drafts/README.md)):

- [drafts/draft-masshealth-fluticasone-hfa-SAMPLE.pdf](drafts/draft-masshealth-fluticasone-hfa-SAMPLE.pdf) —
  MassHealth FFS, Section IV "Yes" path with two ICS trials in Section XI.
- [drafts/draft-tufts-fluticasone-hfa-SAMPLE.pdf](drafts/draft-tufts-fluticasone-hfa-SAMPLE.pdf) —
  Tufts commercial, Section F step-exception path (prior QVAR-generic trial, inadequate
  response) + full Section G clinical grid.

## 7. Risks and open questions

- **MA's June 5, 2026 DOI regs (211 CMR 52.00 amendments) eliminate PA for medications for
  "certain chronic conditions" — asthma was named in the governor's announcement.** If ICS
  inhalers fall in scope, the *commercial* half of this vertical shrinks to nothing at
  fully-insured BCBSMA/Point32/MGB books. Notably, the carriers' own 2026 formulary documents —
  which we re-read in July 2026, after the effective date — still list the step edits, so
  either implementation lags, it lands at plan-year renewal, or ICS is out of scope. The regs
  do **not** touch MassHealth or self-insured ERISA plans, so the Medicaid lane (and the
  MassHealth form registry) is durable either way. Verify per-carrier before building the
  commercial flow.
- **Forms drift on a months-scale cadence.** The MassHealth inhaled form went Rev. 01/26 →
  07/01/26 between our June formulary gather and this capture; effective dates on the registry
  range from 01/26 to 08/26. Any shipped template needs the live-drift check in its refresh
  ritual.
- **mass.gov hosts a stale copy of its own standard form** (April 2019 v1.0, pre-Section-F)
  while carriers host Feb/Apr 2024 — the *carrier* copy is the current one to template. The
  "Bulletin 2024-03" doc slug on mass.gov serves a text-free scan.
- **Fax and portals stay the submission rails** (MassHealth DUR 877-208-7428; OptumRx
  844-403-1029; BCBSMA eForm; PromptPA) until at least the CMS-0062-P horizon (proposed
  Oct 2027, Medicaid/CHIP/QHP only). A static site can produce the artifact but never submit
  it — by design.
- Doses/strengths per drug (44/110/220 mcg) don't change the form or criteria here, but the
  dosage-aware generation backlog item should confirm that assumption per class (it breaks for
  drugs where strength changes the criteria, e.g. GLP-1 titration schedules).

## 8. One-click UX (design)

**Entry point.** On a `ResultCard` where the searched drug sits in `paRequired` (e.g.
fluticasone HFA under Tufts), next to the existing "PA required/step therapy" pill and the
appeal-letter button: **"Draft the PA form"**. The button only renders when the forms registry
has a validated template for (payerId, classId) — absence of a template means no button, never
a generic fallback.

**Flow (three panes in a drawer, mirroring the appeal-letter UX):**

1. **The right form, already chosen.** Header states the payer's correct intake ("MassHealth
   Inhaled Respiratory Agents PA Request, eff. 07/01/26" / "MA Standard Form — Tufts accepts
   this by law, M.G.L. c. 176O § 25") with its citation, submission channel (fax number,
   portal link), and decision clock (24 hr MassHealth / 2-business-day deemed approval
   commercial). This is the app's existing evidence-first voice.
2. **Prefilled scaffold + the clinical gap.** The drug/strength/sig/quantity, plan routing,
   and criteria structure arrive filled; the app lists *this plan's own preferred agents* as
   the expected prior-trial rows (exactly what it already knows). The prescriber answers only
   the criteria questions (trial dates/outcomes or exception rationale) and patient fields.
   A saved **practice profile** (prescriber name/NPI/phone/fax — localStorage only) makes
   repeat drafts one click for real.
3. **Download.** `pdf-lib` fills the blank AcroForm entirely in the browser → user gets the
   payer's own PDF, ready to sign and fax/upload, plus a checklist line ("attach chart notes
   for the trials listed"). Print/fax cover text optional.

**Privacy stance (the differentiator, stated in the UI):** patient fields never leave the
browser, are never persisted, and the site keeps no accounts. The only stored artifact is the
prescriber's own practice profile on their device.

**Data model.** `pa-forms-registry.json` per guide: `(payerId, classId) → { formFile, formTitle,
effectiveDate, revisionCheckUrl, submission{fax,portal,phone}, decisionClock, fields[] }` where
each field entry pins `{ acroName, page, rectHint, valueSource: app|practiceProfile|patient|clinical,
exportState? }` — the position-verified map this research produced for one cell
([templates/ma-ics-fluticasone-hfa.json](templates/ma-ics-fluticasone-hfa.json) is the seed).
Blank form PDFs ship as static assets (~100–620 KB each, lazy-loaded on click, same pattern as
the jspdf lazy-load).

**Honesty rule:** the UI says "drafts ~90% — you review, complete, and sign", never "submits
your PA" and never a predicted approval. The signature stays human (MassHealth explicitly
rejects typed signatures).

## 9. Path to shipping (proposed phases)

1. **Phase 1 — MassHealth inhalers (this template).** One payer object, one form, pdf-lib
   fill, practice profile, the drawer UX. MassHealth is durable (unified formulary, stable
   Conduent URLs, 24-hr clock, untouched by the DOI regs) and its form covers all six plans.
2. **Phase 2 — MA standard form generic path.** One template serves every MA commercial payer
   × every drug (fields are drug-agnostic; criteria text comes from our per-cell data). Gate
   on the 211 CMR 52.00 verification above.
3. **Phase 3 — registry scale-out.** The 77-form MassHealth registry maps 1:1 onto our other
   MA guides; CA (61-211) and TX (NOFR002) replicate the standard-form play in the two next
   uniform-form states.
4. **Ongoing** — `validate-pa-forms:live` joins the data-refresh ritual next to
   `validate-links`/`validate-prices`; drift → re-capture → re-verify template → bump manifest.

## File inventory

```
docs/pa-drafting/
├── README.md                                  ← this report
├── masshealth-pa-form-registry-2026-08-24.json  (77 forms: class → ids + effective dates)
├── forms/            9 captured PDFs + manifest.json (sha256, URLs, validation evidence)
├── templates/        ma-ics-fluticasone-hfa.json (per-payer field maps + criteria + channels)
├── drafts/           2 filled SAMPLE drafts + README
└── notes/            private-sector-landscape.md · payer-regulatory-landscape.md (cited)
scripts/validate-pa-forms.mjs                  ← manifest integrity + live-drift checker
```
