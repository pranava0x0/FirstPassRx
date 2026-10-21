# Daily burndown: the 5 PM run

A scheduled session runs this file every day at 17:00 local time in the **main checkout**
(`/Users/pranava/Projects/FirstPassRx`). Read it top to bottom, do one unit from the queue, and
update the ledger at the bottom before stopping. Created 2026-10-21.

## Time box (hard)

- **20 minutes of wall-clock, total.** Note the start time in your first message.
- **At 15 minutes, stop starting new work.** Decide: can the unit in hand reach a green
  `npm test` + commit in the remaining 5? If yes, finish it. If no, write what's done to a
  scratch checkpoint (see "Checkpoints"), log the resume point in the ledger, and stop.
- Never leave `src/data/formulary.json` half-merged. A guide merges whole or not at all
  (`validate()` count-floor: every payer × active class needs a cell).

## Model roles

| Role | Model | Use for | Concurrency |
|---|---|---|---|
| Coordinator | Opus (this session) | pick the unit, merge, test, commit, ledger | 1 |
| Search / extract | Haiku | payer discovery, reading one payer's document for N classes, trend checks | ≤4 at once (`.claude/agent-cap` = 4, set by the user 2026-10-21). Drop to 2 on the first "limiting requests" error |
| Cross-check | Sonnet | one adversarial pass over the merged cells before commit (drug/device sanity, BOGL device match, combo-drug traps; see CLAUDE.md) | 1 |

Inline beats an agent for anything under ~3 tool calls: a grep in `sources/`, one PDF page read.

## Token efficiency: why the queue is state-first

Almost all the cost of a guide is **finding, fetching, and reading each payer's formulary
document**. Extracting one more drug class from a document already open costs very little. A
payer's formulary or a state PDL is **one document for every drug class**.

So:

1. **Work state-major, payer-major.** One agent per payer document, extracting *every* topic
   still missing for that state in one read. Never one agent per (payer, class) cell. This is
   the shape `.claude/workflows/formulary-gather.js` already takes.
2. **Use the local source cache before the network.** `sources/` (committed, deduped by git blob; ~1.1 GB on disk, 426
   documents as of 2026-10-21) holds raw bytes for every cited URL; `sources/manifest.json`
   maps URL → file + sha256. A new topic for a state whose payers are already archived is
   `pypdf` text extraction + a grep on local files (`pdftotext` isn't installed on this machine;
   search brand names too, e.g. ELIQUIS, not just apixaban). No fetch, often no agent at all.
3. **Statewide Medicaid PDLs first.** One PDL covers FFS and (usually) every MCO in the
   state (NY, PA, TX, AL, CA, MA, VA, IL so far). Mining a 150-page PDL by section heading is
   cheap (CLAUDE.md, IL HFS note).
4. **A new topic is cheapest added state by state in states already covered**, because the
   payer roster and documents are known. A brand-new state costs roster discovery plus every
   payer fetch, so do it only when the queue's data items for covered states are done.

## Checkpoints

Gather output goes to `data-gathering/<stamp>/<payer>.json` in the main checkout (gitignored;
survives between runs because this run always uses the main checkout, not a worktree). The
ledger names the stamp so the next run resumes from disk instead of re-gathering.

## Every run, in order

1. `git fetch && git status`. If `main` is behind, `git pull --ff-only`. If there are
   uncommitted changes you didn't make, stop and log it; don't touch them.
2. **One rolling PR, never a new one per run** (user, 2026-10-21: "try not to have so many
   PRs"). `gh pr list --state open --author @me`. If any open PR from this work exists (a
   burndown PR or a manual follow-up branch), check out its branch, `git merge origin/main`,
   and keep stacking on it. Only when none is open: `git checkout -b burndown/rolling`.
3. Read the ledger; take the first unchecked queue item (or resume the in-flight one).
4. Do it. Commit at each green checkpoint.
5. Before stopping: `npm test`, `npm run data:split` if data changed,
   `npm run archive-sources` if new references were added, update the ledger.
6. Push to that one branch. Open a PR only if none exists (title `Daily burndown (rolling)`),
   otherwise update its description with today's ledger line. Do **not** merge; the user reviews. Disclose models in the PR body per `~/Projects/CLAUDE.md` (no AI
   co-author trailers).

## Queue (top = next)

Each item fits roughly one 20-minute run. Bigger items are split.

