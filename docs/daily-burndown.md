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

0. **Six common-drug topics, one state per run** (acid reflux, thyroid, oral steroids, antibiotics,
   BPH, loop diuretics; 17 classes; added 2026-11-06 from the CMS Part D top-20 list). Done: KY
   (68 cells, 60 verified), OH (2026-11-08, 68 cells, 58 verified), GA (2026-11-09, 85 cells, 77 verified), NC (2026-11-10, 68 cells, 60 verified), TN (2026-11-11, 68 cells, 63 verified). Template: `data-gathering/ky-common6-2026-11-06/` in the main checkout
   (taxonomy.json, BRIEF.md, CHECK.md, research.md; copy the folder and change the payer sections).
   UHC and Humana PDP are national: export them from the KY guides instead of re-gathering, e.g.
   `node scripts/export-payer-checkpoint.mjs --payer=uhc-ky --as=<state's UHC id> --guides=ky-acid-reflux,ky-thyroid,ky-oral-steroids,ky-antibiotics,ky-bph,ky-loop-diuretics --out=<dir>/<id>.json --note="same national UHC PDL"`
   (same for `humana-premier-rx-pdp`). UHC's key says E = "may be excluded from coverage or subject to
   Prior Authorization in Connecticut, New Jersey and New York": the KY records call bare E
   nonformulary, so for NY remap those items to outcome "pa". One Haiku agent per remaining payer
   document (all 17 classes in one read), one Sonnet check per payer (CHECK.md), then
   `merge-gather --payers-from=<xx>-adhd`, `apply-label-sigs --topics=acid-reflux,thyroid,oral-steroids,antibiotics,bph,loop-diuretics`
   (rows exist for every expected pick), add the 6 guide ids to the order test, raise
   KNOWN_UNPRICED_GAP. Cash rules exist for every KY pick molecule. Order: OH, GA, NC, TN, MI, FL, TX,
   PA, IL, NY, CA, VA, WA, MD, AL, DC, MA. Criteria (item 2) for the brand-only products after each lands.

1. **The 11 new topics in the other 16 states, one state per run** (antipsychotics, depression
   beyond SSRIs, eczema/psoriasis/acne, insomnia/anxiety, RA/psoriasis/IBD biologics, pain,
   testosterone, OAB, blood pressure beyond ACE, HIV, hepatitis C; 28 classes). Done: MA
   (2026-10-22, PR #23), NY, CA, TX and FL (2026-10-27), PA (2026-10-29), IL (2026-10-31), OH (2026-11-01), GA, NC, MI, VA, WA and TN (2026-11-02), MD, AL and DC (2026-11-02, late run). Item 1 is complete for all 17 states. Order: NY, CA, TX, FL, PA, IL, OH, GA, NC, MI, VA, WA, MD, TN, AL, DC.
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
6. **Cash prices.** Cost Plus is deterministic now: `npm run costplus` (audit + gap list),
   `npm run costplus -- --write` (refresh the snapshot the app reads). Run it after every merge
   and add `costPlusPath` for each ADD line whose form matches. **Then the alternatives long tail** (`KNOWN_UNPRICED_GAP` 1547). GoodRx needs the
   user's Chrome (the in-app browser is blocked); extract only the price with javascript_tool and
   print `location.pathname` to catch redirects. Cost Plus via browser if curl 403s.
7. **Stale sources** (issues.md): Meridian (Dec 2024) and BCBS Community IL (May 2025) lists;
   Cigna MD's URL now serves the 2027 list (re-add Cigna to the MD new-topic guides on
   2027-01-01); Aetna IL reissued; BCBS MA SSRI 404; 6 MassHealth tables drifted. The audit's
   accepted list re-flags checks when a source row changes — re-run it after any reissue.
8. **Partial → verified upgrades:** `il-osteoporosis` (13 partial), `ny-osteoporosis` (6),
   `ny-menopause` (5 example).
