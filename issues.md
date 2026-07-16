# Issues

Living audit trail. Each bug: date, area, description, root cause (code bug vs. test bug), status.

## Fixed

- **2026-07-08 · code (scripts/archive-sources.mjs) · two real bugs caught by PR review on the
  redaction feature, both fixed same-day.** (1) **Fixed-length redaction could corrupt binary
  files**: the original `redactSecrets()` replaced a matched secret with the literal string
  `[REDACTED]`, a different byte length than what it removed — harmless for the HTML files seen so
  far, but a real corruption risk the moment a match ever landed inside a PDF's byte-offset-
  dependent structure (xref table, stream `/Length`). Root cause: **code bug** — didn't consider
  that the redaction function is applied uniformly to every fetched buffer regardless of format,
  not just the HTML files where the first incident happened. Fixed by masking every match
  character-for-character (`'*'.repeat(match.length)`), so no replacement ever changes a file's
  byte length. (2) **18 manifest entries claimed `ok: true` with a `saved_path` that was never
  actually committed** — orphaned by an old id scheme (`stateSourceId()` used to slice/truncate the
  URL string directly; it was rewritten at some point to a proper sha256-based hash, silently
  orphaning every entry keyed under the old scheme, since the archiver only ever adds/updates
  entries for ids in the *current* target set, never removes ones that fell out of it). Root
  cause: **process gap** — the archiver had no step that reconciled `manifest.entries` against the
  actual current target set, so a scheme change (or any reference dropping out of
  `formulary.json`/`state-index.json`) accumulates permanent dead weight. Fixed by pruning any
  manifest entry whose id isn't in the current target set before archiving, plus a new end-of-run
  integrity check that verifies every `ok` entry has a matching file with matching bytes/sha256 and
  fails loud (non-zero exit) if not — see the PR review + CLAUDE.md's FirstPassRx scar-tissue
  section for the underlying reasoning.

- **2026-07-07 · security (sources/ archive) · a live third-party API key reached a local commit

- **2026-07-07 · security (sources/ archive) · a live third-party API key reached a local commit
  before push, caught by GitHub push protection — root cause analysis.**

  **What happened:** After switching `scripts/archive-sources.mjs`'s output from gitignored to
  committed (per user request, to make the archive durable across worktree cleanup), a bulk `git
  add sources/ && git commit` staged 214 archived third-party pages verbatim. One of them
  (`sources/il-hfs-pdl-process.html`, Illinois HFS's own PDL-process page) contained a live Mapbox
  API key embedded in a `<map-details api-key="...">` widget. `git push` was rejected by GitHub's
  secret-scanning push protection (`GH013`) before anything reached the remote — the secret never
  became publicly visible.

  **Root cause:** I ran a bulk-commit of raw, unmodified third-party HTML/PDF content without first
  scanning file *contents* for embedded credentials — despite CLAUDE.md's own standing instruction
  ("Before committing: `git diff --cached | grep -iE \"apikey|password|token|secret\"`") already
  covering exactly this check. Two things let it slip past attention: (1) the mental model was
  "these are formulary documents" (drug/coverage data), not "these are arbitrary third-party web
  pages that can embed anything a map widget, translation script, or analytics tag needs" — the
  content-type reasoning didn't generalize past what I was looking *for* (drug data) to what else
  might be *in* the file; (2) 214 files were staged in one `git add sources/`, past the point where
  a human would eyeball a diff before committing. The existing repo convention (grep before
  commit) is a manual step that depends on someone remembering to run it on exactly this kind of
  bulk, non-authored content — it did not fire.

  **Verification after the fact:** searched full git history (`git rev-list --all` + `git grep`)
  and confirmed the secret existed in exactly one local commit, which was never pushed (the reject
  happened first). Redacted the file, amended that commit (safe — never left this machine), then
  ran `git reflog expire --expire=now --all && git gc --prune=now` to purge the now-dangling
  original commit/blob from the local object store entirely, so the secret doesn't linger even
  unreachable-but-present in `.git/`.

  **Structural fix (not just a note to remember next time):** built automatic secret detection
  directly into `scripts/archive-sources.mjs` itself — every fetched byte is scanned against a
  pattern list (Mapbox/Google/AWS/Slack tokens, PEM private keys, generic `key: "..."` assignments)
  and redacted *before* the bytes ever touch disk, with the redaction recorded in the manifest
  entry for auditability. Re-running the archiver with this in place immediately found **3 more**
  previously-uncaught instances beyond the one that tripped GitHub's scanner: a Weglot
  translation-widget key (same Illinois HFS page) and an Akamai Boomerang RUM analytics key shared
  across 3 unrelated payer pages — confirming this is a systemic property of scraping third-party
  web pages, not a one-off, and that a one-time manual grep would have kept missing instances a
  broader, automated, and *permanent* scan catches by construction. See `scripts/archive-sources.mjs`
  for the pattern list and redaction logic.

- **2026-07-07 · test (App.test.tsx) · a guide-switch test hung for 15+ seconds instead of failing
  fast, tracing to a real (but user-unreachable) UI race.** Adding MD's first second guide
  (`md-inhalers`) meant a state click could itself trigger an intermediate guide load (MD already
  had a guide for the *current* topic) before the topic click landed. `Controls.tsx` correctly
  disables every state/topic tab while `loadingGuideId !== null`, specifically to prevent a state
  and topic switch from racing each other — but the test's `switchGuide` helper clicked the topic
  tab immediately after the state tab, landing on a still-disabled button, which silently no-ops.
  Root cause: **test bug** — a scripted click sequence is far faster than any real user, who
  physically cannot click a disabled button (a lazy-loaded JSON chunk resolves in a few ms).
  Diagnosed by temporarily logging every `switchGuide` call + its `loadGuideView` resolution
  (removed after); confirmed by the actual DOM show a legitimate "could not load" panel from an
  *unrelated*, real data bug (see the `cigna/icslaba` entry below) found along the way — don't
  assume "flaky" means "just add a timeout" without checking the DOM for what's actually rendered.
  Fixed the test helper to wait for the topic tab to be enabled before clicking it, matching what a
  real user's click would do. All 214 tests now run in ~2.5s (was hanging to a 15s+ timeout).
- **2026-07-07 · data (md-inhalers) · one more `paRequired`-vs-`alternatives` misclassification
  (`cigna`/`icslaba` TRELEGY ELLIPTA) escaped the first fix pass because the same drug appears
  twice — once under LAMA, once under ICS/LABA (it's a triple-therapy product spanning both
  classes).** The LAMA instance was fixed; the ICS/LABA instance was missed in the same pass.
  Root cause: **process gap**, not a code bug — `validate()` caught it immediately once the guide
  was actually loaded through the app (not just via the schema test, which only validates the
  *first* guide with an error before `Array.map` throws and skips the rest — see the coverage note
  in backlog.md). Fixed; also fixed the same rewording/BOGL patterns recurring in `md-ace`,
  `md-diabetes`, and `md-nsaids`, which the schema test's short-circuit had never actually reached.

- **2026-07-06 · data (3 new NY guides: ny-inhalers, ny-menopause, ny-diabetes) · a cluster of
  ~18 research-agent misclassifications caught by `validate()` across 5 payers.** Two distinct,
  now-recurring failure modes, both already seen once each in earlier sessions but this time at
  volume (NYRx alone tripped it across all 4 inhaler classes + insulin + sglt2 + glp1):
  (1) **Genuine PA barriers mislabeled by wording, not by fact.** NYRx's PDL is a real binary
  preferred/non-preferred system where "non-preferred" **is** the PA trigger — these are true
  barriers, just phrased with the literal word `validate()`'s cost-tier regex flags. Fixed by
  rewording (not reclassifying) every instance to "not on NYRx's preferred list."
  (2) **BOGL flagged on the wrong drug, or where no real generic exists to be "over."** Several
  records set `boglActive: true` with a `boglNote` describing a *different* alternative drug's
  brand-preference, not the actually-chosen `preferredAgent` (which had `brand: null` — a hard
  schema violation). Others set it for a class where the boglNote itself said "no generic exists
  in this class at all" — that's a brand-only market, not BOGL (which requires an *available*
  generic being passed over). One record (`ny-medicaid`/LAMA) had a real bug baked into the
  chosen `preferredAgent`: it picked bare generic tiotropium as "preferred," while the record's
  *own* `paRequired` list correctly showed generic tiotropium needs PA (NYRx's BLTG program
  prefers the brand Spiriva HandiHaler) — a genuine self-contradiction, fixed by making the brand
  the preferred agent. Root cause: **process gap**, not a code bug — `validate()` caught every
  instance; none shipped unnoticed. Given the volume, `docs/agent-runs.md`'s per-run note flags
  this as a candidate for adding worked examples to the gather prompt if it recurs a third time
  at this scale.

