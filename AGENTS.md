# AGENTS.md — How to work in these repos as an AI agent

> Base file for every project in this folder. Project-specific `AGENTS.md` files extend this with file maps, settings keys, and project-specific conflict cheatsheets. When project conflicts with base, project wins — it's the local source of truth.
>
> Companion files: [CLAUDE.md](CLAUDE.md) is the *what* (principles, architecture, editorial rules); [DESIGN.md](DESIGN.md) is the *look*.

---

## Read these first, in order

Before touching code, read:

1. **[CLAUDE.md](CLAUDE.md)** — universal principles + project-specific intent and editorial rules. The "Project intent" and any project-specific notes are load-bearing for every change.
2. **[DESIGN.md](DESIGN.md)** — visual + content system. Touch this before changing how data is presented.
3. **`backlog.md`** (or `BACKLOG.md`) — what's next. Pick from here; don't invent work.
4. **`issues.md`** — what's broken. Check before reporting a bug as new.
5. **`security.md`** — supply-chain advisory log. **Refresh if `Last updated` is > 7 days old before any `npm install` / `pip install` / dep upgrade.** Also fetch `https://pranava0x0.github.io/vibe-coding-security/llms-ctx.txt` and surface any matching advisory before suggesting an install.

---

## The Explore → Plan → Code → Verify loop

Documented in detail in [CLAUDE.md](CLAUDE.md). Concretely inside any repo:

- **Explore.** Use `grep`, `find`, or an Explore agent to find relevant code. Most projects here are small enough that a single read of the main module + the data schema covers ~80% of the surface.
- **Plan.** For anything beyond a one-line fix, present 2–3 approaches with pros/cons before writing code. Changes that touch the data schema, the editorial rules, or the visual identity ALWAYS need a plan surface — they reshape the product.
- **Code.** Edit existing files first; only create new files when the task genuinely requires it. No new helpers for one-shot operations. For any non-trivial rule or logic, write the spec in prose first — trigger, inputs, mechanism, success criteria — then implement against it.
- **Verify.** Run the test suite. Use the feature in a browser (or invoke the CLI) before declaring done.

**Research budget.** Web searches and multi-source fetches cost 20–50K tokens and minutes of wall-clock; most coding questions are answerable from the repo in seconds. Work through this ladder before going online:

1. `grep` / `find` in the repo.
2. Read the file(s) that showed up.
3. One targeted WebFetch if the local code points to an external spec (a library's changelog, an API schema, a referenced RFC).
4. If still stuck, state the specific gap and ask — don't run a broad web sweep.

Reserve deep web research for tasks the user explicitly frames as research. Don't spawn multi-source research agents (WebSearch + multiple WebFetch + synthesis) for tasks that are answerable from the codebase. If you find yourself fetching more than 2–3 URLs for a single coding task, stop and ask.

**Per-item cadence in multi-item sessions.** Surface design questions up front, then do **tests + docs + commit per item**, not batched at the end. Catches issues early and produces a clean bisect history.

---

## Token economy

The context is RAM, and every tool result is re-fed on every later turn. Cheap habits compound:

- **Inline before subagent.** A subagent costs ~5–40K tokens of overhead; don't spawn one to grasp a small project's structure or do a bounded lookup — 1–2 targeted `grep` / `node -e` / `WebSearch` calls beat it. Spawn only for 10+-file exploration or synthesis.
- **For "where is X?" on a greppable codebase, grep first.** A literal `grep -rn` is *exhaustive* where a semantic Explore run silently misses call sites (one missed a downstream re-sort a grep would have caught). Don't send an agent to analyze data you already control (your own JSON/CSV/code) — inline `grep` + a Python one-liner is faster, cheaper (~1–2K vs ~30K), more exhaustive, and iterable where a frozen agent snapshot isn't.
- **Verify a subagent's "complete" list against a grep before acting on it for mechanical changes.** Agents report what they *noticed*; grep reports what *exists*. For every-call-site / every-reference edits, the agent's list is a lead, not a guarantee.
- **Model-select per subagent.** Simple gathering (grep, file listing, schema validation) → `model: "haiku"` (~20× cheaper). Multi-source synthesis (web research, code review, gap analysis) → Sonnet. Reserve Opus for genuinely open-ended work where Sonnet visibly underperforms.
- **Every spawn prompt carries a scope limiter.** At least one of: "report in under N words," "no more than N web searches," "read only the N most relevant files," "return the top N." Without one, Explore reads every file and a web agent fetches 20+ full pages. Default Explore breadth to `"quick"`, not `"very thorough"`.
- **Spend down a token budget out loud.** At ~50K tokens consumed in a single turn, pause and offer proceed / scope-down / abort rather than silently burning the budget.
- **WebSearch snippets usually suffice.** For "search X and add it," the snippet typically carries every field. WebFetch only for a missing field, never secondary analysis; cap at one fetch per entity.
- **Read the slice, not the file.** `grep -n` + `offset`/`limit` over whole large files; when N files share a structure, read one representative.
- **Suppress verbose output by default.** Pipe noisy scripts to `tail` / a summary; read full only on failure — a re-run re-injects the entire output. Validate inputs before triggering, don't recover after.
- **Check enum/ID constraints before writing.** Look up the live allowed `category` / `theme` / enum set first; an invalid value forces a fix-and-re-commit loop. Never guess enums from memory.
- **Don't read background-agent transcript files.** Use the completion-notification result, not the raw `tasks/*.output` JSONL — reading the transcript dumps the whole agent run into your context.
- **Confirm work isn't already done before re-running.** After a context reset, check that a research file / agent result doesn't already exist before re-spawning; re-running completed agents silently burns 50–70K tokens.

---

## Running research & multi-agent fan-outs

Reserve fan-outs for genuinely open-ended research (see [CLAUDE.md → Working with AI agents](CLAUDE.md) for whether the task needs one at all). When it does, these rules keep the run cheap and the results clean:

- **Size to the shelf.** Ask for exactly the N records the destination surface holds, ranked — never "find as many as possible." A specified count makes the agent stop instead of over/undershooting.
- **Partition entities across agents.** Each entity (person/org/sector) belongs to exactly one agent; hand each a "covered elsewhere, skip" list. Cross-agent duplicates are a partitioning failure, not a dedupe chore.
- **Seed then spawn.** Fix the JSON contract (field names, id shapes, enums, edge cases) with cheap inline searches first, then bake it into each agent prompt. Debugging a schema across N live agents costs N×; proving it once inline yields zero parse/retry loops.
- **Pre-flight the agent's premise against your own data before spawning.** A ~1-minute local `grep` can disprove the hypothesis a finder agent would be launched on — one run burned ~85K tokens chasing a format assumption a local grep contradicted (it returned `[]` *and* contradicted the project's own working parser). Check the cheap local signal first; it's near-free.
- **Batch research agents by breadth, not by unit.** One agent covering 8–10 entities/states beats eight single-entity agents — each agent re-loads the system prompt + tool schemas. Sequence agents only when a prior result genuinely informs the next direction; don't fan out in parallel "to be thorough."
- **When one entity's source document backs multiple *future* deliverables, gather everything you'll need from it in one pass — not once per deliverable.** Measured directly: the per-entity cost of a messy source (a government/payer PDF that needs a curl-fallback + a from-scratch extraction script) is dominated by the fetch-and-parse step, not by how much you read out of it once open — two same-project gathers pulling 1 vs. 4 categories out of the same class of document cost nearly identical tokens per entity (87K vs. 81K). If a later task will need 3 more categories from that same source, gather all of them in this pass; building 3 separate future fan-outs each re-pays the fetch cost for a document you've already opened. Applies whenever "one big document, many small deliverables" is the shape — not just formulary PDFs.
- **Never run more than 2 concurrent agents without asking first — this overrides "fan out for breadth" above.** A `pipeline(10 payers, ...) → parallel(4 classes)` shape (~55 agents) and a similarly-shaped ~30-agent run both hit heavy "Server is temporarily limiting requests" failures in one session (~85% of agents failed); the per-workflow concurrency cap doesn't prevent this. Confirm scale with the user before launching anything wider than 2 concurrent, even under a standing "don't stop to ask, just decide" instruction — this is the one exception. If real breadth is needed, run small batches (≤2 at a time) sequentially instead of one wide fan-out. See `docs/agent-runs.md` and [CLAUDE.md](CLAUDE.md)'s scar-tissue section for the incident.
  - **Enforce this *inside* a Workflow script by chunking, not by trusting the tool's own cap.** `parallel()`/`pipeline()` default to `min(16, cores-2)` concurrent — well above 2. To get an actual ≤2-at-a-time run, loop over the item list in slices of 2 and `await parallel(chunk...)` per slice (a plain `for` loop over a sliced array), instead of calling `parallel()`/`pipeline()` once over the full list. A follow-up VA-diabetes re-gather this session used this pattern (8 payers, 4 sequential chunks of 2) with zero rate-limit failures, vs. the earlier 55-agent one-shot fan-out that failed ~85% of the time.
