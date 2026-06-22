# Iteration 2 — UAT, real sourced data, de-AI'd design

Driven by three asks: (1) UAT as a confused patient + an expert doctor, then implement fixes;
(2) the design still reads as AI-generated — research and fix; (3) every data point (drug classes,
biosimilars/generics, payer preferred/PA/step rules) must trace to a reputable source (gov, insurer,
PBM, formulary), with citation links shown throughout the UI.

## UAT findings → improvements

**Confused-patient persona** (lands here without context):
- Jargon wall: SABA/ICS/LABA/LAMA, BOGL, PA, step therapy, "2 puffs Q4-6H PRN" are unreadable.
  → Plain-language layer: glossary tooltips on every acronym; plain-English class names alongside
    the clinical ones ("rescue", "daily controller"); a plain-English reading of the sig.
- "Who is this for / what do I do?" unclear. → A short audience line + a "for patients" framing note.
- Doesn't recognize "payer/network" framing. → label as "Insurance plan", keep payer term secondary.

**Expert-doctor persona** (needs speed + trust):
- Won't trust uncited claims. → Citations on every cell (this is also ask #3). Effective/review dates.
- Speed: wants to search by drug ("is Symbicort covered?"). → Omni-search box (DESIGN §1).
- Wants the actual PA criteria / step rule and a link to the payer's PA form, not just a label.
- Sig must be editable (dose varies). → Show the sig as a starting point; note it's a default.
- Sample-data banner is a dealbreaker. → Replace with sourced data + explicit verification state.

## Design (de-AI)
- Run a design-direction workflow (web research on the AI-look tells + 3 anchored directions, synth).
- Commit to one decided identity beyond the current scaffold; update docs/design.md + index.css.

## Data + citations
- Research workflow pulls reputable sources per payer + clinical class defs + generic/biosimilar
  status + biologics. Each record gets `sourceIds`; a global `references` list holds the citations.
- Honesty: where a payer-specific preferred/PA value can't be confirmed from the fetched document,
  mark `verification: "example"` and still show the source link — never present unverified as fact
  (CLAUDE.md data-integrity rules).

## Verify
Typecheck, tests (extend for citations + search + glossary), build, screenshots (desktop + mobile),
re-run the adversarial review.
