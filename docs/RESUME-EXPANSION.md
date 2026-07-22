# RESUME-EXPANSION.md — resumable playbook for the SSRI/osteoporosis + PA/AL/CA expansion

> Durable, self-contained state so a fresh session (scheduled run or a rate-limit restart) can pick
> up **gracefully** without this conversation. Update the "Progress ledger" at the bottom after
> every chunk so the next run knows exactly where to continue. Created 2026-07-09.

## The ask (user, 2026-07-09)

Two things, in this order of preference the user set:

1. **DONE — cash prices for existing guides.** Every diabetes/NSAID (and straggler) preferred-agent
   cell now has a captured GoodRx/Cost Plus price. Shipped in `src/lib/cash.ts`
   (`KNOWN_UNPRICED_GAP` 1088 → 575; the 575 is purely the alternatives long tail). Not part of the
   remaining expansion.
2. **REMAINING — data expansion.** Add **SSRIs** and **osteoporosis** topics for every state, and
   add **Pennsylvania, Alabama, California** as new states. User chose **"one guide as proof
   first"**: gather a single guide end-to-end, get it reviewed, THEN scale to the rest.

Full literal scope: 2 new topics × 5 existing states (MA/MD/NY/VA/IL) = 10 guides + 3 new states ×
7 topics = 21 guides ≈ **31 new 8-payer gathers**. This is multi-session by design.

## Hard constraints (do not violate)

- **≤2 concurrent agents, ever.** Never fan out wider without asking the user first (standing rule,
  see CLAUDE.md + memory). Enforce it *inside* any Workflow by chunking the item list into pairs and
  `await parallel(chunk)` per chunk — do NOT trust the workflow's own concurrency cap.
- **Commit in small chunks.** One commit per coherent unit (a taxonomy, a roster, one guide merge,
  one docs update). Never let uncommitted work pile up — a rate-limit interruption must never lose
  more than the current chunk.
- **Checkpoint every gathered source to disk before returning** (the `formulary-data` /
  `formulary-gather` skills already do this to `data-gathering/<stamp>/`). If a run dies mid-gather,
  the next run recovers finished payers from those JSON files instead of re-fetching. NOTE: these
  checkpoints are gitignored and only live in the current worktree — they do NOT survive across
  sessions/worktrees (CLAUDE.md scar tissue). So: merge a state's checkpoints into `formulary.json`
  the same session they're gathered, or treat them as needing re-gather next time.
- **`validate()` count-floor: a guide can't be committed with partial payer coverage.** Every payer
  must cover every non-`comingSoon` class. Gather a state's FULL grid in scratch first; only write
  the guide into `formulary.json` once every payer × class cell is present. If a gather comes up
  short, leave `formulary.json` untouched and report the gap.
- **Cash prices need a real browser (GoodRx/Cost Plus bot-block plain fetch).** A cloud/scheduled
  run without the Chrome extension CANNOT capture new prices. For any new guide gathered without the
  browser: ship it with the cash-link rules that already match its drugs (SSRIs and oral
  bisphosphonates are common generics — several may already resolve), and log the price gaps to
  `backlog.md` for a later browser session, exactly like the diabetes/NSAID gap was handled. Do not
  block the merge on prices.

## Order of work (resume here)

### Step 1 — Class taxonomies (cheap, do first, commit each)
Neither topic exists yet. Author the class taxonomy once, reuse across all states (see how
`.claude/workflows/formulary-gather.js` reuses `ma-inhalers`/`va-diabetes`/etc.). Reference the
single-class shape of `ny-ace`/`ny-nsaids` and the multi-class shape of `va-diabetes`.

- **SSRIs** — likely one `ssri-oral` class (fluoxetine, sertraline, citalopram, escitalopram,
  paroxetine, fluvoxamine). Mirror `nsaid-oral`/`ace-inhibitor`.
- **Osteoporosis** — 3–5 classes: oral bisphosphonate (alendronate, risedronate, ibandronate),
  IV/injectable bisphosphonate (zoledronic acid), RANKL mAb (denosumab/Prolia), anabolics
  (teriparatide, romosozumab), SERM (raloxifene).