- **Record exhausted / walled seams durably** (backlog + a `data-sources.md`) so no future session re-spends an agent re-confirming the same dead end. A confirmed-negative is a real deliverable — note *why* each seam is dead ("corpus X exhausted," "host Y 403s scripts → browser-capture only," "source Z is image-only scans → needs OCR"), and distinguish a closeable gap from a permanent source-side dead-end.
- **Validator bar + early bail as a hard prompt constraint.** Put required fields in the prompt with "2 searches without them → return `skip: true`," or agents grind on unfindable records and return junk rows.
- **Agents write to disk, return a summary — non-negotiable.** Subagents are isolated per spawn, so research an agent doesn't write is *irrecoverable* once it returns. Require it to Write JSON to `data/research/`, verify the file landed, and return just path + count + 2–3 surprises (~100 tokens); embedded JSON blobs bloat the orchestrator and aren't auditable. An **"export the prior agent's data" task is a smell** — a fresh agent never had it either, so you only re-research from scratch (one case wasted ~180K tokens; ~40% of research tokens go to this). The bug is upstream: the original prompt didn't write. Agents return *candidates*; integration, cross-record linking, and commits happen in the main session.
  - **That disk checkpoint is only durable for *this* run, not across sessions.** A checkpoint dir under a gitignored path (e.g. `data-gathering/<stamp>/`) lives in the session's worktree — if that worktree gets cleaned up, the checkpoints are gone even though `backlog.md`/`issues.md` still describe them as "resume from disk." A later session in this repo found two such directories referenced by name in the backlog completely absent. Don't treat an unmerged checkpoint as long-term storage: merge it into the real data file promptly, or explicitly note in the backlog that a next run may need to re-gather from scratch rather than implying a free resume.
