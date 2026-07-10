# RESUME-EXPANSION.md — resumable playbook for the SSRI/osteoporosis + PA/AL/CA expansion

> Durable, self-contained state so a fresh session (scheduled run or a rate-limit restart) can pick
> up **gracefully** without this conversation. Update the "Progress ledger" at the bottom after
> every chunk so the next run knows exactly where to continue. Created 2026-07-09.

## The ask (user, 2026-07-09)

Two things, in this order of preference the user set:

1. **DONE — cash prices for existing guides.** Every diabetes/NSAID (and straggler) preferred-agent
   cell now has a captured GoodRx/Cost Plus price. Shipped in `src/lib/cash.ts`
   (`KNOWN_UNPRICED_GAP` 1088 → 541; the 541 is purely the alternatives long tail). Not part of the
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

## Progress ledger (update after every chunk)
- 2026-07-09 — Cash-price gap for existing diabetes/NSAID/straggler guides CLOSED (`cash.ts`,
  `KNOWN_UNPRICED_GAP` 1088→541). Backlog scoped. Expansion NOT started. **Next: Step 1 (SSRI +
  osteoporosis taxonomies).**
