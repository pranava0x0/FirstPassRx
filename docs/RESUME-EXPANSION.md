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

- **DOAC anticoagulants — one class, `doac-anticoagulant` (decided 2026-08-21, user picked this
  candidate out of the OB/GYN-contraceptives / ortho-muscle-relaxants / cardiothoracic-DOAC set of
  3 options offered).** Covers apixaban, rivaroxaban, dabigatran, edoxaban; warfarin goes in
  `alternatives[]` as the old-line comparator, not a preferred candidate (DOACs are first-line in
  current guidelines). Mirrors `ace-inhibitor`/`ssri-oral`'s single-class shape.
  - name: "Oral Anticoagulants (DOACs)" · shortName: "DOAC" · plainName: "Blood thinner"
  - description: "Direct oral anticoagulants (apixaban, rivaroxaban, dabigatran, edoxaban) —
    first-line therapy for stroke prevention in atrial fibrillation and treatment/prevention of
    venous thromboembolism, largely supplanting warfarin."
  - plainDescription: "A daily pill that prevents dangerous blood clots and stroke."
  - indication: "Atrial fibrillation & venous thromboembolism (DVT/PE) prevention and treatment"
  - topicId: `doac`, topic: "DOAC Anticoagulants", classNoun: "Prescription type", unitNoun:
    "medication"
  - **Known cash-price trap (from `backlog.md`'s 2026-08-18 Cost Plus check) — do NOT reuse
    naively**: apixaban/Eliquis has no generic yet (brand-only, ~$345/60ct); rivaroxaban's generic
    is stocked on Cost Plus **only at 2.5mg** (antiplatelet dose), not the 15/20mg therapeutic
    anticoagulation strength a preferred-agent cell will actually need — same dose-mismatch class as
    the Reclast/Zometa and Respimat/HandiHaler bugs. Ship without a rivaroxaban cash rule unless the
    2026-08-21+ gather confirms a 15/20mg product specifically.

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
- 2026-07-23 (scheduled run) — **Step 2 (PA/AL/CA payer-roster discovery) completed and merged into
  `state-index.json`.** All 3 states now have live-verified payer rosters (`src/data/state-index.json`,
  now 6 states total: NY/VA/DC/PA/AL/CA), same shape as NY/VA (`plans[]` with name/kind/pbm/
  formularyUrl/formularyLabel/effectiveDate). No guide data gathered this session — this was
  metadata-only discovery, all via inline `WebSearch`/`WebFetch` (no agents/Workflows spawned).
  - **PA (7 payers)**: confirmed via the official June-2026 PA Medicaid Managed Care Directory PDF
    (another confirmed instance of the "WebFetch says corrupted/binary, but the saved local path
    reads fine" pattern — see CLAUDE.md) that Physical HealthChoices + Community HealthChoices (CHC)
    MCOs all ride the one Statewide PDL (papdl.com); rostered 1 FFS PDL + Keystone First + UPMC for
    You + PA Health and Wellness (all MCOs sharing the PDL) + AmeriHealth Caritas CHC + 2 commercial
    payers with independently-sourced formularies (Independence Blue Cross's Select Drug Program PDF,
    Highmark BCBS). Deliberately shipped 7 payers, not a forced 8th — no defensible source found for
    a PA Medicare Part D representative in this pass rather than fabricate one.
  - **AL (3 payers)**: confirms the ledger's "genuinely simpler" read — one FFS PDL administered
    directly by the Alabama Medicaid Agency (no PBM name could be confirmed via search; recorded
    honestly as "no contracted PBM identified" rather than guessed) + BCBS Alabama commercial
    (Prime Therapeutics, dominant ~90%-share carrier, real 2026 4-tier formulary PDF found) + BCBS
    Alabama's Blue Advantage Medicare Part D formulary.
  - **CA (3 payers)**: confirmed Medi-Cal Rx is the single statewide FFS carve-out (DHCS + Magellan
    Health) exactly as predicted, plus Kaiser Permanente (CA's largest integrated commercial HMO) and
    Anthem Blue Cross of California commercial. **Resolved the open item from 2026-07-22**: live
    search of Blue Shield of CA's own Medi-Cal medical/UM-criteria pages confirms denosumab (Prolia +
    biosimilars), romosozumab (Evenity), and teriparatide (Forteo) are ALL covered as Medi-Cal Rx
    PHARMACY-benefit line items (with PA criteria), not carved out to medical-only — so a future
    `ca-osteoporosis` guide can cover all 5 classes, not just oral-bisphosphonate/SERM. Did **not**
    re-fetch the 242-page CDL PDF itself this session (the thing that blew up context on 2026-07-22)
    — used the denosumab/romosozumab/teriparatide-specific search snippets instead, which was
    sufficient to confirm coverage without the cost.
  - `npm test` (390/390), `typecheck`, `validate-coverage` all green — new states integrate cleanly,
    validate-coverage's payer-roster cross-check now covers 6 states.
  - **Did NOT start Step 3 (proof gather for a PA/AL/CA guide)** — payer-roster discovery alone was
    a full session's worth of research given the WebFetch-PDF-dump risk in this domain; scaling to
    an actual data gather is real Workflow/agent work (chunked ≤2 concurrent) that deserves its own
    session, not tacked onto a research pass. **Next session: pick ONE new-state guide to prove
    (recommend AL SSRIs — smallest roster at 3 payers, cheapest to verify end-to-end), gather via
    `formulary-gather.js`, merge, validate, and report before scaling further** — the existing
    "one guide as proof first" gate the user set for SSRIs/osteoporosis in 2026-07-09 should apply
    to each brand-new state the same way it applied to each new topic.
- 2026-07-23 (same day, continued) — **Step 3 proof guide for the new-state expansion SHIPPED:
  `al-ssris`.** Gathered via `formulary-gather.js` (3 payers — Alabama Medicaid PDL, BCBS Alabama
  commercial, BCBS Alabama Blue Advantage Medicare Part D — chunked ≤2 concurrent, 0 agent errors,
  ~307K subagent tokens), merged into `formulary.json`, all checks green (`npm test` 398/398,
  `typecheck`, `trace`, `validate-coverage`, `archive-sources`), verified live in the browser
  (AL → SSRIs renders sertraline as preferred with correct alternatives/PA-required list). One
  data-quality fix during merge: 6 of the Alabama Medicaid PDL's brand-name `paRequired` reasons
  used the phrase "non-preferred-brand rule," which tripped the schema's cost-sharing-vs-barrier
  heuristic even though these are genuine PA barriers (not cost-tier-only) — reworded to
  "brand-restriction rule," same reword-not-reclassify pattern established for the binary-PDL
  Medicaid states. `KNOWN_UNPRICED_GAP` bumped 339→351 (headless run, GoodRx/Cost Plus stayed
  bot-blocked as expected). National grid moved 35/357 → 36/357. One open item logged to
  `issues.md`: `medicaid.alabama.gov` fails the archiver's fetch (SSL/cert issue independently
  flagged by the gather agent too) even though the gather itself read the same PDFs fine via curl
  — non-blocking, provenance-only gap, doesn't affect the shipped guide data.
  **STOPPING HERE per the same "one guide as proof first" gate — do not scale PA/AL/CA to their
  remaining 20 guides (7 topics × 3 states, minus the 1 shipped) without the user reviewing this
  proof guide and approving**, exactly as was done for `ny-ssris` on 2026-07-18. Next session: if
  approved, scale AL's remaining 6 topics (reusing its 3-payer roster, now the cheapest state in
  the dataset to gather), then PA and CA (7 payers and 3 payers respectively, per the rosters
  shipped earlier today).
- 2026-07-24 (scheduled run) — **Gate still active, correctly did not scale.** Confirmed working
  tree clean, `main` up to date with `origin/main`, `npm run validate-coverage` unchanged at
  36/357 since the 2026-07-23 `al-ssris` merge — no drift, no user approval had landed (non-
  interactive run, nothing to approve against). Tried the browser preview tool to see if cash
  prices could be captured for `al-ssris`'s known gap; it errored immediately (safety classifier
  unavailable in this run), confirming the standing "no real browser in a headless/scheduled run"
  constraint still holds — did not attempt cash-price work. Per the fallback instruction, spent the
  run on web research instead of scaling: (1) re-verified the 2026-07-19-logged CA/PA Medicaid
  GLP-1-weight-loss coverage drop is still current (Stateline, 2026-04-30) — no change, logged as a
  confirmation in `backlog.md`; (2) surfaced a new candidate 4th new state, **Texas** — single
  statewide PDL (Vendor Drug Program) that every MCO must follow, same cheap-to-roster shape as
  NY/PA/AL/CA, 2nd-largest Medicaid population nationally — logged to `backlog.md`, not started
  (no `state-index.json` entry, no payer verification, no data). No data gathered, no agents/
  Workflows spawned, no branches created — this run's changes are `backlog.md` +
  this ledger entry only.
  **Still stopped here pending the user's review of `al-ssris`.** Next session: if approved, scale
  AL's remaining 6 topics, then PA and CA, per the plan above.
- 2026-07-25 (scheduled run) — **Gate still active, correctly did not scale.** Confirmed working
  tree clean, `main` up to date with `origin/main`, `npm run validate-coverage` unchanged at
  36/357 since the 2026-07-23 `al-ssris` merge — no drift, no user approval had landed (non-
  interactive run, nothing to approve against). Per the fallback instruction, spent the run on two
  research threads instead of scaling, both logged to `backlog.md`: (1) re-checked the 2026-07-24
  Texas candidate-state note — `txvendordrug.com`'s own news feed confirms the semi-annual Medicaid
  PDL update actually published 2026-07-24 (the day before this check) as scheduled, so a future TX
  gather should cite that fresh July edition rather than the January one originally noted; the
  specific news-page URL 403'd `WebFetch`, not chased further since the PDL identity/cadence was
  already well-confirmed; (2) identified a real, previously-unlogged gap: the existing
  "existing-guide depth gaps" backlog item dated 2026-07-19 predates the osteoporosis expansion and
  was missing its 48 `partial` cells entirely — broke them down by class via a direct read of
  `formulary.json` (iv-bisphosphonate 22/48, rankl-inhibitor 14/48, anabolic 9/48, serm 2/48,
  oral-bisphosphonate 1/48) and logged the rollup, flagging that these likely mirror the existing
  menopause-HT structural medical-benefit carve-outs (already correctly labeled, not closeable)
  rather than being a genuine gather gap — worth confirming before spending a verification pass on
  them. No data gathered, no agents/Workflows spawned, no branches created — this run's changes are
  `backlog.md` + this ledger entry only.
  **Still stopped here pending the user's review of `al-ssris`.** Next session: if approved, scale
  AL's remaining 6 topics, then PA and CA, per the plan above.
- 2026-07-25 (later, interactive session — retroactively logged 2026-07-26, this entry was missed
  in the session that did the work) — **Gate cleared by explicit user instruction; AL scaled to
  its remaining 6 topics, AL now complete across all 7 topics (SSRIs + the original 5 + osteoporosis).**
  Shipped `al-inhalers`, `al-menopause`, `al-ace`, `al-diabetes`, `al-nsaids`, `al-osteoporosis`
  (commits `ca9950a`..`0c212c0`), reusing AL's 3-payer roster. `KNOWN_UNPRICED_GAP` bumped
  351→361. Sources archived (`84d0ed6`, `146ed2d`) with the recurring `medicaid.alabama.gov`
  fetch-failure logged again (known SSL/cert issue, non-blocking). The same session also started
  a **PA all-topics gather** (`data-gathering/pa-all-topics-2026-07-25/`) — 3 of PA's 7 payers
  (pa-medicaid, ibx-commercial, highmark-bcbs) fully gathered across all 21 classes (all 7
  topics) — but the session ended before any of it was merged into `formulary.json`. Those
  checkpoint files survived on disk (this repo is worked in directly, not a cleaned-up worktree)
  and were recovered by the next run below.