### Step 2 — New-state payer rosters (live discovery, never from memory)
None of PA/AL/CA are in `src/data/state-index.json`. For each: `WebSearch` "<state> Medicaid managed
care organizations 2026" + confirm the PDL identity via a live fetch before scaffolding (CLAUDE.md
MCO-churn scar tissue). CA note: **Medi-Cal Rx** carves pharmacy out to a single statewide FFS PDL
(Magellan) — likely NYRx-style consolidation, so most Medi-Cal MCOs share one PDL; confirm before
listing MCOs separately. Grep `state-index.json` first — MA/MD/NY/VA/IL/DC metadata is already there.

### Step 3 — ONE proof guide, end-to-end (user's explicit gate)
Gather a single guide (recommend **SSRIs in one existing state** — reuses an existing payer roster,
so no new-state discovery risk). Run it through `formulary-gather.js`
(`Workflow({scriptPath, args:{stamp, state, today, payerTasks}})`, one agent per payer covering all
classes off one fetch, chunked ≤2). Merge into `formulary.json` only when the full grid is back
(see `merge_state()` shape in CLAUDE.md). Then run `npm run data:split`, `npm test`,
`npm run trace`, `npm run validate-coverage`, `npm run archive-sources`. **STOP and report to the
user for review before scaling to the other 30 guides.**

### Step 4 — Scale (only after user approves the proof guide)
Remaining guides, one (state × all-topics) gather at a time (not one per topic — `docs/agent-runs.md`
lever #7). Commit + `data:split` + `archive-sources` after each state merges. Update the Progress
ledger below after every chunk.

## Useful commands
```
npm run validate-coverage   # national grid + payer-roster cross-check — run before scoping a batch
npm test                    # count-floor + schema + cash gaps; pretest runs data:split --check
npm run trace               # provenance: every line item resolves to a cited source
npm run data:split          # regenerate generated/ chunks after editing formulary.json (commit them)
npm run archive-sources     # snapshot cited sources + manifest — run right after every merge
```

## Decided taxonomies (Step 1, 2026-07-18)

Not standalone JSON — schema only allows `classes` inside a guide, so these are wording/shape
decisions to reuse verbatim when authoring each guide's `classes` array (mirrors `nsaid-oral`/
`ace-inhibitor`'s single-class shape and `va-diabetes`'s multi-class shape).

- **SSRIs — one class, `ssri-oral`.** Covers fluoxetine, sertraline, citalopram, escitalopram,
  paroxetine, fluvoxamine.
  - name: "Oral SSRIs" · shortName: "SSRI" · plainName: "Antidepressant (SSRI)"
  - description: "Selective serotonin reuptake inhibitors (fluoxetine, sertraline, citalopram,
    escitalopram, paroxetine, fluvoxamine) — first-line oral therapy for major depressive disorder
    and anxiety disorders."
  - plainDescription: "A daily pill for depression or anxiety that works by increasing serotonin
    levels."
  - indication: "Major depressive disorder & anxiety disorders"
  - topicId: `ssris`, topic: "SSRIs", classNoun: "Prescription type", unitNoun: "medication"
    (mirrors `ace-inhibitors`/`nsaids` topic shape)