- **2026-07-06 · process · a full session of tooling work produced zero new (state, topic) grid
  cells.** User asked directly "what did you do this session for new data? I don't see any" after
  a session that built the reusable `formulary-gather` workflow, the coverage validator, and
  expanded 2 *existing* NY guides' payer depth — none of which changed the national grid count
  (still 6/255, same as session start, confirmed by `npm run validate-coverage`). Root cause:
  **scope drift** — the actual ask ("prescription data present for all states") requires new
  (state, topic) guides, but every completed task had been payer-depth or cash-price work on
  guides that already existed. Fixed by actually creating one: `va-ace` (8 payers, reusing
  `va-diabetes`'s roster, all `verified`) — first new grid cell of the session, 6/255 → 7/255.
  Two research-agent misclassifications caught by `validate()` and fixed in the same pass: Aetna
  Better Health VA's cost-tier-only items (no PA/step per the agent's own NDC-level data) were
  wrongly tagged `nonformulary` — moved to `alternatives`; Anthem HealthKeepers Plus's and UHC
  Community Plan's *real* PA barriers had reason text that happened to contain the word
  "non-preferred," tripping the same regex for a different reason — reworded rather than
  reclassified, since these are genuine barriers, not cost-tier placements.
- **2026-07-06 · data (cash prices) · closed the ma-inhalers cash-link gap (13 of 232 unpriced
  names).** User flagged "lots of GoodRx and Cost+ drugs info missing" after browsing the app.
  Researched all 8 remaining ma-inhalers drugs via a real browser session (Dulera, Incruse
  Ellipta, Arnuity Ellipta, Yupelri, Tudorza Pressair, Asmanex Twisthaler, Alvesco, QVAR
  RediHaler): real GoodRx coupon prices for all 8, but **zero** Cost Plus Drugs matches — searched
  each generic name (mometasone, umeclidinium, fluticasone furoate, revefenacin, aclidinium,
  ciclesonide, beclomethasone) and Cost Plus only carries topical/nasal/combo forms of a couple of
  these components, not the actual inhaler devices. Root cause: **coverage gap**, not a code bug.
  `KNOWN_UNPRICED_GAP` lowered 232 → 219. Remaining, still open: md-menopause (59), ny-nsaids (66),
  va-diabetes (76, currently **zero** priced drugs), il-nsaids (12), ny-ace (10). See backlog.md.
- **2026-07-06 · data (ny-ace, ny-nsaids payer expansion) · 2 research agents misclassified a
  covered-but-higher-tier drug as a coverage barrier.** Gathering the 4 new NY payers (Excellus
  BCBS, UnitedHealthcare, Anthem BCBS NY, Excellus Medicare) via the new `formulary-gather`
  Workflow, 2 of 8 cells put a drug in `paRequired` with a reason mentioning "higher tier" or
  "non-preferred" — exactly the pattern `validate()` already guards against (a cost-sharing
  difference is not a barrier; see the IL NSAIDs case below from 2026-07-05). `ny-excellus-bcbs`/
  `ace-inhibitor` flagged Trandolapril as `step` for being Tier 3 with no actual PA/ST code; moved
  to `alternatives`. `ny-anthem-bcbs`/`nsaid-oral` flagged TOLECTIN (tolmetin) as `pa` based on the
  agent's own admission that its tier wasn't cleanly read (page-boundary extraction issue) — rather
  than guess, the line item was dropped from the record entirely (neither claimed covered nor
  PA-required) with the `verificationNote` updated to say so honestly. Root cause: **process gap**,
  not a code bug — `validate()`'s regex check caught both immediately; `npm test` never needed to
  be bypassed. Confirms the schema-validation gate is doing its job on freshly-gathered data, same
  as it did for the codex-bot-caught IL NSAIDs case.
- **2026-07-06 · infra (Workflow tool) · the `args` global arrives as a JSON-encoded string in this
  harness, not the parsed object the tool's own docs describe.** A first `formulary-gather` run
  threw `undefined is not an object (evaluating 'cells.length')` immediately, even though `args` was
  passed as a real JSON object in the tool call (not a string) per the documented convention. A
  minimal diagnostic script (`log(typeof args)` / `JSON.stringify(args)`) confirmed `args` itself
  was the literal string `'{"hello": "world", ...}'`. Root cause: **environment/tooling quirk**, not
  a project code bug — worked around by having the script itself do
  `const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args` before destructuring,
  which is now baked into `.claude/workflows/formulary-gather.js` so future invocations don't hit
  this. Also confirmed: `scriptPath` mode only works cleanly once a script has been registered via
  an inline `script` call first — a cold `scriptPath` call to a file that was only ever written by
  hand (never run via `script`) hit the same `args` bug immediately, so any newly hand-authored
  workflow script needs its first invocation to pass `script` inline, not `scriptPath`.
