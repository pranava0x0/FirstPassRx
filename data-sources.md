# Data sources

The data is organized into **guides** (`src/data/formulary.json` → `guides[]`), one per region ×
therapeutic area: `ma-inhalers` (Massachusetts inhalers) and `md-menopause` (Maryland menopause
hormone therapy). Every cell carries a `sourceIds` list resolving to **its own guide's**
`references`, plus a `verification` state. The UI shows the citations and the state on each result.

## Verification states

- **verified** — the preferred agent + key restriction were read directly off the cited document
  (publisher- and content-verified, not just an HTTP 200).
- **partial** — the cited formulary is the correct, current source, but the exact preferred/PA value
  for this cell is inferred and should be confirmed in the document.
- **example** — illustrative; the source is the right formulary family but the value is unconfirmed
  (e.g., the payer's inhaler PDF blocked automated reading).

> As of capture (2026-06-22): MassHealth and MGB cells are largely **verified**; Tufts and Harvard
> Pilgrim are **partial** (formulary PDFs verified, per-cell agent inferred); BCBS MA is **example**
> (formulary + PA intake confirmed, but the inhaler policy PDF returned HTTP 403 to the fetcher).

## Primary sources (verified to resolve + correct publisher, 2026-06-22)

| Payer | Source | Status |
| --- | --- | --- |
| MassHealth | MHDL Table 23: Respiratory Agents (Inhaled), rev. 11/2025 + PA-37 (Rev. 01/26) | verified |
| BCBS MA | Provider Medication Look-up (provider.bluecrossma.com) | example (policy PDF 403) |
| Tufts (Point32Health) | Value Direct 3-Tier Formulary PDF, eff. 2026-01-01 (OptumRx hub) | partial |
| Harvard Pilgrim (Point32Health) | Select 3-Tier 2026 PDL PDF (OptumRx hub) | partial |
| MGB Health Plan | 2026 6-Tier Commercial Formulary + Fluticasone HFA PA Policy (eff. 09/10/2025) | verified |

Clinical class definitions, dosing, and generic/biosimilar status are cited to government and
guideline sources: NHLBI/NIH, GINA, NIH/NLM DailyMed (FDA labels), NCBI/StatPearls, and FDA
(first-generic approvals, ANDA letters, the Purple Book). See `meta.references` for the full list
with publisher, effective date, and capture date.

## Key verified findings baked into the data

- **MassHealth BOGL is real:** the MHDL lists brand **Ventolin HFA** as Brand Preferred and
  PA-exempt, while the **generic albuterol HFA inhaler requires prior authorization** (PA-37 §I).
- **MassHealth ICS/LABA:** Symbicort is a Preferred Drug (PD), no PA; AirDuo RespiClick needs a
  prior generic-Advair trial (PA-37 §III).
- **MGB ICS:** fluticasone propionate HFA requires members 12+ to fail **both** Arnuity Ellipta and
  QVAR RediHaler first (Fluticasone HFA PA policy).
- **Inhalers are generics, not biosimilars:** Wixela Inhub (generic Advair), Breyna (generic
  Symbicort), generic albuterol/Flovent HFA — all ANDA generics. Biosimilars apply only to
  injectable biologics (Omlyclo → Xolair).

## Maryland menopause hormone-therapy guide (`md-menopause`, captured 2026-06-27)

Classes: `est-td` (transdermal estradiol), `est-oral` (oral estradiol), `progestogen` (oral
micronized progesterone / medroxyprogesterone), `vaginal` (local vaginal estrogen), `combo` (oral
combined estrogen+progestin tablet). Real plan PDFs were downloaded and read.

Oral combo (added 2026-06-28): generic **estradiol / norethindrone acetate** tablet is the clean
first-pass on every plan (Priority Partners' closed formulary lists the ethinyl-estradiol/norethindrone
generic instead). Brand single-pill combos vary: CareFirst puts **Bijuva** behind a PA; Cigna and
Kaiser tier Angeliq/Bijuva up (non-preferred); Medicare Part D lists Activella/Angeliq/Bijuva/Prefest
as non-formulary; MD Medicaid FFS is `partial` (unmanaged class). No plan forces a brand over the
generic.

Oral estrogen (added 2026-06-28): generic **estradiol oral tablet** (0.5/1/2 mg) is the clean
first-pass on every plan; Premarin/conjugated and Menest/esterified estrogens are the brand tail
(non-preferred, higher tier, or — on the closed/Part-D formularies — non-formulary), and CareFirst's
age-70+ High Risk Medication PA reaches oral estradiol too. The class carries the clot-risk caveat
(oral > transdermal). MD Medicaid FFS is `partial` (same unmanaged-class reason as the other classes).

| Payer | Source | Status |
| --- | --- | --- |
| Maryland Medicaid (FFS) | MD Medicaid PDL, eff. 1/1/2026 (upd. 3/26/2026) + DAW6 brand-preferred list | partial (class is unmanaged on the PDL) |
| CareFirst BCBS (CVS Caremark) | 2026 Exchange/Individual & Small Group Formulary, upd. 6/1/2026 | verified |
| Kaiser Permanente Mid-Atlantic | 2026 Marketplace Formulary, upd. 4/7/2026 (HMO formulary corroborates) | verified |
| Johns Hopkins Priority Partners (HealthChoice MCO) | Priority Partners (690) Formulary, eff. 4/1/2026 (192-pp PDF read in full) | verified |
| UnitedHealthcare (commercial, OptumRx) | Commercial Prescription Drug List, eff. 1/1/2026 | verified |
| Cigna (commercial, Express Scripts) | Value 4-Tier PDL, eff. 7/1/2026 | verified |
| Aetna (commercial, CVS Caremark) | 2026 Standard Plan Drug Guide | verified |
| Medicare Part D (representative) | AARP MedicareRx Preferred (UHC), MD Region S5921, 2026 | verified |

### Key findings baked into the data

- **Maryland Medicaid FFS does not manage HRT on its PDL** — systemic/vaginal estrogen and
  progestogens are absent from the managed PDL and the DAW6 list names no estrogen, so generic
  estradiol / micronized progesterone are standard-benefit with no PDL-driven PA. Compounded
  "bioidentical" products are **excluded** (not FDA-approved), not merely PA. Cells are `partial`
  (the unmanaged-class fact is verified; the specific first-pass agent is the clinically-standard
  choice). Brand vaginal inserts/rings (Imvexxy, Estring, Femring) are not confirmed on the FFS PDL —
  confirm against the dispensing MCO.
- **CareFirst:** generic estradiol patch/gel, oral micronized progesterone, and estradiol vaginal
  cream/tablet are all **Tier 1, no PA**. The one catch: estrogens carry a **High Risk Medication PA
  for members age 70+** (Beers-criteria review) — not a barrier for typical menopausal patients. The
  age-70 PA does **not** apply to vaginal cream.
- **Kaiser Mid-Atlantic quirk:** generic **micronized progesterone is flagged PA + quantity limit**
  on this plan (atypical), so generic **medroxyprogesterone** (no restriction) is the first-pass that
  ships clean here; micronized progesterone is clinically preferred but expect a PA. Generic estradiol
  patch and vaginal estradiol are unrestricted.
- **Priority Partners is a *closed* formulary** — absence from the list = non-formulary (needs an
  exception/PA). Generic estradiol patch, micronized progesterone, and vaginal estradiol tablet/cream
  all ship clean; transdermal gels/sprays and Imvexxy/Estring/Femring are non-formulary. The Maryland
  HealthChoice FFS PDL carve-out covers only behavioral-health/SUD drugs, so menopause hormones run
  off *this* MCO formulary, not the state FFS PDL.
- **Commercial plans converge** on generic estradiol patch / oral micronized progesterone / vaginal
  estradiol as the clean Tier-1 first-pass (UnitedHealthcare/OptumRx, Aetna/CVS Caremark). Differences
  are in the brand tail: Cigna requires PA on Myfembree and Crinone and tiers up Premarin/Intrarosa/
  Osphena; Aetna prefers the vaginal *cream* over the generic tablet; UHC tiers up the gels and brand
  patches.
- **Medicare Part D varies by sponsor.** The cell names a concrete representative plan — AARP
  MedicareRx Preferred (UnitedHealthcare), a Maryland Region S5921 Part D plan — where generic HRT is
  covered (estrogens/progestins are not on the Part D excluded-drug list); Crinone needs PA and
  Imvexxy/Femring are non-formulary. The verificationNote flags the per-plan variance.
- Guideline backing for the class definitions/dosing: ACOG menopause HT FAQ and The Menopause Society
  (NAMS) 2022 position statement.

No payer document was login-walled. Every cited formulary (MD Medicaid PDL/DAW6/QL, CareFirst, KP MAS
Marketplace + HMO, Priority Partners 690, UnitedHealthcare commercial, Cigna, Aetna, AARP MedicareRx)
was fetched and read — several large PDFs were downloaded and text-extracted locally where WebFetch
could not render the binary stream.

## NY ACE inhibitors (`ny-ace` guide) — 2026-07-01

**Shipped: 1 of 6 intended payers.** New York carved the Medicaid pharmacy benefit entirely out of
Medicaid Managed Care effective April 1, 2023 — every NY Medicaid MCO (Fidelis, Healthfirst,
MetroPlus, UnitedHealthcare Community Plan, EmblemHealth) now shares one statewide program, NYRx,
rather than publishing its own formulary. Confirmed independently by two separately-researched MCOs
(Fidelis Care and Healthfirst) both resolving to the identical NYRx Preferred Drug List (revised
2026-06-04) with identical preferred-agent/PA findings — so the guide lists one consolidated
**"New York Medicaid (NYRx)"** payer instead of 5 near-duplicate MCO entries. Preferred agent:
lisinopril (generic, no PA); benazepril/enalapril/ramipril also preferred; all other ACE inhibitors
(captopril, fosinopril, moexipril, perindopril, quinapril, trandolapril, and all brand names) require
PA. Source: `newyork.fhsc.com/downloads/providers/NYRx_PDP_PDL.pdf` (gov, NYS DOH via Prime
Therapeutics/FHSC). `health.ny.gov` pages 403'd to automated fetch during this research but are
cross-referenced by the NYRx materials as the authoritative program home — don't re-attempt a direct
fetch there without a real browser session.

**Not yet gathered:** the 5 NY commercial payers (Empire BCBS, Excellus BCBS, Cigna, Aetna, UHC
commercial) — payer metadata (formularyUrl/PBM) is checkpointed at
`data-gathering/ny-ace-2026-07-01/payer-*.json` but no drug-class records exist yet. See backlog.md.

## VA diabetes (4 classes: metformin/oral, GLP-1, SGLT2, insulin) — shipped 2026-07-02

**Shipped, all 32 cells `verified`.** 8 payers × 4 classes in the `va-diabetes` guide, each cell
read directly off the payer's own formulary document:

- **VA Medicaid FFS (Cardinal Care)** — statewide Medicaid-Approved PDL / Common Core Formulary
  PDF (`fm.formularynavigator.com/FBO/4/Virginia_PDL_English.pdf`, effective 2026-05-01), plus a
  DMAS bulletin. The four Medicaid MCOs below follow this statewide PDL for PDL-managed classes;
  each MCO cell also cites the MCO's own document confirming the deferral.
- **Anthem HealthKeepers Plus** (CarelonRx), **Sentara Community Plan** (Express Scripts, July–Sept
  2026 formulary, doc SHP_MD_MEM_OMSC_230005), **UHC Community Plan of VA** (OptumRx), **Aetna
  Better Health of VA** (CVS Caremark; the aetnabetterhealth.com WAF still 403s plain fetches —
  DMAS-hosted mirrors used where needed).
- **Anthem BCBS VA Commercial** (CarelonRx, 2026 drug list), **Sentara Commercial / employer group**
  (Standard Formulary Large Group, July–Sept 2026, via the sitecorecontenthub PDF the drug-lists
  page links), **Wellcare Value Script PDP** (2026 comprehensive formulary, HPMS ID 26195, updated
  07/01/2026, via `fm.formularynavigator.com/FBO/67/`; Part D $35/month insulin cap noted from the
  plan's own tier legend).

Notable coverage quirks worth remembering when re-verifying: no VA payer covers a GLP-1 without PA;
the state PDL prefers *brand* Lantus/Jardiance/Farxiga over generics/biosimilars; Sentara Commercial
covers no aspart-family insulin at all (lispro only), while Wellcare covers no lispro-family (aspart
only); Wellcare puts GLP-1s on its $11 Select Care tier (Tier 6) with PA.

## Verification protocol (per cell, before flipping to `verified`)

1. Open the payer's current formulary for the drug class.
2. Confirm the preferred agent, BOGL/brand-required flag, the reject list + reasons, and step text.
3. Set `sourceIds`, `verification: "verified"`, `verificationNote`, and `lastReviewed`.
4. A 200 + a real PDF is **not** proof — confirm the document's effective date and that the drug-
   class section actually backs the claim. Formularies change quarterly; treat >90 days as stale.