- **Osteoporosis — five classes** (mirrors `va-diabetes`'s multi-class shape):
  1. `oral-bisphosphonate` — alendronate, risedronate, ibandronate. "Oral bisphosphonates" /
     "Bone-strengthening pill" / first-line oral therapy for osteoporosis.
  2. `iv-bisphosphonate` — zoledronic acid (Reclast). "IV bisphosphonate" / "Once-yearly bone
     infusion" / for patients who can't tolerate oral bisphosphonates or need stronger therapy.
  3. `rankl-inhibitor` — denosumab (Prolia). "RANKL inhibitor" / "Twice-yearly bone injection" /
     alternative to bisphosphonates, especially with renal impairment.
  4. `anabolic` — teriparatide, abaloparatide, romosozumab. "Anabolic bone-building agent" /
     "Daily/monthly bone-building injection" / severe osteoporosis or bisphosphonate failure.
  5. `serm` — raloxifene. "SERM" / "Bone + breast-cancer-risk pill" / postmenopausal women who
     can't use estrogen or bisphosphonates.
  - topicId: `osteoporosis`, topic: "Osteoporosis", classNoun: "Prescription type", unitNoun:
    "medication"

## Progress ledger (update after every chunk)
- 2026-07-09 — Cash-price gap for existing diabetes/NSAID/straggler guides CLOSED (`cash.ts`,
  `KNOWN_UNPRICED_GAP` 1088→575). Backlog scoped. Expansion NOT started.
- 2026-07-18 (scheduled run) — Step 1 taxonomies decided (SSRI single-class, osteoporosis
  5-class), recorded above. **Step 3 proof guide SHIPPED: `ny-ssris`.** Gathered via
  `formulary-gather.js` (5 payers, chunked ≤2 concurrent, ~459K subagent tokens, 0 errors),
  merged into `formulary.json`, all checks green (`npm test`, `typecheck`, `trace`,
  `validate-coverage`, `archive-sources`), verified live in the browser (NY → SSRIs renders
  Sertraline as preferred with correct alternatives/PA/excluded items). One data-quality fix
  applied during merge: 6 of NY Medicaid's `paRequired` reasons used "non-preferred" language that
  tripped the schema's cost-sharing-vs-barrier heuristic — reworded (not reclassified; NYRx's PDL
  is a binary Preferred/Non-Preferred format where non-preferred genuinely triggers PA, per the
  established convention documented in CLAUDE.md). Cash prices NOT captured — GoodRx bot-blocked
  this headless run (confirmed live), so `KNOWN_UNPRICED_GAP` bumped 0→33 and the gap logged to
  `backlog.md` for a future interactive session. Committed in 4 chunks (taxonomy decision, guide
  merge, cash-gap bump, source archive) — pushed to `main`.
  **STOPPING HERE per the user's explicit gate — do not scale to the remaining ~30 guides without
  the user reviewing this proof guide and approving.** Next session: if approved, proceed to Step 2
  (PA/AL/CA payer-roster discovery) and Step 4 (scale remaining state×topic combinations, one
  state-all-topics gather at a time).
- 2026-07-19 (scheduled run) — **Gate still active, correctly did not scale.** Confirmed working
  tree clean, `main` up to date with `origin/main`, `ny-ssris` proof guide unchanged since the last
  run — no user approval had landed (non-interactive run, nothing to approve against). Re-ran
  `npm run validate-coverage` to confirm current state (26/306 state×topic cells, 46 states with
  zero guides — matches the known, already-scoped gap, nothing new broken). Per the task's fallback
  instruction, spent the run on research instead of scaling: web-searched for additional
  therapeutic-area candidates beyond SSRIs/osteoporosis (GLP-1 weight-loss as a distinct indication
  from the existing diabetes `glp1` class, ADHD stimulants, DOAC anticoagulants) and logged existing
  `partial`/`example` cell gaps across shipped guides — both recorded in `backlog.md` (Medium) as
  scoping ideas, not started. No data gathered, no agents/Workflows spawned, no branches created.
  **Still stopped here pending the user's review of `ny-ssris`.** Next session: if approved, proceed
  to Step 2 (PA/AL/CA payer-roster discovery) and Step 4 (scale remaining state×topic combinations).
