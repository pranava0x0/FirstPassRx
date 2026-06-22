# Data sources

Every cell in `src/data/formulary.json` carries a `sourceIds` list resolving to `meta.references`,
plus a `verification` state. The UI shows the citations and the state on each result.

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

## Verification protocol (per cell, before flipping to `verified`)

1. Open the payer's current formulary for the drug class.
2. Confirm the preferred agent, BOGL/brand-required flag, the reject list + reasons, and step text.
3. Set `sourceIds`, `verification: "verified"`, `verificationNote`, and `lastReviewed`.
4. A 200 + a real PDF is **not** proof — confirm the document's effective date and that the drug-
   class section actually backs the claim. Formularies change quarterly; treat >90 days as stale.
