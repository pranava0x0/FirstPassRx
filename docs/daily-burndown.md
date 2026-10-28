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

Each item fits roughly one 20-minute run. Done items stay listed (struck) so the next run knows.
Every data item ends the same way: merge → `node scripts/apply-label-sigs.mjs --state=XX --topics=...`
→ `node scripts/audit-cells.mjs --state=XX` → agents review only flagged checks →
`node scripts/apply-cell-fixes.mjs <fixes>` → `--accept-remaining` → tests (see docs/data-audit.md).

1. **The 11 new topics in the other 16 states, one state per run** (antipsychotics, depression
   beyond SSRIs, eczema/psoriasis/acne, insomnia/anxiety, RA/psoriasis/IBD biologics, pain,
   testosterone, OAB, blood pressure beyond ACE, HIV, hepatitis C; 28 classes). Done: MA
   (2026-10-22, PR #23), NY, CA, TX and FL (2026-10-27). Order: NY, CA, TX, FL, PA, IL, OH, GA, NC, MI, VA, WA, MD, TN, AL, DC.
   Method (MA run): taxonomy `data-gathering/ma-next11-2026-10-22/taxonomy{,-A,-B}.json`, task
   template `TASK.md`, check template `CHECK.md`, `combine.py` — copy the folder for the new
   state. Two Haiku agents per payer document (batch A 12 classes, batch B 16), one Sonnet check
   per payer, `node scripts/merge-gather.mjs --dir=... --state=XX --payers-from=<xx>-adhd`.
   Reuse UHC/Humana checkpoints across states (export-payer-checkpoint.mjs refuses source-state
   prose). Then label sigs, ICD-10 (DRUG_ICD10 needs entries for any new barrier drug in JAK,
   IL-17/23 and TNF — a test fails otherwise), cash rules for new picks, audit.
2. **PA criteria for the new topics, per state as each lands** (MA done: all 5 payers).
   `data-gathering/pa-criteria-2026-10-22/{BRIEF.md,targets.json}` → Haiku extract → Sonnet
   adjudicate (multi-indication drugs need one path per indication) → `apply-pa-criteria.mjs`.
3. **Run the deterministic audit on every other state's existing 12 topics, one state per run.**
   MA is clean (1,727 OK, 252 reviewed, 0 open, 35 skipped). Expect new PDF layouts to need a
   tweak in `scripts/source_rows.py` (see docs/data-audit.md "adding a layout").
4. **PA approval criteria for the original topics' remaining Medicaid payers:** MI, GA, WA (Apple
   Health PA policy numbers are in the PDL sheet), TN done; NC public criteria are a 2024 DRAFT.
   Then commercial plans' policies.
5. **PA submission channels** for payers that print only "call the number on the ID card"
   (CareSource GA, Florida Blue, BCBS TN have no general pharmacy PA channel published). Verify
   with Sonnet before applying (`scripts/apply-pa-submission.mjs`); a wrong fax misroutes PHI.
6. **Cash prices for the alternatives long tail** (`KNOWN_UNPRICED_GAP` 1547). GoodRx needs the
   user's Chrome (the in-app browser is blocked); extract only the price with javascript_tool and
   print `location.pathname` to catch redirects. Cost Plus via browser if curl 403s.
7. **Stale sources** (issues.md): Meridian (Dec 2024) and BCBS Community IL (May 2025) lists;
   Cigna MD's URL now serves the 2027 list (re-add Cigna to the MD new-topic guides on
   2027-01-01); Aetna IL reissued; BCBS MA SSRI 404; 6 MassHealth tables drifted. The audit's
   accepted list re-flags checks when a source row changes — re-run it after any reissue.
8. **Partial → verified upgrades:** `il-osteoporosis` (13 partial), `ny-osteoporosis` (6),
   `ny-menopause` (5 example).
9. **New states** (17 of 51 covered): next by Medicaid enrollment AZ, NJ (per-MCO lists,
   expensive), IN, KY (single PDL), LA, MN, MO, OR, CO, WI; SC and NV also have single PDLs.
10. ~~TX: 7 missing topics~~ — done 2026-10-21. ~~ADHD / cholesterol / weight / migraine in every
   state~~ — done 2026-10-21.

## Ledger (append one line per run)