9. **New states** (18 of 51 covered): ~~KY~~ done 2026-11-03 (all 23 topics, one gather dir:
   taxonomy-{old8,new4,A,B}.json + BRIEF/CHECK/combine.py in `data-gathering/ky-all-2026-11-03/`, a
   template for the next state). Next by Medicaid enrollment AZ, NJ (per-MCO lists, expensive), IN,
   LA, MN, MO, OR, CO, WI; SC and NV also have single PDLs.
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
| 2026-10-29 | #1 PA × 11 topics, finish (scheduled, ~10 min, 2 Sonnet) | Merged 11 guides, 84 cells. Highmark A+B Sonnet-checked: OAB pick is solifenacin (Tier 3 "Non-Formulary", partial); B's alternatives/paRequired lists were capped at 8/12 to cut bloat (noted per record). Opus changed Highmark's HIV ART pick from efavirenz/FTC/TDF to Biktarvy. Sonnet cross-check of all 84 cells: 5 pick strengths moved to the sig's start dose, oxybutynin picks named IR, combo rows removed from the Medicaid ARB/beta-blocker PA lists, Highmark OAB closed-formulary caveat. KNOWN_UNPRICED_GAP 2556 → 2804. Audit: 1,896 SKIPPED (no extractor layout for the PA PDL or FormularyNavigator) | Queue #1: Illinois for the 11 topics. To confirm: Highmark OAB pages (is oxybutynin Tier 1?), the capped Highmark lists, brand names on generic Highmark picks (false brand badges?), Highmark Epclusa BOGL, IBX LAI medical-benefit label |
| 2026-10-30 | #1 IL × 11 topics, run A (scheduled, 20 min, 6 Haiku + 3 Sonnet, ≤4 at once) | Gathered from cached `sources/` PDFs into `data-gathering/il-next11-2026-10-30/`: il-medicaid and bcbs-illinois-commercial gathered + Sonnet-checked + combined (28 records each); wellcare-value-script gathered + Sonnet-checked + combined (national PDP, state-neutral, so reusable for VA). Sonnet fixed IL Medicaid A filing NON_PREFERRED as alternatives (now paRequired, matching B and existing IL records). formulary.json untouched (5 of 8 payers left). Wellcare benzo pick moved clonazepam → alprazolam, muscle relaxant baclofen → tizanidine | molina-il A/B and aetna-better-health-il A landed after close (unchecked; Aetna A PA reasons follow the HFS convention since the PDL prints no PA flag, so Sonnet should confirm). Sonnet-check Molina, combine; then aetna B, bcbs-community-il, countycare, meridian (A/B each; cached PDFs in `sources/*-nsaids-source-2026-07-07.pdf`, CountyCare Q3 in `countycare-doac-source-202609.pdf`); Sonnet-check each, `combine.py`, `merge-gather --state=IL --payers-from=il-adhd`, item-1 tail. To confirm: BCBS IL commercial "nonformulary" calls (p.5 says complete list, p.7 says unlisted may be covered; 50 records still verified); BCBS LAI keeps noCoveredAgent (card overstates); tofacitinib AB rating (IL Medicaid BOGL) |
| 2026-10-31 | #1 IL × 11 topics, finish (scheduled, ~13 min, 7 Haiku + 6 Sonnet, ≤4 at once) | Merged 11 guides, 224 cells, 170 verified. Today: Molina, Aetna (B gathered), Blue Cross Community, CountyCare (Q3 2026 list) and Meridian gathered/Sonnet-checked/combined from cached `sources/` PDFs. Cross-check moved 2 OAB picks to IR oxybutynin and BCBS IL commercial HIV ART to Biktarvy. 210 label sigs. KNOWN_UNPRICED_GAP 2804 → 3385. IL audit not run (time) | Queue #1: Ohio for the 11 topics. Also: `node scripts/audit-cells.mjs --state=IL`. To confirm: CountyCare testosterone/DORA absent (exception or medical benefit), CountyCare HCV line brand vs AG, Aetna unflagged not-preferred = PA (HFS convention, PDL silent), BCBS Community 120 MME/stale May 2025 list, Meridian Dec 2024 list (10 of B's 16 partial), CountyCare/Wellcare acne pick clindamycin vs tretinoin, Meridian tacrolimus 0.03%, IL Medicaid tofacitinib BOGL |
| 2026-11-01 | #1 OH × 11 topics (scheduled, ~13 min, 4 Haiku + 2 Sonnet, ≤4 at once) | Merged 11 guides, 112 cells. Ohio Medicaid (UPDL) and Anthem OH individual gathered from cached `sources/` PDFs in `data-gathering/oh-next11-2026-11-01/` and Sonnet-checked; UHC and Humana PDP exported from FL. Opus pick review caught Anthem buspirone-as-benzo (→ lorazepam) and efavirenz combo HIV pick (→ Biktarvy). Anthem's 48 "nonformulary" reasons now quote its p.2 completeness line + p.3 PA exception route. 53 label sigs; ICD-10 alopecia areata for Leqselvi/Litfulo. KNOWN_UNPRICED_GAP 3385 → 3515. Audits: OH 1,799 and IL 4,168 checks all SKIPPED (no extractor layout for UPDL, FormularyNavigator, HFS or MCO PDFs). No new URLs, archive not re-run | Queue #1: Georgia for the 11 topics. Or queue #3: an extractor layout in `scripts/source_rows.py` for the OH UPDL / FormularyNavigator PDFs (the audit skips every non-MA state). To confirm: Anthem OH oral antipsychotics and IR opioids all carry PA (Sonnet confirmed pp.12-13, 34-35); DORA and LAI picks at Anthem are reference products (none listed); Ohio Medicaid BvG = BOGL for the Pyzchiva biosimilar |
| 2026-11-02 | #1 GA × 11 topics (scheduled, ~15 min, 6 Haiku + 4 Sonnet, ≤4 at once) | Merged 11 guides, 140 cells, 118 verified. GA Medicaid (DCH PDL Oct 2026), CareSource GA and Anthem GA gathered from cached `sources/` PDFs in `data-gathering/ga-next11-2026-11-02/` and Sonnet-checked; UHC and Humana PDP exported from OH. Opus moved CareSource HIV ART efavirenz combo → Biktarvy. 78 label sigs (2 unmatched: CareSource etanercept, testosterone 1% gel keep agent sigs). KNOWN_UNPRICED_GAP 3515 → 3618. Audit: 1,967 GA checks all SKIPPED (no extractor layout). No new URLs, archive not re-run | Queue #1: North Carolina for the 11 topics. Or queue #3: an extractor layout in `scripts/source_rows.py` (every non-MA state skips). To confirm: CareSource DORA and beta-3 absent (closed list but "not a full list"), CareSource HCV pick brand vs AG, GA Medicaid beta-3 pick Myrbetriq is NP/PA (no preferred beta-3), Anthem GA LAI/DORA none listed. Sonnet cross-check (`crosscheck.md` in the checkpoint dir) fixed: 3 tacrolimus picks named "ointment" (cash lookup), CareSource Enbrel and testosterone gel sigs. Left open: GA Medicaid gabapentin pick 600 mg tab vs 300 mg start sig; mirabegron BOGL at GA Medicaid/Humana (no generic printed); CareSource HCV tier says preferred brand but no brand set; OH Humana tacrolimus pick has the same bare INN |
| 2026-11-02 | Evening manual run (2 h, ≤4 agents): #1 NC + MI × 11 topics, #2 PA criteria, #6 cash | NC merged (112 cells, 97 verified). PA criteria for the newer topics: OH, NC, PA Medicaid, Humana PDP in 5 states (`build-pa-targets.mjs`, `apply-pa-criteria --all-states`). Cost Plus now from its price-list API (`npm run costplus`); 56 label-sig rows (generic sigs 1,031 → 214); `check-dose-strength.mjs` fixed 62 pick strengths | Later the same evening: MI, VA (MCOs copy the DMAS PDL, partial), WA, TN merged; PA criteria added for TX, NY, GA, MI, IL Medicaid, UHC (7 states), Humana (8 states), IBX, Highmark, Anthem OH; strength-aware cash prices. Next: #1 MD/AL/DC × 11 topics; #2 PA criteria for IL MCOs (Aetna, Molina, BCBS Community), Florida Blue, Kaiser, BCBST, Sentara, Blue Cross NC/MI; re-read VA MCO lists to upgrade their partial cells |
| 2026-11-02 (late) | 1 + 2: MD, AL, DC newer topics + PA criteria | MD 196 cells/129 verified, AL 84/63, DC 112/86; criteria: UHC MD 46, MD Medicaid 28, AL Medicaid 90, AmeriHealth DC 53, DC Medicaid 5 | Branch burndown/md-al-dc-next11 (PR open). Next: #2 criteria for CareFirst, Kaiser Mid-Atlantic, Aetna, BCBS AL; re-read Priority Partners' own list (its cells copy the MD PDL, partial); #3 audit |
| 2026-11-03 | #2 PA criteria, newer topics: CareFirst, Kaiser Mid-Atlantic, Aetna MD, BCBS AL (scheduled, ~15 min, 5 Haiku + 1 Sonnet, ≤4 at once) | Applied 4 items: Aetna Xyosted + Jatenzo (non-Medicare TGC PA policies), Kaiser MAS Cosentyx md + dc (HMO/exchange form, eff. 2023-10-03); Sonnet confirmed both sources and dropped a renewal line. Rejected 3 agent outputs (kept as `REJECTED-*.json` in `data-gathering/pa-criteria-2026-11-03/`): Kaiser's first try used its MD **Medicaid** criteria for the marketplace plan; CareFirst's only source was a 2015 list (Sovaldi + peginterferon); BCBS AL's were 2018 Prime summaries. One flaky `npm test` failure that didn't reproduce (2 later runs green) | #2: CareFirst's current criteria (no public per-drug doc found; try the CareFirst/Prime "drug-specific criteria" index in the browser); BCBS AL via al-policies.exploremyplan.com (client-rendered, needs the real browser); Kaiser Caplyta/Cimzia exchange forms (pharmacy page redirect-loops curl/WebFetch, so try the browser); `npm run archive-sources` for the 3 new criteria URLs (stopped at the time box: a full re-fetch takes 30+ min, so start it first next run); Aetna gels, opioids, other classes; IL MCOs, Florida Blue, BCBST, Sentara, Blue Cross NC/MI |
| 2026-11-03 | #9 new state: Kentucky, all 23 topics + PA criteria (manual, 8 Haiku + 3 Sonnet gather, 2 Haiku + 1 Sonnet criteria, ≤4 at once) | 23 guides × 4 payers (244 cells). KY Medicaid = one MedImpact PDL for FFS and all 5 MCOs (Anthem left KY Medicaid 2025-01-01), read by column x-coordinate; Anthem KY Select 4-Tier (complete list); UHC + Humana exported from TN. Sonnet fixed: SGA PA is diagnosis-only (pick aripiprazole 10 mg), stimulants preferred-with-PA on a diagnosis edit, Wegovy/Zepbound covered only for MACE/MASH/OSA, Anthem IR amphetamine has no PA, Descovy $0 PrEP. Anthem criteria copied from OH (7 items); archived 12 cited-but-unarchived URLs. KNOWN_UNPRICED_GAP 4504 → 4549. A hook blocks writes to the main checkout from a worktree, so the gather dir lives in the worktree (copied to main after) | Next state AZ or IN. Cash gaps (GoodRx via user's Chrome): adapalene 0.1% gel, haloperidol decanoate, testosterone 1.62% gel. To confirm: KY PDL vs criteria disagree on Complera, Concerta/Adderall XR and lisdexamfetamine status; Arnuity BOGL; Anthem Descovy NF row; generic rivaroxaban 20 mg |
| 2026-11-04 | #2 PA criteria, newer topics: IL MCOs + Florida Blue (scheduled, ~9 min, 5 Haiku + 1 Sonnet, ≤4 at once) | Applied 6 sets / 9 items in `data-gathering/pa-criteria-2026-11-04/`: Molina IL Medicaid Rinvoq (C30614-A, eff. 2026-04-01) + adalimumab/Simlandi/Humira (C29655-A, eff. 2025-08-20); Aetna Better Health IL methylphenidate ER products (eff. 2025-04-16), Ilumya + Taltz (eff. 2026-07-31), Cibinqo (eff. 2026-06-01). Sonnet re-read every PDF: dropped continuation lines from "any"/"all" sets, added the PsA/AS paths and the three-preferred-products rule. 6 PDFs archived. Empty: BCBS Community IL (no plan-level drug criteria published; HFS LAI doc is 2021), Florida Blue (PA list names drugs only; MCGs at mcgs.bcbsfl.com are ASP.NET postback links, need the browser). Molina rejected 9 pre-2025 PDFs; its Wegovy/Zepbound docs cover CV/MASH/OSA only, not the weight targets. Aetna IL testosterone doc covers breast cancer/delayed puberty/gender dysphoria, not hypogonadism. All cited URLs were already archived (manifest keys normalize `&`, so a raw-URL diff miscounts) | #2: Aetna IL Humira, Otezla, Olumiant PDFs (index `illinois-medicaid/providers/pharmacy-guidelines.html`, Node fetch with browser UA); Florida Blue MCGs via Chrome (click the tree entries: Adalimumab, Dupilumab, Hepatitis C, Ustekinumab); CareFirst, BCBS AL (browser); BCBST, Sentara, Blue Cross NC/MI. `for id in $ids` needs `${=ids}` or a quoted array in zsh — the first archive loop ran once |
| 2026-11-05 | #2 PA criteria, newer topics: Aetna Better Health IL Humira/biosimilars, Otezla, Olumiant (scheduled, ~4 min, 1 Haiku + 1 Sonnet) | Applied 3 sets / 14 items in `data-gathering/pa-criteria-2026-11-05/`: adalimumab (12 products, eff. 2026-08-11), Otezla (eff. 2026-07-20), Olumiant (eff. 2025-05-23); 3 PDFs archived (`--only=`, no full re-fetch). curl gets 403 on aetnabetterhealth.com PDFs; Node fetch with a browser UA gets 200. Sonnet rewrote 6 of 7 adalimumab statements (RA biomarkers wrong, contraindication paths missing, made-up Crohn's/UC ages) | #2: Florida Blue MCGs via Chrome (Adalimumab, Dupilumab, Hepatitis C, Ustekinumab); CareFirst, BCBS AL (browser); BCBST, Sentara, Blue Cross NC/MI. To confirm: Aetna IL policy also covers Hulio/Idacio (not in the PA list); JIA compressed to one example path; Otezla checkpoint-inhibitor toxicity path omitted. Untracked repo-root `Humira-and-Biosimilars-Aetna-IL-Medicaid-Policy-ua.pdf` (11-04 run download) and `.sessions/` left alone |
| 2026-11-07 | #2 PA criteria, newer topics: BCBST + Blue Cross NC (scheduled, ~5 min, 2 Haiku + 1 Sonnet) | Applied 4 sets / 7 items in `data-gathering/pa-criteria-2026-11-07/`: BCBST Medical Policy Manual pages for Skyrizi, Cosentyx, Tremfya, Imuldosa/Yesintek (`bcbst.com/mpmanual/!SSL!/WebHelp/<molecule>.htm`, curl works); 4 pages archived (`--only=`). Sonnet rewrote Haiku's flat "any" paths into complete per-indication paths and added CD/UC, AS/nr-axSpA, ERA, HS and checkpoint-inhibitor colitis. effectiveDate = BCBST's "most recent review date" (no single effective date printed). Blue Cross NC: 0 sets (commercial GLP-1 policy 404s; only Part D pages found). BCBST GLP-1, CGRP, antipsychotics, ADHD: no public criteria (Caremark portal Access Denied) | #2: BCBST's other mpmanual pages (try `WebHelp/<Molecule>.htm` directly for adalimumab, etanercept, upadacitinib, dupilumab); Blue Cross NC via its commercial pharmacy policy index in the browser; Florida Blue MCGs, CareFirst, BCBS AL via Chrome; Sentara |
| 2026-11-08 | #0 OH × 6 common-drug topics (scheduled, ~11 min, 2 Haiku + 2 Sonnet) | Merged 6 guides (`oh-acid-reflux/thyroid/oral-steroids/antibiotics/bph/loop-diuretics`), 68 cells, 58 verified. Ohio Medicaid UPDL and Anthem OH Select gathered from cached `sources/` PDFs in `data-gathering/oh-common6-2026-11-08/` and Sonnet-checked; UHC and Humana PDP exported from KY. UPDL p.2: non-UPDL drugs get PA under the Gainwell SPBM policy *when* PA applies, so non-UPDL class picks (thyroid, H2, steroids, penicillins, UTI, C. diff) stay covered/partial. Sonnet fixes: Anthem doxycycline monohydrate ST rows added, withdrawn ranitidine dropped; OH Medicaid Duchenne steroid reasons, prazosin alternative. 34 label sigs. KNOWN_UNPRICED_GAP 4826 → 4876. Audit: 2,244 OH checks SKIPPED (no extractor layout). No new URLs | Queue #0: Georgia. To confirm: Anthem OH tadalafil "PA; BE" for BPH (benefit exclusion on the member's plan?), Anthem omeprazole-sodium bicarbonate ST |
| 2026-11-09 | #0 GA × 6 common-drug topics (scheduled, ~9 min, 3 Haiku + 3 Sonnet) | Merged 6 guides (`ga-acid-reflux/thyroid/oral-steroids/antibiotics/bph/loop-diuretics`), 85 cells (5 payers), 77 verified. GA Medicaid (DCH PDL Oct 2026), CareSource GA and Anthem GA gathered from cached `sources/` PDFs in `data-gathering/ga-common6-2026-11-09/` and Sonnet-checked; UHC and Humana PDP exported from KY. GA Medicaid PDL has no row for amoxicillin, IR ciprofloxacin, furosemide or tadalafil 5 mg (partial; the PDL says it is not a full list). Sonnet fixes: CareSource famotidine pick 20 → 40 mg (only strength printed), CareSource C. diff pick → vancomycin oral solution (no capsule printed; PA). GA Medicaid PDF needs PyMuPDF (pypdf cmap fails). 50 label sigs (CareSource famotidine 40 mg keeps its sig). KNOWN_UNPRICED_GAP 4876 → 4992. Audit: 2,561 GA checks SKIPPED. No new URLs | Queue #0: North Carolina. To confirm: GA Medicaid tadalafil BPH status inferred from Cialis 5 mg / tadalafil 2.5 mg rows; Anthem GA tadalafil "PA; BE"; CareSource C. diff capsule vs solution pick |
| 2026-11-10 | #0 NC × 6 common-drug topics (scheduled, ~10 min, 2 Haiku + 2 Sonnet) | Merged 6 guides (`nc-acid-reflux/thyroid/oral-steroids/antibiotics/bph/loop-diuretics`), 68 cells, 60 verified. NC Medicaid PDL and BCBS NC 4-tier gathered from cached `sources/` PDFs in `data-gathering/nc-common6-2026-11-10/` and Sonnet-checked; UHC and Humana PDP exported from KY. NC Medicaid PDL has no thyroid, nitrofurantoin or loop-diuretic rows (partial, not a PDL class); Voquezna tablet is Preferred but listed only under H. pylori combinations (P-CAB partial). BCBS NC lists no omeprazole/esomeprazole and no famotidine tablet: picks are pantoprazole 40 mg and nizatidine 150 mg (agent sigs kept). Sonnet resolved 6 of 7 partial BCBS rows by x-position, moved Dificid suspension/Vowst/lansoprazole ODT/Lasix ONYU to paRequired, and re-dated the BCBS reference to November 2026 (the PDF prints it). 32 label sigs. KNOWN_UNPRICED_GAP 4992 → 5087. Audit: 2,292 NC checks SKIPPED. No new URLs | Queue #0: Tennessee. To confirm: NC Medicaid Voquezna Preferred applies to reflux use; BCBS NC effectiveDate day (PDF prints only "November 2026"); BCBS NC tadalafil 5 mg sits in the ED section (BPH coverage not distinguished) |
| 2026-11-11 | #0 TN × 6 common-drug topics (scheduled, ~7 min, 2 Haiku + 2 Sonnet) | Merged 6 guides (`tn-acid-reflux/thyroid/oral-steroids/antibiotics/bph/loop-diuretics`), 68 cells, 63 verified. TennCare PDL (cached copy is effective 2026-11-02; PyMuPDF needed, pypdf cmap fails) and BCBST Essential (Nov 2026) gathered from cached `sources/` PDFs in `data-gathering/tn-common6-2026-11-11/` and Sonnet-checked; UHC and Humana PDP exported from KY. TennCare: tadalafil 5 mg Preferred but PA+QL; Dificid tabs Preferred with PA; nitrofurantoin suspension (not capsule) carries the age-12 PA. BCBST: every generic PPI carries PA+QL (omeprazole pick keeps the restriction); only famotidine suspension and only PAH tadalafil 20 mg printed (both partial). Opus moved dutasteride/tamsulosin from the PDE5 cell to 5-ARI and dropped strengths from 2 pick INNs. 33 label sigs (BCBST famotidine suspension keeps its agent sig). KNOWN_UNPRICED_GAP 5087 → 5178. Audit: 2,561 TN checks SKIPPED. No new URLs | Queue #0: Michigan. To confirm: BCBST famotidine tablets / tadalafil 5 mg BPH coverage (no completeness statement); TennCare Dexilant prints only QL (recorded PA per non-preferred rule) |
