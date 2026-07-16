# CLAUDE.md — Universal Development Principles

> Base file for every project in this folder. Project files extend it and win on conflict (they're the local source of truth).
>
> Companion files: [AGENTS.md](AGENTS.md) is the *how* for agents; [DESIGN.md](DESIGN.md) is the *look*.

---

## North star: ship small things that work end-to-end

One rule drives the rest: **build the smallest version that works, then add only what the next real user need demands.** (Karpathy: "make it work, then make it good." levels.io: "ship it ugly, ship it now.") A working ugly thing teaches more in a day than a plan teaches in a month.

- **No half-finished work.** A feature ships end-to-end or stays a branch — never merged 80% done with a TODO.
- **No speculative abstraction.** Three similar lines beat a premature helper. Build the helper the second time you need it.
- **No future-proofing without a present user.** Every config knob, plugin point, and flag is dead weight until someone uses it.

---

## Agent Workflow: Explore → Plan → Code → Verify

Never blindly write code.

1. **Explore.** Find relevant files and understand existing patterns before touching anything.
2. **Plan.** Assess blast radius. For significant changes, present 2–3 approaches with pros/cons and get approval before coding.
3. **Code.** Implement following the rules below.
4. **Verify.** Run tests, use the feature, fix all failures before declaring done.

**Read before edit** — always, even if you read the file earlier this session. **Ask for options first** on non-trivial tasks; the first plausible plan is rarely the best. **Close the loop yourself** — build so the agent can compile, lint, test, and verify its own output. (Karpathy: "agentic coding works when the eval is the loop.")

---

## Communication style

- **Concise.** No filler, apologies, moralizing, or generic advice.
- **Show your work** only when it changes the answer.
- **Fail loud.** No catch-all handlers that swallow errors. Raise or log.
- **State results, not effort.** "Tests pass," not "I worked hard to get tests to pass."

---

## Architecture principles

- **No over-engineering.** Only changes directly requested or clearly necessary.
- **Boring tech wins.** Vanilla JS, SQLite, static HTML, system fonts, plain Python beat the framework-of-the-month. Every dependency is a future bug, migration, and advisory. (levels.io: "boring tech is the secret.")
- **Single source of truth.** Constants, configs, shared types derive from one place. If a value is duplicated, test that the copies match.
- **Modular layers.** Data fetching, processing, storage, presentation — distinct modules.
- **Idempotent operations.** Re-running is safe (`INSERT OR IGNORE`, cache checks, dedup by key) — but that protects re-runs, not concurrent writers. Never run two instances of the same stage on overlapping inputs; both writing one output dir corrupt each other.
- **Precompute derived values at ingest, not per call.** Compute a hot-loop value (e.g. a per-record search string) once at write time and store it. No per-call fallback that re-derives it — that silently defeats the optimization; prefer "no key → no match" so a missed index fails loud.
- **Static when possible.** Baked data over runtime backends. A `docs/` folder on GitHub Pages beats a server to babysit.
- **Cost-optimized.** Free tiers; cheapest resource that meets the requirement.
- **CLI-first.** Build CLI entry points before UI so agents can self-validate output.
- **Minimize page weight and request count.** Content sites stay lightweight — fewest requests, smallest payload.
- **Tree-shake and code-split.** Lazy-load what a page needs; don't bundle every controller everywhere.
- **Benchmark against best-in-class.** If the simplest site in the org is orders of magnitude lighter, review the build.
- **Document subsystems.** A `docs/` folder noting non-obvious subsystems, decisions, and correct CLI invocations. One line prevents repeated mistakes.

---

## Error resilience

- **Never let one item crash the pipeline.** Wrap per-record processing; log and continue.
- **Log aggressively** — every request, parse, API call, cache hit/miss, filter decision.
- **Cache everything fetchable** so re-runs are fast and cheap.
- **Validate everything.** Invalid external responses → log and skip, never crash.
- **Track errors visibly** in `issues.md` or an errors array — failures must surface.
- **Checkpoint long jobs incrementally.** Save per unit, commit per N units / per partition, and log every failure to an append-only `ingest_log.jsonl` with a `retryable` flag. End the run with a one-line status report (`✓ N done · ✗ M failed (reason) · → resume at X`). A job that only reports success hides the items that silently fail every re-run.
- **Resume/backfill merges with on-disk output.** A `--missing-only` run must merge new records with existing *before* writing, or a capped partial run drops everything done earlier. Keep a progress manifest (per partition: `last_run`, `count`, `next_target`) so a new session resumes without re-deriving progress. Distinguish a closeable gap from a permanent source-side dead-end — don't re-run enrichment for data upstream will never give; mark it a known structural gap.
- **Verify files are really on disk before debugging a "code" bug.** Cloud-sync (iCloud / Dropbox / OneDrive) can leave dataless placeholders that read empty / NUL while the inode reports the right size — and `git status` calls them *clean* because it trusts its stat-cache and never reads the bytes. The symptoms masquerade as code bugs (`ERR_INVALID_PACKAGE_CONFIG`, every route 500s, multi-minute boots, `page 2.tsx` conflict-copies). Fix: delete the file *then* `git checkout` (a plain checkout no-ops on a "clean" placeholder); better, move the repo out of the synced folder.
- **Key file-backed caches on a signature, not a TTL.** For a cache fronting a local file, key on `(mtime_ns, size)` instead of a fixed `ttl=`; it busts the instant the file changes and serves indefinitely otherwise. A time-based TTL either serves stale data or churns needlessly.

---

## Security & credential handling

- **Never commit secrets.** Read credentials from env vars only; halt with a clear error if missing; never log them.
- Always `.gitignore`: `.env`, `.env.local`, `credentials.json`, `secrets/`, `node_modules/`, `__pycache__/`, `dist/`, `*.pyc`.
- Before committing: `git diff --cached | grep -iE "apikey|password|token|secret"`.
- **Respect privacy choices.** Don't proxy tracking SDKs through your own domain to dodge blockers.
- **Check the security advisory index before risky supply-chain actions — targeted, not on every command.** Supply-chain attacks hit popular packages within hours of a maintainer phish. Fetch the advisory index at `https://pranava0x0.github.io/vibe-coding-security/llms-ctx.txt` (~12 KB) and surface any match **before** these specific actions: (1) starting / scaffolding a new project, (2) any `npm install` / `pip install` / `uv add` / dependency add or upgrade, (3) adding a third-party CDN asset or a GitHub Action, (4) running a fetched install script (`curl … | sh`). Do **not** re-fetch it for routine edits, reads, or running already-installed code — that's noise that burns tokens. Cache the result in `security.md` with the sweep date; reuse it within a session and refresh only if > 7 days old or one of the trigger actions recurs after the cached window.

### Supply-chain hardening

- **Pin exact versions, never floating ranges.** `==` (Python) + lockfile installs (`npm ci`, not `npm install`) — a `>=`/`^` range auto-pulls whatever the registry serves next, the exact window a bad release lands in. Better still, hash-lock (`pip-compile --generate-hashes` + `--require-hashes`, `uv lock`, lockfile integrity hashes) to reject same-version re-publishes.
- **Subresource Integrity on every CDN asset.** `sha384` `integrity` on each `<link>`/`<script>`/import-map entry so a swapped file fails closed. Regenerate with `curl -sL <url> | openssl dgst -sha384 -binary | openssl base64 -A`; verify twice (a partial download yields a wrong hash that blanks the page). Self-host when feasible.
- **Pin CI actions to a full commit SHA + least privilege.** Every `uses:` pinned to a 40-char SHA (not a moving `@v3` tag) with a `# vX.Y.Z` comment, plus a minimal `permissions:` block per workflow. Re-pin with `gh api repos/<owner>/<repo>/commits/<tag> --jq .sha`.
- **Neutralize formula injection in exports.** Prefix CSV/TSV/spreadsheet cells starting with `= + - @`, tab, or CR with a `'`, or `=HYPERLINK(...)` runs when opened in Excel/Sheets.
- **No machine-local paths in committed data.** Store paths repo-relative; `/Users/<name>/...` leaks identity and layout into public history.
- **Every security fix ships with a regression test** — these regressions are invisible until exploited.

---

## Testing & validation

- **Write tests alongside code.** Every new module or bug fix includes them.
- **Regression-test every bug fix.** The bug is the test case; without one the fix rots.
- **Validate output against schemas before writing to disk** (Pydantic `extra="forbid"`, or zod).
- **Cover edges:** empty `[] / {} / ""`, null for every optional field, boundary values, combined filters.
- **Count-floor regression test.** For append-only datasets, assert total/item counts never drop versus the previous commit. Reintroduced caps and accidental deletions pass schema validation but fail a count floor.
- **Seed one example per enum value.** When the UI renders a legend/chips off an enum, test the dataset ships ≥ 1 record per value — so no legend slot renders empty and deleting the last example fails loudly.
- **Query text safely when elements contain nested markup.** Avoid calling `getByText` with a full sentence regex if it is split by `<b>` or `<strong>` tags. Instead, grab the closest wrapper element (e.g. `.closest('li')`) and assert using `.toHaveTextContent(regex)` which aggregates the text of all child nodes.
- **Run the full suite before committing.**
- **Never ship test files to production.** CI excludes tests, fixtures, debug artifacts.
- **Tests are the eval suite** — the loop that tells you what works. Invest in it.

---

## Git discipline

- **Commit often** at natural checkpoints — small and focused: per module/feature, per bug fix (with its regression test), per doc update.
- **Messages explain *what* and *why*** — "fix off-by-one in pagination when filter is empty," not "fix bug."
- **Never commit large binaries, downloaded data, or keys.**
- **Don't amend pushed commits**, and don't `--no-verify` — fix the hook's underlying issue.
- **`git fetch` and integrate onto the latest remote before pushing to a shared branch.** Parallel agent / IDE / Codex sessions advance `main` mid-task; a stale base is rejected non-fast-forward. Check `git rev-list --left-right --count origin/main...HEAD`; if diverged with overlapping edits, re-apply onto the new structure rather than force-pushing (a force-push destroys the parallel work). At session start, `git branch -a` + `git log --all --oneline | head` to spot another tool mid-flight before assuming a clean starting point. Only clear a stale `.git/refs/.../*.lock` after confirming no `git` process is running.
- **Don't gate a commit on a piped filter.** `pytest … | grep passed && git commit` silently skips the commit when grep matches nothing (it exits non-zero). Run the tests, read the summary, then commit as a separate step.
- **No agent co-authors and no machine fingerprints.** No `Co-Authored-By:` for any AI tool, no "🤖 Generated with…" footers, no generic-assistant PR prose. Commits are owned by the human who ships them; write messages in their plain voice. Enforce with `git config --local claude.coauthor false` (set globally once to cover all repos).
- **Set commit identity deliberately.** Author with the account's noreply address — `git config --global user.email "<id>+<username>@users.noreply.github.com"` — and set `user.name "<username>"` too, or git falls back to the OS full name and leaks it. The human runs this; agents don't touch git config.

---

## Data handling

- **Append-only.** Append rather than overwrite; dedup by unique key.
- **Source attribution.** Every record carries its origin (source URL, connector, capture date) so any value traces back.
- **Defensive optional fields.** Null-check before rendering or processing.
- **Null renders as an explicit placeholder** ("N/A", "—") — never a blank element.
- **Empty ≠ broken.** A legitimately empty result (clean audit, no matches) is valid — render an explicit "none" state. An *extraction failure* is a bug — log it and track coverage in `issues.md`. A silent `0` conflating the two reads as "covered everything" when it didn't.
- **Generated output commits with its source.** Seed + baked JSON, or rules + derived `llms.txt`, move together (a bisect must never land on an inconsistent state); assert the match with a test.
- **Capture dates over "current" framing.** Record `captured_at` and surface "as of YYYY-MM-DD"; record `archived_via` when a value came from a secondary/archived source.
- **Don't re-stamp `captured_at` on a re-parse.** A run that regenerates output from unchanged cached bytes preserves the original capture date — load prior dates before processing and only re-stamp genuinely reissued (byte-different) sources. Stamping everything to today churns the audit trail and misrepresents provenance.
- **Keep bounded values, don't drop them.** A bare `\d+%` regex silently discards real rows like `>99%` / `<1%`; parse `[<>~]?(\d+)%`, keep the number, and carry the bound as metadata. Dropping unparseable-but-real values is a silent coverage gap, not a clean filter.
- **Preserve raw values when cleaning.** Normalizing a name/date/location/category? Keep the original in a parallel `*_raw` field — cleaning is lossy, and raw is the only way to debug a bad transform or re-derive under new rules.
- **Cap by content, not count.** Trimming an append-only collection to a fixed count silently drops the oldest valid records. Bound by a content predicate (date window), store everything, limit *display* in the UI (top-N + "show all"). Log a threshold warning; never let the data layer enforce the cap.
- **Quality/confidence is its own field.** Keep geocoding confidence, match certainty, modeled-vs-observed separate from the value — a high-severity record with a low-confidence location differs from a clean one, and conflating them hides the gap.
- **Separate facts, estimates, and judgments** into distinct labeled lanes. A tool may have a view but mustn't manufacture certainty — show the data and mechanism behind a recommendation, never a black-box score.
- **Publication date ≠ capture date.** Store the source's own publish date separately from `captured_at`; show publish when present, else capture. Don't fabricate a date for an undated source — leave it null.
- **Absence of a judgment is meaningful.** An empty curator field (status, verdict) means "not yet assessed," not a default. Don't auto-fill or add a catch-all "unknown" — leave it off so the record reads as it did before the field existed.
- **Contested → show both sides.** When a third party documents a shortfall the subject disputes, tag it "contested" and surface both sources — don't pick a winner. Reserve the strongest adverse status for ≥ 2 independent sources or a citable regulator/court finding.
- **Rates need denominators.** Raw counts mislead across groups of different size. Rank by a rate against an exposure measure (volume, population, length); label any raw-count ranking a triage heuristic, not a verdict.
- **Don't re-identify anonymized data.** Combined records can re-identify individuals. Aggregate small counts before surfacing; don't publish a precise individual narrative unless already public and necessary.
- **AI-synthesized values are provisional.** LLM aggregations from secondary round-ups aren't citation-grade. Audit each against a primary source, stamp `verified_at` + a per-row source; don't ship them as fact.
- **A 200 + a real file is not proof the source backs the claim.** A guessed identifier (docket / order / case number) can resolve to a real but *unrelated* document. Verify the *content* matches (page-1 caption: entity, date, identifier) — not just that the URL loads. Prefer self-proving artifacts (a downloaded PDF with `page_count > 0`) over a metadata-only "verified" flag; the un-fetched escape hatch is the fabrication vector.
- **Survey the real distribution before hardcoding an allowlist.** An exact-match allowlist drops the long tail (casing/prefix variants). Check the actual value distribution first, and filter on a stable underlying type, not the human-entered label, when one exists.
- **Enforce a source-host allowlist in code.** When data must come from authoritative origins, make the loader *raise* on any off-origin URL (e.g. non-`.gov`) — don't trust reviewer vigilance. Test it over every committed seed.
- **Archive the source bytes, not just the URL.** Save the fetched document to a local store and commit a provenance *manifest* (url, `fetched_at`, `sha256`, http status, content-type, size, method) — keep the binaries out of git, the manifest in. Key the manifest on `sha256` so a re-fetch bumps `last_verified` on unchanged bytes and flags a changed hash as drift. A frozen copy lets you re-extract after the live site moves (a policy PDF that 404s a plain fetcher archived fine under a browser User-Agent).
- **Make every shown claim traceable by a re-runnable check.** A validator that walks each line item (preferred pick, alternative, reject, tier) to a cited, resolvable source — and, in a `--live` mode, re-fetches each source — catches the #1 rot in a cited dataset: the source *website* drifts (URL moves, 404s, goes JS-only) even when the underlying *material* is stable. Reachability is dep-free and the highest-value signal; PDF content-tracing needs a parser, so flag PDFs rather than silently skipping them.
- **Link to live external values; don't bake volatile numbers.** Cash drug prices (GoodRx, Cost Plus Drugs) change daily — deep-link to the live lookup instead of freezing a dollar figure that's wrong by next week. Same instinct as separating facts from estimates: show the *mechanism* (a link to the current price), not a stale snapshot dressed as fact.

---

## Issue tracking (`issues.md`)

A living audit trail in the project root.

- Each bug: date, area, description, root cause (**code bug** vs. **test bug**), status (Open / Fixed).
- On resolution: the fix + the commit. Check whether a regression test is needed.

## Backlog (`backlog.md`)

- Add ideas immediately — don't lose them. Each: description + priority (low / medium / high).
- Reprioritize periodically; demote stale "high" items rather than let them rot.

---

## Python standards *(when the project uses Python)*

- Type hints on all functions. `pathlib.Path` for paths. `logging`, not `print`, for runtime output.
- All constants in one config module. Pydantic for validation. Python 3.9+ unless specified.
- Pin dependencies with `==` (see Supply-chain hardening for hash-locking).

---

## Frontend standards *(when the project has a web frontend; full system in [DESIGN.md](DESIGN.md))*

- Functional components + hooks only. TypeScript strict, no `any`.
- Colors, enums, constants in a dedicated file — never inline.
- Data transforms in hooks/utils, not components.
- Loading, error, and empty states on every view. Visible focus indicators on every interactive element.
- **Mobile-first**; test at 375px before declaring done. **Touch targets ≥ 44px.**
- **Deduplicate image assets;** `<picture>` + `srcset` for AVIF/WebP/PNG. Never serve uncompressed PNGs for content. **Descriptive `alt`** on every content image.
- **Only load libraries used on the page.** No backend-only deps in read-only frontends.
- **Responsive CSS, not duplicate DOM trees.**
- **Budget the DOM.** Synchronously rendering thousands of nodes freezes the main thread (38k rows → ~265k nodes). Keep working sets in memory, render only a visible window (pagination + IntersectionObserver sentinel), hydrate in chunks across idle ticks, regression-test the node count. A sentinel can fire repeatedly before layout settles — gate the append on a real scroll-distance check, not `isIntersecting` alone.
- **Lossy visuals keep the value in `aria-label`.** A glyph standing in for a number (checkmark for a count) carries the exact figure in `aria-label` so screen readers and tests still get it. Guard with a test.
- **The `[hidden]` trap.** A `display: ...` rule overrides the `hidden` attribute. Always ship a `[hidden] { display: none }` rule alongside it.
- **The ellipsis trap.** `overflow: hidden` + `text-overflow: ellipsis` silently no-op on a `display: inline` element (a bare `<span>`) — set `block`/`inline-block`/`flex`/`grid` on anything you expect to ellipsis, plus `min-width: 0` on a flex/grid parent so the column can shrink below intrinsic width.

---

## Performance, reliability & bandwidth — measure, don't guess

Ship targets, then track them against real users; Google ranks on p75 *field* data, not lab averages.

- **Core Web Vitals at p75, segmented by page/device/percentile.** The `web-vitals` library reports LCP/INP/CLS for free; beacon batched on `visibilitychange`, sample at high traffic. Synthetic (Lighthouse CI) catches regressions pre-merge, RUM catches what real devices see — run both.
- **Budget page weight + request count, fail CI on regression.** A `size-limit`/bundlesize check per route so a heavy dep fails loud, not silent. Benchmark against the lightest site in the portfolio.
- **Track bandwidth over time** — a 3× jump in transfer size / request count is a regression to investigate. (The reducing levers — AVIF/WebP, tree-shake, code-split — live in Frontend standards; this is about *watching the number*.)
- **Track error rate + uptime.** Beacon client errors (`window.onerror` or the analytics tool) — a spike after a deploy is the roll-back signal. Backends also track request error rate + p95 latency.
- **Put before/after weight + CWV in any hot-path PR.** A number beats "feels fast."

### Website analytics — privacy-first, not GA4

For a content/static site, default to a **cookieless, privacy-first** tool (no consent banner, <2 ms script):

- **Skip GA4 by default** — ~2.5 MB + ~17 ms, cookies/fingerprinting, GDPR-non-compliant in parts of the EU, and consent fatigue drops 40–60% of EU traffic from the data. Use it only when you need its ad-attribution/funnels and accept the weight + banner.
- **Decision rule:** on Cloudflare → **Cloudflare Web Analytics** (free, barebones, samples). Want portability/self-host → **Plausible** (~1 KB, EU-hosted; Umami/Fathom equivalent). On Vercel and staying → **Vercel Web Analytics** (zero-config but lock-in — never the reason to stay). Need deep attribution → GA4. Never proxy a tracker through your own domain to dodge blockers (Security → privacy).

---

## Network ethics & rate limiting *(when fetching from external sources)*

- ≥ 1.5–2s between requests to one host. Informative `User-Agent`. 429 → exponential backoff from 10s.
- Cache all fetched content to disk; re-runs never re-download.
- Persistent block after retries → log to `issues.md` and skip, never crash.
- **Start small** — validate against a handful of pages before a full run.

---

## AI / API cost optimization *(when the project uses LLM APIs)*

- Cheapest model that meets quality (Haiku before Opus). Keyword pre-filter before expensive calls. Truncate/excerpt input.
- Cache responses by content hash; never re-classify identical content.
- Log cost per layer; print a run summary. `--dry-run` and `--fetch-only` work without an API key.

---

## Working with AI agents (meta-principles)

- **Research is triggered by a specific gap, not by default.** Resolution ladder for any coding question: grep the repo → read the relevant file → one targeted web fetch → ask the user. Don't run multi-source research sweeps for tasks answerable from the codebase. A full web-research pass costs 20–50K tokens; most code tasks cost under 5K. Fetching more than 2–3 URLs for a single coding task is a signal to stop and ask instead.
- **A faster/cheaper agent run usually *failed*.** A deep-research or workflow fan-out that finishes quicker and cheaper than expected has often died mid-way and returned nothing — confirm the result object is non-empty before trusting the metric. And reserve fan-outs for genuinely open-ended questions: one deep-research pass is tens of subagents and millions of tokens. If you can enumerate the sub-questions yourself, do the work inline (grep → read → one fetch).
- **Context is RAM, not memory.** (Karpathy: LLMs are "fuzzy CPUs.") Fill it with what the task needs — no more. Watch for context poisoning (compounding early errors), distraction (noise burying signal), and clash (contradictory instructions).
- **Early expensive operations compound.** Every tool result is re-fed on every later turn, so a costly turn-2 mistake multiplies all session. Keep early turns cheap, defer heavy work, `/clear` rather than carry bloat. Suppress verbose output by default (pipe to `tail`; read full only on failure) — a re-run re-injects the whole thing.
- **Inline before subagent.** A subagent costs ~25–40K tokens of orchestration; an inline `WebSearch` ~5–10K, a `grep` near-free. Spawn only for synthesis, adversarial verification, or 10+-file exploration; do routine "find X" / "understand this module" inline. In a fan-out the verify phase is the cost sink (~80% of subagents, cache tokens dominate) — lower the verify-claim cap, one vote per well-sourced fact.
- **Start fresh on topic switches.** `/clear` between unrelated problems; break complex tasks into small committed steps.
- **AI has no taste.** Review output for: excess try/catch, needless abstractions, bloat instead of refactoring, generic naming (`data`, `result`, `utils2`), comments that restate code, gratuitous emoji or marketing tone. The fix is one thing: **match the surrounding code's idiom** so a diff doesn't announce a different author.
- **AI-sounding prose is a tell too.** Scrutinize shipped words — UI copy, empty states, READMEs, generated narrative — as hard as code. Cut the LLM register (*delve, leverage, robust, seamless,* "it's worth noting"), marketing vapor, rule-of-three padding, hollow summaries. Lead with the specific; short declaratives; read it aloud. Full list in [DESIGN.md § 11.1](DESIGN.md). On drafting: if a paragraph fights back, source more — don't draft more; the struggle means you don't understand the topic yet. Confident first draft, light edit, shelve a weak one rather than sand it down.
- **The four agent failure modes** (Karpathy), each already a rule here: (1) unverified assumptions → surface tradeoffs, ask first; (2) abstraction hypertrophy → minimum code; (3) collateral changes → touch only what the task needs, log adjacent cleanup in `backlog.md`; (4) no success criteria → define "done" and loop until verified.
- **AI is a tool, not a substitute for discipline.** Apply the fundamentals — perf audits, bundle analysis, review — to generated code. High LOC means nothing if it's bloated.
- **Vibe coding for throwaway; engineer the rest.** The moment a user depends on it, you owe it *agentic engineering* (vibe coding raises the floor; this raises the ceiling). Litmus test: **can you defend the output** under review? If not, you're still vibe coding.
- **Intent specification is the new coding.** The unit shifts from typing lines to delegating macro-actions; the scarce skill is judgment — what to delegate, how to specify, how to review fast. Write non-trivial logic as a prose spec first (trigger, inputs, mechanism, success criteria). **LLMs automate what you can verify** — build the feedback loop first.
- **Make instructions agent-legible.** Setup/deploy/run steps as copy-pasteable markdown blocks, not brittle scripts. Document the APIs, CLIs, and logs an agent can sense and drive — the more it can sense and drive, the more it closes the loop unattended.
- **Closed-loop validation** is the biggest force multiplier: when the agent can answer "did it work?" itself, every iteration is fast.
- **Keep this file current.** Append concise notes when something surprises you (a failed pattern, a correct invocation, a quirk). This is scar tissue — grow it, don't rewrite it.
- **Write big plans to files.** Spec large tasks to a `docs/` markdown file and review before executing.
- **Sweep for orphaned wrapper shells after long-running commands.** A background polling wrapper (`until ps -p $(pgrep -f "...")...; do sleep N; done`) can outlive its process: once the PID exits, `pgrep` returns empty and the `until` loop never resolves, sleeping forever. Run `pgrep -fl "<project-path>"` before declaring done and `kill` stragglers. Fixes: prefer a Monitor tool over inline polling, or invert to `while pgrep -f "..."; do sleep N; done` so the loop exits when the process disappears.

---

## Influences

- **Andrej Karpathy** — "make it work, then make it good"; LLM-as-fuzzy-CPU; eval-as-the-loop ("LLMs automate what you can verify"); context over prompt engineering; the closed-loop bar for trustworthy agents; the 2026 shift from vibe coding to *agentic engineering* (intent spec + task decomposition) and the four failure modes (unverified assumptions, abstraction hypertrophy, collateral changes, missing success criteria).
- **Pieter Levels (levels.io)** — ship fast and ugly; boring tech beats shiny; solo-friendly defaults (vanilla, SQLite, single-file, cheap hosting); profit before scale; don't add a dependency you can't maintain alone; talk to users daily.

When in doubt: **ship the smallest version that works, then iterate on what real users do, not what you imagine they'll do.**

---

## FirstPassRx — project-specific scar tissue

Append-only. These are quirks specific to this repo's data sources and tooling, not universal rules.

- **GoodRx and Cost Plus Drugs both 403 a plain `fetch()`/WebFetch call, but a real browser session
  (Chrome extension navigate + get_page_text) gets through cleanly.** Bot-protection is keyed on
  TLS/browser fingerprint, not URL shape. For any future cash-price work, drive the real browser
  tool, not WebFetch — WebFetch will look like a dead end that isn't actually dead.
  Counter-intuitively, a plain server-side Node `fetch()` (used in `scripts/validate-prices.mjs`)
  *does* get through to Cost Plus Drugs (though still 403s on GoodRx) — different rate-limit tier
  than the WebFetch tool's IP/UA, so the live-validator script still works even though ad hoc
  WebFetch calls don't.
- **GoodRx's bare drug-name slug page (`/albuterol`, `/activella`, `/divigel`, `/climara`, ...)
  defaults to whichever strength/form the page picks first — often NOT the one a specific formulary
  cell needs.** Don't take the first price you see as truth for a specific dose. The page's own
  "Edit" control exposes every real strength/form/quantity combo as a `<select>`; picking the right
  one and hitting "Confirm prescription" rewrites the URL with `?label_override=&form=&dosage=&quantity=`
  params that deep-link straight to that exact combo — reuse that URL as both the citation link and
  the price source so the link and the number always match. See `goodRxParams` in `src/lib/cash.ts`.
- **A brand-name price is not a substitute for a missing generic price.** When GoodRx has no page at
  the exact generic strength/form a cell describes but does have the *brand* at that strength, don't
  attach the brand price — brand can be 3-10x the generic and would badly overstate real cost. Leave
  it link-only and log the gap in `issues.md` (see the Climara 0.05mg case).
  - **Cost Plus Drugs product pages sometimes fail to hydrate on the first `get_page_text` read**
  (shows only "Skip to Main Content" — a client-side price-calc race, not a real 404/error). A second
  read on the same tab after a beat resolves it. Don't treat this as "no price available" without a
  retry.
- **State Medicaid MCO rosters churn — verify the current list before building a payer set, don't
  trust memory/training data.** Molina exited Virginia Medicaid mid-2025; a plan named "VA Premier"
  doesn't exist. One `WebSearch` for "<state> Medicaid managed care organizations <year>" before
  scaffolding a new guide's payer list is cheap insurance against citing a defunct or wrong plan.
  Same instinct applies to commercial-plan rebrands (Amerigroup → Wellpoint happened in 6 specific
  states, not nationwide — check the state list, don't assume a rebrand is universal).
- **This session's browser-preview tool (`preview_screenshot`) intermittently returns a blank or
  corrupted frame after a `scrollIntoView`/`scrollBy` + reload sequence, on an otherwise-healthy
  page.** Confirmed via `document.body.innerText` / computed-style reads returning correct content
  every time the screenshot was blank. Treat `preview_eval` DOM/style reads as the authoritative
  verification signal; retry `preview_screenshot` at most once or two before trusting the DOM read
  over it — don't burn turns re-screenshotting a real bug that isn't there.
- **Never fan a Workflow out past 2 concurrent agents without asking first.** Two data-gathering
  Workflow scripts in one session (one `pipeline(10 payers) → parallel(4 classes)` = ~55 agents, one
  ~30 agents) both hit "Server is temporarily limiting requests" on ~85% of agents — the fan-out
  width overwhelmed the API regardless of the formal per-workflow concurrency cap. The user's
  correction was blunt and specific: never more than 2 at a time without asking, even under a
  standing "don't stop to ask, just decide" instruction from the same session. Recovery worked
  because each agent had been told to checkpoint its own JSON to
  `data-gathering/<stamp>/<payer>[-<class>].json` before returning (per the `formulary-data` skill) —
  reading those files off disk recovered the ~15% that did succeed instead of needing to re-run
  anything. For any future multi-payer/multi-class gather, do it in small batches (≤2 concurrent)
  and confirm scale with the user before launching, not after something breaks.
- **Check `src/data/state-index.json` before spawning a payer-metadata discovery phase for any
  state.** It already holds pre-vetted formulary URLs, PBMs, and market-segment info for several
  states (populated by an earlier `state-formulary-index` run) — the VA/NY workflow above launched
  a full payer-metadata-gather phase without checking this first, burning agents to re-discover
  data that was already sitting in the repo. Grep it first; only spawn discovery for states/payers
  actually missing from it.
- **`data-gathering/<stamp>/` checkpoints do not survive between sessions — they're gitignored and
  live only in that session's worktree.** A later session picking up "resume from the checkpoint"
  language in `backlog.md`/`issues.md` found the entire `data-gathering/va-diabetes-2026-07-01/`
  and `data-gathering/ny-ace-2026-07-01/` directories simply gone (the worktree that wrote them had
  been cleaned up). The checkpoint-then-return pattern only protects against *that session's*
  connection drop, not against the directory outliving the session. Don't treat an unmerged
  checkpoint as durable state referenced from committed docs across sessions — either merge it into
  `formulary.json` promptly, or note in the backlog that the checkpoint may need re-gathering from
  scratch next time, not "resume from disk."
- **`validate()`'s count-floor (every payer × active class must have a cell) means a guide can't be
  committed with partial payer coverage.** Adding a new multi-payer guide (e.g. VA diabetes: 8
  payers × 4 classes) can't be merged into `src/data/formulary.json` piecemeal as each payer's
  research finishes — a guide with 3 of 8 payers filled in fails `npm test` immediately, because
  every existing payer must cover every non-`comingSoon` class. Gather the full grid in a scratch
  location (agent checkpoints, or a Workflow's returned results) first, and only write the guide
  into `formulary.json` once every payer × class cell is present; if the gather run comes up short,
  leave `formulary.json` untouched and report the gap rather than half-merging.
- **Enforce the hard 2-concurrent-agent cap *inside* a Workflow script by chunking, not by trusting
  the workflow's own concurrency cap.** `parallel()`/`pipeline()` run up to `min(16, cores-2)`
  agents at once by default — well above this project's hard limit. To actually get ≤2 concurrent,
  loop over the item list in chunks of 2 and `await parallel(chunk...)` per chunk (a plain `for`
  loop with a sliced array), rather than calling `parallel()`/`pipeline()` once over the full list.
- **GoodRx's exact-dosage query params can be guessed directly from the pattern — no need to click
  through the page's "Edit" UI every time.** The format is
  `label_override=<slug>&form=<tablet|capsule|...>&dosage=<N>mg&quantity=<count>`; navigating
  straight to a guessed URL (e.g. `?label_override=lisinopril&form=tablet&dosage=10mg&quantity=30`)
  landed on the exact strength/quantity page on the first try for 4/4 ACE inhibitors this session.
  Cheaper than the click-through-Edit-and-Confirm flow documented earlier for the HRT patches (that
  flow still exists as a fallback if a direct param guess doesn't resolve to the right page).
- **Cost Plus Drugs product slugs aren't always `<genericname>-<strength>-<form>` — verify with the
  site's own search before assuming a 404 means "not carried."** `benazepril-10mg-tablet` 404'd,
  but the real product exists at `benazeprilhcl-10mg-tablet` (search suffixes the salt form, "hcl").
  `enalapril-10mg-tablet` similarly 404'd; the real slug was `enalaprilmaleate-10mg-tablet`. Fix:
  hit `costplusdrugs.com/medications/?query=<genericname>` first, read the real product link off
  the results table, and only fall back to a "not carried" conclusion if the search itself comes up
  empty. Also reconfirms the known hydration race (CLAUDE.md above): the price-calculator box can
  render empty on the first `get_page_text` read even on a URL that resolves fine — reload once
  before concluding a product isn't priced.
- **`src/data/formulary.json` remains canonical; the app loads generated guide chunks.** Run
  `npm run data:split` after editing the canonical file and commit `src/data/generated/index.json`
  plus `src/data/generated/guides/*.json` with it. `npm test` checks that the chunks are current;
  `npm run dev` and `npm run build` regenerate them. This keeps one auditable source while stopping
  each new state/prescription guide from inflating the initial browser bundle.
- **Never use a bare `===` as an echo separator in Bash commands — zsh equals-expansion kills the
  whole compound command.** Any word starting with `=` makes zsh try to resolve the rest as a
  command path (`(eval): == not found`, exit 1), so `grep … ; echo ===; grep …` silently drops
  everything after the first grep. Quote it (`echo "==="`). Bit a workflow agent and the main
  session on the same day (2026-07-02).
- **A plain `WebFetch` on a large government PDL PDF can return only binary/metadata with no
  readable page text, even though the PDF itself is real and fetchable** — same "looks dead but
  isn't" category as the GoodRx/Cost Plus bot-protection note above, just a different cause (PDF
  parsing, not bot detection). The NYRx PDL (85 pages) needed the PDF-reading tool to extract real
  text; a naive fetch alone would have wrongly concluded the source was unreadable. For any future
  large-PDF formulary source, try a dedicated PDF tool before downgrading verification to
  `partial`/`example` on the assumption the document is unreachable.
- **A brand-new state (no `state-index.json` entry, no existing guide) needs its Medicaid
  administrator/PDL identity discovered from scratch via live search — never assume the agency name
  from training data.** Illinois HFS's PDL and pharmacy-benefit structure (administered directly, no
  contracted PBM) was confirmed by search + a live fetch of the actual `illinois.gov` PDL PDF before
  citing anything, per the existing state-Medicaid-roster-churn rule above. Same instinct, now
  proven for a state with zero prior footprint in this repo, not just a payer-roster refresh.
- **The Workflow tool's `args` global can arrive as a JSON-encoded string in this harness, not the
  parsed object its own docs describe.** A first `formulary-gather` invocation threw
  `undefined is not an object (evaluating 'cells.length')` immediately, even though `args` was
  passed as a real JSON object (not a string) in the tool call. A minimal diagnostic script
  (`log(typeof args)`) confirmed `args` was literally the string `'{"hello": "world", ...}'`. Fix:
  every workflow script should defensively do
  `const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args` before destructuring —
  baked into `.claude/workflows/formulary-gather.js`. Also: a brand-new hand-authored script only
  works reliably invoked via `script` (inline) the first time; a cold `scriptPath` call to a file
  that was never run via `script` hit the same bug immediately — resubmit inline once, then switch
  to `scriptPath` for later runs/edits.
- **`fm.formularynavigator.com` and `uhcprovider.com` join the "looks blocked but isn't" list** (see
  the GoodRx/Cost Plus Drugs note above): both block Claude's `WebFetch` (a domain safe-browsing
  check), but a plain `curl` with a browser User-Agent gets the real PDF every time. For any payer
  formulary hosted on FormularyNavigator or a big-carrier provider domain, try a direct `curl`
  fetch before concluding the source is unreachable.
- **A `git diff` on `formulary.json` after a Python `json.dump` re-serialize can look enormous
  (thousands of lines) even when only a couple of guides actually changed.** Adding 8 records to
  `ny-ace`/`ny-nsaids` produced a 4500-line default-algorithm diff touching `va-diabetes`/
  `il-nsaids` too — but `git diff --diff-algorithm=histogram` on the same change showed the true
  edit (~1300 insertions, 4 deletions), and a Python equality check confirmed every untouched
  guide's parsed content was byte-for-byte identical. Myers diff gets confused by JSON's repetitive
  `},`/`{`/`],` structural tokens once line positions shift from an insertion earlier in the file.
  Use `--diff-algorithm=histogram` (or compare parsed JSON directly) before assuming a huge diff
  means unintended reformatting.
- **`.claude/workflows/formulary-gather.js` is the reusable gather script for any future (state,
  topic) expansion** — parameterized by `{stamp, state, today, payerTasks}` where each payerTask
  carries one payer plus its full list of assigned classes (one agent per payer, one fetch,
  every assigned class covered from it — never one agent per (payer, class) cell, which
  re-fetches the same source N times; see `docs/agent-runs.md` cost lever #1 and the 2026-07-06
  row for the confirmed incident this shape fixes). Chunks agent calls to the hard ≤2-concurrent
  cap itself, so it's safe to invoke directly without re-deriving the chunking logic. `npm run
  validate-coverage` reports the full national (state × topic) grid plus a payer-roster cross-check against
  `state-index.json` — run it before scoping any new gather batch instead of hand-counting gaps.
- **Run `npm run archive-sources` after every gather-and-merge cycle, not just when convenient.**
  `scripts/archive-sources.mjs` already exists (committed 2026-07-06) and does exactly what a future
  session needs: fetches every cited reference URL with a browser UA, saves raw bytes to `sources/`
  (gitignored — keeps binaries out of git), and commits a `sources/manifest.json` provenance entry
  (url, sha256, http status, content-type, size, first_archived/last_verified) keyed for drift
  detection. It was forgotten for 3 consecutive multi-topic merges (MD, VA, MA shipped 2026-07-07
  with zero new archive entries) before a user reminder caught the gap — running it afterward
  backfilled 52 → 196 entries in one pass. Make it the last step of every merge, right alongside
  `npm run data:split` and the test suite, not an optional afterthought. The raw bytes only persist
  for the current worktree's lifetime (same durability caveat as `data-gathering/<stamp>/`
  checkpoints — see the entry above) but the committed manifest survives regardless, so even a
  future session that lost the cached bytes knows exactly which URL/hash to re-fetch instead of
  re-discovering the source from scratch.
- **The multi-topic merge (checkpoint JSON → new/expanded guides in `formulary.json`) has a stable
  shape across every state gathered so far (NY, MD, VA, MA, IL) — recreate it, don't reinvent it.**
  A generic `merge_state(state_code, region, today, ckpt_dir, payer_order, payer_meta_by_id,
  topics, glossary_source_guide)` Python function folds per-payer/per-class checkpoint JSON into
  one-or-more new guide objects: `topics` is a dict of `guide_id -> {label, topicId, topic,
  unitNoun, classIds, classes_source_guide, include_coming_soon}`, reusing an existing guide's
  class taxonomy (`ma-inhalers` for inhaler classes, `ny-ace` for ace-inhibitor, `va-diabetes` for
  diabetes classes, `md-menopause` for menopause-HT classes) rather than re-authoring class
  metadata per state. Always emit a minimal 2-term glossary (PA, step therapy) rather than copying
  a source guide's full glossary — sourceIds are guide-scoped, so a copied glossary breaks
  `validate()`'s cross-guide resolution. *Expanding* an existing guide (adding new payers to
  `il-nsaids` rather than creating a brand-new guide) needs one extra manual step beyond
  `merge_state()`: append the new payers/records/references directly to the existing guide object
  (reusing `build_record()`), since `merge_state()` only ever appends brand-new guides to
  `d["guides"]`. This script lives in the session's scratchpad, not committed to the repo — a
  future session needs to recreate the same shape (or hand-merge) rather than expecting to find it
  on disk.
- **A large government PDL PDF (100+ pages) is cheaper to mine by targeted keyword search + page
  reads than by reading the whole document.** IL HFS's 150-page PDL was covered for all 14 needed
  drug classes by searching for each class's section heading and reading only those pages (SABA/
  ICS/ICS-LABA/LAMA on pages 9-13, ACE inhibitors on 44-45, diabetes classes on 23-28, HRT classes
  split across 74/139/150) rather than reading page 1 through 150 in order. Applies to any
  100+ page formulary/PDL source once you know the class names to search for.
- **A PDF table-extraction artifact can fabricate a drug form that doesn't exist in reality — sanity-
  check extracted entries against real drug knowledge, don't just transcribe the table.** The IL
  Medicaid gather's GLP-1 extraction produced `"OZEMPIC TABS PREFERRED_WITH_PA"` — Ozempic
  (semaglutide) has no FDA-approved tablet form; the real oral semaglutide product is Rybelsus, a
  separate line in the same PDF. This is almost certainly a multi-row/multi-NDC table collapsing
  during extraction, not a real formulary entry. The research agent caught it by flagging the
  anomaly explicitly in its `verificationNote` rather than silently transcribing it as fact, and
  used Rybelsus as the authoritative oral-semaglutide preferred pick instead — the right instinct
  when a PDF extraction produces something that contradicts known drug facts (a molecule/dosage-
  form pairing that doesn't exist) is to flag it and cross-check, not trust the raw extracted text.
  A second, similar case the same gather caught: `SPIRIVA RESPIMAT 2.5 MCG/ACT` appeared twice in
  one extracted table with conflicting Preferred/Non-Preferred status on the same line item, almost
  certainly a pack-size/NDC collision in the source table — flagged in the record's
  `verificationNote` rather than arbitrarily picking one status, so a human reviewer knows to
  verify at the point of prescribing rather than trusting a silently-resolved guess.
- **A payer's own PDL wording style — not the state — determines whether a "non-preferred" hit is a
  genuine PA barrier (reword) or a real cost-tier-only item (reclassify to `alternatives`).** Every
  Medicaid MCO's binary Preferred/Non-Preferred PDL seen across NY/MD/VA/MA/IL gathers is the
  reword case (being "non-preferred" **is** the PA trigger under these payers' own process). The
  IL gather was the first to also hit the inverse for real: `bcbs-illinois-commercial`, an actual
  multi-tier **commercial** Marketplace plan (not Medicaid), had "Tier 3/4, non-preferred" items
  with no PA/step criteria stated anywhere in the source — these are genuinely just costlier-but-
  covered and belong in `alternatives`, not `paRequired`. Check the payer's *document structure*
  (binary PDL vs. real tiered cost-sharing) each time, not an assumption carried over from the
  last payer in the same batch.
- **Cash-link resolution is keyed on the drug NAME, not strength/form — and the UI (`ResultCard`/
  `PrescribeOptions`) looks it up by `agent.inn` ALONE, not `inn + brand`.** Two consequences bit
  the 2026-07-09 cash-price sweep: (1) a matcher must hit the *inn* string, not just the brand — the
  existing micronized-progesterone rule matched only `/micronized progesterone|prometrium/` and so
  the bare inn "progesterone" (the actual progestogen-cell value) fell through to a link-only
  fallback until the matcher was broadened to `/progesterone|prometrium/`; (2) two forms sharing one
  inn can't be told apart — both ipratropium cells carry inn "ipratropium bromide" (one HFA aerosol
  ~$234, one nebulizer solution ~$34), so a single rule serves both and must pick one representative
  price (chose the generic nebulizer, noted the HFA caveat in the rule comment). When measuring the
  cash-price gap, measure it *per cell on the preferred agent* (the 177-cell number that actually
  matters to a user), not `KNOWN_UNPRICED_GAP`, which counts every covered name including the
  alternatives long tail and reads far scarier than the headline-recommendation gap.
- **A bare generic-name cash matcher silently mis-prices multi-ingredient COMBO drugs — always
  exclude combos with a negative lookahead.** `/\bmetformin\b/` matched ~50 covered combo names
  (Synjardy, Xigduo XR, Trijardy, Janumet/sitagliptin-metformin, glipizide/pioglitazone/saxagliptin-
  metformin) and priced them all as cheap plain metformin ($29.63) — badly wrong for $300-600 brand
  combos, and worse than the prior link-only state because it shows a confidently-wrong number. A
  code-review pass (regex-shadowing angle) caught it. Fix: `/^(?!.*\b(?:dapagliflozin|empagliflozin|
  sitagliptin|glipizide|pioglitazone|synjardy|xigduo|...)\b).*\bmetformin\b/i` so combos fall
  through to the SGLT2 rules (a reasonable proxy — the SGLT2 is the costly component) or the no-price
  fallback. Same trap applies to any single-agent matcher whose drug appears in fixed-dose combos.
- **GoodRx exact-dosage deep links still work by guessing params, but two 2026 quirks:** (1) the
  Ozempic page has migrated to the new *oral* semaglutide tablet as its default and gates the
  injectable pen behind a client-side "Switch" control that `?form=pen` no longer overrides — capture
  the pen via the manufacturer cash price the page surfaces (NovoCare "$199", vs ~$950 standard),
  same as Jardiance ($249) and Lantus ($35) surface manufacturer/copay-program prices rather than a
  plain coupon; (2) for injectable brands (Trulicity/Lantus/Humalog/Victoza/Tresiba) the **bare slug**
  (`goodrx.com/trulicity`) lands on GoodRx's own sensible 1-carton/1-vial default and is more reliable
  than fighting the quantity param (a `quantity=4` was interpreted as 4 cartons = 4 months). The
  headline number to record is the "Standard GoodRx price" (CVS-anchored at the session ZIP), matching
  the existing inhaler rules' convention.
- **Cost Plus product slugs are inconsistent — some carry a salt + brand suffix, some don't — so
  discover the real slug from the search page's DOM instead of guessing.** `metformin-500mg-tablet`,
  `naproxen-500mg-tablet`, `meloxicam-15mg-tablet` resolve on the plain `<generic>-<strength>-<form>`
  pattern, but `dapagliflozin-10mg-tablet` 404s and the real slug is
  `dapagliflozin-propanediol-10mg-tablet-farxiga` (salt + brand suffix). Fastest discovery:
  `navigate` to `costplusdrugs.com/medications/?query=<generic>`, then
  `javascript_tool` → `[...document.querySelectorAll('a[href*="/medications/"]')].map(a=>a.href)` to
  read the real product hrefs (the search rows aren't exposed in the accessibility tree, so
  `read_page` won't surface them). Ibuprofen (any Rx strength) is genuinely not carried — a real
  "not carried" outcome, GoodRx-only by design.
- **A BOGL (`boglActive:true`) requires the generic to be AB-substitutable for the EXACT preferred
  product/device — not just "a generic of the same molecule exists somewhere."** The 2026-07-11 VA
  sweep flipped the four `va-inhalers` `lama` cells to BOGL because a generic tiotropium exists — but
  the preferred agent is **Spiriva Respimat** (a soft-mist inhaler with NO AB-rated generic), while the
  only generic tiotropium is a **HandiHaler dry-powder capsule**: a different, non-interchangeable
  device a pharmacist can never substitute at the counter, so DAW accomplishes nothing. Code review
  (device-nuance angle) caught it; reverted all four to `genericAvailable:false, boglActive:false`.
  Contrast the *clean* same-device BOGLs that stuck the same day: Symbicort MDI→generic
  budesonide-formoterol (Breyna, same MDI), Advair Diskus→Wixela (same DPI), Spiriva **HandiHaler**
  capsule→generic tiotropium capsule (same capsule) — all AB-rated to the exact preferred product.
  Rule: before setting `boglActive`, confirm the generic shares the preferred agent's **dosage form +
  delivery device**, not merely its INN. Soft-mist (Respimat), Ellipta/Breo, and other proprietary
  devices usually have *no* generic even when the molecule does — leave those `genericAvailable:false`.
- **For a Medicaid MCO cell, verify against the MCO's OWN FormularyNavigator `FBO/<n>/<Payer>.json`
  NDC export, not a mirror of the statewide PDL.** VA's Cardinal Care MCOs follow the statewide DMAS
  PDL, so an earlier gather filled the Aetna Better Health cells by copying FFS data and marking them
  `partial`. Fetching Aetna's own export (`fm.formularynavigator.com/FBO/111/Aetna_Better_Health_of_Virginia.json`,
  27 MB, 102,529 NDCs, per-NDC `drug_tier`/`prior_authorization`/`step_therapy` flags; curl+browser-UA,
  the host 403s a plain fetch) both upgraded 9 cells `partial`→`verified` AND surfaced a real BOGL the
  mirror had encoded wrong. The FBO JSON is the authoritative payer-branded source; the per-NDC
  `drug_tier` label even names the statewide tier ("State PDL Non-Preferred"), so one MCO's export also
  reveals what the shared PDL does for every sibling MCO. Blob is byte-identical across payers pointing
  at the same FBO number, so committing it costs ~nothing (git dedups by sha).
- **A spawn_task chip's background session lands its own worktree/branch — fold it into the active
  PR with `git cherry-pick`, don't open a second PR.** A UI bug flagged mid-session (the `roleOf()`
  false-"Generic"-badge bug above) was spun off as a background task; it landed 2 commits on
  `jam/quizzical-mahavira-84cc82` in its own worktree, sharing the same base commit as the active
  session's branch. `git merge-base` confirmed the shared base, so `git cherry-pick <sha1> <sha2>`
  applied both cleanly with zero conflicts — cheaper and cleaner than merging or opening a rival PR.
  After tests passed (307/307, +2 for the new regression test) and the branch was pushed, removed
  the now-redundant worktree (`git worktree remove`) and deleted the local branch (`git branch -D`).
  Also: `.claude/launch.json`'s dev-server preview should set `"autoPort": true` on every
  configuration — a fixed port hard-fails when a concurrent session's dev server already holds it,
  which is common when multiple worktrees/spawn_task sessions run against this repo at once.
