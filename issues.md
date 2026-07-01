# Issues

Living audit trail. Each bug: date, area, description, root cause (code bug vs. test bug), status.

## Fixed

- **2026-06-29 · UI (cash-price links) · wrong vendor destinations.** GoodRx links used clinical
  display labels as URL slugs, and every Cost+ link opened the unfiltered medication directory.
  Root cause: **code bug** — vendor URL formats were treated as interchangeable. Cash links now
  normalize to canonical GoodRx pages, use current Cost Plus product paths for matching products,
  and omit Cost+ when no match is known. Covered by `src/lib/cash.test.ts` and app link assertions.

## Open

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