- **2026-07-01 · data (cash prices) · NY ACE inhibitor guide's 4 drugs had no cash-link rule.**
  `Lisinopril`, `Benazepril`, `Enalapril`, `Ramipril` — the preferred agent + all 3 covered
  alternatives in the `ny-ace` guide — fell to the generic fallback-slug guesser (link only, no
  verified price), since ACE inhibitors were a new drug class `cash.ts` had no rules for. Root
  cause: **coverage gap**, not a code bug. Fixed: added 4 `CASH_LINK_RULE`s with real GoodRx
  (exact-dosage `goodRxParams` deep link, 10mg/30-count) and Cost Plus Drugs prices captured via a
  real browser session; `KNOWN_UNPRICED_GAP` dropped 76 → 72 accordingly. `validate-prices.mjs`'s
  existing ceiling check already re-verifies this on every future data refresh (any class, not just
  ACE) — it fails loud if a new covered drug is added without a matching cash-link rule.
- **2026-06-29 · UI (cash-price links) · wrong vendor destinations.** GoodRx links used clinical
  display labels as URL slugs, and every Cost+ link opened the unfiltered medication directory.
  Root cause: **code bug** — vendor URL formats were treated as interchangeable. Cash links now
  normalize to canonical GoodRx pages, use current Cost Plus product paths for matching products,
  and omit Cost+ when no match is known. Covered by `src/lib/cash.test.ts` and app link assertions.
- **2026-07-01 · UI (PA appeal letter) · stale letter text after switching payer/class.**
  `AppealAction`'s letter was built once via a `useState` lazy initializer and never rebuilt when
  the surrounding record/payer/drugClass changed for a same-named barrier drug at the same list
  position (React reuses the component instance). Root cause: **code bug** — missing the
  `useEffect` resync pattern `RxSig` already used for the identical problem. Found independently by
  3 review passes plus the `chatgpt-codex-connector` PR bot, which supplied a real reproduction
  case already in the data ("estropipate oral tablet" under MD menopause's Priority Partners vs
  Medicare Part D). Fixed with the same resync pattern; regression test in `App.test.tsx`.