- 2026-07-26 (scheduled run) — **Confirmed AL's completion (above) was real but never logged —
  backfilled the ledger entry.** `git log`/`validate-coverage` showed AL fully scaled and pushed
  to `main` (main/`expand/pa-ca-topics`/`origin/main` all at the same commit, nothing to
  integrate). **Shipped `pa-ssris` — Pennsylvania's proof guide, the new-state gate for PA** —
  by recovering the already-gathered checkpoint data in `data-gathering/pa-all-topics-2026-07-25/`
  (pa-medicaid/ibx-commercial/highmark-bcbs `*-ssri-oral.json`) rather than re-fetching: **zero
  new agent calls**. Reworded 17 `paRequired` reasons that used "non-preferred" language (PA
  Medicaid's binary PDL + IBX's tiered formulary) per the established reword-not-reclassify
  pattern — genuine PA barriers, not cost-tier-only. `KNOWN_UNPRICED_GAP` bumped 361→377
  (headless run, GoodRx/Cost Plus stayed bot-blocked). All of `npm test` (454/454), `typecheck`,
  `trace`, `validate-coverage`, `archive-sources` green; verified live in the browser (PA now
  appears in the state picker, SSRIs renders sertraline preferred with correct
  alternatives/PA-required list for all 3 payers). National grid moved 42/357 → 43/357, 6→7
  jurisdictions covered. Committed in 3 chunks (guide merge + test-id list, cash-gap bump, source
  archive).
  **STOPPING HERE per the same "one guide as proof first" gate applied to `ny-ssris` and
  `al-ssris`** — do not scale PA's remaining 20 guides (7 topics − 1 shipped) without the user
  reviewing `pa-ssris` and approving, even though most of the underlying data is already sitting
  gathered and checkpointed. **Head start for next session, if approved:** PA's other 20 classes
  (inhalers ×4, ace ×1, diabetes ×4, menopause ×5, nsaids ×1, osteoporosis ×5 = 20) are **already
  fully gathered and verified for the same 3 payers** in
  `data-gathering/pa-all-topics-2026-07-25/` — merging them costs zero new agent calls, only the
  same reword-and-merge mechanics used for `pa-ssris`. The 4 PA Medicaid MCOs that share the
  Statewide PDL (Keystone First, UPMC for You, PA Health and Wellness, AmeriHealth Caritas CHC)
  were never gathered — same "MCO rides the same statewide PDL as FFS, don't re-fetch identical
  content" judgment call already applied to NY's Healthfirst/Fidelis/MetroPlus (see
  `validate-coverage`'s own roster-cross-check commentary) — PA guides ship with 3 payers, not 7,
  consistent with that precedent. After PA: CA (3-payer roster already in `state-index.json`,
  cheapest state to gather next, no data gathered yet).
- 2026-07-28 (scheduled run) — **Gate still active, correctly did not scale.** Confirmed working
  tree clean, `main` up to date with `origin/main`, `npm run validate-coverage` unchanged at
  43/357 since the 2026-07-26 `pa-ssris` merge — no drift, no user approval had landed (non-
  interactive run, nothing to approve against). The already-gathered `data-gathering/pa-all-
  topics-2026-07-25/` checkpoint (20 classes, 3 payers) survived on disk and remains ready to
  merge for free once approved. Per the fallback instruction, spent the run auditing the existing
  osteoporosis `partial` cells (48 cells logged 2026-07-25) instead of scaling or open-ended
  web research: read every partial cell's `verificationNote` directly from `formulary.json`
  (no agents) and confirmed the overwhelming majority (iv-bisphosphonate, most rankl-inhibitor/
  anabolic) are genuine, already-exhaustively-documented medical-benefit/Part-B carve-outs — not
  extraction failures, not closeable without a fundamentally different sourcing approach
  (medical-benefit policy documents, which a couple of gathers already checked). Found one real,
  fixable case: `md-osteoporosis` mdmedicaid/rankl-inhibitor was held at `partial` solely because
  the source PDL didn't disambiguate whether "Jubbonti/Stoboclo/Bildyos/Conexxence" are 60mg
  Prolia-strength (osteoporosis) or 120mg Xgeva-strength (oncology) biosimilars — one inline
  `WebSearch` (AJMC's FDA-approval coverage) confirmed all four are 60mg Prolia-referencing
  products, so the cell upgraded `partial`→`verified` (commit `15cd119`). Also surfaced a second,
  distinct finding not previously logged: **`al-osteoporosis`'s `al-medicaid` payer has zero
  osteoporosis-agent mentions across BOTH published Alabama Medicaid PDL documents, for every
  class** (oral-bisphosphonate/anabolic/serm all partial for this exact reason) — a whole-
  therapeutic-area PDL gap distinct from the injectable/medical-benefit carve-out pattern seen
  everywhere else, already correctly documented in the existing verificationNotes. `npm test`
  (454/454), `typecheck`, `trace`, `validate-coverage`, `archive-sources` all green after the fix;
  AJMC's own page 403'd the archiver's fetch (bot-protected, citation stands, archive entry
  recorded unreachable, same category as GoodRx/Cost Plus). Committed in 2 chunks (data fix,
  source archive). **Still stopped here pending the user's review of `pa-ssris`.** Next session:
  if approved, merge PA's remaining 20 gathered-and-checkpointed classes, then CA.
