# docs/design.md — FirstPassRx visual identity: "Monograph"

Extends the base [../DESIGN.md](../DESIGN.md). Project rules win on conflict. (Lives in `docs/`
because macOS's case-insensitive filesystem would treat a top-level `design.md` as `DESIGN.md`.)

## Identity (one line)

**Monograph** — FirstPassRx as a dated drug-compendium page (FDA Highlights-over-Full-PI), borrowing
its document-of-record *values* from a Massachusetts pharmacopoeia insert and ProPublica's
source-trail discipline. The answer is set like an editorial verdict; one rationed apothecary-green
means "the covered path."

## The decisions

- **Palette — warm paper + ink + three graven status tones, one accent.** No pure white, no pure
  black, zero violet/indigo.
  - `--paper #FBFAF7` canvas · `--paper-shade #F3F1E9` recessed · `--ink #1A1A17` · `--ink-muted #5F5E5A`.
  - `--accent #0A6E5C` (apothecary green) is THE accent, rationed to one meaning: the preferred /
    covered path (brand mark, preferred dot, GO stamp, links, the sig-edit focus). One accent object
    dominates per result.
  - Status pairs color WITH a glyph AND a word so it survives grayscale/color-blindness:
    `--accent` GO · `--status-warn #8A4B00` ⚠ BOGL · `--status-deny #8E1F1A` ✕ reject.
- **Type — three system-font lanes mapped to meaning** (no web fonts):
  - **serif** (New York/Iowan/Palatino/Georgia) — the ONE verdict: the drug-name headline + wordmark.
  - **sans** — every sentence a human reads (plain language, instructions, UI). Weights 400/500 only.
  - **mono** (SF Mono) — every machine value you transcribe: dose, sig, status stamps, dates, the
  numbered citations. Mono = "a literal policy value copied verbatim."
- **Layout — a stacked document, not cards.** Square corners, hairline `--rule` dividers and a 3px
  ink masthead rule carry all structure; zero shadows/gradients/glassmorphism. Fixed
  order: masthead → exact product + class → coverage result → options → barriers → policy detail →
  source byline.
- **Motion** — one orchestrated page-load (staggered rise of the result sections), nothing else;
  fully disabled under `prefers-reduced-motion`.

## Signature moves

1. **Outlined mono status stamps** ("GO · PREFERRED", "⚠ BOGL · BRAND REQ", "VERIFIED DATA") that
   read like a regulatory rubber-stamp.
2. **The barrier ledger** — PA, step-therapy, and non-formulary outcomes only. Higher tiers stay in
   the covered-options table.
3. **A numbered source byline closes every result** — the trust mechanism is provenance, not polish.
4. **Glossary affordance** — clinical terms wear a dotted-green underline; tap for a plain-language
   definition. Serves the confused patient without cluttering the expert's scan.

## What this deliberately is not

Not a centered hero, not the violet-gradient / emoji-card / rounded-2xl default, no web fonts, no
icon or animation library. The off-white print temperature, the serif-vs-mono distance, and the
dated source trail are the "authored by a human" tells (DESIGN §1.1).

## Accessibility commitments

Skip link · landmarks · fieldset+legend per control group · class tablist with roving tabindex +
arrow keys · result is the `tabpanel` with `aria-live="polite"` · glossary popover wired with
`aria-describedby`/`aria-expanded` and Esc-dismiss · search status in an `aria-live` region · lossy
barrier rows carry "Coverage barrier:" in SR text · ≥44px targets · 16px inputs (no iOS zoom) · all
text/bg pairs ≥4.5:1 (contrast ratios recorded in the palette comments).