- **2026-07-01 · data (PA appeal letter) · step-therapy text could describe a different drug.**
  `record.stepTherapy` is a class-level blurb that can cover multiple distinct barrier drugs (e.g.
  MassHealth LAMA's combined Tudorza/Yupelri note); it was attached to every barrier drug's letter
  regardless of relevance. Root cause: **code bug** — no outcome check before including it. Fixed:
  only shown for a `step` outcome, framed as class-wide rather than specific to the one drug.
- **2026-07-01 · docs · formulary-map.md not regenerated for the new NY guide.** `build-map.mjs`
  hardcoded only `ma-inhalers`/`md-menopause` in its state-name lookup, so adding `ny-ace` would
  have rendered an ugly `ny-ace (ny-ace)` in-app header alongside a stale "New York — index only"
  duplicate section. Root cause: **code bug** — found by the codex PR bot. Fixed: the lookup and
  the index-only section now both key off the same guide list, and the map was regenerated.

## Open

- **2026-07-01 · process (data gathering) · VA diabetes re-gather (chunked ≤2 concurrent) hit
  transient connection failures, not rate-limiting.** Resuming the `va-diabetes-gather` Workflow
  (run `wf_20cee55f-82a`) to pick up the remaining 7 of 8 payers failed all 7 with
  `FailedToOpenSocket`/`ConnectionRefused` errors — a different failure mode than the earlier
  85%-rate-limited 55-agent fan-out (see below), and not something the ≤2-concurrent cap was meant
  to fix. Root cause: **infra/connectivity**, not a code or scale bug. 1 of 8 payers (VA Medicaid
  FFS) completed successfully before the failures and is checkpointed at
  `data-gathering/va-diabetes-2026-07-01/va-medicaid-ffs.json` (verified, all 4 classes). _Open —
  see backlog.md for the resume plan._
- **2026-07-01 · process (data gathering) · `data-gathering/` checkpoints referenced in
  backlog.md no longer existed on disk at the start of this session.** Both
  `data-gathering/va-diabetes-2026-07-01/` and `data-gathering/ny-ace-2026-07-01/`, which
  backlog.md described as holding per-payer research ready to "resume from disk," were absent —
  the directory is gitignored and apparently didn't survive past the session/worktree that wrote
  it. Root cause: **process gap**, not a code bug — the checkpoint-then-return pattern protects
  against a dropped connection mid-run, but nothing protects an unmerged checkpoint from a
  worktree cleanup between sessions. Recovery: re-ran the VA diabetes gather this session, which
  re-populated `data-gathering/va-diabetes-2026-07-01/` with 1 fresh, real payer checkpoint
  (`va-medicaid-ffs.json` — see the entry above); that directory is no longer empty as of this
  writing. `data-gathering/ny-ace-2026-07-01/` was **not** re-gathered this session and remains
  empty/absent. _Open — NY ACE's other 5 payers still need a fresh gather; see backlog.md._

- **2026-06-28 · data (MA inhalers) · dead source citation.** `npm run trace:live` flags the MGB
  Fluticasone HFA PA Policy URL (`mgb-flut-hfa-pa`, cited by `mgb/ics`) as **HTTP 404** — the policy
  PDF moved on the MGB site. Root cause: **source drift** (the website changed), not a code bug.
  Fix: re-locate the current policy on the MGB pharmacy-policy index and update `meta.references`
  for `mgb-flut-hfa-pa`. Out of this session's MD scope; logged for the MA pass. _Open._
- **2026-06-28 · data (MA inhalers) · slow/JS-only sources.** `trace:live` also flags MassHealth
  PA-37 (timeout on the Conduent host) and the BCBS-MA / MassHealth-Table-23 / MGB-policy-index
  pages as content "drift" — they are JS-rendered portals, so the static HTML lacks the drug names.
  Not broken, but un-traceable by static fetch; verify manually or via the source PDF. _Open._
- **2026-06-28 · CSS · dead rules after the result-card reflow.** The reflow (lead-with-table +
  appendix) orphaned several CSS rules now matched by nothing: `.cost-note*`, `.reject__intro`,
  `.coverage-panels` grid, `.coverage-panel--covered`, `.detail-stack` / `.detail-block` (RxSig moved
  into `.appendix__block`). Root cause: **refactor leftover** (not a runtime bug — harmless, just dead
  code). Fix: prune in a CSS-cleanup pass; low priority. _Open._
- **2026-07-06 · data (cash prices) · NY payer-expansion added 64 more unpriced drug names.**
  Expanding `ny-ace`/`ny-nsaids` from 1→5 payers each surfaced each new payer's own long tail of
  ACE-inhibitor/NSAID brand and generic-form variants (ALTACE, VASOTEC, ZESTRIL, LOTENSIN family;
  CELEBREX, ANAPROX DS, NAPROSYN, RELAFEN, FELDENE, DAYPRO, EC-NAPROSYN, diclofenac submicronized,
  etc.) that the existing 20-drug `cash.ts` ruleset has no entry for. `src/lib/cash.test.ts`'s
  ceiling caught it (`KNOWN_UNPRICED_GAP` raised 168 → 232, same "declared, not silent" pattern as
  the 2026-06-30 and 2026-07-02 raises below). Root cause: **coverage gap**, not a code bug. Fix:
  research + add cash-link rules for the new NY commercial/Medicare drug names, same process as the
  existing 20. _Open._
- **2026-06-30 · data (cash prices) · 72 of 220 covered-drug names have no priced cash-link rule.**
  `src/lib/cash.ts` has real GoodRx + Cost Plus prices (captured 2026-06-30, live browser session)
  for the 20 rules covering both inhaler classes and the core menopause HT products. The MD menopause
  guide's `alternatives[]` lists carry ~72 additional name variants — the Premarin/Prempro/Duavee/
  Bijuva/Angeliq family, vaginal rings (Estring/Femring/Imvexxy), Menest/Estratest, Crinone, Osphena,
  Prefest — plus a handful of non-inhaler respiratory drugs (Dulera, Yupelri, Arnuity Ellipta, Asmanex,
  Incruse Ellipta, QVAR, Tudorza) that have no explicit `CASH_LINK_RULE` and fall to the generic
  fallback-slug guesser (link only, unverified, no price). Root cause: **coverage gap**, not a code
  bug — these products were simply out of the original 20-drug scope. Found via `src/lib/cash.test.ts`
  ("does not silently grow..."), which pins this at a ceiling of 72 so it can't regress further
  unnoticed; also fixed one regex-ordering bug in the same pass (rule 15's twice-weekly patch group
  required "estradiol" to precede the brand name, so "Lyllana (estradiol transdermal system)" fell
  through to the unpriced weekly-patch rule instead of its correct, already-priced match).
  Fix: research + add cash-link rules for the remaining family, same process as the 20 already done.
  _Open._
- **2026-07-01 · data (cash prices) · closed 3 of 4 within-rule price gaps flagged by user review.**
  Rules 1 (albuterol nebulizer), 10 (Activella 0.5mg/0.1mg), and 14 (Divigel 1mg gel) were missing a
  GoodRx price because the vendor's default page shows a different strength; GoodRx exposes the exact
  strength via a `dosage=` query param reachable through the page's own "Edit" control, so all three
  now have a real GoodRx price + a `goodRxParams`-qualified deep link that matches it (see `cash.ts`).
  The 4th (rule 16, Climara 0.05mg weekly patch) stays unpriced on purpose: the only GoodRx page at
  that exact strength is the **brand** product ($75.07), while this rule's cells describe the
  *generic* — showing the brand price there would overstate what a generic fill actually costs, so
  it's left link-only. Root cause: **research gap**, not a code bug. _Fixed (3/4); Climara open by design._
- **2026-07-01 · process (data gathering) · 55-agent + 30-agent Workflow fan-outs hit heavy API
  rate-limiting.** Building the VA diabetes and NY ACE inhibitor guides, two Workflow scripts each
  fanned out one agent per (payer × class) — 55 agents for VA (10 payers × 4 classes + verify), 30
  for NY (10 payers × 1 class + verify). ~85% of the class-gather/verify agents failed with "Server
  is temporarily limiting requests" (not a usage-limit error — a transient concurrency overload).
  Root cause: **process/scale bug**, not a code bug — the fan-out width (up to ~16 concurrent
  agents queued from a much larger total) exceeded what the API could sustain. The user corrected
  this directly mid-session: never run more than 2 concurrent agents without asking first (see
  `CLAUDE.md` scar-tissue section, and the `feedback-agent-concurrency-cap` memory). Recovered by
  reading the on-disk checkpoints (`data-gathering/<stamp>/*.json`, written by each agent before
  returning per the `formulary-data` skill's design) instead of re-running — this is exactly the
  resilience the checkpoint-then-return pattern was built for. Result: shipped the one payer (NY
  Medicaid/NYRx) that had complete, dual-sourced data; held back VA and the other 5 NY payers
  rather than fabricate or force incomplete cells past schema validation. _Open — remaining cells
  need small-batch (≤2 concurrent) follow-up, see backlog.md._
- **2026-07-02 · process (data gathering) · VA diabetes gather: 2 of 8 payer agents died on the
  session usage limit; finished inline.** A fresh chunked Workflow (≤2 concurrent, 8 agents, one
  per payer) completed 6 payers cleanly; the final chunk (Sentara Commercial, Wellcare Value
  Script) failed with "You've hit your session limit" before either agent started, so no
  checkpoint existed for them. Root cause: **usage-limit exhaustion**, not rate-limiting and not a
  code bug. Recovered by gathering both inline in the main session (curl + pypdf off the plans'
  own formulary PDFs — no agents needed), writing the same checkpoint shape to
  `data-gathering/va-diabetes-2026-07-01/`, and merging all 8. Lesson: for a 1-payer-sized gap,
  inline gathering is cheaper and immune to the subagent usage limit. _Fixed (guide shipped)._
- **2026-07-02 · tooling (zsh) · `echo ===` separator aborts a compound Bash command.** In zsh, any
  word starting with `=` triggers equals-expansion (`=cmd` → path lookup), so a bare `===`/`====`
  separator fails the whole command with `== not found` (exit 1) even though everything before it
  succeeded. Bit a workflow agent's "Extract Sentara formulary text" step and then the main session
  in the same day. Root cause: **shell quirk**, not a code bug. Fix: quote it (`echo "==="`). _Fixed
  (noted in CLAUDE.md scar tissue)._
- **2026-07-02 · data (MD menopause) · DAW6 list citation rotted.** `validate-links` caught
  `health.maryland.gov/.../DAW6 List effective 3-26-2026.pdf` returning 404 — MDH reissued the
  list at `/mmcp/pap/docs/daw6-7-1-2026.pdf` (eff. 7/1/2026). Re-fetched the new PDF and
  re-verified the load-bearing claim (still no estrogen/progestogen named on the list) before
  swapping the URL/effectiveDate/accessed on `md-daw6-2026`. Root cause: **source website drift**,
  not a code bug — exactly what the link validator exists to catch. _Fixed._
- **2026-07-02 · review (PR #5) · persona reviews found 3 blocking issues in the shipped VA data;
  all fixed same-day.** (1) **Code/UI**: non-BOGL cells rendered "likely to cover X without prior
  authorization" even when the preferred agent itself was PA-gated (all 8 VA GLP-1 cells) — added
  `preferredRestriction` to `FormularyRecord`, ResultCard now shows the restriction instead, and a
  regression test asserts every va-diabetes glp1 cell carries it. (2) **Data**: 4 GLP-1 cells
  dual-listed drugs in both `alternatives` and `paRequired` (including their own preferred agent) —
  stripped; guard test added. (3) **Data**: aetna-better-health/glp1 claimed "no service
  authorization" for Trulicity, contradicting the governing statewide PDL — corrected + cross-cited.
  Also fixed: FFS closed-class `nonformulary`→`pa`, sentara-commercial insulin flagged BOGL (all
  glargine biosimilars non-formulary), 4 BOGL flags that described a sibling drug, metformin
  titration sigs, insulin sig individualization, tirzepatide GIP/GLP-1 labeling, biosimilar-not-
  generic wording, Xultophy discontinued annotation, DMAS PDL ref mislabeled as Anthem's, PDF
  WinAnsi sanitization, download error state, and the 44px touch-target on the tips summary.
  Root causes: **UI copy assumed an unrestricted preferred agent** (schema couldn't express the
  exception) and **gather agents modeled class-wide PA two different ways**. _Fixed (commit on PR #5)._
- **2026-07-10 · data (ma-inhalers) · first-built guide carried soft cells; upgraded 12 to verified
  + fixed a missed BOGL.** A full correctness/citation sweep flagged `ma-inhalers` (built before the
  reusable gather workflow existed) as the weakest guide: 6 verified / 10 partial / 4 example. The
  three commercial payer PDFs (Tufts Value Direct, Harvard Pilgrim Select — both on Optum
  contenthub — and MGB on FormularyNavigator) and the MassHealth MHDL Table 23 all fetched cleanly
  via `curl`/direct GET (the "looks blocked but isn't" pattern), so the inferred cells were verified
  against the real formularies. Corrections found while verifying: (a) Tufts/HPHC **SABA** preferred
  was branded "ProAir HFA" — real preferred is generic albuterol sulfate HFA (Tier 1); (b) Tufts
  **ICS** inferred fluticasone propionate HFA, which is actually **Tier 3 + step therapy** — real
  low-tier ICS is beclomethasone HFA (Tier 2); (c) HPHC **ICS** inferred mometasone/Asmanex, also
  **Tier 3 + step therapy** — corrected to a Tier-2 unrestricted ICS; (d) Tufts/HPHC **ICS/LABA**
  inferred Symbicort/Breo (Tier 2) — real preferred is generic fluticasone-salmeterol DPI (**Tier
  1**). Also fixed a **missed BOGL**: MassHealth's `icslaba` (Symbicort) is marked "BP" (Brand
  Preferred over generic equivalents) on MHDL Table 23 — `boglActive` was `false`; flipped to `true`
  with a `boglNote`, matching the SABA/Ventolin cell. Added `tier` strings to 16 cells (the trace
  "no insurance tier/cost" warning dropped from 20/20 → 4/20). Result: **16 verified / 4 example**;
  the 4 remaining `example` cells are BlueCross MA (Standard Control / CVS Caremark), whose source is
  an interactive lookup that 403s WebFetch/curl and whose "Focused" PDF extracts as a fragmented
  index — left honestly labeled "verify on the BCBSMA Medication Look-up" rather than fabricate
  tiers. Root cause: **pre-workflow guide had inferred preferred agents**; verifying against the live
  sources both upgraded depth and corrected several picks. _Fixed (this commit)._
- **2026-07-10 · data (observation, not a bug) · `genericAvailable:false` on 13 brand-preferred
  cells where the same molecule has a generic/biosimilar named elsewhere in the cell.** The
  correctness sweep flagged records (mostly insulin glargine/Lantus, plus tiotropium/Spiriva and
  budesonide-formoterol/Symbicort) where the preferred agent is a brand with `genericAvailable:false`
  while an alternative lists a generic/biosimilar of that molecule. These are internally consistent
  (all have `boglActive:false`, so no invariant is violated) and several are true negatives
  (empagliflozin/Jardiance genuinely has no US generic; the "generic" named is a different molecule
  in a combined phrase). Flipping them changes only the cosmetic "; a generic is fine." suffix in
  ResultCard and risks contradicting what each payer's source actually supports (biosimilar ≠ AB-
  rated generic). Left as-is pending per-source confirmation; documented here so a future sweep
  doesn't re-flag them as new. Root cause: **heuristic false-positive class**, not a data defect.
- **2026-07-11 · data (correctness) · Aetna Better Health of VA cells verified against Aetna's own
  formulary; two real BOGLs the statewide-PDL mirror had missed.** The 10 `partial` Aetna Better
  Health cells in `va-inhalers`/`va-menopause`/`va-nsaids` had been filled by mirroring the statewide
  DMAS PDL (they carried FFS-identical data marked `partial` only because no Aetna-branded source had
  been read). Fetched Aetna's payer-specific FormularyNavigator NDC export
  (`fm.formularynavigator.com/FBO/111/Aetna_Better_Health_of_Virginia.json`, 27 MB, 102,529 NDCs,
  formulary_id 22791 v33, eff 07/01/2026) via curl+browser-UA. Nine cells upgraded to `verified`
  (est-oral left `partial`, matching its FFS twin — a structural PDL gap). One cell was genuinely **wrong**
  in the mirror, not just under-verified: `icslaba` (brand **Symbicort** is Preferred, generic
  budesonide-formoterol is State-PDL-Non-Preferred; same MDI device as generic Breyna) — a real
  brand-preferred-over-generic situation the mirror had encoded as `genericAvailable:false,
  boglActive:false`. Because the tier label reads "**State** PDL Non-Preferred", the same BOGL propagates
  to every statewide-PDL-following payer: also corrected the `va-medicaid-ffs`,
  `anthem-healthkeepers-plus`, and `sentara-community` `icslaba` cells (`genericAvailable:true,
  boglActive:true` + boglNote). (The `lama` cells were initially flipped the same way but **reverted on
  code review** — Spiriva Respimat is a soft-mist device with no AB-rated generic; generic tiotropium is
  a non-substitutable capsule, so those stay `genericAvailable:false, boglActive:false`. See the
  `2026-07-11 (cont.)` sweep entry below.) Result: `va-inhalers` 32/32 verified,
  `va-nsaids` 8/8, `va-menopause` 38/40. Added the Aetna source as a new reference in all three guides;
  trace still resolves 100%. _Fixed (this commit)._ **Refines the 2026-07-10 observation above:** the
  `genericAvailable:false` pattern is NOT uniformly a false positive — where an *AB-rated generic of the
  exact product* exists (Symbicort→Breyna, Spiriva HandiHaler→generic tiotropium capsule, Advair→Wixela,
  Vagifem→generic estradiol vaginal tablet) it is a true BOGL bug. The remaining ~30 flagged cells split
  cleanly: **true negatives** (GLP-1 Trulicity/Ozempic/Rybelsus, SGLT2 Jardiance/Farxiga, insulin —
  no AB-rated US generic exists; leave) vs. **still-to-fix BOGLs** in `ma-inhalers`/`md-inhalers`/
  `ny-inhalers`/`il-inhalers` (Symbicort, Spiriva, Advair) and `va-menopause` anthem Vagifem — deferred
  to a follow-up pass that re-reads each payer's own source rather than mass-flipping. _Open (scoped)._
- **2026-07-11 (cont.) · cross-guide `icslaba` BOGL sweep resolved; `lama` Spiriva cells confirmed
  NOT blanket BOGLs.** Followed up the scoped remainder above by reading each payer's own source:
  - **CountyCare (IL) `icslaba`** — Advair Diskus/HFA are Preferred; generic fluticasone-salmeterol
    (Wixela) is absent from the 117-page Q1-2026 formulary → real BOGL, fixed.
  - **Excellus Medicare (NY) `icslaba`** — Symbicort is Tier 3/QL; generic budesonide-formoterol
    (Breyna) is absent from the 108-page 5-tier PDF → real BOGL, fixed.
  - **anthem-healthkeepers-plus (VA) `vaginal`** — generic estradiol vaginal tablet IS Preferred on
    the statewide PDL → `genericAvailable` false→true, *not* a BOGL.
  That closes every clean AB-rated-generic `icslaba`/vaginal case (Symbicort→Breyna, Advair→Wixela,
  Vagifem→generic estradiol vaginal). **The remaining `lama` Spiriva Respimat candidates
  (`ma`/`md` masshealth, bcbsma, harvardpilgrim, cigna, medicare-partd, kpmidatlantic; va
  sentara-commercial) are deliberately left as `genericAvailable:false`:** Spiriva Respimat is a
  soft-mist device with no AB-rated generic, and where a source was read (CountyCare) the generic
  tiotropium *capsule* is itself covered — so these are device-distinct alternatives, not a
  brand-over-generic steer. Only a source explicitly preferring brand Spiriva HandiHaler *capsule*
  over the non-covered generic tiotropium capsule would qualify; none seen. Diabetes/insulin
  `genericAvailable:false` cells (GLP-1, SGLT2, insulin) remain true negatives. _Sweep closed._
- **2026-07-11 (cont.) · ny-menopause ny-medicaid 5 `example` cells — coverage confirmed on the NYRx
  reimbursable-drugs file, but PA depth blocked on an undocumented code.** Fetched the authoritative
  NYRx List of Reimbursable Drugs (`docs.emedny.org/ReimbursableDrugs/MedReimbDrugsFormulary.csv`,
  37,669 NDCs, eff 2026-07-11). All five HT drug families **are covered** (estradiol 211 NDCs across
  patch/oral/vaginal, micronized progesterone, estradiol-norethindrone combo). The file's `PA` column
  takes values `0` / `G` / `N`, but eMedNY's own file-layout spec (`FormularyFileInfo.pdf`) is a COBOL
  copybook that never defines the flattened CSV's single-letter `PA` / `PREFERRED DRUG CODE` values.
  Per-form PA breakdown: **vaginal insert/cream and the estradiol-norethindrone combo are uniformly
  `PA=0`** (clean, no PA); **transdermal patch, oral tablet, and micronized progesterone are mostly
  `PA=G`** (17/109 patch, 6/34 oral, 15/26 progesterone are `0`). Because `G` is undefined in the
  available materials, marking a "no PA" verified finding on the patch/oral/progesterone cells would
  fabricate a claim, so they stay `example`. **To finish:** obtain eMedNY's `PA`-code legend (call
  center / provider manual) — if `G` ≠ prior-authorization, all 5 upgrade to verified citing the CSV;
  the `vaginal` + `combo` cells (uniform `PA=0`) are already safe to upgrade whenever a future pass
  adds the CSV as a source. _Open (blocked on code legend)._
- **2026-07-16 · data (coverage gap) · BCBS MA (`bcbsma`) 15/15 cells across all 5 MA guides upgraded
  partial/example → verified; the payer's `pbm: "CVS Caremark"` field and its actual source document
  had been mismatched.** The 2026-07-16 UAT found bcbsma's `ma-inhalers` cells cited its own
  medication-lookup page (blocked, hence `example`), while `ma-ace`/`ma-diabetes`/`ma-menopause`/
  `ma-nsaids` cited a `BCBSMA Commercial Formulary Guide` labeled "for members with the **Blue Cross
  Blue Shield of Massachusetts Formulary**" — a *different* formulary family from the one the payer
  object's own `pbm: "CVS Caremark"` field points to (BCBS MA runs 3 parallel commercial formularies:
  Medicare Advantage, **Standard Control with Advanced Control Specialty Formulary — CVS Caremark
  administered**, and the Blue-Cross-managed one). `provider.bluecrossma.com`'s medication-lookup page
  loads fine in a real browser session (matches the GoodRx/Cost Plus "looks blocked, isn't" pattern in
  CLAUDE.md) and links to `bluecrossma.org/medication/standard-control-formulary`, which lists direct
  PDF links; those PDFs are NOT bot-protected — plain `curl` with a browser UA fetched all 3
  (Comprehensive Covered Medication List, 172pp; Comprehensive Drug Removal List, 36pp; Quarterly
  Updates, 3pp; all effective July 2026) in one pass. `pypdf` extracted clean per-drug tier tables
  (`Drug Name | Tier | Requirements/Limits` columns) — no OCR/fragmentation issue this time. Standardized
  all 15 bcbsma cells onto this one authoritative source, which **resolved every open ambiguity that
  had kept them at `partial`**: (1) `ace-inhibitor` — Accupril/Altace/Lotensin/Vasotec/Zestril/Prinivil
  brands are Tier 3 *covered*, not on the removal list — moved from `paRequired`(nonformulary) to
  `alternatives`, the same "commercial multi-tier, no PA = alternatives not paRequired" pattern
  documented for IL BCBS commercial in the 2026-07-07 entries above; (2) `sglt2` — generic
  dapagliflozin is Tier 1 with **no PA/step-therapy flag at all**, contradicting the prior inferred
  "Farxiga preferred, step therapy" finding — preferred agent changed from brand Farxiga (step-gated)
  to generic dapagliflozin (clean Tier 1), a materially better first-pass recommendation; (3) `insulin`
  — the removal list explicitly names Humalog+Apidra as removed (Fiasp+Novolog are the listed
  replacements) and Basaglar as removed (insulin glargine-yfgn, i.e. the Semglee/Rezvoglar biosimilar
  under its FDA nonproprietary name, is the listed replacement) — the prior cell had this exactly
  backwards (Humalog as a covered alternative, Fiasp and the glargine biosimilar as nonformulary);
  (4) `lama` — resolves the open item from the 2026-07-11 sweep above: BCBS MA's Standard Control
  formulary explicitly prices Spiriva **HandiHaler** (capsule) at Tier 1 with no generic tiotropium of
  any device listed, while Spiriva **Respimat** sits at Tier 2 — the "explicit HandiHaler-over-Respimat
  preference" that entry said would be needed to change anything now exists for this one payer;
  preferred agent switched from Respimat to HandiHaler, `genericAvailable` stays `false` (still no
  generic tiotropium listed for either device); (5) several menopause-HT alternatives were misclassified
  in both directions — Estrace and Imvexxy were wrongly `paRequired`(nonformulary) (Estrace is Tier 3
  covered; Imvexxy is the removal list's own named replacement for removed Estring/Yuvafem/Premarin
  Cream) while Climara/Vivelle-Dot/Minivelle were wrongly in `alternatives` (all three are on the
  removal list). Also fixed a live bug the new Jardiance alternative entry would have tripped:
  `PrescribeOptions.tsx`'s `roleOf()` badge picker naive-substring-matches "generic" in the drug/note
  text, so "no generic exists" phrasing (already present in several older records across MD/VA/IL
  guides — not touched here) renders a false "Generic" badge; reworded this record's text to avoid it
  and spun off a background task to fix `roleOf()` itself rather than working around it record-by-record.
  Also corrected the payer's `productName`/`formularyUrl`/`formularyId` (previously "confirm product",
  now names the exact formulary + effective date) and added 3 new guide-scoped references
  (`bcbsma-std-covered-2026-07`, `bcbsma-std-removals-2026-07`, `bcbsma-std-updates-2026-07`) across
  all 5 MA guides, replacing the old `bcbsma-medlookup`/`bcbsma-*-source-2026-07-07` citations for
  these cells. `ma-inhalers`/`ma-ace`/`ma-diabetes`/`ma-nsaids` guides are now `dataStatus: verified`
  (every cell in the guide, not just bcbsma's); `ma-menopause` stays `mixed` (MGB's 1 `vaginal` cell
  is still `partial`, unrelated payer). `npm test`/`typecheck`/`validate-coverage`/`trace`/
  `validate-prices` all pass; per-cell cash-price gap stays 0/510. _Fixed (this commit)._
