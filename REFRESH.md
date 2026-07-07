# REFRESH.md — FirstPassRx data refresh playbook

A "refresh" here has two halves: **gathering/updating cells** (that's the project's
`formulary-data` skill — payer × state × class, checkpointed, allowlisted sources) and
**this check suite**, which validates the result and reports the gaps to work next.

> Project refresh playbook, read by the generic `data-refresh` skill (~/.claude/skills/data-refresh). Keep current: every refresh run appends learned patterns; structural pipeline changes get edited into the body.

Root: `/Users/pranava/Projects/FirstPassRx`. Data: `src/data/formulary.json`
(`{ meta, guides[] }`, one guide per region × therapeutic area, self-contained references).
The recurring ask this skill exists for: *"lots of missing goodrx and cost+ drugs info —
check this when data refreshes."*

## 1. Static suite (offline, always run all of it)

```bash
npm run typecheck
npm test                          # pretest runs split-formulary --check
npm run trace                     # provenance: every record cites a resolving sourceId
npm run validate-prices           # cash-price coverage vs CASH_LINK_RULEs + capture dates
npm run validate-links
```

Any non-zero exit is a real regression — fix it (or route the fix through the
`formulary-data` skill if it needs new sourced data) before reporting the run green.

## 2. Live drift pass (network; run when asked for drift/live, or ~weekly)

```bash
npm run validate-prices:live      # GoodRx/Cost Plus URLs: BLOCKED (403) is EXPECTED —
                                  # both vendors bot-block. The signal is DEAD (404/other)
                                  # = wrong slug/path. --strict makes DEAD fail.
npm run trace:live                # cited sources: ok/redirected/blocked/dead + drug-name
                                  # presence in live HTML; PDF tracing is stubbed, flagged.
npm run archive-sources           # when sources changed: snapshot them (live pages are
                                  # not durable citation targets)
```

Don't retry blocked hosts in a loop — bot-blocks are a wall, not a transient.

## 3. Gap report (the actual deliverable)

Per guide (`ma-inhalers`, `md-menopause`, …), report:

- **Cash-price coverage:** covered drugs in active classes with no GoodRx/Cost Plus rule,
  vs. the known coverage-gap ceiling in `src/lib/cash.test.ts`. A gap above the ceiling
  fails; a gap *at* the ceiling still gets listed so it can be worked down.
- **Verification states:** counts of `verified` / `partial` / `example` cells, with the
  specific `partial`/`example` cells named (these are the upgrade queue).
- **Staleness:** `pricesCapturedAt` / `capturedAt` older than ~90 days (prices on these
  vendors drift daily; the value is a snapshot).
- **Dead or drifted sources** from the live pass.

Distinguish **fetch-blocked** from **actually missing** — a 403'd vendor page is not a
data gap. Log real gaps to `backlog.md` (with guide + class), validator bugs to
`issues.md`, and end with the one-line status:
`✓ suites green · price gaps: N (guide/class list) · partial/example: M · stale: K`.

If the user then wants the gaps *filled*, hand off to the `formulary-data` skill; ship via
`cr-deploy`.

## Learned patterns (append dated entries)

- (none yet)
