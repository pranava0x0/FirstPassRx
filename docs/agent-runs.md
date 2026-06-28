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

Session total: ~22 agents, ~1.35M subagent tokens across 4 workflows.

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

## Going forward (required)

After **every** Agent/Workflow run, append a row here and a one-line retrospective in the response:
did it work, quality, ~tokens, and the cheaper alternative if there was one. A run that finished
suspiciously fast/cheap probably **failed** — confirm the result object is non-empty before trusting
the metric. This protocol is also stated in [AGENTS.md](../AGENTS.md) so any agent on the repo follows it.