- **2026-07-16 (cont.) · user UAT screenshot caught the NSAID alternatives-list cash-price gap;
  ~19 real molecules had zero cash-link rule, referenced under ~200 verbatim phrasings.** User
  screenshotted `il-nsaids` alternatives (Etodolac, Flurbiprofen, Indomethacin) rendering with a
  GoodRx box but no Cost Plus box, and asked for a full sweep of every combination plus a check of
  competing cash-price vendors. Measured the real scope: 3,079 distinct drug-name strings
  referenced across all 25 guides (preferred agent + alternatives + paRequired), only 1,271 with
  both vendor prices. Scoped to NSAIDs first per the user's explicit pick (of 3 options offered) to
  finish one topic fully before widening. The 213 unmatched NSAID-guide alternative-list names
  collapsed to ~19 real molecules referenced under wildly different verbatim phrasing per source
  PDF (e.g. "Etodolac (capsule, tablet, extended-release)" vs "etodolac cap/tab (generic Lodine)"
  vs "etodolac oral capsule/tablet 200-500 mg" — all the same drug). Added regex-based rules for
  all 19 (celecoxib, diclofenac potassium/sodium-ER/topical/misoprostol-combo as 4 distinct
  sub-rules ordered specific-before-general, etodolac, flurbiprofen, indomethacin, ketoprofen +
  ketoprofen-ER as 2 distinct sub-rules, ketorolac, meclofenamate, mefenamic acid, nabumetone,
  oxaprozin, piroxicam, sulindac, diflunisal, tolmetin, salsalate, aspirin) instead of editing 200+
  individual data strings — the fix belongs in `cash.ts`'s matching layer, not the data.
  `KNOWN_UNPRICED_GAP` dropped 575 → 362. **GoodRx blocked this browser session with a real
  "Press & Hold" bot-check CAPTCHA** (not the usual plain-fetch 403 documented elsewhere in
  CLAUDE.md) after exactly one successful lookup (celecoxib, $21.41) — did not attempt to solve or
  route around it (bypassing bot-detection is off-limits regardless of context). All 17 Cost Plus
  prices captured are real, from a live browser session 2026-07-16; GoodRx prices are omitted, not
  fabricated, with an explicit code comment distinguishing "pending, blocked this session" from the
  2 molecules (meclofenamate, salsalate) and 1 form (immediate-release ketoprofen) Cost Plus
  genuinely doesn't carry (confirmed by search). `npm test` (25/25 cash tests, 301/301 total),
  `typecheck`, `validate-prices`, and `trace` all pass. Also researched competing cash-price
  vendors per the user's ask (SingleCare, Amazon Pharmacy RxPass, RxSaver/WellRx) — SingleCare is
  the strongest 3rd-vendor candidate (no membership fee, more pharmacies than Cost Plus) but the
  user deferred that decision until the price-fill gap is further along. **Open follow-ups, in
  priority order:** (1) retry GoodRx for these 19 NSAID molecules once the bot-check clears —
  don't just retry blindly, wait a session or more; (2) the remaining ~362-name gap outside NSAIDs
  (per the user's stated order: NSAIDs first, then "alternatives shown in the UI" broadly, then
  evaluate an exhaustive pass) — see backlog.md.