1. **TX: 7 missing topics from the Texas Vendor Drug Program PDL.** `tx-ssris` exists with 3
   payers (TX Medicaid, BCBS TX commercial, Humana Premier Rx PDP). The TX PDL is one document
   covering every topic (fetch via the real browser, see CLAUDE.md `txvendordrug.com` note).
   **All 3 payer documents are already cached** (`sources/tx-medicaid-ssris-source-2026-08.pdf`,
   `bcbs-tx-commercial-ssris-source-2026-08.pdf`, `humana-premier-rx-pdp-ssris-source-2026-08.pdf`
   — the SSRI-named files are whole formularies), so no fetch or browser is needed.
   Split: run A = TX Medicaid all 7 topics from the PDL (inline); run B = BCBS TX + Humana PDP
   (2 Haiku agents, one per payer document, all 7 topics each); run C = merge 7 guides + Sonnet
   check. Payoff: 1 → 8 TX guides.
2. **New topics to the other 8 states** (ADHD, cholesterol, weight loss, migraine; taxonomy and
   MA proof shipped 2026-10-21 as `ma-adhd`/`ma-lipids`/`ma-weight`/`ma-migraine`). Reuse
   `data-gathering/ma-new4-2026-10-21/taxonomy.json` + `BRIEF.md` (copy to a new stamp dir),
   one Haiku agent per payer document (all 11 classes in one read), Sonnet cross-check, then
   `node scripts/merge-gather.mjs --dir=… --state=XX --payers-from=<xx-ssris>`. One state per
   run; cached `sources/` PDFs first. MA took ~5 agent runs + 1 check.
   Then capture cash prices for each new guide's preferred agents (browser; `KNOWN_UNPRICED_GAP`
   jumped 60 → 233 with MA).
   Original item: **ADHD stimulants as a new topic (trend pick #1 among cheap generics).** Classes:
   methylphenidate (IR/ER), amphetamine salts (IR/ER), lisdexamfetamine, non-stimulants
   (atomoxetine, guanfacine ER, viloxazine). Author the class taxonomy once, then go state by
   state from cached `sources/` documents, MA first (5 payers), then NY, MD, VA, IL, PA, AL,
   CA, TX. One state per run.
3. *(Folded into #2 on 2026-10-21: statins/PCSK9, GLP-1 weight loss, and CGRP migraine shipped
   as the `lipids`, `weight`, and `migraine` topics.)*
4. **PA criteria + send-to, one state per run** (schema shipped 2026-10-21; MA inhalers done).
   For each payer: `paSubmission` (fax/phone/portal/ePA) from its PA form or provider page, and
   for each `paRequired` item, `criteria` + `criteriaMode` from the payer's PA policy, verbatim
   in substance, each with source ids. Medicaid first: one statewide PA criteria document covers
   every class (e.g. MassHealth's MHDL tables, PA DHS's PDL clinical criteria). Verify every
   number and criterion against the cached PDF text (pypdf) before merging; drop anything the
   document doesn't say (the 2026-10-21 run dropped an unverified "CoverMyMeds" for MGB).
5. **Partial → verified upgrades:** `il-osteoporosis` (13 partial), `ny-osteoporosis` (6),
   `ny-menopause` (5 example). Re-read the payer's own document; cache first.
6. **Cash-price gaps** (`KNOWN_UNPRICED_GAP`): needs the real browser (GoodRx/Cost Plus
   block fetch). Only when Claude in Chrome is connected.
7. **Product items** from backlog.md "High" (PA form fill for MassHealth, criteria checklist per
   drug) only when the data queue is blocked.

## Ledger (append one line per run)

| Date | Item | Result | Resume at |
|---|---|---|---|
| 2026-10-21 | Setup run (manual, 1 h) | New picker + PA request builder + UAT harness; PA MCO roster gaps 32 → 0; this plan | Queue #1 run A |
| 2026-10-21 | Follow-up (manual) | PA criteria/ICD-10/send-to (PR #21); AL/MD archive + estradiol patch price (PR #20, merged); 4 new MA topics, 55 cells, 45 verified (this PR) | Queue #1 run A, or #2 for NY |
| 2026-10-21 | #2 NY (manual, 4 agents) | `ny-adhd/lipids/weight/migraine`: 55 cells, 36 verified; added to rolling PR #22 | #2 next state (MD or VA), or #1 TX |
