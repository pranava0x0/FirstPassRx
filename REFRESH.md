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

- **2026-08-03: `trace:live`'s dead/drift signal is unreliable for 3 specific hosts —
  `mhdl.pharmacy.services.conduent.com`, `massgeneralbrighamhealthplan.org`, and
  `client.formularynavigator.com/Search.aspx`.** All 11 dead/drift hits from this run's
  `npm run trace:live` on these hosts turned out to be live, unchanged, correct pages once checked
  in a real logged-in Chrome session — plain `fetch()` gets timed out/blocked on the first two, and
  the third renders its results table client-side via JS so a plain fetch only ever sees an empty
  shell. Same "looks dead but isn't" pattern as GoodRx/Cost Plus/`fm.formularynavigator.com`/
  `uhcprovider.com` (see CLAUDE.md). Until `trace-sources.mjs` gets a host allowlist for these (see
  backlog.md), treat any DEAD/DRIFT hit on these 3 hosts as needing a real-browser spot-check before
  logging it as a real gap — see issues.md's 2026-08-03 entry for the full verification.
- **2026-08-05: `validate-links` flagged `hfs.illinois.gov/.../preferreddruglistprocess.html` as a
  404 dead link — a false positive, another instance of the "looks dead, isn't" host pattern.** A
  browser-UA `curl` got a clean 200. This script's plain fetch (no browser UA) is blocked by hosts
  that a real UA sails through; treat any single dead-link hit from `validate-links` on a
  government/payer host as needing this spot-check before logging it as a real gap, same as the
  3 hosts already listed above for `trace:live`.
- **2026-08-03: `npm run validate-links` is a separate, older script
  (`scripts/validate-links.cjs`) from `npm run validate-prices:live` — don't confuse the two.**
  `validate-links` re-derives GoodRx slugs naively from raw drug names (ignoring the real per-dosage
  `goodRxParams` logic in `src/lib/cash.ts`) and HEAD-checks ~2240 URLs with no rate-limit-aware
  batching, taking several minutes and producing mostly-noise output (many "checked" URLs don't
  match any real `CASH_LINK_RULE`). `validate-prices:live` is the accurate, current source of truth
  (215 URLs pulled from the actual rule table). See backlog.md — `validate-links.cjs` is a cleanup
  candidate.