- **2026-07-16 (cont. 2) · continued the alternatives-list price-fill sweep across ACE inhibitors,
  inhalers, diabetes, and menopause-HT; `KNOWN_UNPRICED_GAP` 362 → 76 (87% total reduction from
  the original 575).** User said "DO IT" to continue past NSAIDs into the rest of the app. Worked
  topic by topic, same regex-rule approach: ACE inhibitors (captopril, fosinopril, moexipril,
  perindopril, trandolapril, their HCTZ/verapamil combos, sacubitril/valsartan — quinapril
  confirmed not carried by Cost Plus) and inhalers (Anoro, Perforomist, terbutaline, montelukast,
  Nasonex, flunisolide, Breyna) are now **fully resolved, zero gap remaining in either topic**.
  Diabetes closed the largest chunk: glipizide/glyburide/glimepiride/pioglitazone and their
  metformin/glimepiride combos, sitagliptin + Janumet, exenatide, Xigduo XR all priced; confirmed
  **the entire insulin brand family (NovoLog, Humulin, Novolin, Fiasp, Levemir, Lyumjev, Soliqua,
  Merilog) is not carried by Cost Plus** — consistent with this file's pre-existing "Cost Plus
  doesn't carry insulins" finding on the Lantus/Humalog/Tresiba rules, so not re-verified
  drug-by-drug beyond confirming insulin aspart and Humulin directly; same for Mounjaro/
  tirzepatide, Invokana/canagliflozin, Synjardy/Trijardy/Glyxambi (no generic empagliflozin
  exists), and alogliptin-/saxagliptin-metformin. Menopause-HT closed Prempro/Premphase/Duavee/
  megestrol; the rest (Femring, Bijuva, Crinone, Depo-Estradiol, Osphena, Endometrin, injectable/
  vaginal progesterone, estradiol valerate IM) confirmed not carried by direct search — this topic
  now holds all 76 remaining gap names.
  Along the way, found and fixed **3 pre-existing regex precedence bugs** unrelated to this
  session's new drugs: `estradiol.*(gel|divigel|estrogel|elestrin)` required the literal word
  "estradiol" to appear before the brand name, so bare "DIVIGEL"/"ESTROGEL"/"ELESTRIN" mentions
  (no "estradiol" in the same string) fell through — same issue on the twice-weekly-patch rule
  (missing "alora") and weekly-patch rule (missing "menostar"). Also added a bare "\bibu\b"
  abbreviation to the ibuprofen rule and a bare "glucophage" brand mention to the metformin rule —
  both real formulary phrasings that had zero rule despite the underlying molecule already being
  priced under its generic name.
  GoodRx access was highly inconsistent this session: fully CAPTCHA-walled at the start (matches
  the earlier NSAID entry), then recovered mid-session for a run of ~15 successful lookups, then
  the classifier infrastructure itself (not GoodRx) intermittently denied browser tool calls with
  "Stage 2 classifier error" for stretches of several consecutive attempts — retried each until it
  cleared rather than working around it, per the tool's own guidance. All 44 new Cost Plus prices
  this pass are real, captured live 2026-07-16; GoodRx remains pending for all of them (same
  "pending, not confirmed-unavailable" distinction as the NSAID entry). `npm test` (25/25 cash
  tests, 301/301 total), `typecheck`, and `validate-prices` all pass.
  **Remaining 76-name gap is now 100% menopause-HT**, and almost entirely confirmed not carried by
  Cost Plus (see above). A handful are still genuinely unconfirmed (not yet searched or the search
  was interrupted by tool flakiness): Menest, Estratest/EEMT/Covaryx, Estring, Abigale/Zafemy/
  Gallifrey, Prefest, estropipate, plain norethindrone 5mg, and conjugated-estrogens-oral/Premarin
  (Premarin brand confirmed carried at $192.85 mid-search, but the exact Cost Plus slug wasn't
  captured before the session's tool access degraded — needs a quick re-confirm, not a fresh
  search). Logged as an open follow-up, not guessed at.
