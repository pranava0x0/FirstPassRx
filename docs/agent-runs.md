# Agent & workflow run log

Append-only review of every multi-agent run (Agent tool / Workflow). One row per run, scored on
**did it work**, **quality**, **token efficiency**, and the **best-ROI alternative**. Read this
before launching a new fan-out — the cost levers at the bottom are learned here, not theoretical.

> How to read tokens: "subagent tokens" is the workflow's own metric (output across all its agents).
> Treat anything over ~300K as a real spend that should clear a "would inline have been cheaper?" bar.

## Runs

| Date | Run | Agents | ~Tokens | Worked? | Quality | Efficiency note |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-06-27 | `md-menopause-formulary` — gather+verify 3 MD payers (transdermal/progestogen/vaginal) | 6 | 347K | ✅ all 3 verified off real PDFs | High — found the Kaiser PA-on-micronized-progesterone quirk | ⚠️ the separate **verify phase (~3 agents, ~half the tokens) added little** — the gather agents had already downloaded the PDFs, which are self-proving |
| 2026-06-27 | `md-menopause-payers-r2` — 5 more MD payers | 5 | 363K | ✅ all 5 verified | High — Cigna/Aetna/Medicare brand-tail nuances | Good — verification **folded into the gather agent** (lesson from run 1); no wasted verify phase. Minor: one agent left 3 empty stub files |
| 2026-06-28 | `md-oral-estrogen` — oral estrogen, 8 payers | 8 | 428K | ✅ 7 verified, 1 partial | High — caught CareFirst's age-70 PA reaching oral estradiol | Good — agents were **pre-supplied the known formulary URLs**, so they fetched instead of searching |
| 2026-06-28 | `state-formulary-index` — NY/VA/DC plan→PBM→formulary index | 3 | 216K | ✅ all 3, real URLs | High — surfaced NY's NYRx pharmacy carve-out | Cheap + high-value: **index-level** (plan/PBM/URL), not drug-level. 1 VA plan resolved to a landing page only |
| 2026-06-28 | `md-combo-oral` — oral estrogen+progestin combo tablet, 8 payers | 8 | 475K | ✅ 7 verified, 1 partial | High — caught CareFirst's Bijuva PA and the brand-vs-generic tiers | Good — all three learned levers applied (per-payer, pre-supplied URLs, verification folded in). Enabled the previously-scaffolded `combo` tab |
| 2026-07-01 | `va-diabetes-formulary` — 10 payers × 4 classes + verify, one big fan-out | 55 | 1.30M | ❌ ~85% of class-gather/verify agents rate-limited ("Server is temporarily limiting requests") | Low — only 1/10 payers got any class data (3/4 classes), guide unshippable | **Failure: fan-out width (55) overwhelmed the API regardless of the per-workflow concurrency cap.** User corrected mid-session: never >2 concurrent agents without asking. Recovered ~15% that succeeded from on-disk checkpoints (per-agent Write-before-return) instead of re-running blind |
| 2026-07-01 | `ny-ace-formulary` — 10 payers × 1 class + verify, same shape | 30 | 1.22M | ❌ same rate-limit failure, ~1 payer usable | Low — shipped 1/6 intended payers (the one with clean data) | Same root cause as above — launched before checking `src/data/state-index.json`, which already had pre-vetted NY/VA formulary URLs from an earlier session; re-discovering them in the payer-metadata phase was pure waste on top of the rate-limit failure |
| 2026-07-01 | `code-review-8-angle` — correctness/cleanup/altitude/conventions finders, run in pairs | 8 | ~613K | ✅ all 8 completed | High — 3 angles independently converged on the same real bug (stale appeal-letter state); codex bot found the same bug plus 2 more | Correct response to the concurrency-cap correction: same review depth, batched ≤2 at a time instead of one 8-wide fan-out. Slower wall-clock, zero failures |
| 2026-07-01 | `va-diabetes-gather` — re-gather 8 VA payers × 4 classes (metformin-oral/glp1/sglt2/insulin), one agent per payer, chunked 2-at-a-time via a `for` loop over `parallel(chunk)` inside the Workflow script | 8 (1 launch + 1 resume) | ~442K | ⚠️ 1/8 payers fully verified (VA Medicaid FFS, all 4 classes, real PDL PDF); 7/8 failed on the resume with `FailedToOpenSocket`/`ConnectionRefused` | High for the 1 that succeeded (bold/italic font-metadata read straight off the PDF distinguished preferred vs. non-preferred, caught 2 closed-class BOGL rules) | The **chunking pattern itself worked** — zero rate-limit failures this time, unlike the earlier 55-agent one-shot fan-out. The 7 failures were a different, transient connectivity issue (`FailedToOpenSocket`/`ConnectionRefused`), not scale-related; retrying later (same session: `resumeFromRunId`; new session: re-run only the missing 7) should succeed without a redesign |
| 2026-07-02 | `va-diabetes-gather` (this session, run `wf_0d3afb8d-ef2`) — fresh gather, 8 VA payers × 4 classes, one agent per payer, chunked ≤2 via `for`+`parallel(chunk)` | 8 | ~650K | ⚠️ 6/8 ok (all 24 cells verified w/ page-level citations); 2 died pre-start on the session **usage limit** (not rate-limiting) | High — every completed payer verified off the real formulary doc; checkpoint-then-return meant the 2 failures cost ~0 | ~94K/payer as agents vs ~15-20K/payer when the last 2 were finished **inline** (curl+pypdf, same quality, ~10 tool calls each). Verdict: fan-out justified for 8 payers (context isolation + wall-clock), but 1-2 payer gaps should always be closed inline |
| 2026-07-02 | PR #5 persona review — SW engineer | 1 | ~84K | ✅ | High — 7 findings, 3 real should-fixes, each empirically verified (e.g. proved non-WinAnsi chars mangle in the PDF) rather than speculated | Worth it: fresh-eyes review of my own code caught things I'd re-read past. Personas dropped when marginal (PM skipped this PR per user's efficiency flag) |
| 2026-07-02 | PR #5 persona review — data reviewer + clinical domain expert | 2 | TBD | in flight | TBD | Batched ≤2 concurrent per the cap; retro to be appended when they land |