- 2026-07-29 (scheduled run) — **Gate still active, correctly did not scale new guides.** Confirmed
  working tree clean, `main` up to date with `origin/main`, `npm run validate-coverage` unchanged
  at 43/357 since the 2026-07-26 `pa-ssris` merge — no drift, no user approval had landed
  (non-interactive run, nothing to approve against). Audited a dozen not-yet-individually-reviewed
  `partial`/`example` cells (md-menopause, il-nsaids, md-ace, ma-menopause, il-inhalers,
  il-diabetes, ny-ssris, ma-ssris) by reading their `verificationNote`s directly — unlike the
  2026-07-28 osteoporosis audit, found none were a quick one-search fix like the `md-osteoporosis`
  rankl-inhibitor case; each is either a genuinely blocked source (ny-menopause's eMedNY PA-code
  legend, already logged and dead-ended twice) or a real source-level ambiguity (tied Tier-1
  SSRIs, OCR-split NDC rows, PA table-id mismatches) needing a payer call or a different source,
  not more web research. Not logged as new findings since none were actionable.
  **Did real, in-scope work instead of pure research: closed a chunk of the SSRI cash-price gap.**
  The browser preview tool worked today (unusual for a scheduled run — GoodRx wasn't bot-blocked
  at the start of the session, unlike 2026-07-24's immediate error). This isn't "scaling" under
  the proof-guide gate (no new formulary data gathered, no new guide/state) — it closes an
  already-known, already-permitted gap in guides shipped weeks ago, flagged as future work in the
  2026-07-21 `cash.ts` history comment. Added 6 broad SSRI molecule cash-link rules
  (sertraline/citalopram/escitalopram/fluoxetine/paroxetine/fluvoxamine, real GoodRx + Cost Plus
  Drugs prices, captured 2026-07-29) to `src/lib/cash.ts` — collapses every SSRI name variant
  across all 7 shipped SSRI guides (NY/MA/MD/VA/IL/AL/PA) in one pass, the same molecule-family-
  regex leverage the metformin/lisinopril rules already have. GoodRx served a "Press & Hold"
  bot-check partway through (paroxetine/fluvoxamine came back Cost-Plus-only, consistent with the
  documented intermittent block). `KNOWN_UNPRICED_GAP` lowered 377→155 (a real coverage
  improvement, not a ceiling raise). `npm test` (454/454), `typecheck`, `validate-prices` all
  green; verified live in the browser dev server (NY → SSRIs renders sertraline/citalopram/
  escitalopram/fluoxetine with correct GoodRx+Cost Plus prices, paroxetine Cost-Plus-only as
  expected).
  **Still stopped here pending the user's review of `pa-ssris`; the PA/CA scaling work is
  unchanged from the 2026-07-26 entry.** Next session: if approved, merge PA's remaining 20
  gathered-and-checkpointed classes, then CA. If a browser is available again, osteoporosis's
  molecule families (bisphosphonates/denosumab/teriparatide/raloxifene) are the next cash-price
  target — same collapse-many-guides-in-one-pass leverage as this session's SSRI rules.
- 2026-07-30 (scheduled run) — **Gate still active, correctly did not scale new guides.** Confirmed
  working tree clean, `main` up to date with `origin/main`, `npm run validate-coverage` unchanged
  at 43/357 since the 2026-07-26 `pa-ssris` merge — no drift, no user approval had landed
  (non-interactive run, nothing to approve against). The already-gathered `data-gathering/pa-all-
  topics-2026-07-25/` checkpoint (20 classes, 3 payers) survived on disk and remains ready to merge
  for free once approved.
  **Did real, in-scope work instead of pure research, same category as 2026-07-29: closed part of
  the osteoporosis cash-price gap flagged as the next target in that session's note.** A real
  browser session was available again. Checked Cost Plus Drugs' bone-health category directly (only
  2 of the 5 osteoporosis molecule families are stocked there — alendronate and raloxifene; the
  other 3 are specialty injectables/infusions Cost Plus doesn't carry). Added both as broad
  molecule-family cash-link rules (`src/lib/cash.ts`): alendronate (GoodRx ~$29.30 for 4×70mg,
  Cost+ ~$7.38 for 30×10mg) and raloxifene (GoodRx ~$31.86, Cost+ ~$8.42, both 30×60mg) — prices
  every oral-bisphosphonate and serm preferred-agent cell across all 5 shipped osteoporosis guides
  (NY/MA/MD/VA/IL) in one pass. GoodRx then hit a session-wide "Access to this page has been
  denied" block (harder than the milder intermittent "Press & Hold" check documented elsewhere)
  before the 3 remaining molecules (zoledronic acid/Reclast, denosumab/Prolia + biosimilars,
  teriparatide/Forteo + abaloparatide/Tymlos) could be attempted — logged to `backlog.md` with a
  new observation: those 3 are physician-administered infusions/injections, so a plain GoodRx
  retail-cash price may not even be the right number to show (worth checking manufacturer
  copay-card pages instead, same pattern as the existing Ozempic-pen rule) once GoodRx access is
  clean again. `KNOWN_UNPRICED_GAP` lowered 155→129 (verified via `node scripts/validate-prices.mjs`
  — 129/129 known-gap drugs unpriced, matching the new ceiling exactly). `npm test` (454/454),
  `typecheck`, `validate-prices` all green; verified live in the dev-server browser (NY →
  Osteoporosis renders alendronate with both prices on oral-bisphosphonate, raloxifene with both
  prices on serm).
  **Still stopped here pending the user's review of `pa-ssris`; the PA/CA scaling work is
  unchanged from the 2026-07-26 entry.** Next session: if approved, merge PA's remaining 20
  gathered-and-checkpointed classes, then CA. If a browser is available again, the 3 remaining
  osteoporosis specialty-injectable molecules (above) are the next cash-price target.
- 2026-08-02 (scheduled run) — **Gate still active, correctly did not scale new guides.** Confirmed
  working tree clean, `main` up to date with `origin/main`, `npm run validate-coverage` unchanged
  at 43/357 since the 2026-07-26 `pa-ssris` merge — no drift, no user approval had landed
  (non-interactive run, nothing to approve against). The already-gathered `data-gathering/pa-all-
  topics-2026-07-25/` checkpoint (20 classes, 3 payers) survived on disk and remains ready to merge
  for free once approved.
  **Committed an untracked leftover found at session start**: `scripts/gap-report.mjs`, a complete
  and working offline gap-prioritization script (created 2026-07-30, never committed) that
  automates the manual "eyeball formulary.json" audits several past sessions did by hand — ranks
  unpriced-molecule stems by cell count and buckets `partial`/`example` cells by cause, pure data
  analysis, no network calls, no agent spawn. Verified it runs correctly before committing.
  **Did real, in-scope work instead of pure research, same category as 2026-07-29/07-30: closed
  part of the remaining osteoporosis cash-price gap.** A real browser session was available with no
  vendor block at the start. Added denosumab/Prolia + every biosimilar name variant
  (rankl-inhibitor, GoodRx ~$1,832.87 for 1 syringe 60mg/mL — the bare `goodrx.com/prolia` slug
  landed on the exact right osteoporosis-strength product by default) to `src/lib/cash.ts`.
  `KNOWN_UNPRICED_GAP` 129→90. GoodRx then hit the same session-wide access-denied block as
  2026-07-30, this time after only 2 lookups — the 2nd lookup (zoledronic acid/Reclast) landed on
  the WRONG product via the bare slug (4mg/5mL Zometa oncology vial instead of the 5mg/100mL
  Reclast osteoporosis infusion), so that price was discarded rather than shipped incorrectly.
  Teriparatide/Forteo and abaloparatide/Tymlos were never reached. Full gap and the Reclast
  wrong-strength trap logged to `backlog.md`. `npm test` (454/454), `typecheck`, `validate-prices`
  all green; verified live in the dev-server browser (NY → Osteoporosis → RANKL INHIBITOR renders
  Prolia with the correct GoodRx price). Committed in 2 chunks (gap-report script, cash rule +
  backlog/ledger notes).
  **Still stopped here pending the user's review of `pa-ssris`; the PA/CA scaling work is
  unchanged from the 2026-07-26 entry.** Next session: if approved, merge PA's remaining 20
  gathered-and-checkpointed classes, then CA. If a browser is available again, zoledronic
  acid/Reclast (use the Edit-flow or a correct dosage param, not the bare slug) and
  teriparatide/Forteo + abaloparatide/Tymlos are the next cash-price target.
- 2026-08-03 (scheduled run) — **Gate still active, correctly did not scale.** Confirmed working
  tree clean, `main` up to date with `origin/main`, `npm run validate-coverage` unchanged at
  43/357 since the 2026-07-26 `pa-ssris` merge — no drift, no user approval had landed (non-
  interactive run, nothing to approve against). The already-gathered `data-gathering/pa-all-
  topics-2026-07-25/` checkpoint (20 classes, 3 payers) survived on disk and remains ready to merge
  for free once approved.
  **Attempted the 3 remaining osteoporosis cash-price molecules (the named next target from
  2026-08-02), came up empty but for a real reason, not idleness.** GoodRx was hard-blocked
  immediately this session ("Access to this page has been denied" on the very first lookup,
  zoledronic acid — worse than 2026-08-02's 2-lookup grace period before the block hit). Cost Plus
  Drugs wasn't re-checked (already confirmed 2026-07-30 not to carry any of the 3). Pivoted to
  manufacturer copay-card pages per the backlog's own suggestion: Forteo's site
  (`forteo.lilly.com`) advertises "$4/month" but its own eligibility terms restrict the card to
  patients with commercial insurance and explicitly exclude Medicaid/Medicare enrollees — a copay-
  reduction card for the already-insured, not a cash/self-pay price, so shipping it as a
  `cash.ts` rule would misrepresent it to the uninsured user this feature serves. Did not add it.
  Tymlos's patient site has no pricing on its homepage and its savings-support path 404s; Reclast's
  manufacturer domain no longer resolves (long-genericized). **Net: no cash rule added,
  `KNOWN_UNPRICED_GAP` unchanged at 90.** Full reasoning logged to `backlog.md` so a future session
  doesn't re-attempt the same Forteo card under the mistaken belief it's a valid GoodRx substitute.
  **Still stopped here pending the user's review of `pa-ssris`.** Next session: if approved, merge
  PA's remaining 20 gathered-and-checkpointed classes, then CA. If GoodRx access is clean again,
  retry zoledronic acid/Reclast with a correct dosage param (not the bare slug, which picked the
  wrong oncology-dose product on 2026-08-02).
- 2026-08-04 (scheduled run) — **Gate still active, correctly did not scale.** Confirmed working
  tree clean, `main` up to date with `origin/main`, `npm run validate-coverage` unchanged at
  43/357 since the 2026-07-26 `pa-ssris` merge — no drift, no user approval had landed (non-
  interactive run, nothing to approve against). The already-gathered `data-gathering/pa-all-
  topics-2026-07-25/` checkpoint (20 classes, 3 payers) survived on disk and remains ready to merge
  for free once approved.
  Audited a handful of the smaller `partial`-cell buckets flagged by `scripts/gap-report.mjs`
  (`md-osteoporosis/anabolic`'s "OCR/table-extraction" tag, `va-menopause/est-oral`'s "needs manual
  read" tag, `md-inhalers/ics`'s "access blocked" tag) — all three were already thoroughly
  documented, genuine source-side gaps (403-blocked payer PDFs falling back to search-cache
  extraction, no verbatim strength stated in a source PDL), not quick fixes; none re-bucketed.
  GoodRx was session-wide "Access to this page has been denied" blocked from the very first lookup
  (3rd consecutive scheduled run with this exact block, following 2026-08-02/08-03) — no GoodRx
  price captured.
  **Did find one real, in-scope fix: a routine re-check of Cost Plus Drugs' catalog (last checked
  2026-07-30) turned up a genuine catalog change** — Cost Plus now carries teriparatide (generic
  for Forteo), which it did not on 2026-07-30. Confirmed via a real product page
  (`costplusdrugs.com/medications/teriparatide-560-mcg_2_24ml-solution-pen-injector-2_24/`,
  $775.15/pen, 560 mcg/2.24 mL). Added a Cost-Plus-only cash-link rule covering the generic/Forteo/
  Bonsity name variants (`src/lib/cash.ts`), `KNOWN_UNPRICED_GAP` 90 → 78. Abaloparatide/Tymlos and
  zoledronic acid/Reclast re-confirmed still absent from Cost Plus's catalog. `npm test` (454/454),
  `typecheck`, `validate-prices` all green; verified live in the dev-server browser (MD →
  Osteoporosis → Anabolic → Priority Partners renders Forteo/teriparatide with the Cost+ price).
  Committed in 1 chunk.
  **Still stopped here pending the user's review of `pa-ssris`.** Next session: if approved, merge
  PA's remaining 20 gathered-and-checkpointed classes, then CA. If GoodRx access is clean again,
  the remaining osteoporosis cash-price gap is zoledronic acid/Reclast (needs a correct dosage
  param, not the bare slug) and abaloparatide/Tymlos.
- 2026-08-09 (scheduled run) — **Gate still active, correctly did not scale new states/topics.**
  Confirmed working tree clean, `main` up to date with `origin/main`, `npm test` (570/570),
  `npm run validate-coverage` unchanged at 56/357 (8/51 jurisdictions) since the 2026-08-05 CA
  merge — no drift, still no user answer on the 43-state prioritization axis, no state picked
  unilaterally. The already-gathered `data-gathering/pa-all-topics-2026-07-25/` checkpoint (20
  classes, 3 payers) was not re-checked this session but is assumed still ready to merge for free
  once approved (per every prior entry since 2026-07-26).
  **Did real, in-scope work instead of pure research: closed most of the remaining osteoporosis
  cash-price gap.** GoodRx access recovered mid-session — after 7 consecutive scheduled runs with a
  hard "Access to this page has been denied"/"Press & Hold" block, this session started blocked too
  but cleared after a couple of retries (then re-blocked again later, confirming it's genuinely
  intermittent, not a clean recovery). Captured real prices for zoledronic acid/Reclast ($81.49 —
  the bare slug resolved to the CORRECT 5mg/100mL osteoporosis dose this time, not the wrong 4mg
  oncology dose it defaulted to on 2026-08-02; pinned with explicit dosage/form/quantity params so a
  future session's default can't silently drift back) and abaloparatide/Tymlos ($3,030, correct FDA-
  labeled 80mcg/dose pen). Also resolved — not just blocked — the other two of the original 3
  open molecules: romosozumab/Evenity and pamidronate both loaded live but are tagged "Physician-
  administered" with no pharmacy dispensing/price panel at all, confirming there is no real retail
  cash price to capture for either (a structural fact, not a research gap; no rule added, and none
  should be added later on this basis). Etidronate disodium (a 4th molecule surfaced later, by the
  2026-08-05 PA scale-up) was never reached before GoodRx re-blocked. `KNOWN_UNPRICED_GAP` 33→21.
  `npm test` (570/570), `typecheck`, `validate-prices` (21/21 matching the new ceiling), `trace` all
  green; verified live in the dev-server browser (NY → Osteoporosis → IV BISPHOSPHONATE renders
  zoledronic acid with the new GoodRx price; NY → Osteoporosis → ANABOLIC AGENT renders the
  abaloparatide/Tymlos alternative with its new GoodRx price). Committed in 1 chunk (cash rules +
  backlog/ledger notes).
  **Still stopped here pending the user's answer on the 43-state prioritization axis.** Next
  session: if the user answers, scale the chosen state(s); if approved, merge PA's remaining 20
  gathered-and-checkpointed classes, then CA. If GoodRx access is clean again, etidronate disodium
  is the only remaining "worth retrying" cash-price gap in osteoporosis — everything else left
  unpriced is either a structural dead end (romosozumab, pamidronate) or a minor insulin-brand/
  one-off long tail.
- 2026-08-05 (interactive session) — **Gate cleared by explicit user instruction ("grab the
  rest"); PA scaled to its remaining 20 classes, PA now complete across all 7 topics** (matching
  AL's full footprint). Shipped `pa-inhalers` (12 records), `pa-ace` (3), `pa-diabetes` (12),
  `pa-menopause` (15), `pa-nsaids` (3), `pa-osteoporosis` (15) — 60 records total, all 3 payers ×
  20 classes.
  **Important correction to this ledger's own standing assumption**: the `data-gathering/pa-all-
  topics-2026-07-25/` checkpoint was NOT available in this session's worktree — gitignored
  checkpoints only live in the worktree that wrote them (per the existing CLAUDE.md scar tissue),
  and this session started in a fresh worktree. It was NOT lost, though: the checkpoint was still
  sitting on disk in the **main checkout** (`/Users/pranava/Projects/FirstPassRx/data-gathering/`,
  not the worktree), because that gather was run directly against the main checkout back on
  2026-07-25. Recovered all 68 files from there — zero new agent calls, exactly as this ledger
  assumed, just from a different path than expected. **Lesson for future sessions**: when a
  checkpoint referenced by this ledger isn't in the current worktree, check the main checkout's
  `data-gathering/` before concluding it needs re-gathering — it may simply be sitting in whichever
  location originally ran the gather.
  Wrote a one-off Python merge script (scratchpad only, not committed — same as every prior
  session's `merge_state()`-style script) that: reused each topic's class taxonomy verbatim from
  `il-<topic>` (the reference guide for that shape), built one reference per (payer, topic) for
  pa-medicaid/ibx-commercial (single static PDF covers every topic), and one reference **per
  class** for highmark-bcbs (its FormularyNavigator search URL is genuinely class-specific — 19 of
  20 classes had a distinct deep-link, confirmed by diffing every checkpoint's `primarySource.url`
  before assuming one shared URL). Applied the established reword-not-reclassify fix to 218
  `paRequired` reasons using "non-preferred" wording (all confirmed genuine PA barriers, matching
  every prior state's pattern).
  **Caught and fixed 3 real schema bugs in the checkpoint data itself** (not merge-script bugs) via
  `npm test`'s validate() failing loud, exactly as designed: (1) `pa-medicaid/lama`'s preferred
  agent (Spiriva Respimat, correctly genericAvailable:false) had `boglActive:true` left set from a
  class-wide reversed-BOGL note that explicitly named a *different* product (Spiriva HandiHaler) as
  the one affected — same soft-mist-device-has-no-generic nuance as the 2026-07-11 VA fix in
  CLAUDE.md; (2) `pa-medicaid/glp1` had the identical pattern (Ozempic preferred, boglNote about
  Victoza) — both corrected to `boglActive:false`; (3) `pa-medicaid/sglt2` had `boglActive:true`
  with `brand:null` even though its own boglNote named "Farxiga" as the brand being beaten by
  generic dapagliflozin — filled in the missing brand rather than disabling the (real) BOGL,
  confirmed against the sibling `ibx-commercial/sglt2` record in the same guide which already had
  `brand:"Farxiga"` correctly set.
  **Cash-price gap**: PA's osteoporosis alternatives introduced 3 molecule families
  (risedronate/Actonel, ibandronate/Boniva, pamidronate) never seen in any prior guide, plus a few
  one-off names (VoSpire ER, Apidra/Admelog insulin, a bare "Norethindrone Tablet (generic)"
  phrasing). `KNOWN_UNPRICED_GAP` raised 78→90 (headless session, no browser price capture
  attempted for the new names — logged to `backlog.md` as the next cash-price target alongside the
  already-known zoledronic acid/Reclast and abaloparatide/Tymlos gaps). One genuine link-only-rule
  gap also surfaced and was fixed at the test level: "Estradiol Patch (Once-Weekly, generic)"
  matched the existing price-less `estradiol.*(weekly|patch|transdermal)` rule but wasn't yet in
  `cash.test.ts`'s `KNOWN_PRICE_UNAVAILABLE` list (added `/estradiol patch/i`, consistent with that
  rule's existing documented link-only status).
  `npm test` (502/502), `typecheck`, `trace` (0 broken sources), `validate-prices` (90/90 matching
  the new ceiling), `validate-coverage` all green; verified live in the dev-server browser (PA →
  Osteoporosis renders alendronate/PA-Medicaid with correct GoodRx+Cost Plus prices and the
  risedronate-family exclusion reworded to "restricted"; PA → Osteoporosis → RANKL INHIBITOR/
  Highmark renders Prolia with the correct GoodRx price and a class-specific source citation;
  PA → Osteoporosis → IV BISPHOSPHONATE/Highmark correctly cites the separate medical-policy
  document, not the pharmacy-formulary search). Updated `src/lib/formulary.test.ts`'s hardcoded
  guide-id list with the 6 new ids. National grid moved 43/357 → 49/357, verified-only 25→30.
  **Next session: California is next** (3-payer roster already in `state-index.json` from
  2026-07-23, cheapest state to gather, but has zero guides yet — needs its own proof guide first,
  same "one guide as proof" gate applied to every other new state/topic). If GoodRx/Cost Plus
  access is available, the accumulated osteoporosis cash-price gap (zoledronic acid, abaloparatide,
  risedronate, ibandronate, pamidronate, romosozumab) is the next pricing target.
- 2026-08-05 (same session, continued — user said "keep going") — **California's proof guide
  SHIPPED: `ca-ssris`, the new-state gate for CA.** Gathered fresh via `formulary-gather.js`
  (3 payers — Medi-Cal Rx, Kaiser Permanente, Anthem BCBS California — chunked ≤2 concurrent,
  0 agent errors, ~307K subagent tokens, all 3 citing fresh 2026-08 documents). No reword-not-
  reclassify fixes needed this time: every payer either states PA/step criteria explicitly or
  explicitly disclaims them (Kaiser's own formulary states verbatim "does not have a requirement
  for PA" / "does not have a requirement for Step Therapy") — the first new-state gather where zero
  paRequired reasons needed the binary-PDL reword fix. Medi-Cal Rx's CDL is a flat covered/
  restricted list, not a ranked PDL, so it doesn't itself name a "preferred" SSRI among the six —
  sertraline was picked by first-line convention (same as every other payer's ssri-oral record) and
  flagged `verification: partial` for that inference, matching this project's standing rule that an
  inference gets marked, not silently presented as read-verbatim.
  One metadata fix applied during merge: Anthem's `state-index.json` `formularyUrl` was the landing
  page (`anthem.com/ca/pharmacy-information/drug-list-formulary`), which timed out twice for the
  gather agent — it found the real document via a FormularyNavigator-hosted PDF instead. Synced
  `state-index.json` to the real URL (same "sync to what the gather actually fetched" fix as the
  MassHealth MHDL case in CLAUDE.md), so a future CA gather doesn't re-hit the same timeout.
  Cash-price gap: **zero new gap** — all 6 SSRI molecule names already matched the existing broad
  SSRI cash-link rules from 2026-07-29, `KNOWN_UNPRICED_GAP` unchanged at 90.
  `npm test` (510/510), `typecheck`, `trace` (0 broken sources), `validate-prices` (90/90,
  unchanged), `validate-coverage` all green; verified live in the dev-server browser (CA → SSRIs
  renders sertraline preferred with correct GoodRx+Cost Plus prices for both Medi-Cal Rx and Kaiser
  Permanente, Kaiser's 6 excluded brand alternatives render with the payer's own no-PA-requirement
  language intact). National grid moved 49/357 → 50/357, 7→8 jurisdictions covered. Committed in 4
  chunks (guide merge + test-id list, state-index URL sync, source archive).
  **Next session: California's remaining 6 topics** (inhalers/ace/diabetes/menopause/nsaids/
  osteoporosis, same "one guide as proof, then scale" gate that applied to every prior new state —
  AL and PA both scaled their remaining topics only after this proof-guide step). No checkpoint
  exists yet for CA's other topics — this would be a fresh gather, not a free merge, same shape as
  today's `ca-ssris` run (3 payers, ≤2 concurrent chunks). After CA: the national grid still has 43
  states with zero guides at all — a much larger scope decision than anything scoped so far in this
  ledger, worth an explicit conversation with the user about which states/topics matter next rather
  than picking one unilaterally.
- 2026-08-05 (same session, continued — user said "finish CA and then make sure that no
  combination of data is missing any cost+ or goodrx data") — **Gate cleared by explicit user
  instruction; CA scaled to its remaining 6 topics, CA now complete across all 7 topics** (matching
  AL and PA's full footprint). Gathered via a fresh `formulary-gather.js` run (3 payers × 20
  classes each off one fetch per payer, chunked ≤2 concurrent, 0 agent errors, ~662K subagent
  tokens, ~26 min). Zero reword-not-reclassify fixes needed — every CA payer states its PA/step
  policy unambiguously, matching `ca-ssris`'s finding; this state's payers simply don't use the
  ambiguous binary-PDL "non-preferred" phrasing that's needed the fix everywhere else. Fixed one
  real BOGL bug (`kaiser-permanente-ca/anabolic`: `boglActive` set despite Kaiser's own note
  confirming it doesn't carry generic teriparatide) and normalized one "not applicable" placeholder
  (`kaiser-permanente-ca/combo`: no combo product carried at all — replaced blank dosing fields
  with the same real clinical strength/sig every other guide's combo class uses, keeping the
  "genuinely uncovered" finding in `preferredRestriction`/`paRequired` where it belongs).
  **Then closed the cash-price gap as far as this session's tool access allowed** (the user's
  second ask). GoodRx was session-wide "Access to this page has been denied" blocked from the first
  lookup — 5th consecutive session with this exact block. Cost Plus Drugs was accessible: confirmed
  real prices for risedronate/Actonel (30 tablets, 5mg daily-dose, $31.54) and ibandronate/Boniva
  (dose-pack of 3, 150mg once-monthly, $8.51) — both collapse across every osteoporosis guide
  shipped so far. The ibandronate rule required a route-of-administration exclusion (iv/injection/
  injectable/syringe/vial) since several covered names explicitly describe IV ibandronate, a real,
  distinct, Cost-Plus-uncarried product — pricing those as the cheap oral tablet would have been a
  mispricing bug, same category as the Reclast/Zometa and Respimat/HandiHaler traps. Also fixed a
  narrow coverage-match gap (not a pricing gap): PA's bare "Norethindrone Tablet (generic)"
  phrasing, safely broadened since this app has no contraception class. `KNOWN_UNPRICED_GAP`
  90 → 29 → 33 (dropped sharply after the risedronate/ibandronate/norethindrone fixes, then rose
  slightly as CA's own new alternatives-list phrasings were checked — 2 were real pre-existing gaps
  closed via regex broadening — bare "estradiol (vaginal)"/"Estradiol vaginal" without a form word,
  and a plain "estradiol N mg ... tablets" phrasing lacking "oral" — and 2 were genuinely new,
  confirmed-not-Cost-Plus-carried drugs: fenoprofen/Nalfon and plain regular human insulin).
  Remaining gap, all confirmed not-Cost-Plus-carried this session and GoodRx-blocked: zoledronic
  acid/Reclast, pamidronate (IV only), abaloparatide/Tymlos, romosozumab/Evenity, etidronate
  disodium, VoSpire ER, Apidra/Admelog insulin brands, plus intentionally-excluded IV-route
  ibandronate mentions.
  **Live-browser verification of the CA merge surfaced a real, pre-existing UI correctness bug,
  not introduced by this session but first exposed by it**: `ResultCard.tsx`'s prominent "In plan:
  X" badge fell back to the bare literal "covered" whenever a record had no `tier`, even when
  `preferredRestriction` explained the drug isn't actually covered cleanly (as with
  `kaiser-permanente-ca/rankl-inhibitor` — denosumab/Prolia has no line item anywhere on Kaiser's
  formulary at all, yet the badge said "covered"). The honest caveat only surfaced if the user
  expanded the collapsed "Coverage detail" section below — the type definition's own doc comment
  for `preferredRestriction` explicitly says the UI "must NOT claim the plan covers this drug
  without prior authorization," so this was a real violation of an already-stated invariant.
  Affects 58 existing records across the whole dataset, not just CA. Fixed (`ResultCard.tsx`) with
  a 3-case regression test (`ResultCard.test.tsx`, new file).
  `npm test` (561/561), `typecheck`, `trace` (0 broken sources), `validate-prices` (33/33 matching
  the new ceiling), `validate-coverage` all green; verified live in the dev-server browser across
  all 3 CA payers and multiple classes, including the fixed "In plan" badge. National grid moved
  50/357 → 56/357, still 8/51 jurisdictions covered (CA already counted from `ca-ssris`).
  Committed in 5 chunks (guide merge, cash-price fixes, ResultCard bug fix + test, source archive).
  **Next session: 43 states still have zero guides — a genuinely large scope decision.** The user
  was asked (end of the prior entry) for a prioritization axis and hasn't yet answered; don't pick
  a state unilaterally. Also flagged, not yet actioned: dosing-caveat fields for renal/hepatic
  cutoffs (bisphosphonates/metformin/SGLT2/ACE-inhibitors have real clinical cutoffs this app
  doesn't surface at all today) and the `sources/` directory's growing size (now ~900MB+,
  Git LFS flagged in backlog.md as the fix once it becomes a real clone-time problem).
- 2026-08-05 (scheduled run, same day as the CA-completion session above) — **Gate still active,
  correctly did not scale new states/topics.** Confirmed working tree clean, `main` up to date with
  `origin/main`, `npm test` (570/570), `npm run validate-coverage` unchanged at 56/357 (8/51
  jurisdictions) since the CA merge earlier today — the 43-states-with-zero-guides prioritization
  decision the user was asked about is still unanswered, so no state was picked unilaterally.
  Attempted the cash-price gap next (permitted in-scope work, not "scaling"): GoodRx was
  session-wide "Access to this page has been denied" blocked on the very first lookup (zoledronic
  acid) — 6th consecutive session with this exact block, did not attempt to bypass the Press & Hold
  bot-check. Re-checked Cost Plus Drugs' full bone-health category (11 products, 2 pages) directly —
  unchanged since 2026-07-30/08-04: still only alendronate/raloxifene/ibandronate/risedronate/
  teriparatide among osteoporosis agents; zoledronic acid, abaloparatide, pamidronate, denosumab,
  romosozumab, and etidronate are still not carried. `KNOWN_UNPRICED_GAP` unchanged at 33.
  Per the task's fallback instruction, spent the remainder auditing previously-un-individually-
  read `partial` cells flagged by `scripts/gap-report.mjs` (il-osteoporosis/serm,
  ny-osteoporosis/serm, va-osteoporosis/oral-bisphosphonate, pa-osteoporosis/iv-bisphosphonate +
  rankl-inhibitor, al-nsaids/nsaid-oral, al-menopause/progestogen, ca-ssris/ssri-oral,
  ca-menopause/combo) by reading each `verificationNote` directly (no agents) — every one was
  already an exhaustively-documented, genuine structural absence (drug confirmed absent from the
  source PDL/formulary via full-text search, or a physician-administered medical-benefit carve-out),
  not an extraction failure or quick fix; none re-bucketed, no new backlog items logged since
  restating an already-documented conclusion isn't a new finding.
  Two web searches for new candidate topics/states (per the task's fallback instruction, no
  agents): (1) statins — found 2026 state PDLs exist (MI, DE, NY) but no compelling PA-barrier
  story (statins are typically unrestricted first-line generics, unlike the existing GLP-1/ADHD/
  DOAC/CGRP candidates already logged 2026-07-19/07-20, which each have a real PA-friction angle) —
  not added to backlog, wouldn't serve this app's core "avoid a PA denial" value prop; (2)
  re-verified Texas Vendor Drug Program (the standing candidate 4th-new-state) is still on its
  known semi-annual cadence — the 2026-07-24 update the 2026-07-25 entry flagged as scheduled did
  publish on time, next one expected ~January 2027 — no change to the existing recommendation.
  No data gathered, no agents/Workflows spawned, no branches created, no commits from this run's
  research (this ledger entry is the only change). **Still stopped here pending the user's answer
  on the 43-state prioritization axis.** Next session: if the user answers, scale the chosen
  state(s); if GoodRx access is clean again, the remaining osteoporosis cash-price gap (zoledronic
  acid — needs a correct dosage param, not the bare slug — abaloparatide, pamidronate, romosozumab,
  etidronate) is the next pricing target.
- 2026-08-06 (scheduled run) — **Gate still active, correctly did not scale new states/topics.**
  Confirmed working tree clean, `main` up to date with `origin/main`, `npm test` (570/570),
  `npm run validate-coverage` unchanged at 56/357 (8/51 jurisdictions) since the 2026-08-05 CA
  merge — no drift, no user answer on the 43-state prioritization axis, no state picked
  unilaterally.
  Attempted the cash-price gap next (permitted in-scope work): GoodRx presented a "Press & Hold"
  bot-check on the very first lookup (zoledronic acid) — a milder state than the last 6 sessions'
  hard "Access to this page has been denied" block, the underlying drug page (title, "Generic
  Reclast and Zometa", Specialty Drug tag) had actually loaded behind the modal this time. Did
  **not** click Press & Hold — completing a bot-detection challenge to bypass it is out of scope
  regardless of project convention, so this counts as blocked, same outcome as prior sessions just
  a different-looking wall. Re-checked Cost Plus Drugs' bone-health category (11 products, 2 pages,
  read directly via the browser) — byte-for-byte the same catalog as 2026-08-05: alendronate,
  calcitonin, Duavee, ibandronate, oxaprozin, Premphase, Prempro, raloxifene, risedronate ×2,
  teriparatide. Zoledronic acid, abaloparatide, pamidronate, denosumab, romosozumab, and etidronate
  still absent. `KNOWN_UNPRICED_GAP` unchanged at 33.
  Per the fallback instruction, spent the remainder on fresh web research rather than re-reading
  `verificationNote`s already exhaustively audited 2026-07-28/07-29/08-05 (diminishing returns —
  those passes consistently found genuine structural gaps, not extraction failures). One new
  candidate topic surfaced and logged to `backlog.md`, not yet logged in any prior session:
  **buprenorphine / medication for opioid use disorder (MOUD)**. Published research (Penn LDI, USC
  Arnold School, JAMA Network Open) documents 32/50 state Medicaid programs require PA for at least
  one buprenorphine formulation and 15 require it even for the first-line buprenorphine-naloxone
  combination (Suboxone); FFS programs require PA more often than MCOs (64.1% vs. 42.3%); Medicare
  has already dropped PA for buprenorphine while many state Medicaid plans haven't — an unusually
  strong, well-documented PA-friction story (and higher-stakes than the existing GLP-1/ADHD/DOAC/
  CGRP candidates, given the overdose-risk cost of a delayed MOUD fill). Likely a single
  `buprenorphine` class, same shape as `ssri-oral`. Research only — no data gathered, no agents
  spawned, not started.
  No data gathered, no agents/Workflows spawned, no branches created. Committed 1 chunk (backlog +
  this ledger entry). **Still stopped here pending the user's answer on the 43-state prioritization
  axis.** Next session: if the user answers, scale the chosen state(s); if GoodRx access is clean
  again (no bot-check at all, not just a milder one), the remaining osteoporosis cash-price gap
  (zoledronic acid, abaloparatide, pamidronate, romosozumab, etidronate) is the next pricing target.
- 2026-08-07 (scheduled run) — **Gate still active, correctly did not scale new states/topics.**
  Confirmed working tree clean, `main` up to date with `origin/main`, `npm test` (570/570),
  `npm run validate-coverage` unchanged at 56/357 (8/51 jurisdictions) since the 2026-08-05 CA
  merge — no drift, still no user answer on the 43-state prioritization axis, no state picked
  unilaterally.
  Attempted the cash-price gap next (permitted in-scope work): GoodRx presented the same
  "Press & Hold" bot-check as 2026-08-06 on the very first lookup (zoledronic acid) — did not
  click through it (out of scope regardless of project convention). Re-checked Cost Plus Drugs'
  bone-health category (page 1, same 10 products) — byte-for-byte unchanged since 2026-08-05/08-06:
  zoledronic acid, abaloparatide, pamidronate, denosumab, romosozumab, and etidronate still absent.
  `KNOWN_UNPRICED_GAP` unchanged at 33.
  Spent the remainder developing the 2026-08-06 buprenorphine/MOUD candidate rather than
  re-reading already-exhausted `verificationNote`s: checked Cost Plus Drugs' cash-price
  feasibility for it directly (a check the 2026-08-06 entry hadn't done). Result: Cost Plus does
  **not** carry buprenorphine or buprenorphine-naloxone at all — its "Opioid Dependence" category
  only stocks naloxone/Narcan-generic and naltrexone/ReVia-generic (overdose-reversal and
  non-opioid-antagonist drugs, not MOUD itself), and a direct site search for "buprenorphine"
  returned zero results. Logged to `backlog.md`: if this topic is ever scoped, its cash-price
  story would depend entirely on GoodRx (not confirmed this session — GoodRx was bot-blocked
  throughout), unlike SSRIs/osteoporosis where Cost Plus backstops several molecules.
  No data gathered, no agents/Workflows spawned, no branches created. Committed 1 chunk (backlog +
  this ledger entry). **Still stopped here pending the user's answer on the 43-state prioritization
  axis.** Next session: if the user answers, scale the chosen state(s); if GoodRx access is clean
  again (no bot-check at all), the remaining osteoporosis cash-price gap (zoledronic acid,
  abaloparatide, pamidronate, romosozumab, etidronate) is the next pricing target.
- 2026-08-08 (scheduled run) — **Gate still active, correctly did not scale new states/topics.**
  Confirmed working tree clean, `main` up to date with `origin/main`, `npm test` (570/570),
  `npm run validate-coverage` unchanged at 56/357 (8/51 jurisdictions) since the 2026-08-05 CA
  merge — no drift, still no user answer on the 43-state prioritization axis, no state picked
  unilaterally.
  Attempted the cash-price gap next (permitted in-scope work): GoodRx presented the "Press & Hold"
  bot-check again on the very first lookup (zoledronic acid) — 7th consecutive scheduled run with
  a GoodRx block, did not click through it (out of scope regardless of project convention).
  Re-checked Cost Plus Drugs individually for the 3 still-open molecule families (zoledronic acid,
  abaloparatide, romosozumab) plus pamidronate — all confirmed still not carried, byte-for-byte
  unchanged since 2026-07-30. `KNOWN_UNPRICED_GAP` unchanged at 33.
  Audited a fresh batch of `partial`-cell `verificationNote`s not read verbatim in any prior
  session's ledger entry — the "biosimilar/strength ambiguity" gap-report bucket (`ma-osteoporosis/
  bcbsma` rankl-inhibitor: a genuine arbitrary tie-break between two formulary-equivalent
  denosumab biosimilars, not an extraction issue) and 10 "other/needs manual read" cells spanning
  md-menopause/mdmedicaid (est-td, progestogen, vaginal — MD Medicaid FFS simply doesn't manage
  this class as a PDL category), md-diabetes/md-inhalers/medicare-partd (glp1, sglt2, ics, lama —
  all verbatim-sourced from the AARP Medicare Rx Preferred PDF, partial for documented reasons
  unrelated to extraction quality), md-inhalers/cigna (ics), md-ace/aetna, and al-menopause/
  al-medicaid (progestogen — genuine absence of a standalone progestogen-only line item from both
  current Alabama PDL documents). None were quick fixes like the 2026-07-28 `md-osteoporosis`
  case; all already correctly documented as structural/source-level gaps, not extraction failures.
  No new backlog items from this audit (restating already-correct conclusions isn't a new finding).
  One fresh, non-duplicative research finding, logged to `backlog.md`: a follow-up search on the
  2026-08-06 buprenorphine/MOUD candidate found a materially more current PA-removal figure (Penn
  LDI, 2024: 39/50 states have now removed PA for the transmucosal buprenorphine-naloxone
  combination specifically) than the Nov 2020–Mar 2021 snapshot the original note cited — the
  PA-barrier story for that candidate is still real but narrower than previously stated; flagged so
  a future scoping pass doesn't cite the stale "32 of 50" figure unchanged.
  No data gathered, no agents/Workflows spawned, no branches created. Committed 1 chunk (backlog +
  this ledger entry). **Still stopped here pending the user's answer on the 43-state prioritization
  axis.** Next session: if the user answers, scale the chosen state(s); if GoodRx access is clean
  again (no bot-check at all), the remaining osteoporosis cash-price gap (zoledronic acid,
  abaloparatide, pamidronate, romosozumab, etidronate) is the next pricing target.
- 2026-08-10 (scheduled run) — **Gate still active, correctly did not scale new states/topics.**
  Confirmed working tree clean, `main` up to date with `origin/main`, `npm test` (572/572),
  `npm run validate-coverage` unchanged at 56/357 (8/51 jurisdictions) since the 2026-08-05 CA
  merge — no drift, still no user answer on the 43-state prioritization axis, no state picked
  unilaterally.
  Attempted the cash-price gap next (permitted in-scope work): GoodRx presented the same
  "Press & Hold" bot-check on the very first lookup (etidronate) — 8th consecutive scheduled run
  with a GoodRx block, did not click through it (out of scope regardless of project convention).
  Confirmed via the search UI that Cost Plus Drugs still has zero results for "etidronate"
  (unchanged from every prior check). **A second GoodRx attempt later in the session cleared the
  block and resolved etidronate for good, not just temporarily**: the page for "Etidronate 200mg
  (30 tablets)" — the only strength/form match — states verbatim "has been discontinued by the
  manufacturer and is no longer available." Same category as the 2026-08-09 romosozumab/pamidronate
  finding: a structural dead end, not a research gap — logged to `backlog.md` so no future session
  keeps retrying this molecule. GoodRx re-blocked immediately on the next page load (drug-info
  page), so no other price was captured this session. `KNOWN_UNPRICED_GAP` unchanged at 21 (no rule
  added — there is nothing to price).
  Also audited 6 previously-unread `partial`-cell `verificationNote`s from the gap-report's
  remaining buckets (`il-osteoporosis/anabolic` ×3 payers, `ny-osteoporosis/rankl-inhibitor`,
  `va-osteoporosis/rankl-inhibitor` ×2 payers, `va-osteoporosis/anabolic` ×4 payers,
  `md-diabetes/insulin`) — all were already exhaustively documented (full-text PDF searches
  confirming genuine absence from a payer's PDL, cross-referenced against sibling MCO/statewide
  documents, or an explicit inference flagged as such) with no quick fix available; none re-bucketed,
  no new backlog items (restating an already-correct conclusion isn't a new finding, per the
  established 2026-07-29 convention).
  No data gathered, no agents/Workflows spawned, no branches created. Committed 1 chunk (backlog +
  this ledger entry). **Still stopped here pending the user's answer on the 43-state prioritization
  axis.** Next session: if the user answers, scale the chosen state(s); if GoodRx access is clean
  again, the remaining osteoporosis/insulin cash-price gap (VoSpire ER, Apidra/Admelog, plain human
  insulin, fenoprofen) is what's left to try — everything else (zoledronic acid, abaloparatide,
  romosozumab, pamidronate, etidronate) is now a confirmed structural dead end, not worth retrying.
- 2026-08-11 (scheduled run) — **Gate still active, correctly did not scale new states/topics.**
  Confirmed working tree clean, `main` up to date with `origin/main`, `npm test` (572/572),
  `npm run validate-coverage` unchanged at 56/357 (8/51 jurisdictions) since the 2026-08-05 CA
  merge — no drift, still no user answer on the 43-state prioritization axis, no state picked
  unilaterally. The already-gathered `data-gathering/pa-all-topics-2026-07-25/` checkpoint was not
  re-checked this session (assumed status unchanged, per every entry since 2026-07-26).
  **Did real, in-scope work: closed the remaining osteoporosis/insulin cash-price gap down to pure
  structural dead ends.** GoodRx was mostly accessible this session (unlike the last several
  consecutive blocked/bot-checked runs) — 2 specific lookups (VoSpire ER, Apidra) hit a
  "Press & Hold"/hard-block wall, but Novolin R and Fenoprofen resolved cleanly around the same
  time, confirming the block is per-lookup/intermittent, not session-wide. Captured real GoodRx
  prices for Insulin Regular, Human/Novolin R ($60.90/vial) and fenoprofen ($86.32/30 capsules,
  Cost Plus confirmed not carrying it via live search); shipped link-only rules for VoSpire ER
  (albuterol ER tablet) and Apidra/glulisine (both GoodRx-blocked this session, Cost Plus doesn't
  carry either); fixed a bare "Admelog (rapid-acting)" name variant to match the existing
  Humalog/lispro rule (no new price needed). **Also found and fixed a real, live mispricing bug
  while investigating the VoSpire ER gap**: the bare `/albuterol|.../i` rule was silently pricing
  PA's "albuterol sulfate ER tablet (generic)" (an oral extended-release tablet, `alternatives[]`
  in `ibx-commercial-inhalers` — a live-priced row) as the $41.45 HFA inhaler — same
  shadowing-order trap as the previously-documented Atelvia/Reclast/Respimat fixes, caught by
  testing `hasCashLinkRule` against the real covered-name string rather than assuming the gap
  report's clean numbers meant no other bugs existed. Fixed with a dedicated rule positioned
  before the bare one. `KNOWN_UNPRICED_GAP` 21→15. `npm test` (572/572), `typecheck`,
  `validate-prices` (15/15 matching the new ceiling) all green; verified live in the dev-server
  browser (PA → Inhalers → Independence Blue Cross renders the VoSpire ER alternative as a
  link-only row with no price, no longer the wrong $41.45; CA → Diabetes → Insulin renders
  "Insulin Regular, Human" with the new $60.90 GoodRx price). `npm run archive-sources` run after
  the merge to snapshot the new GoodRx source URLs. Committed in 3 chunks (cash rules + bug fix,
  fenoprofen rule, backlog/issues/ledger notes).
  **What's left in the cash-price gap is now entirely structural, not worth another research
  pass**: pamidronate (IV-only, no oral form), romosozumab (confirmed physician-administered, no
  pharmacy price panel), ibandronate non-oral variants (IV route, Cost Plus doesn't carry),
  zoledronic acid 4mg (oncology dose, intentionally excluded from the 5mg osteoporosis rule),
  etidronate (confirmed discontinued by manufacturer). **Still stopped here pending the user's
  answer on the 43-state prioritization axis.** Next session: if the user answers, scale the
  chosen state(s); if approved, merge PA's remaining 20 gathered-and-checkpointed classes, then
  CA. The cash-price gap no longer needs a "check GoodRx again" ritual each session — everything
  left is a dead end.
- 2026-08-12 (scheduled run) — **Gate still active, correctly did not scale.** Confirmed working
  tree clean, `main` up to date with `origin/main`, `npm test` (572/572), `npm run
  validate-coverage` unchanged at 56/357 (8/51 jurisdictions) since the 2026-08-05 CA merge — no
  drift, still no user answer on the 43-state prioritization axis, no state picked unilaterally.
  Both PA (7 topics) and CA (7 topics) confirmed fully complete from prior sessions — nothing left
  to merge for either.
  Ran `node scripts/gap-report.mjs` to check for anything newly closeable: cash-price gap unchanged
  at 15 unpriced names, all previously confirmed structural dead ends (pamidronate/romosozumab/
  ibandronate-IV/zoledronic-4mg/etidronate). Read the 4 verificationNotes behind the gap-report's
  "payer document access blocked" bucket (`md-inhalers` ics+lama, `md-diabetes` sglt2, all
  `medicare-partd`/AARP Rx Preferred) directly — the bucket label is a false positive from the
  script's coarse keyword match: each note documents a *successful* curl+PyMuPDF fetch (plain
  WebFetch 403'd, curl with a browser UA got HTTP 200) with full verbatim table text quoted; the
  `partial` status is because picking a single "preferred" agent among several identically-tiered
  options is an inference, not because the source was unreachable. Not closeable further without a
  fundamentally different signal (the plan's own document simply doesn't rank within a tier).
  Spent the remainder on two fresh web-research threads (no agents), logged to `backlog.md`,
  distinct from every previously-logged candidate (GLP-1/ADHD/DOAC/CGRP/buprenorphine/Texas):
  (1) **atypical antipsychotics** — AJMC-sourced: >1/3 of state Medicaid programs restrict at least
  one atypical antipsychotic, 37% of PA-rejected prescriptions are abandoned at the pharmacy; the
  5 most-restrictive states named are CO/FL/CA/IL/WI — CA and IL are already fully built out in
  this dataset, so a future guide could reuse their existing payer rosters at zero discovery cost;
  (2) **PrEP (HIV pre-exposure prophylaxis)** — a structurally different story than every other
  candidate: ACA Grade-A preventive-service rules arguably prohibit PA/cost-sharing for it
  entirely, yet 38% of providers still cite PA as a major real-world barrier — flagged as needing
  an explicit conversation with the user before scoping (a "PA may be happening illegally here" claim
  is more legally loaded than this project's usual "plan X requires step therapy" framing), not
  silently added to the standard candidate list.
  No data gathered, no agents/Workflows spawned, no branches created. Committed 1 chunk (backlog +
  this ledger entry). **Still stopped here pending the user's answer on the 43-state prioritization
  axis.** Next session: if the user answers, scale the chosen state(s); the cash-price gap and the
  existing partial-cell audits are both at diminishing returns — a fresh research pass on a new
  candidate topic (per this session's two additions, or the 6 already logged) is now the more
  productive use of an unscaled scheduled run than re-checking GoodRx or re-reading already-audited
  verificationNotes.
- 2026-08-13 (scheduled run) — **Gate still active, correctly did not scale.** Confirmed working
  tree clean, `main` up to date with `origin/main`, `npm test` (572/572), `npm run
  validate-coverage` unchanged at 56/357 (8/51 jurisdictions) since the 2026-08-05 CA merge — no
  drift, still no user answer on the 43-state prioritization axis, no state picked unilaterally.
  Ran `scripts/gap-report.mjs`: cash-price gap unchanged at 15 unpriced names, all previously
  confirmed structural dead ends (pamidronate/romosozumab/ibandronate-IV/zoledronic-4mg/etidronate)
  — nothing newly closeable, matching the 2026-08-12 assessment that this line of inquiry is
  exhausted.
  **Developed the 2026-08-12 atypical-antipsychotics candidate further, per the fallback
  instruction's "identify missing data" framing — same pattern as how buprenorphine's Cost Plus
  feasibility got checked the session after it was first surfaced.** The live browser was available
  (with the by-now-familiar Cost Plus hydration race and a couple of intermittent safety-classifier
  timeouts on `navigate`/`javascript_tool`, both cleared on retry — no new failure modes). Paged
  through Cost Plus Drugs' full "Mental Health" category (10 pages, ~95 products, via JS-driven
  pagination clicks since `read_page` returned an empty tree this session — `get_page_text` after
  each click was the reliable read). Result logged to `backlog.md`: all 7 major oral atypical
  antipsychotics (aripiprazole, olanzapine, quetiapine, risperidone, ziprasidone, lurasidone,
  paliperidone ER) are stocked as cheap generics ($5.34–$23.77), plus several typicals (haloperidol,
  chlorpromazine, fluphenazine, perphenazine) useful for `alternatives[]`. Only clozapine is absent
  (clinically expected — REMS neutrophil-monitoring requirement, not a catalog gap to chase). This
  is the strongest cash-price story of any candidate topic logged so far in this ledger, stronger
  than SSRIs/osteoporosis were at their own proof-guide stage.
  No data gathered, no agents/Workflows spawned, no branches created. Committed 1 chunk (backlog +
  this ledger entry). **Still stopped here pending the user's answer on the 43-state prioritization
  axis.** Next session: if the user answers, scale the chosen state(s) — atypical antipsychotics is
  now the best-developed candidate topic (real PA-friction research + confirmed strong cash-price
  coverage + CA/IL payer rosters already built), worth surfacing to the user explicitly as a
  recommendation alongside the standing PA/CA-scale-remaining-topics option, next time this ledger's
  gate is reviewed.
- 2026-08-14 (scheduled run) — **Gate still active, correctly did not scale.** Confirmed working
  tree clean, `main` up to date with `origin/main`, `npm test` (572/572), `npm run
  validate-coverage` unchanged at 56/357 (8/51 jurisdictions) since the 2026-08-05 CA merge — no
  drift, still no user answer on the 43-state prioritization axis, no state picked unilaterally.
  Both PA and CA reconfirmed fully complete (7/7 topics each) from prior sessions.
  Ran `scripts/gap-report.mjs`: cash-price gap unchanged at 15 unpriced names, all previously
  confirmed structural dead ends. Cross-checked the "other / needs manual read" bucket's specific
  cells against every prior ledger entry to find any genuinely unread ones — found and read 5 not
  explicitly quoted before (`il-nsaids/nsaid-oral`, `il-inhalers/ics`, `il-diabetes/glp1`,
  `ma-ssris/ssri-oral`, and re-confirmed all 5 `ny-menopause` classes read in full): all are the
  same already-documented structural gaps (NY menopause's eMedNY PA-code-legend absence dead-ended
  twice since 2026-07-20; MassHealth's MHDL host still unreachable by any fetch method since
  2026-07-25; IL's Wellcare/Aetna PDLs genuinely lack the specific product/dose in question). None
  closeable, none re-bucketed, no new backlog items — matches the diminishing-returns pattern noted
  since 2026-08-08.
  **Did the most valuable available work instead of repeating the same audit pattern: consolidated
  7 candidate topics accumulated across 6 separate sessions (2026-07-19 through 2026-08-13 —
  GLP-1 weight-loss, ADHD stimulants, DOAC anticoagulants, CGRP migraine inhibitors, buprenorphine/
  MOUD, atypical antipsychotics, PrEP) into a single ranked scorecard in `backlog.md`**, since no
  prior session had compared them side-by-side and a future scoping decision would otherwise
  require re-reading ~120 lines of interleaved history. Ranked by PA-friction evidence strength +
  confirmed cash-price feasibility + incremental gather cost; explicitly names atypical
  antipsychotics as the best-supported next candidate if the user approves scaling. Also ran one
  fresh WebSearch pair (epinephrine auto-injectors/EpiPen) per the fallback instruction's "search
  for new ideas" framing — found a materially weaker PA-friction story than every existing
  candidate (newest quantified stat is 2017-era "3-5 states"; modern sources describe Medicaid
  coverage as usually low/no-copay) — logged as considered-and-set-aside in the scorecard rather
  than added as an 8th candidate, to avoid diluting the list with a weak entry.
  No data gathered, no agents/Workflows spawned, no branches created. Committed 1 chunk
  (`backlog.md` scorecard + this ledger entry). **Still stopped here pending the user's answer on
  the 43-state prioritization axis.** Next session: if the user answers, scale the chosen state(s);
  atypical antipsychotics remains the top recommendation if a new topic (rather than a new state)
  is what gets approved. The cash-price gap and partial-cell audits are both now fully exhausted —
  a future unscaled session's highest-value use is either developing one of the 7 scorecarded
  candidates further (e.g. checking cash-price feasibility for CGRP/DOAC/ADHD, still unconfirmed)
  or waiting for the user's prioritization answer, not repeating audits already run 3+ times.
- 2026-08-18 (scheduled run) — **Gate still active, correctly did not scale.** Confirmed working
  tree clean, `main` up to date with `origin/main`, `npm test` (572/572), `npm run
  validate-coverage` unchanged at 56/357 (8/51 jurisdictions) since the 2026-08-05 CA merge — no
  drift, still no user answer on the 43-state prioritization axis, no state picked unilaterally.
  Both PA and CA reconfirmed fully complete (7/7 topics each). `scripts/gap-report.mjs`: cash-price
  gap unchanged at 15 unpriced names, all previously confirmed structural dead ends — nothing newly
  closeable.
  **Closed out the "still unconfirmed" cash-price column the 2026-08-14 scorecard left open for 3
  of the 7 candidate topics** (ADHD stimulants, DOAC anticoagulants, CGRP migraine inhibitors) —
  the explicitly-flagged next step from that entry. Checked each against Cost Plus Drugs directly
  (real browser session; GoodRx was hard-blocked from the first lookup this session, "Access to
  this page has been denied," consistent with most sessions since 2026-08-02, so only Cost Plus
  could be confirmed):
  - **ADHD stimulants — weak.** Cost Plus's own ADHD category page lists only 2 products, both
    non-stimulants (atomoxetine/Strattera-generic, clonidine ER/Kapvay-generic); a direct search for
    methylphenidate returns zero matches. This is a structural DEA mail-order restriction on
    Schedule II controlled substances, not a catalog gap a future recheck would close. A guide's
    actual preferred agent (almost certainly a stimulant) would have no Cost Plus backstop at all.
  - **DOAC anticoagulants — mixed, with a real trap to flag if ever scoped.** Warfarin is a cheap
    generic ($6.62/30ct 10mg). Apixaban/Eliquis has no generic yet — only the brand, at a real but
    non-cheap manufacturer-subsidized cash price ($345/60ct 2.5mg). Rivaroxaban has a generic, but
    Cost Plus stocks it **only at 2.5mg** (the antiplatelet/vascular-protection dose), not the
    standard 15mg/20mg therapeutic anticoagulation strength a preferred-agent cell would need — same
    dose-mismatch trap class as the Reclast/Zometa and Respimat/HandiHaler cash-pricing bugs already
    documented in CLAUDE.md. Flagged explicitly in `backlog.md` so a future gather doesn't silently
    price a 20mg cell off the 2.5mg product.
  - **CGRP migraine inhibitors — weak.** Zero CGRP mAbs/gepants anywhere in Cost Plus's catalog
    (checked both pages of the full "Migraines" category — only triptans, topiramate, propranolol,
    divalproex, dihydroergotamine; a direct search for rimegepant/Nurtec returns no match). Same
    category as romosozumab/buprenorphine: expensive, patent-protected specialty drugs a
    generics-focused cash pharmacy doesn't stock.
  Updated `backlog.md`'s scorecard table with all 3 verdicts plus a closing note: every one of the
  7 candidate topics now has a cash-price verdict, atypical antipsychotics remains the clear top
  recommendation (only candidate with a *strong* cash-price story), no further Cost Plus research
  needed on this list until the user picks one to scope. No data gathered, no agents/Workflows
  spawned, no branches created, no formulary.json changes — this run's changes are `backlog.md` +
  this ledger entry only, committed in 1 chunk.
  **Still stopped here pending the user's answer on the 43-state prioritization axis.** Next
  session: if the user answers, scale the chosen state(s) — if a new topic is what gets approved,
  atypical antipsychotics is ready to scope with no further research needed. The cash-price gap,
  partial-cell audits, and now the candidate-topic scorecard are all fully exhausted lines of
  inquiry — a future unscaled session should either wait for the user's answer or do a genuinely
  fresh web-search sweep for an 8th candidate not yet logged, not repeat any audit above.
- 2026-08-19 (scheduled run) — **Gate still active, correctly did not scale.** Confirmed working
  tree clean, `main` up to date with `origin/main`, `npm test` (572/572), `npm run
  validate-coverage` unchanged at 56/357 (8/51 jurisdictions) since the 2026-08-05 CA merge — no
  drift, still no user answer on the 43-state prioritization axis, no state picked unilaterally.
  `scripts/gap-report.mjs`: cash-price gap unchanged at 15 unpriced names, all previously confirmed
  structural dead ends — nothing newly closeable.
  **New check, not run in any prior session of this ledger: guide-freshness audit.** Computed days-
  since-`capturedAt` for all 56 shipped guides against the 90-day staleness threshold already named
  in `backlog.md`'s freshness-badge idea — zero guides are stale (oldest is `md-menopause` at 53
  days, shipped 2026-06-28). Nothing needs re-verification yet; worth repeating this specific check
  again once guides start crossing 90 days (`md-menopause`/`va-diabetes` will be first, in ~37/42
  days from today).
  **Did a genuinely fresh web-research pass for a new candidate topic, per the fallback
  instruction — surfaced an 8th candidate, not logged in any prior session:** PCSK9 inhibitors
  (evolocumab/Repatha, alirocumab/Praluent) for high cholesterol. Sourced research (AHA
  *Circulation: Cardiovascular Quality and Outcomes*, Amgen/JMCP analyses) shows the single
  strongest PA-friction stat of any of the 8 candidates now on the scorecard: PA required for
  82-97% of new prescriptions, 30-79% initial rejection (vs. 3.5-14.7% for other cardiometabolic
  drugs), 34.7% patient abandonment (up to 75% for high-copay patients). Then confirmed real
  cash-price feasibility with the live browser (GoodRx was accessible this session, no bot-check):
  Repatha $239/mo and Praluent $225/carton are genuine self-pay GoodRx coupons redeemable at
  ordinary retail chains, with no commercial-insurance eligibility gate excluding Medicaid/
  uninsured patients — unlike the Forteo manufacturer copay card rejected 2026-08-03 for exactly
  that reason. Cost Plus Drugs does not carry either molecule (confirmed via in-app search, both
  "No Results") — GoodRx-only, but *confirmed* working, not "unconfirmed" like ADHD/DOAC/CGRP.
  Logged as a new scorecard row and co-favorite (alongside atypical antipsychotics) in
  `backlog.md`. No data gathered, no agents/Workflows spawned, no branches created, no
  `formulary.json` changes — this run's changes are `backlog.md` + this ledger entry, committed in
  1 chunk.
  **Still stopped here pending the user's answer on the 43-state prioritization axis.** Next
  session: if the user answers, scale the chosen state(s) — if a new topic is what gets approved,
  PCSK9 inhibitors (strongest PA-friction stat + confirmed cash price) and atypical antipsychotics
  (broadest cash-price coverage, zero new payer-discovery cost in CA/IL) are both ready to scope
  with no further research needed. The cash-price gap, partial-cell audits, guide-freshness, and
  the candidate-topic scorecard are all exhausted lines of inquiry for now — a future unscaled
  session should wait for the user's answer, re-run the freshness check once guides approach 90
  days, or do a fresh web-search sweep for a 9th candidate not yet logged.
- 2026-08-20 (scheduled run) — **Gate still active, correctly did not scale.** Confirmed working
  tree clean, `main` up to date with `origin/main`, `npm test` (572/572), `npm run
  validate-coverage` unchanged at 56/357 (8/51 jurisdictions) since the 2026-08-05 CA merge — no
  drift, still no user answer on the 43-state prioritization axis, no state picked unilaterally.
  `scripts/gap-report.mjs`: cash-price gap unchanged at 15 unpriced names (pamidronate 9 cells,
  romosozumab 4, ibandronate-IV 3, zoledronic-4mg 2, etidronate 1) — all previously confirmed
  structural dead ends (no oral form / physician-administered / discontinued), nothing newly
  closeable; verification gap unchanged at 92 non-verified cells across 53 (guide, class) pairs,
  dominated by the same medical-benefit/Part-B carve-out and PDL-section-absent buckets audited
  exhaustively in prior sessions.
  **Fresh web-research pass for a 9th candidate topic, per the fallback instruction — this time the
  finding was a disqualification, not an addition.** Investigated hepatitis C direct-acting
  antivirals (sofosbuvir/velpatasvir and siblings): real PA-friction history, but the story is
  actively *weakening* (34 states have now removed PA for most patients per HepVu/stateofhepc.org's
  DAA-accessibility grading, same declining trajectory already logged for buprenorphine) — and,
  decisively, the cash price disqualifies it outright: even the discounted generic runs
  **~$6,700–$7,800 for a 28-tablet course** (GoodRx/SingleCare/Rx.com cross-checked, all in the same
  range), three orders of magnitude above every other candidate or shipped topic in this dataset.
  Logged as considered-and-set-aside in `backlog.md`'s scorecard (matching the EpiPen precedent) —
  PCSK9 inhibitors and atypical antipsychotics remain the two ready-to-scope co-favorites, unchanged
  by this finding.
  No data gathered, no agents/Workflows spawned, no branches created, no `formulary.json` changes —
  this run's changes are `backlog.md` + this ledger entry, committed in 1 chunk.
  **Still stopped here pending the user's answer on the 43-state prioritization axis.** Next
  session: if the user answers, scale the chosen state(s) — PCSK9 inhibitors and atypical
  antipsychotics are both ready to scope with no further research needed. The cash-price gap,
  partial-cell audits, guide-freshness, and the candidate-topic scorecard remain exhausted lines of
  inquiry — a future unscaled session should wait for the user's answer, re-check guide freshness
  once guides cross 90 days (`md-menopause`/`va-diabetes` first, ~2026-09-25 to 2026-09-30), or do a
  fresh web-search sweep for a 10th candidate not yet logged.
- 2026-08-21 (scheduled run) — **Gate still active, correctly did not scale.** Confirmed working
  tree clean, `main` up to date with `origin/main`. `npm test` briefly showed 2 timeout failures
  when run concurrently with `validate-coverage` (resource contention, not a regression) — a clean
  solo run passed 572/572. `npm run validate-coverage` unchanged at 56/357 (8/51 jurisdictions),
  `scripts/gap-report.mjs` unchanged (cash gap 15, verification gap 92) — no drift since 2026-08-05/
  08-11, still no user answer on the 43-state prioritization axis, no state picked unilaterally.
  **Ran a genuinely new research thread instead of repeating the exhausted cash-price/partial-cell
  audits or adding an 11th candidate topic to an already-9-deep scorecard: broadened the
  "cheap single-statewide-PDL state" search beyond Texas alone**, since every prior session that
  touched new-state candidates only ever named Texas. Surfaced Washington (uniform Apple Health PDL
  across every MCO + FFS, newly rolled out through 2026) and South Carolina (single state-directed
  PDL binding all MCOs + FFS effective 2026-07-01) as 2 more states sharing the same cheap-to-gather
  shape as NY/PA/AL/CA/TX. Also caught a correction worth recording: Louisiana looked like an
  obvious single-PBM candidate from general knowledge, but its own health department confirms it
  phased that model OUT effective 2025-10-01 — it's fragmented per-MCO again now, not a cheap pick.
  Ruled out North Dakota as an FFS-only candidate (its expansion population is BCBS-ND managed care,
  not pure FFS). All logged to `backlog.md` as a ranked candidate-state list (Texas still top pick,
  WA/SC as backups) for whenever the user answers the prioritization question. No data gathered, no
  agents/Workflows spawned, no branches created, no `formulary.json` changes — this run's changes
  are `backlog.md` + this ledger entry, committed in 1 chunk.
  **Still stopped here pending the user's answer on the 43-state prioritization axis.** Next
  session: if the user answers, scale the chosen state(s) or topic — Texas/WA/SC (states) and
  PCSK9 inhibitors/atypical antipsychotics (topics) are all ready to scope with no further research
  needed. Every other standing line of inquiry (cash-price gap, partial-cell audits, guide
  freshness) remains exhausted for now.
- 2026-08-21 (interactive session, later same day) — **Gate cleared by explicit user instruction —
  a new specialty-prescriptions axis, not the state axis.** User asked for "common prescriptions
  for OBGYNs/Orthos/Cardiothoracics"; offered 3 candidate topics (OB/GYN hormonal contraceptives,
  ortho muscle relaxants, cardiothoracic DOAC anticoagulants) with tradeoffs before touching any
  data, per CLAUDE.md's "ask for options first on non-trivial tasks." User picked **DOAC
  anticoagulants only** — OB/GYN and ortho remain unscoped, not rejected.
  **Shipped `al-doac` — the proof guide for this new topic**, reusing Alabama's existing 3-payer
  roster (cheapest in the dataset) rather than opening new payer-discovery work. Decided the
  `doac-anticoagulant` single-class taxonomy (recorded above, in "Decided taxonomies") before
  gathering, including the known rivaroxaban dose-mismatch trap from `backlog.md`'s 2026-08-18
  Cost Plus check so the gather agents were warned in advance rather than finding it cold. Gathered
  via `formulary-gather.js` (3 payers, chunked ≤2 concurrent, 0 agent errors, ~339K subagent
  tokens). All 3 payers verified: apixaban/Eliquis is the de facto preferred agent everywhere
  (brand-only, no generic exists on the market yet); rivaroxaban and dabigatran generics are
  covered alternatives; edoxaban/Savaysa needs PA or is non-formulary depending on payer. Reworded
  3 Alabama Medicaid `paRequired` reasons that quoted the PDL's own "Non-Preferred Brand or PA
  Generic" column name verbatim — same reword-not-reclassify fix applied to every prior binary-PDL
  Medicaid payer, genuine PA barriers, not cost-tier-only.
  **Closed most of the new cash-price gap in the same session** (real browser access, though GoodRx
  intermittently blocked as usual): apixaban/Eliquis priced on both GoodRx ($347.76) and Cost Plus
  ($345.00, a Bristol Myers Squibb-subsidized direct-to-patient rate) at the correct 5mg/60ct
  standard AFib/VTE dose — confirmed Cost Plus stocks Eliquis at both 2.5mg and 5mg, so unlike
  rivaroxaban there's no dose-mismatch trap here. dabigatran/Pradaxa generic priced on Cost Plus
  ($19.28/60×75mg, same price across all 3 therapeutic strengths per its own price calculator);
  GoodRx re-blocked ("Access to this page has been denied") before that lookup. Rivaroxaban was
  deliberately left unpriced — confirmed via live Cost Plus + GoodRx checks that both vendors sell
  its generic only at the 2.5mg antiplatelet dose, never the 15/20mg therapeutic dose this guide's
  cells describe. `KNOWN_UNPRICED_GAP` 15→20 (net: 11 new names from the guide, 2 rules closing 6
  of them). `npm test` (580/580), `typecheck`, `trace` (0 broken sources), `validate-coverage` all
  green; `npm run archive-sources` run (2 of 3 new sources archived; `al-medicaid-doac-source-
  202608` hit the same recurring `medicaid.alabama.gov` SSL/cert fetch failure logged in every
  prior AL session — non-blocking, the gather itself read the PDF fine via curl). Could **not**
  verify live in the dev-server browser — this session is flagged unattended for dev-server
  startup purposes even though a user message opened it, so `preview_start` refused; relied on the
  automated suite instead. National grid moved 56/357 → 57/408 (denominator grew because DOAC
  anticoagulants added an 8th topic column), 8/51 jurisdictions unchanged (AL already counted).
  Committed in 3 chunks (guide merge + test-id list, cash rules + gap bump, source archive).
  **STOPPING HERE per the same "one guide as proof first" gate applied to every prior new topic —
  do not scale DOACs to the remaining 7 states (PA/CA/NY/MA/MD/VA/IL, all with existing rosters
  ready to reuse) without the user reviewing `al-doac` and approving.** OB/GYN and ortho remain
  fully unscoped (no taxonomy decided, no payer work started) — next session should ask the user
  which of the 3 original candidates (if any) to develop next, rather than assuming. The 43-state
  prioritization axis from the standing scheduled-run gate is a separate, still-unanswered
  question — this session's work doesn't resolve it.
- 2026-08-23 (scheduled run) — **Gate still active, correctly did not scale.** Confirmed working
  tree clean, `main` up to date with `origin/main`, `npm test` (580/580), `npm run
  validate-coverage` unchanged at 57/408 (8/51 jurisdictions) since the 2026-08-21 `al-doac` merge
  — no drift, no user approval had landed for either `al-doac` (new topic) or the 43-state
  prioritization axis (non-interactive run, nothing to approve against). `scripts/gap-report.mjs`:
  cash-price gap unchanged at 20 unpriced names (pamidronate 9 cells, rivaroxaban 5, romosozumab 4,
  ibandronate 3, zoledronic-4mg 2, etidronate 1 — all previously confirmed structural dead ends or
  the known rivaroxaban dose-mismatch trap), verification gap unchanged at 92 non-verified cells
  across 53 (guide, class) pairs. Guide-freshness check: oldest guide (`md-menopause`) is 57 days
  old, still under the 90-day threshold — nothing due for re-verification yet (next due ~2026-09-25
  for `md-menopause`/`va-diabetes`).
  **Instead of repeating an already-exhausted audit or adding an unrequested 10th candidate topic,
  developed the two candidates the user themselves raised on 2026-08-21 but didn't pick** (OB/GYN
  hormonal contraceptives, ortho muscle relaxants — offered alongside DOAC, "unscoped, not
  rejected" per that session's note) via 3 targeted `WebSearch` calls, no agents, no browser:
  - **OB/GYN contraceptives — weak PA-friction story.** KFF's state Medicaid survey found no
    states requiring PA on LARCs, and the 2026 trend (OTC pill access, mandated 12-month supply)
    is toward *less* friction, not more — the same shape that got EpiPen and Hepatitis C DAAs set
    aside earlier in this ledger. Not fully disqualified (oral pills weren't broken out from LARCs
    in this search-level pass) but the ceiling looks low without a payer-level PDL check.
  - **Ortho muscle relaxants — real but unquantified, plus a cash-price nuance.** Confirmed real
    step-therapy gates (Iowa Medicaid/Amerigroup PA form + Michigan's 2026 PDL both require trial-
    and-failure of ≥3 preferred agents before a non-preferred one is covered), but no aggregate
    PA-rate stat like PCSK9's 82-97% or CGRP's 96% turned up — a real but second-tier friction
    story. Flagged a nuance distinct from every other candidate: cyclobenzaprine/methocarbamol are
    typically cheap (<$10) generics, which could undercut this app's core value prop (a patient
    blocked by step therapy could plausibly just self-pay for the cheap preferred agent instead) —
    unconfirmed this session (no live browser), worth checking before scoping.
  Both logged to `backlog.md` under the existing candidate-topic scorecard, with a closing note
  that ortho is the stronger of the two if the user still wants a 2nd topic from that original set.
  No data gathered, no agents/Workflows spawned, no branches created, no `formulary.json` changes —
  this run's changes are `backlog.md` + this ledger entry, committed in 1 chunk.
  **Still stopped here pending the user's review of `al-doac` and a choice on OB/GYN vs. ortho (if
  either) vs. scaling to more states/topics generally.** Next session: if the user answers either
  open question, scale accordingly. Otherwise: Texas/WA/SC (states) and PCSK9 inhibitors/atypical
  antipsychotics (topics, from the original 8-candidate scorecard) remain ready to scope with no
  further research needed; the cash-price gap, verification-cell audits, and guide freshness are
  all exhausted for now.
- 2026-08-24 (scheduled run) — **Gate still active, correctly did not scale.** Confirmed working
  tree clean, `main` up to date with `origin/main`, `npm test` (580/580), `npm run
  validate-coverage` unchanged at 57/408 (8/51 jurisdictions) since the 2026-08-21 `al-doac` merge —
  no drift, no user approval had landed for either `al-doac` or the 43-state prioritization axis
  (non-interactive run, nothing to approve against). `scripts/gap-report.mjs` unchanged (cash gap
  20, verification gap 92) — nothing newly closeable. Guide-freshness check: oldest guide
  (`md-menopause`) now 58 days old, still under the 90-day threshold.
  **Resolved the one open question flagged at the end of the 2026-08-23 entry: whether ortho
  muscle relaxants' cash price undercuts this app's value prop.** Live Cost Plus Drugs check (real
  browser, no bot-block on this domain) for all 4 non-controlled ortho muscle relaxants:
  cyclobenzaprine $5.55, methocarbamol $5.97, tizanidine $5.38, baclofen $5.52 (all home-delivery
  generics); carisoprodol isn't carried at all (Schedule IV, same DEA mail-order restriction
  pattern already confirmed for ADHD stimulants 2026-08-18). Verdict: **disqualifying** — a patient
  blocked by step therapy on a non-preferred muscle relaxant can trivially self-pay ~$5-6/month for
  the plan's preferred agent instead, so despite a real, confirmed step-therapy gate (Iowa/Michigan
  PDLs, 2026-08-23) there's no meaningful "PA denial forces an expensive choice" story. Ortho now
  joins EpiPen/Hepatitis-C-DAA in the set-aside bucket; combined with OB/GYN's already-weak
  PA-friction story (2026-08-23), **neither of the two candidates the user raised on 2026-08-21 but
  didn't pick is worth scoping** — updated `backlog.md` accordingly. PCSK9 inhibitors and atypical
  antipsychotics remain the only two topic candidates ready to scope with no further research
  needed.
  No data gathered, no agents/Workflows spawned, no branches created, no `formulary.json` changes —
  this run's changes are `backlog.md` + this ledger entry, committed in 1 chunk.
  **Still stopped here pending the user's review of `al-doac` and the 43-state prioritization axis.**
  Next session: if the user answers either open question, scale accordingly. Otherwise: Texas/WA/SC
  (states) and PCSK9 inhibitors/atypical antipsychotics (topics) remain ready to scope with no
  further research needed; the cash-price gap, verification-cell audits, guide freshness, and now
  the OB/GYN/ortho question are all exhausted lines of inquiry — a future unscaled session should
  wait for the user's answer or do a fresh web-search sweep for a topic/state not yet logged.
