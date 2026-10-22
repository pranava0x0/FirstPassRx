# Deterministic cell audit

Goal: re-check every record against its cited source with code, so an LLM agent only reads the
checks the tools flag, with the raw source row in hand.

```
extract (source_rows.py)  ->  audit (audit-cells.mjs)  ->  agent reviews ONLY flagged checks
        ^                                                          |
        |                      re-audit  <-  apply fixes via scripts (merge-gather / apply-*.mjs)
```

## Commands

```bash
# 1. Extract rows for one or more sources (URL or local path). Cached by sha256.
python3 scripts/source_rows.py "<url>" ["<url>" ...] [--out-dir data-gathering/rows] [--refresh] [-v]

# 2. Audit a state (extracts any missing source rows itself; --no-extract to forbid that).
node scripts/audit-cells.mjs --state=MA [--guides=ma-lipids,ma-ace] [--out=data-gathering/audit-ma-YYYY-MM-DD] [--strict]

# 3. Read data-gathering/audit-ma-*/summary.md, then open report.json for the flagged checks:
node -e 'const r=require("./data-gathering/audit-ma-2026-10-22/report.json");
  for (const c of r.cells) for (const k of c.checks) if (k.status==="FLAG_MISMATCH")
    console.log(c.guide,c.payer,c.class,k.kind,k.drug,"|",k.reason,"|",k.matched[0]?.raw)'
```

`data-gathering/` is gitignored (rows, raw bytes, audit output). Re-runs reuse cached bytes; the rows
JSON is re-derived whenever `source_rows.py` itself changes (signature = hash of the script) or with
`--refresh`. Exit code is 0 unless `--strict` and a `FLAG_MISMATCH` exists.

## What the extractor emits

`data-gathering/rows/<sha256>.json` = `{url, sha256, fetched_at, layout, stats, rows[]}`;
`index.json` = `{url: {sha256, fetched_at, rows, layout}}`.

| layout | documents | row fields | row boundaries |
|---|---|---|---|
| `optum` | Tufts Value Direct, Harvard Pilgrim Select (OptumRx PDFs) | page, drug, tier, flags, notes, section, raw | horizontal rules / rectangle edges |
| `mgb` | MGB Health Plan (FormularyNavigator PDF) | page, drug, reference (brand), tier (`1`-`6`, `MC`, `$0`), flags, notes, raw | shaded rectangles per row |
| `bcbs` | BCBS MA Comprehensive Covered Medication List | page, drug, tier, flags, notes, section, label (generic/brand), raw | a "Generic drug"/"Brand drug" label starts each row |
| `mhdl` | MassHealth `pubtheradetail.do?id=N` and `pubdruglist.do` | table, drug, brand, class, pa (full status text), flags, notes, raw | `<tr>` |

Flags are the uppercase codes found in the notes (`PA ST QL SP AL OTC HCD MC ...`). `raw` is the row's
text exactly as extracted; every audit verdict quotes it.

Why the PDF paths use pypdf's layout runs: the plain text visitor glues `drug  tier  notes` on one
baseline into a single string (a tier digit then looks like part of the drug or the notes). The
extractor takes per-run text from `pypdf._text_extraction._layout_mode.text_show_operations` (private
API, pinned to pypdf 6.x) which keeps column gaps as runs of 3+ spaces. Row membership comes from
rules/rectangles because side cells are vertically centred against multi-line drug cells.

The MHDL parser is `html.parser` with entity decoding. A bare `<` before a space or digit is plain
text there, so `PA - < 10 years and PA > 3 units/day` survives intact (a regex parser once turned it
into `PA`). Commented-out markup is ignored.

## What the audit checks

For each record: the preferred agent (`coverageSourceIds` + `restrictionSourceIds`), each `paRequired`
item and each `alternatives` item (own `sourceIds`, falling back to the record's). Source URLs resolve
through the guide's `references`. A drug string is split into targets (and/or/`;`/`,`), salts, forms and
strengths are stripped, ER/XR/XL/CR/SR/LA fold to one modifier, and rows match by exact name+modifier
first, then same-name-different-form, then partial. Parenthetical names are fallback aliases only (so
`(generic Crestor)` never swaps a generic claim for the brand row). Strength numbers narrow
multi-row matches. Brand and generic names on a row both count.

| status | meaning |
|---|---|
| OK | claim consistent with every matched row |
| NOT_FOUND | no row matches the name (for a `nonformulary`/`noCoveredAgent` claim, absence is OK) |
| FLAG_MISMATCH | no-PA claim but the row has PA; PA/step claim but the row shows neither; nonformulary claim but the row exists; no-step claim but the row has ST; tier differs |
| AGE_QUALIFIED | row PA or age limit (AL) is age-bound and the record text never mentions age |
| AMBIGUOUS | matched rows disagree, only a low-confidence (partial/form) name match, or a quantity/other condition on the PA |
| SKIPPED | no extractable rows for the cited sources, or non-specific drug text ("all other statins") |

Low-confidence name matches can never produce FLAG_MISMATCH (they degrade to AMBIGUOUS).

## Agent review step

Open only checks that are not OK/SKIPPED. For each, the report carries `matched[].raw` (the source row),
`page`/`table` and the source URL. The agent decides: tool false positive (note why), record wrong (fix
via the merge/apply scripts, never hand-edit `formulary.json`), or source unreadable (log in `issues.md`).
Then re-run the audit; the check should flip to OK. Track the false-positive rate per payer in the
summary you hand back.

## Adding a document layout

1. Run `python3 scripts/source_rows.py <url> -v`; if `layout` is `none`, no header was recognised.
2. Dump a table page's runs (`ps = scan_page(page)`; print `ps.groups`, `ps.seps`, `ps.spans`) and find:
   the header words, whether rows are bounded by rules/rectangles (`ps.seps`) or start with a label.
3. Add header detection to `detect_layout()` (return `(layout_name, header_y)`).
4. Rule-bounded tables: reuse `groups_by_row` + `parse_row_groups` (set `right_min`, `status_zone`, the
   tier/status regex). Label-started tables: copy `parse_bcbs_page`.
5. Extract flags via `extract_flags`; keep `raw`. Re-run on the document and spot-check 5 known rows by
   hand, plus the tier/None-tier counts (`index.json` + the rows file `stats`).
6. If a name column carries abbreviations the matcher should ignore (`SOSY`, `TBEC`), add them to `NOISE`
   in `audit-cells.mjs`.

## Known limits

- Unsupported sources are SKIPPED, not OK: PA form PDFs, plan policy PDFs, the BCBS formulary guide and
  July-2026 removals list (prose, not tables), the HTML medication look-up, and any URL that 404s.
  `summary.md` lists them with the number of checks they leave unaudited.
- Matching is by name, not NDC. Items like "Nifedipine extended-release and IR tablet" are split on
  `and`; unusual phrasing can parse to the wrong target or none (NOT_FOUND noise).
- A note that mixes PA for one strength and none for another is only caught when strength narrowing finds
  the right row; otherwise AMBIGUOUS.
- Row text reflects the PDF at extraction time; the document can move (see `docs/` notes on rotting PDL
  URLs). The audit does not re-verify that the cited URL is the current edition.
- Conditions on PA (`members N and older`, quantity ceilings) are classified by keyword; read `raw`.
- Tier checks run only when the record's `tier` text contains `Tier N` and the source has a numeric tier.
- Uses pypdf's private layout API; a pypdf upgrade may need `layout_groups()` re-checked.