| Date | Item | Result | Resume at |
|---|---|---|---|
| 2026-10-21 | Setup run (manual, 1 h) | New picker + PA request builder + UAT harness; PA MCO roster gaps 32 → 0; this plan | Queue #1 run A |
| 2026-10-21 | Follow-up (manual) | PA criteria/ICD-10/send-to (PR #21); AL/MD archive + estradiol patch price (PR #20, merged); 4 new MA topics, 55 cells, 45 verified (this PR) | Queue #1 run A, or #2 for NY |
| 2026-10-21 | #2 NY (manual, 4 agents) | `ny-adhd/lipids/weight/migraine`: 55 cells, 36 verified; added to rolling PR #22 | #2 next state (MD or VA), or #1 TX |
| 2026-10-21 | #8 new states (manual, 5.5 h run, ≤4 agents) | DC, FL, OH: 12 guides × 4 payers each (UHC and Humana PDP reused from checked records); PA criteria for the original topics in 8 states; one rolling PR #22 | NC merge, then GA/MI by population |
| 2026-10-21 | #8 new states, cont. (manual, ≤4 agents) | NC, MI, GA, WA, TN (12 guides each); Anthem NY/VA/CA reissue applied; PA criteria OH/FL/DC; three Codex rounds fixed | Next state by population (NJ needs per-MCO lists; AZ, IN, KY have single PDLs), or #3 criteria for MI/GA/WA/TN |
| 2026-10-22 | Research + MA wave (manual, ≤4 agents) | 11 new topics in MA (28 classes × 5 payers) with PA criteria, cash, label sigs; deterministic audit tooling; MA audit 0 open; PR #23 | Queue #1: NY for the 11 topics |
| 2026-10-22 | #1 NY × 11 topics (scheduled, 20 min, ≤4 agents) | Deploy fix first: Pages build had failed since PR #22 (49 type errors; `npm test` now typechecks). NY gather in `data-gathering/ny-next11-2026-10-22/`: ny-medicaid, ny-excellus-bcbs, ny-uhc-commercial gathered + Sonnet-checked + combined (`<payer>.json`, 28 records each); ny-anthem-bcbs and ny-excellus-medicare A/B gathered. formulary.json untouched | Anthem checked + combined after close (4 of 5 payers ready); ny-excellus-medicare A/B gathered, needs its Sonnet check then `combine.py ny-excellus-medicare`; then merge-gather `--state=NY --payers-from=ny-adhd` and the item-1 tail (label sigs, ICD-10, cash, audit). Open: NY Medicaid bupropion/thiazide/HIV ART are not PDL-managed (partial, confirm vs eMedNY); UHC LAI pick Invega Sustenna is judgment (medical benefit) |
| 2026-10-27 | #1 NY + CA × 11 topics; PA builder UI (manual, ≤4 agents) | NY merged (140 cells, 98 verified; Excellus Medicare Sonnet check done). CA gathered + checked + merged (84 cells, 73 verified; buspirone-as-benzo pick fixed in 2 payers). 15 new label-sig rules, then Sonnet FDA-label fact-check fixed 10. Pick names carry their form so cash rules match. PA builder: one-tap chips, meter, sticky actions; hero "Start PA request" (UAT mobile PA draft 4→2). NY audit: all 1,136 checks SKIPPED — no extractor layout for NYRx/FormularyNavigator/UHC PDFs yet | TX also merged (84 cells, 71 verified). Next: FL for the 11 topics. Reuse `data-gathering/tx-next11-2026-10-27/humana-premier-rx-pdp.json` (Sonnet-checked, v17, state-neutral) for any state whose roster has Humana Premier Rx PDP |
| 2026-10-27 | #1 FL × 11 topics (scheduled, 13 min, 4 Haiku + 2 Sonnet) | Merged 11 guides, 112 cells, 100 verified. FL Medicaid + Florida Blue gathered from cached `sources/` PDFs and Sonnet-checked (Florida Blue batch B had tier/restriction swapped in all 16 records; fixed). UHC exported from NY (same national PDL), Humana PDP reused from TX. 3 hand sigs (Humana bupropion XL from TX, Risperdal Consta-type, Quviviq). Audit: 1,536 SKIPPED (no AHCA/ValueScript extractor layout). No new URLs to archive. To confirm: FL Medicaid LAI pick (haloperidol decanoate), Dupixent over Rinvoq, Edarbi nonformulary at Florida Blue | Queue #1: Pennsylvania for the 11 topics (next in order); or #2 PA criteria for FL. Checkpoints in `data-gathering/fl-next11-2026-10-27/` |
| 2026-10-28 | #1 PA × 11 topics (scheduled, 20 min, 6 Haiku + 2 Sonnet, ≤4 at once) | Gathered in `data-gathering/pa-next11-2026-10-28/`: pa-medicaid (statewide PDL v16, newer than the cached v11) and ibx-commercial gathered + Sonnet-checked + combined (28 records each). Sonnet fixed vague strengths (5 Medicaid picks), IBX HIV pick (efavirenz combo → Dovato), missing opioid QL/MME flags. highmark-bcbs-A gathered (FormularyNavigator class pages via `targetScreen=2`); B was still running at the time box. formulary.json untouched | highmark-bcbs-B.json landed after close (16 records, 7 verified; its oab-antimuscarinic `noCoveredAgent` is wrong: solifenacin is Tier 3 no PA, so it should be the pick, and Sonnet should fix it). Sonnet-check Highmark A+B, `combine.py highmark-bcbs`, then `merge-gather --state=PA --payers-from=pa-adhd` and the item-1 tail. To confirm: PA Medicaid "AR" age limits (PDL key prints none); IBX gabapentin/venlafaxine ER form not printed; IBX LAI is noCoveredAgent (medical benefit) |