- 2026-07-20 (scheduled run) — **Gate still active, correctly did not scale.** Confirmed working
  tree clean, `main` up to date with `origin/main`, `npm run validate-coverage` still 26/306 (no
  drift since 2026-07-19) — no user approval had landed (non-interactive run, nothing to approve
  against). Per the fallback instruction, spent the run on two research threads instead of scaling:
  (1) chased the `ny-menopause` eMedNY PA-code block from `issues.md` — fetched both documents the
  prior note pointed at with a dedicated PDF-reading tool (not just WebFetch text extraction) to
  rule out a "looks dead but isn't" false negative; confirmed the block is real (neither document
  defines the flattened CSV's `G` code), but surfaced the live NYRx call center contact info
  (1-833-967-7310) as a concrete next unblock step for an interactive session — logged to
  `issues.md`; (2) added one new candidate topic to `backlog.md` not already logged on 2026-07-19:
  CGRP migraine inhibitors, backed by both an AJMC MCO-survey stat (96% require trial-and-failure)
  and this project's own freshly-fetched NYRx PDL (which flags the CGRP class with F/Q/D and ST
  criteria the plain triptans don't carry). No data gathered, no agents/Workflows spawned, no
  branches created — this run's changes are `issues.md` + `backlog.md` + this ledger entry only.
  **Still stopped here pending the user's review of `ny-ssris`.** Next session: if approved, proceed
  to Step 2 (PA/AL/CA payer-roster discovery) and Step 4 (scale remaining state×topic combinations).
- 2026-07-21 — **Gate cleared by explicit user instruction ("do the SSRI expansion work").**
  Scaled SSRIs to the 4 remaining existing states — `ma-ssris` (5 payers), `md-ssris` (8),
  `va-ssris` (8), `il-ssris` (8) — reusing each state's existing payer roster from its ACE
  guide. Gathered via `formulary-gather.js`, one state at a time, chunked ≤2 concurrent (one
  `masshealth` agent failure — an OAuth token revocation, not a data issue — recovered with a
  single retry agent). Every payer verified/partial off its own formulary; several binary-PDL
  Medicaid payers per state needed the established "non-preferred wording ≠ cost-tier" reword
  (caught by a pre-merge regex check for VA/IL, by the failing schema test for MA/MD) before the
  guide would validate. `KNOWN_UNPRICED_GAP` bumped incrementally 33→60→102→137→194 (one bump per
  state's commit); no new cash-link rules added (deferred to backlog.md — same 6 molecules recur
  in every state, worth one consolidated regex pass). Updated `src/lib/formulary.test.ts`'s
  hardcoded guide-id list after each merge (the concrete "validation script" that needed updating
  for new guides). All of `npm test`/`typecheck`/`trace`/`validate-coverage`/`archive-sources`
  green after each state; verified live in the browser (VA → SSRIs renders Zoloft/sertraline
  correctly with alternatives and the one PA-required cell). National grid moved 26/306 → 30/306.
  Also cleaned up 8 stale local/remote branches this session — investigated each one (dates,
  diffstat, and targeted content checks like `KNOWN_UNPRICED_GAP` values and `boglActive` states)
  and confirmed every one was a strictly-earlier, already-superseded snapshot of work that had
  since been redone directly on `main` (squash-merged PRs #6/#11 the branches didn't know about,
  plus independent re-fixes of the same BOGL/cash bugs) — none had unique content, so none were
  cherry-picked; all deleted outright rather than merged. **Next session (SSRIs now shipped
  everywhere): proceed to osteoporosis for all 5 states, then Step 2 (PA/AL/CA payer-roster
  discovery).**
- 2026-07-21 (later same day, scheduled run continued interactively) — **Osteoporosis scaled to
  4 of 5 existing states: `ny-osteoporosis` (5 payers), `ma-osteoporosis` (5), `md-osteoporosis`
  (8), `va-osteoporosis` (8).** Gathered one state at a time via `formulary-gather.js`, chunked
  ≤2 concurrent (one MA invocation failed instantly on a session-limit reset that had already
  passed — immediate retry with identical args succeeded). Every payer verified/partial off its
  own formulary; ~63 total `paRequired` reasons across the 4 states needed the established
  reword-not-reclassify fix (binary/tiered PDL wording tripping the cost-tier-vs-barrier
  heuristic) — all confirmed genuine PA/step barriers, none were cost-tier-only. `KNOWN_UNPRICED_GAP`
  bumped 194→227→257→292→327 (one bump per state's commit). Fixed a real merge-script bug found
  during MA's merge (payer `formularyUrl`/`formularyId` blindly copied from the SSRI guide can go
  stale when a payer splits its formulary by topic-specific table, e.g. MassHealth's MHDL) — the
  merge script now syncs `formularyUrl` to whatever the checkpoint's own `primarySource.url` says,
  which auto-fixed 4 more stale landing-page URLs during MD/VA merges with zero manual patching.
  All of `npm test`/`typecheck`/`trace`/`validate-coverage`/`archive-sources` green after each
  state; NY and MD verified live in the browser. National grid moved 30/306 → 34/357 (the
  denominator grew because osteoporosis added a 7th topic column). Also fixed an unrelated CSS bug
  (`.recommendation-hero` was double-applying section-spacing on top of the shared `.doc > *`
  divider convention, the only section in the document doing so) — see `src/index.css`.
  **`il-osteoporosis` (8 payers) deliberately NOT started — user explicitly said stop spinning up
  new agents this session.** That is the one remaining gap to complete osteoporosis's 5-state
  footprint (matching SSRIs' full coverage). Next session: gather `il-osteoporosis` reusing
  `il-ssris`'s 8-payer roster (same shape as this session's other 3 multi-payer states), then
  proceed to Step 2 (PA/AL/CA payer-roster discovery) for the new-state expansion.
- 2026-07-22 (scheduled run) — **`il-osteoporosis` shipped, osteoporosis now complete across all
  5 existing states.** Gathered via `formulary-gather.js` (8 payers reusing `il-ssris`'s roster,
  chunked ≤2 concurrent, zero agent failures, ~1.1M tokens, 40 cells: 27 verified, 13 partial —
  IV-bisphosphonate medical-benefit absence again the majority partial cause, same as every prior
  state). 89 `paRequired` reasons across 5 payers needed the reword-not-reclassify fix (binary
  Preferred/Non-Preferred wording); one commercial payer (`bcbs-illinois-commercial`) had already
  correctly modeled its genuine tiered cost-share items as `alternatives`, not `paRequired`. A
  follow-up copy-polish commit fixed 42 reasons reading "Listed restricted on..." (grammatically
  awkward from the mechanical reword) to "Restricted on...". `KNOWN_UNPRICED_GAP` 327→339. All of
  `npm test`/`typecheck`/`trace`/`validate-coverage`/`archive-sources` green; verified live in
  browser (IL → Osteoporosis renders alendronate sodium as preferred with correct PA-required
  list). National grid moved 34/357 → 35/357. Committed in 3 chunks (guide merge, copy polish,
  archived sources).
  **Then started Step 2 (PA/AL/CA payer discovery) — confirmed PDL identities via live search for
  all 3 new states, but did NOT build full payer rosters or gather any drug data:**
  - **PA**: one Statewide PDL (papdl.com) covers FFS + every HealthChoices/CHC MCO, like NY's
    NYRx — not per-MCO formularies. Current version "PA PDL 2026 v10", effective Jan 2026.
  - **AL**: genuinely simpler than any state gathered so far — almost entirely FFS, **no MCO
    contracts for the general adult population** (confirmed, not assumed) — one statewide PDL,
    updated quarterly.
  - **CA**: confirmed as predicted — Medi-Cal Rx is a single statewide FFS carve-out (DHCS), CDL
    effective 2026-07-01 confirmed live. Spot-checked: all 6 SSRI molecules and oral-bisphosphonate
    + SERM classes appear unrestricted in the base CDL (good sign); denosumab/anabolic classes NOT
    confirmed in this pass (may be medical-benefit, needs checking before a CA osteoporosis guide).
  - **Confirming the CA CDL cost far more context than intended** — `WebFetch` returned the entire
    242-page PDF inline instead of a summary (new CLAUDE.md scar-tissue entry added on this).
    Stopped Step 2 research here rather than compound the cost with PA/AL payer-roster building.
  **Next session: build full payer-roster entries in `state-index.json` for PA/AL/CA (with live
  per-payer formulary URL verification), confirm CA's denosumab/anabolic coverage mechanism, then
  proceed to Step 3/4 (gather + merge) for the new states** — no guide data has been gathered for
  any of the 3 new states yet, this remains a substantial next-session task.
