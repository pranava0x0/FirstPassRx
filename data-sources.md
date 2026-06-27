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

Classes: `est-td` (transdermal estradiol), `progestogen`, `vaginal` (local vaginal estrogen);
`combo` (estrogen–progestogen) ships disabled. Real plan PDFs were downloaded and read.

| Payer | Source | Status |
| --- | --- | --- |
| Maryland Medicaid (FFS) | MD Medicaid PDL, eff. 1/1/2026 (upd. 3/26/2026) + DAW6 brand-preferred list | partial (class is unmanaged on the PDL) |
| CareFirst BCBS (CVS Caremark) | 2026 Exchange/Individual & Small Group Formulary, upd. 6/1/2026 | verified |
| Kaiser Permanente Mid-Atlantic | 2026 Marketplace Formulary, upd. 4/7/2026 (HMO formulary corroborates) | verified |

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
- Guideline backing for the class definitions/dosing: ACOG menopause HT FAQ and The Menopause Society
  (NAMS) 2022 position statement.

No payer document was login-walled. The MD Medicaid PDL/DAW6/QL PDFs, the CareFirst Exchange
formulary PDF, and the KP MAS Marketplace + HMO formulary PDFs were all fetched and read.

## Verification protocol (per cell, before flipping to `verified`)

1. Open the payer's current formulary for the drug class.
2. Confirm the preferred agent, BOGL/brand-required flag, the reject list + reasons, and step text.
3. Set `sourceIds`, `verification: "verified"`, `verificationNote`, and `lastReviewed`.
4. A 200 + a real PDF is **not** proof — confirm the document's effective date and that the drug-
   class section actually backs the claim. Formularies change quarterly; treat >90 days as stale.