Session total (2026-07-01): ~93 agents, ~3.13M subagent tokens across 3 workflows/fan-outs — of which
~2.5M tokens across 2 workflows produced almost nothing usable. See "Concurrency cap" below.

Running total across all sessions: ~123 agents, ~4.95M subagent tokens across 8 workflows.

## Was the fan-out the right call?

Yes for all four. Each cell needs a large formulary **PDF fetched and read**; parallelizing across
payers is far faster than serial inline reads and keeps the main context clean. Inline would have
meant ~22 large-PDF reads in one context — slow and context-bloating. The index run (plan/PBM/URL
only) was the cheapest per unit of value.

## Cost levers (apply these before launching a fan-out)

1. **Gather per entity, not per cell.** One agent reads one payer's formulary for *all* drug classes
   at once. Per-(payer × class) re-fetches the same PDF N times — the single biggest avoidable cost.
2. **Pre-supply known source URLs.** If a formulary URL is already in the data (or a prior run),
   pass it to the agent so it fetches directly instead of burning a search loop.
3. **Fold verification into the gather agent.** A separate adversarial verify phase roughly doubled
   run 1's cost for little gain — once the agent has *downloaded* the source PDF, that artifact is the
   proof. Have the gather agent re-read the caption inline (publisher + effective date) and skip the
   second phase. Reserve a real verify fan-out for claims with no self-proving artifact.
4. **Index before drug-level.** A plan/PBM/formulary-URL index per state is a few agents and unlocks
   the map; full drug-level data is the expensive follow-up — do it on demand, not speculatively.
5. **Inline for ≤3 lookups.** A fan-out costs ~25–40K tokens of orchestration overhead before any
   work; for a handful of lookups, grep → read → one fetch inline is cheaper.
6. **Never fan out past 2 concurrent agents without asking first** — even inside a single Workflow's
   `parallel()`/`pipeline()` stage. Two 2026-07-01 workflows (55 and 30 agents) both hit "Server is
   temporarily limiting requests" on ~85% of agents; the per-workflow concurrency cap (min(16,
   cores-2)) does not protect against this. This is now a hard user-stated rule, not just a cost
   optimization — confirm scale before launching, don't discover the failure mode again.
7. **Check for existing pre-vetted data before spawning a metadata-discovery phase.** The same
   2026-07-01 session launched a payer-metadata-gather phase for VA/NY without first checking
   `src/data/state-index.json`, which already had verified formulary URLs/PBMs for both states from
   an earlier index-level run (lever #4). Grep the repo's own data files for what a prior session
   already gathered before re-discovering it with agents.

## Going forward (required)

After **every** Agent/Workflow run, append a row here and a one-line retrospective in the response:
did it work, quality, ~tokens, and the cheaper alternative if there was one. A run that finished
suspiciously fast/cheap probably **failed** — confirm the result object is non-empty before trusting
the metric. This protocol is also stated in [AGENTS.md](../AGENTS.md) so any agent on the repo follows it.
