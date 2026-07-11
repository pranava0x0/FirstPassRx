# Source audit — 2026-07-11 formulary verification (VA / IL / NY)

Provenance for every source fetched during the 2026-07-11 correctness/citations pass
(commits `dea277b`, `75547cb`, `816da42`, `7d289b8`). Raw bytes for **cited** sources live in
`sources/` with metadata in `sources/manifest.json`; **investigation-only** sources (used to reach a
finding but not cited in `formulary.json`) are recorded here with their extractions in
`docs/audits/2026-07-11/`.

## Sources fetched

| Source | URL | Fetched | HTTP | Type | Bytes | sha256 (16) | Persisted as |
|---|---|---|---|---|---|---|---|
| Aetna Better Health of VA formulary (FBO/111) | `https://fm.formularynavigator.com/FBO/111/Aetna_Better_Health_of_Virginia.json` | 2026-07-11 | 200 | application/json | 27,119,852 | `cbe9e8e0417c89ba` | **cited** — `sources/manifest.json` (`aetna-better-health-va-pdl-2026`); blob gitignored (27 MB); rows in `2026-07-11/aetna-va-fbo111-extraction.txt` |
| CountyCare Q1-2026 formulary | `https://countycare.com/wp-content/uploads/FormularyDocument_Q1_2026_Final_2.26.2026.pdf` | 2026-07-11 | 200 | application/pdf | 864,675 | `afe9807943db7be6` | **cited** — already in `sources/countycare-inhalers-source-2026-07-07.pdf` + manifest |
| Excellus Medicare 5-Tier formulary (FBO/251) | `https://fm.formularynavigator.com/FBO/251/Excellus_Medicare_5T_DP_even.pdf` | 2026-07-11 | 200 | application/pdf | 3,196,070 | `b6b5166277cf467d` | **cited** — already in `sources/ny-excellus-medicare-inhalers-source-2026-07.pdf` + manifest |
| NYRx List of Reimbursable Drugs | `https://docs.emedny.org/ReimbursableDrugs/MedReimbDrugsFormulary.csv?07112026` | 2026-07-11 | 200 | text/csv | 4,970,337 | `7e43fd3be3330e10` | **investigation** — metadata + extraction in `2026-07-11/nyrx-menopause-pa-extraction.txt` (5 MB raw not committed; re-fetchable by URL+sha) |
| eMedNY formulary file layout spec | `https://www.emedny.org/info/FormularyFileInfo.pdf` | 2026-07-11 | 200 | application/pdf | 138,878 | `ccc4dc7e5ae7b0f8` | **investigation** — `2026-07-11/emedny-FormularyFileInfo.pdf` |

## What each source verified

- **Aetna FBO/111 JSON** — authoritative payer-branded source for the 15 VA cell fixes: 9 Aetna cells
  `partial`→`verified`, and the two BOGLs (Symbicort `icslaba`, Spiriva `lama`) whose generics it labels
  "State PDL Non-Preferred", propagated to `va-medicaid-ffs` / `anthem-healthkeepers-plus` /
  `sentara-community`. Also confirms generic estradiol vaginal is Preferred (anthem `vaginal` fix). Full
  drug-tier rows: [`aetna-va-fbo111-extraction.txt`](2026-07-11/aetna-va-fbo111-extraction.txt).
- **CountyCare PDF** — Advair Diskus/HFA Preferred, generic fluticasone-salmeterol (Wixela) absent →
  `il-inhalers` countycare `icslaba` BOGL.
- **Excellus Medicare PDF** — Symbicort Tier 3/QL, generic budesonide-formoterol (Breyna) absent →
  `ny-inhalers` ny-excellus-medicare `icslaba` BOGL.
- **NYRx CSV** — all 5 menopause-HT families covered; vaginal + combo uniformly `PA=0`, patch/oral/
  progesterone mostly `PA=G`. Extraction: [`nyrx-menopause-pa-extraction.txt`](2026-07-11/nyrx-menopause-pa-extraction.txt).
- **eMedNY layout spec** — COBOL copybook; does **not** define the CSV's single-letter `PA`/`PREFERRED
  DRUG CODE` values, which is why the `PA=G` menopause cells stay `example` (see `issues.md`).

## Re-audit

Every source is re-fetchable from the URL above with a browser User-Agent (per CLAUDE.md, these hosts
403 a plain fetch/WebFetch but return cleanly to `curl`/browser-UA). Verify the byte identity against
the recorded sha256; a changed hash means the source drifted and the derived cells need re-checking.