- **The Workflow tool needs the same disk discipline — its returns are in-band.** `agent({schema})` hands the result back through the response stream, not to a file, so a mid-response drop (`API Error: connection closed mid-response`) loses that agent's work entirely (seen: a `research:biologics` agent died and its sources were gone). Have each gathering agent `Write` a checkpoint (`data-gathering/<stamp>/<key>.json`) as its **final step before returning**; on any failure read the checkpoints rather than the run's return value, and resume by `runId` so only the missing agents re-run. A workflow that took 21m and 711K tokens is one connection blip from losing it all otherwise.
- **A "session limit" failure is a graceful-pause signal with its own reset time, not a dead run — read the time before retrying.** It differs from a rate-limit (back off, retry soon) or a transient connectivity error (safe to retry immediately): a message like `You've hit your session limit · resets 7:50pm (America/New_York)` tells you exactly when a retry will work. Check current time in that timezone before resuming — retrying before the reset just fails again for nothing; past it, resume right away via the same `runId`. To confirm the resume actually skipped the already-completed work, don't trust the completion notification's `agent_count` (it counts free cache-hit replays the same as live re-runs, so it reads identical either way) — check the checkpoint directory's file **mtimes** instead: already-completed entries keep their original timestamps, only the re-run ones get fresh ones. See `docs/agent-runs.md` levers #10–11 for the incident this came from.
- **`Workflow({resumeFromRunId})` does NOT auto-replay the original `args` — omitting them crashes the resume instantly.** A script's top-level code re-executes on every resume (that's how it can return fresh results for new/changed `agent()` calls), so if `args` isn't passed again in the same tool call, it comes back `undefined` and any `const { x } = args` destructure throws before a single agent spawns (`Cannot destructure property 'stamp' from null or undefined value`, 0 agents, ~20ms — instantly diagnosable, near-zero cost to hit). Always pass the *same* `args` object alongside `resumeFromRunId`; already-completed `agent()` calls still return from cache keyed on `(prompt, opts)`, so resending `args` doesn't re-run anything that finished. Also confirmed this session: a session-limit failure can hit *after* an agent's tool calls (including its checkpoint `Write`) already succeeded — the notification reports that agent as "failed" because the limit cut off its final text response, but its checkpoint file is already durably on disk with a real timestamp. Don't assume "failed" in the notification means "wrote nothing" — check the checkpoint directory before deciding what actually needs to re-run.
- **A hand-authored Workflow script's `args` can arrive as a JSON-encoded string, not the parsed object the tool's docs describe.** A script that does `const { x } = args` can throw `undefined is not an object` immediately, even when `args` was passed as a real JSON object (not a string) in the tool call. Diagnose with a 3-line throwaway script (`log(typeof args)`); fix by making every script defensively do `const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args` before destructuring. Also: invoking a brand-new script cold via `scriptPath` (never yet run via `script`) can hit the same failure — pass the script inline via `script` once, then switch to `scriptPath` for later runs/edits.
- **Cap sources at 2 per claim** at collection time; deeper citation chains are a separate curation pass.
- **Spell out the output contract:** plain UTF-8 (no HTML entities), omit conditional keys rather than emit empty strings, "your final message is parsed, not read," "cite only URLs you fetched" (else agents cite snippets, ~5% dead). Updating records? Paste the exact ids to echo back — prose gets invented slugs back.
- **Cap search angles (~6) and give a stop rule** ("stop after N verified items, or 2 consecutive angles surface nothing new"). Breadth of angles, not result count, drives waste — 12+ angles cost ~2.7× for identical quality.
- **The final report states absences, not just hits** — what it found, what it couldn't verify, and what it deliberately excluded. A report that lists only successes hides coverage gaps.
- **Strip three recurring defects on integration:** placeholder/empty fields (recover from the source URL or drop the row), cross-agent duplicates (dedupe, pick one category deliberately), and prose contamination (agents prepend "All verifications complete…" despite instructions — drop non-data lines).

---

## Evaluate every agent run

When a subagent/background task returns, do a 30-second retrospective before consuming the result:

- **Reason** — was an agent right, or would 2–3 inline `grep`/Python calls have done it?
- **Cost** — flag anything over ~40K tokens per useful result.
- **Result** — used downstream or wasted? Did it survive verification (grep the "complete" list, confirm the result isn't empty)?
- **One improvement** — fold the lesson into a *file* (prompt template, `data-sources.md` dead-seam note, backlog entry), not just this reply. If the correction applies to the next run, it doesn't belong only in your head.

**Log it (required).** After every Agent/Workflow run, append a row to
[`docs/agent-runs.md`](docs/agent-runs.md) — date, run, agents, ~tokens, worked?, quality, efficiency
note — and give the same retrospective in the response. That file is the running scorecard and holds
the learned cost levers (gather **per entity not per cell**; **pre-supply known source URLs**; **fold
verification into the gather agent** rather than a second phase; **index before drug-level**; inline
for ≤3 lookups). Read it before launching a new fan-out. A run that finished suspiciously fast/cheap
probably failed — confirm a non-empty result before trusting the metric.

**Save it (required).** The retro row must be *committed* in the same session that ran the agents —
an updated `docs/agent-runs.md` left uncommitted in a worktree is deleted when the worktree is
cleaned, which is how earlier retros were lost. Additionally, give a **whole-session evaluation** of
all agent use (quality of results, token efficiency, and per-run whether an agent was needed at all
versus simpler inline tool calls) before the session ends, without waiting to be asked.

A solo turn with no spawn has nothing to evaluate — say so rather than invent analysis.

---

## Verifying changes

Default verification matrix (project-specific `AGENTS.md` should override with concrete commands):

| Change kind                    | Run                                                  |
| ------------------------------ | ---------------------------------------------------- |
| Schema edit                    | Schema-validation tests (Pydantic / zod / etc.)       |
| Seed / data edit               | Refresh script + data-integrity tests                 |
| Shared vocabulary change       | Match-frontend-to-backend test                        |
| Frontend (markup / styles / JS) | E2E / Playwright suite, or manual UAT in browser     |
| Connector / fetcher            | Connector unit tests + a small live integration run  |
| Dependency install / upgrade   | Advisory sweep + lockfile diff + full build/test      |
| Design tokens / styles         | Contrast + visible-focus check at mobile and desktop  |
| Anything substantial           | Full test suite (`pytest` / `npm test` / `vitest`)   |

**Narrowest meaningful test first, then broaden.** Run the test closest to the change for the fast loop; escalate to the full suite only when the change has cross-cutting risk. Don't pay full-suite latency on every iteration, and don't skip it before declaring a substantial change done.

**A schema-validation test built on `array.map(validateOne)` only reports the FIRST failing item — don't read silence past it as "the rest are clean."** `.map()`'s callback throwing on item N never runs items N+1..end in that same test invocation, so "no errors from guides 5-8" can mean "never reached," not "verified clean." Confirmed 2026-07-07: fixing one guide's validation errors revealed 3 more guides' worth of the identical issue that a prior "no errors" read had missed entirely, because the first guide's throw had masked them. Fix each reported error and re-run — don't conclude a clean sweep until a run produces zero errors with nothing left to fix.

**For UI changes**, also run the app locally and click through the affected views — type checks and unit tests verify code correctness, not feature correctness. Two screenshots — 375×812 and 1280×800 — settle a UI fix; more than that is token waste unless the change is genuinely complex.

**For data changes**, diff the canonical output (`docs/data/*.json` or equivalent) and skim the diff before committing. A 30-second skim catches regressions tests miss (especially around character encoding, pretty-printer drift, and unintended fields).

**Never use an agent to review a live UI.** Static-analysis agents read HTML/JS but can't start a server or run JavaScript — they give confidently wrong answers about dynamic behavior (declaring a working JS-rendered feature "dead"). Use `preview_eval` / `preview_snapshot` / `preview_screenshot` directly: faster, ~3K vs ~40K tokens, and actually correct.

**DOM-count before screenshot.** For any DOM-rendering change, make a ~100-token element count (`querySelectorAll('.x').length` via `preview_eval`) the *first* verification step — it catches blank-because-scrolled viewports and stale-cached-JS that screenshots and unit tests miss. Screenshot only once the count is right, and **reload the preview after a rebuild** first — an open tab shows stale data until reloaded.

**A wedged preview tab is a harness problem, not an app bug.** After many reloads the preview can split into two page contexts (duplicate `[vite] connecting` logs) so `preview_click` acts on one tab while `preview_eval` reads the other, or `location.reload()` races a `preview_click` so the click lands on the pre-reload DOM. Symptoms: a control that works in the unit test "does nothing" live, or `preview_eval` times out. Don't chase it — **`preview_stop` + `preview_start` fresh, navigate, then act**; trust the passing integration test plus one fresh-tab screenshot over a flaky live tab. Don't `location.reload()` immediately before a click in the same step.

**Run a build/codegen script twice to assert idempotency** — the second run must inject identical bytes.

**Spot-check source URLs by status** before committing externally-sourced records: `curl -s -o /dev/null -w "%{http_code}" -L -A "Mozilla/5.0..." <url>`. A 403 (bot-blocker) is inconclusive — keep it; a 404 is dead — drop or replace.

---

## Common tasks

### Adding a record / claim / row (most common)

1. Open the seed file (typically `data/seed/<entity>.json` or equivalent).
2. Append one record with: stable `id`, real `source_url`, verbatim content, today's `captured_at`, and any required category from the canonical list in the schema module.
3. Run the refresh script (validates + writes the build output).
4. Run the relevant data-integrity test to confirm.
5. Commit. Seed JSON and build output `data/*.json` move together — never in separate commits, or a future bisect lands on a broken state.

### Adding a feature

1. Confirm it's on `backlog.md`. If not, propose adding it before building.
2. Sketch the smallest version that closes the user need end-to-end.
3. Build that. Add tests alongside. Use the feature in the browser / CLI.
4. Commit at the natural boundary (per module, per fix, per doc update).

### Adding a new vocabulary item (theme, category, tier)

This is a schema change. **Don't do this casually.** Steps:

1. File a `backlog.md` entry first explaining the gap.
2. Add to the canonical constant in the schema module.
3. Mirror in any frontend mirror constant (the test that asserts parity catches drift here).
4. Add any color / icon / label token to the design system (light + dark variants).
5. Migrate any existing records that should map to the new entry — or intentionally leave them.
6. Run the full test suite — drift-safety tests should catch a missed mirror.

### Adding a connector (per-source scraper)

1. Subclass the project's `Connector` base class.
2. Register in the connector index module.
3. Implement `fetch_records()` / `normalize()` / `cache_key()`.
4. Set `run_order` so enrichment connectors run *after* their producers.
5. Schema-validate emitted records; tests catch any new field that the schema's `extra="forbid"` would reject.

### Handling PR review comments

A PR in **"COMMENTED"** state means action required, not FYI. Fetch full review bodies (not the summary line), treat any user-provided link as authoritative, extract a checklist of each distinct issue, and verify the specific flow each names — not just the happy path. The merge is the start of addressing feedback, not the end.

### Driving a browser to scrape (Chrome / Playwright MCP)

Concrete gotchas that aren't obvious until you hit them:

- **No top-level `await` in `javascript_tool`** — wrap calls in an async IIFE.
- **`window` globals don't survive a cross-domain navigation** — stash state in `localStorage`.
- **A selector inside a `[hidden]` container needs `state="attached"`**, not the default `state="visible"` — `display:none` removes the element from the box model, so a visibility wait times out.
- **Auth differs per source** — some need a logged-in browser session first; public APIs don't. Note the requirement per source in the project `AGENTS.md`.

---

## What NOT to do

- **Don't paraphrase quoted content.** Quote verbatim into the `statement` / `quote` / `body` field. Tests catch obvious markers ("they claim that…").
- **Don't write product copy in the AI register.** Headings, button labels, microcopy, empty states, and any prose that ships avoid the model tells — *delve / leverage / seamless / robust*, "it's worth noting that", marketing vapor, rule-of-three padding, hollow summaries. Plain, specific, human: lead with a number or a name, short declaratives, no ceremony. Full list in [DESIGN.md § 11.1](DESIGN.md).
- **Don't add a record without a real `source_url`.** Schema rejects it; reviewers reject it harder.
- **Don't LLM-classify subjective editorial calls.** Stance, sentiment, framing — these are curator-only. A wrong tag undermines the whole product.
- **Don't aggregate to a "trust score" / "credibility index" / "greenwashing score."** Show the data; let users judge.
- **Don't introduce a new framework / library / build tool** mid-project. If the stack is vanilla JS + Pydantic + Playwright, stay there. Adding React / Vue / Svelte / Webpack contradicts the static-first principle and adds maintenance debt the project doesn't pay back.
- **Don't touch `docs/data/*.json` (or equivalent build output) directly.** Edit the seed and re-run the refresh script.
- **Don't push scraper / refresh output straight to `main`.** When the output shape is ambiguous, malformed rows can pass schema validation and still ship — route the output through a branch + PR so a human prunes before merge. Schema validation is necessary, not sufficient.
- **Don't run credential-scoped pipelines in CI.** When the data path is authenticated with the user's session cookies or personal tokens, the refresh runs locally via a skill — never in CI, where the blast radius of a leaked credential is too large. Document why in the project `AGENTS.md`.
- **Don't expand scope inside a fix.** A bug fix doesn't need surrounding cleanup; a one-shot operation doesn't need a helper. Note future cleanup in `backlog.md` and move on.
- **Don't loosen invariants quietly.** If a rule has a test guarding it, that test was written because someone got burned. Read the rationale before relaxing it.
- **Don't `--no-verify` to bypass a hook.** Fix the underlying issue. Hooks exist because someone got burned.
- **Don't hand-roll a process waiter.** Launch long jobs with `run_in_background` and wait for the completion notification. `pgrep -f "<module>"` self-matches the waiter's own command line, so an `until pgrep` loop never exits — if you must poll, match the real invocation or capture the PID, or use a Monitor tool.
- **Don't trust `git add` on a gitignored output dir.** It skips brand-new files under a gitignored path — they bake into the site but never commit, so a fresh clone misses them. `git add -f` new records and test that every baked record is tracked.
- **Don't add yourself as a co-author or leave a machine fingerprint.** Never include `Co-Authored-By:` for any AI agent in commit messages — not Claude, Copilot, or any other tool — and no "🤖 Generated with…" footers or tool-attribution lines in commits or PR descriptions. Commits are owned by the human who reviews and ships the work. Write the message in their plain voice (what + why), not the generic-assistant register. The `claude.coauthor` git config is set to `false` in these repos; honor it.
- **Don't treat an empty result as a failure (or a failure as empty).** A legitimately empty collection renders as an explicit "none" state; an extraction/parse failure is a bug to log in `issues.md`. Conflating them hides coverage gaps. See [CLAUDE.md → Data handling](CLAUDE.md).
- **Don't invent history for a missing file.** If a referenced `backlog.md` / `issues.md` / `security.md` isn't there, don't fabricate prior entries — create the file only when the task calls for it.

---

## Repo norms

- **Read before edit.** Always. Even if you read the file earlier in this session.
- **Type hints on every Python function.** No `any` in TypeScript.
- **No `print()` for runtime output** — use the `logging` module.
- **Test alongside code, not after.**
- **Commit at natural checkpoints**: per-feature, per-bug-fix, per-doc-update. Small, focused commits over large monolithic ones.
- **Touch targets ≥ 44px** in any UI work.
- **Mobile first.** If you change UI, resize the preview to 375×812 (iPhone SE) and verify before declaring done.
- **No API keys in code, ever.** Read from environment variables; halt with a clear error if missing.
- **System fonts by default.** No Google Fonts link without explicit justification (see [DESIGN.md § 2](DESIGN.md)).
- **Don't assume a port is free — probe before binding.** Many projects run concurrently here; starting on an occupied port silently connects to the *wrong* service. Probe first, use an alternate port, and revert any temp port change before committing.
- **Disable the Bash sandbox for vitest / dev-server / `localhost` calls.** The default sandbox blocks loopback IPC — test runners hang then fail with cryptic fetch timeouts ("no tests"), and `curl localhost` returns HTTP 000. Set `dangerouslyDisableSandbox: true` for those specific calls.
- **Unset dummy sandbox env credentials for GitHub CLI (`gh`) or `git credential fill`:** If the sandbox environment injects dummy credentials (like `GITHUB_TOKEN=github_pat_antigravitydummytoken`), command calls to `gh` or `git credential fill` will fail with HTTP 401. Run `unset GITHUB_TOKEN GH_TOKEN` first to allow Git/GH to fall back and read the actual credentials stored in the native OS keychain (e.g. `osxkeychain`).
- **Delete a feature branch (local + remote) right after a successful merge — don't ask.** The merge is the signal it's done; skip the friction prompt. Exception: don't auto-delete if the merge had to be reverted.

---

## Escalate to a human when…

- The editorial frame would change (e.g. adding a new theme / category, changing the rubric for a subjective field, adding a new entity to the in-scope set).
- A subjective call is contested and you're unsure (stance tags, content categorization, what counts as a primary source).
- A canonical source URL starts 404'ing or paywalls. Pause before switching to a less-canonical source.
- Schema fields would change in a way that cross-cuts seed + frontend + tests + connectors. Sketch the migration plan in a `docs/` file first.
- The user says "ship it" but a test is still failing for unrelated-looking reasons. Surface the failure, don't silently skip.
- A "scar tissue" pitfall in [DESIGN.md § 12](DESIGN.md) seems wrong for the current task. The pitfalls exist because someone hit them; verify the rationale doesn't apply before relaxing the rule.

---

## Cross-project hygiene

Working in this folder means the user may run many small projects in parallel.

- **Stay within the current project's scope.** Don't open files from a sibling project unless the user explicitly asks. The folder-level `backlog.md` is portfolio work, not a substitute for the project's own `backlog.md`.
- **Each project's `security.md` is independent.** Refreshing one doesn't refresh the others.
- **Each project's tests are independent.** Don't infer test status across projects.

---

## When something unexpected happens

Add a concise note to the project's CLAUDE.md or `issues.md`. The pattern is:

1. **What I expected:** one sentence.
2. **What happened:** one sentence.
3. **Why:** one sentence (root cause, not symptom).
4. **What to do next time:** one sentence (the actionable lesson).

The note grows the project's scar tissue. The next agent (or you, a month from now) avoids the same hour-long detour.

That growth — files getting *slightly* more specific with each session's surprises — is the asset. Don't rewrite from scratch; append.
