# Issues

Living audit trail. Each bug: date, area, description, root cause (code bug vs. test bug), status.

## Fixed

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