- **2026-07-16 (cont. 3) · closed the remaining menopause-HT gap to zero (76 → 0 unmatched);
  caught and fixed 2 real embedded-substring mispricing bugs via a full-formulary audit.** User
  said "keep going." Confirmed the last unconfirmed items by direct Cost Plus search: Menest,
  Estratest/EEMT/Covaryx, Estring, Prefest, Abigale, estropipate all genuinely not carried.
  Closed 3 real, previously-uncounted gaps: (1) Abigale/Gallifrey/Zafemy are branded-generic
  manufacturer names for the *same* estradiol/norethindrone acetate combo as Activella (added to
  that existing, already-priced rule — a real find, not a new lookup); (2) "norethindrone 5 mg
  tablet" is the acetate-salt strength without the word "acetate" in the source phrasing
  (broadened the existing norethindrone-acetate rule, real price $8.48/$33.50); (3) the Premarin
  rule only matched "conjugated estrogen" in that literal word order, so "estrogens conjugated"
  (reversed, used by several sources) fell through entirely — broadened the regex AND corrected a
  stale "Cost Plus doesn't carry it" comment (true for the old rule's 0.625mg citation, false for
  the 0.3mg product, which is real and now priced at $192.85). Added 15 explicit "not carried,
  GoodRx-slug-only" rules for the confirmed-absent menopause-HT products (Evamist, Depo-Estradiol,
  Crinone, Femring, Endometrin, injectable/vaginal progesterone, Intrarosa, Osphena, Menest family,
  Angeliq, Bijuva, Prefest, Estring, estradiol valerate IM, estropipate) instead of leaving them to
  the fallback slug guesser. **`KNOWN_UNPRICED_GAP` reached 0 — every one of the 1,973 covered
  drug names in the live formulary now has an explicit cash-link rule** (down from 575 this
  morning).
  **Then a UI verification pass (clicking through md-menopause's Combination pill class) caught a
  real, live mispricing bug**: "estradiol / drospirenone (generic of Angeliq)" was rendering the
  *Divigel gel* price ($42.11/$26.85) instead of no price. Root cause: "Angeliq" contains the
  literal substring "gel" (an-GEL-iq) and the estradiol-gel rule's bare (non-word-bounded) "gel"
  alternation matched it. Fixed with a word boundary (`\bgel\b`). Ran a systematic audit of every
  short (3–6 char) bare alternation token across all of `cash.ts` against every real formulary
  drug-name string, checking for the same embedded-substring pattern — found a **second, more
  severe instance already shipped this session**: the new estropipate rule's bare "ogen" trigger
  (meant to catch the brand name "Ogen") matched the substring "ogen" embedded in "estrogen"/
  "estrogens" everywhere, silently shadowing the correctly-priced Prempro/Premphase/Duavee/
  Premarin rules for any string mentioning "estrogens" not already caught by a more specific rule
  earlier in the array — e.g. "conjugated estrogens (Premarin)" was resolving to the *wrong*,
  unpriced estropipate rule instead of its own real $192.85 price. Fixed the same way (`\bogen\b`).
  Added 2 new regression tests (4 total assertions) covering both bugs by name, per this project's
  "every fix ships with a regression test" rule — a future rule addition that reintroduces a bare
  short substring trigger will now fail loudly instead of silently shadowing an unrelated,
  correctly-priced rule.
  `npm test` (29/29 cash tests, 305/305 total), `typecheck`, `validate-prices`, and `trace` all
  pass. **Open follow-up: GoodRx is still pending for the majority of rules added across this
  entire day's sweep** (access was erratic all session — CAPTCHA-walled, briefly recovered for a
  handful of lookups, then blocked again) — revisit in a future session, not by guessing prices.
