# Backlog

Ideas, each with a priority (low / medium / high). Reprioritize periodically.

> New items added 2026-08-03 (post-refresh idea pass) carry explicit **Impact / Effort / Cost**
> tags so the tier placement is auditable. The existing pre-2026-08-03 log below is a rich,
> load-bearing history (dated milestones interleaved with still-open follow-ups on the same
> multi-session epics) — left as-is rather than re-triaged line-by-line, since splitting "done" from
> "open" inside those entries would lose context a future session needs. Flag if a full re-triage
> pass is wanted.

## High

- **Formulary change-history / diff view.** `formulary.json` is git-versioned and every guide
  already carries `capturedAt`/`lastReviewed` dates, but there's no user-facing way to see "this
  drug moved from preferred to non-preferred as of July 2026" — exactly the surprise that causes the
  PA round-trip this app exists to prevent. Build a per-plan/per-class changelog by diffing
  `git log -p -- src/data/formulary.json` snapshots (no new data infra needed) and surface it as a
  small "What changed" panel or page. **Impact: high** (directly serves the core value prop —
  prescribers get burned by formularies changing quarter to quarter without notice). **Effort:
  medium** (diffing logic + a new UI surface; data already exists). **Cost: zero** (static, no
  backend).
- **Multi-class "patient med list" working session.** A prescriber managing a patient on multiple
  drug classes at once (e.g. diabetes + hypertension + menopause HT — common polypharmacy) currently
  has to look up each class separately with no combined view per payer. Let them build a short
  working list of classes and see the whole picture — preferred agent + barriers — for one payer at
  once. **Impact: high** (matches a real, common clinical workflow beyond single-class lookup).
  **Effort: high** (new UI paradigm, session state across classes). **Cost: zero** (client-side
  only, no backend).

- **Every prescription type should have data for every state selected — DONE for the 5 originally
  listed states (user priority, 2026-07-05; scoped 2026-07-06; completed 2026-07-07).** The
  state/therapeutic-area picker (shipped 2026-07-05) makes the full grid visible; **MA, MD, NY, VA,
  and IL now each have all 5 topics** (inhalers, ACE inhibitors, diabetes, menopause HT, NSAIDs) —
  a perfect 5×5 = 25-guide grid, every cell `verified` or `mixed`, zero gaps left among these 5
  states. IL was last to close (2026-07-07): `il-inhalers`/`il-ace`/`il-diabetes`/`il-menopause`
  shipped new (8 payers each) and the existing `il-nsaids` guide expanded from 1 payer to 8 —
  the largest single gather this project has run (8 payers × up to 15 classes, ~1.43M tokens, zero
  failures). IL's payer roster needed correcting mid-project: the original 3-payer plan
  undercounted IL Medicaid (most members are in a managed-care plan, not FFS — see CLAUDE.md's
  "state Medicaid MCO rosters churn" scar tissue); the real roster is IL Medicaid FFS + 5 Medicaid
  MCOs (Aetna Better Health of Illinois, Blue Cross Community Health Plans, CountyCare, Meridian,
  Molina) + BCBS Illinois commercial + Wellcare Value Script (Medicare Part D).

  **Reusable assets built along the way, still live for any future expansion:**
  [.claude/workflows/formulary-gather.js](.claude/workflows/formulary-gather.js) — a reusable,
  checkpointed gather script (one agent per *payer*, covering all its assigned classes off a
  single fetch), chunked to the hard ≤2-concurrent cap, callable via
  `Workflow({scriptPath: ..., args: {stamp, state, today, payerTasks}})` for any future (state,
  topic) combo. [scripts/validate-coverage.mjs](scripts/validate-coverage.mjs)
  (`npm run validate-coverage`) reports the full national grid plus a payer-roster cross-check
  against `state-index.json`. **Gather per state across every remaining topic in one pass, not one
  gather per topic** (`docs/agent-runs.md` lever #7) — proven across NY/MD/VA/MA/IL to cut token
  cost roughly in half to a third vs. one gather per topic, since the per-payer fetch cost is flat
  regardless of how many classes you pull from it. A guide still can't be committed with partial
  payer coverage (see `validate()`'s count floor), so merge only once a state's full class list
  comes back. `npm run archive-sources` (see CLAUDE.md) archives every cited source with a
  provenance manifest — run it right after every merge, not as an afterthought (it was skipped for
  3 consecutive merges this project before catching up in one pass).

  **Recurring `validate()`-fix patterns, seen across every one of these 5 states' gathers** — worth
  knowing before touching any of this data again: (1) a covered-but-higher-tier drug tagged
  `nonformulary`/`pa` instead of `alternatives` — verify the payer's own data really has no PA/step
  flag before moving it, don't just reword around the regex; (2) a true barrier (real PA required)
  whose reason text happens to contain the trigger phrase "non-preferred" or "higher tier" —
  reword, don't reclassify, when the payer's own binary preferred/non-preferred system genuinely
  gates access (every state Medicaid PDL/MCO seen so far is exactly this — being "non-preferred"
  **is** the PA trigger); (3) the *inverse* case, confirmed for the first time in IL: a real
  multi-tier **commercial** plan's "Tier 3/4, non-preferred" items with no PA/step criteria stated
  anywhere — these genuinely are cost-tier-only and DO belong in `alternatives`. The distinguishing
  signal is the payer's own document structure (binary Medicaid PDL vs. real commercial tiering),
  not the state; (4) a BOGL flag (`boglActive: true`) set on the wrong drug (the `boglNote`
  describes a *different* alternative's brand-preference, not the actually-chosen
  `preferredAgent` — a hard tell is `preferredAgent.brand: null` with `boglActive: true`) or set
  when no generic exists in the class at all — clear it in both cases; (5) the rarer inverse of
  (4): `genericAvailable: false` on a record whose own `paRequired` list names a real generic or
  biosimilar being passed over — here the *field* is the bug, not the flag; correct
  `genericAvailable` to `true` and keep `boglActive` as real BOGL.

  **National grid status 2026-07-07 (`npm run validate-coverage`): 25/255 cells, all at full
  `verified`/`mixed` depth.** Expanding beyond these 5 states to the remaining ~46 is explicitly
  deferred — the saved workflow script is the reusable asset for that future work, not something
  to launch without the user re-confirming scope.
- **EXPANSION requested 2026-07-09: add SSRIs + osteoporosis topics for every state, and add
  Pennsylvania, Alabama, California as new states.** This is the big multi-session data-gathering
  ask. Full scope if taken literally: **2 new topics × 5 existing states = 10 new guides**, plus
  **3 new states × 7 topics (the 5 existing + SSRI + osteoporosis) = 21 new guides** = ~31 new
  8-payer gathers. Sequencing/scale must be confirmed with the user before launching (per the hard
  ≤2-concurrent-agent cap and this project's gather-cost scar tissue — a single state × all-topics
  gather is already ~1M+ tokens). Prep work that must precede any gather:
  - **New class taxonomies needed** (neither topic exists yet). *SSRIs*: fluoxetine, sertraline,
    citalopram, escitalopram, paroxetine, fluvoxamine — likely one `ssri-oral` class (mirror the
    single-class `nsaid-oral`/`ace-inhibitor` shape) or split by generation. *Osteoporosis*: oral
    bisphosphonates (alendronate, risedronate, ibandronate), IV/injectable bisphosphonate
    (zoledronic acid), RANKL mAb (denosumab/Prolia), anabolics (teriparatide, romosozumab), plus
    SERM (raloxifene) — 3–5 classes. Author these once, reuse across all states (see how
    `formulary-gather.js` reuses `ma-inhalers`/`va-diabetes`/etc. taxonomies).
  - **New-state payer rosters must be discovered live, never from memory** (CLAUDE.md MCO-churn
    scar tissue). None of PA/AL/CA are in `src/data/state-index.json` yet — each needs a
    `WebSearch` for "<state> Medicaid managed care organizations 2026" + PDL identity before
    scaffolding. CA in particular: Medi-Cal Rx carves the pharmacy benefit out to a single
    statewide FFS PDL (Magellan) — same NYRx-style consolidation as NY, so most Medi-Cal MCOs
    likely share one PDL; confirm before listing MCOs separately.
  - **Superseded item** (still valid, folded in here): earlier 2026-07-07 topic list — biologics
    for autoimmune conditions, DOACs, atypical antipsychotics & ADHD meds, migraine therapeutics
    (triptans/CGRP). Biologics already has a disabled `biologics` tab scaffolded in the inhaler
    taxonomy — decide whether that extends to autoimmune biologics or stays respiratory-only.
  - **Cost/dosage debt compounds:** every new guide inherits the same two gaps this validation run
    surfaced — diabetes/NSAID-style *cash-price* holes (SSRIs and oral bisphosphonates are cheap
    generics with real GoodRx/Cost Plus prices worth capturing at gather time) and *unsourced
    dosage* (see the two items below). Capture cash rules and dose provenance as each new guide
    ships, not as a later backfill, so the debt doesn't keep growing per the pattern in `cash.ts`.
  - **PROOF GUIDE SHIPPED 2026-07-18 (scheduled run): `ny-ssris`.** SSRI single-class taxonomy
    decided (`docs/RESUME-EXPANSION.md`), gathered via `formulary-gather.js` across NY's existing
    5-payer roster (2-concurrent chunked), merged, all validation green (`npm test`/`trace`/
    `validate-coverage`/`archive-sources`), verified rendering in the browser. Sertraline preferred
    across all 5 payers (4 verified, 1 partial — Excellus Medicare's PDL doesn't itself rank the 4
    tied Tier-1 generics). **Cash-price gap opened, not yet closed**: `KNOWN_UNPRICED_GAP` in
    `src/lib/cash.ts` bumped 0→33 for the 33 SSRI name variants (sertraline/citalopram/
    escitalopram/fluoxetine/paroxetine/fluvoxamine × 5 payers' naming) — a scheduled/headless run
    has no human to clear GoodRx's "Press & Hold" bot-check (confirmed live: `goodrx.com/sertraline`
    returned the challenge page), so no cash-link rules were added. These are cheap, long-generic
    SSRIs — a future interactive session with real Chrome extension access should knock this out
    quickly, same as the diabetes/NSAID gap closure pattern. Per this backlog's original scoping
    note, this is stop-and-review — do NOT scale to the remaining ~30 guides without the user
    approving this proof guide first.
  - **GATE CLEARED, SSRIs scaled 2026-07-21** (explicit user instruction: "do the SSRI expansion
    work"). All 5 states now have `*-ssris` guides (`ma-ssris`, `md-ssris`, `va-ssris`, `il-ssris`
    added). `KNOWN_UNPRICED_GAP` reached 194 across the SSRI expansion.
  - **Osteoporosis scaled to 4/5 states 2026-07-21.** 5-class taxonomy shipped as
    `ny-osteoporosis` (5 payers), `ma-osteoporosis` (5), `md-osteoporosis` (8), `va-osteoporosis`
    (8) — all fully validated/traced/archived, NY+MD browser-verified. `KNOWN_UNPRICED_GAP` now
    327.
  - **`il-osteoporosis` shipped 2026-07-22 — osteoporosis now complete across all 5 existing
    states, matching SSRIs' full coverage.** Gathered via `formulary-gather.js` (8 payers reusing
    `il-ssris`'s roster, chunked ≤2 concurrent, zero agent failures, ~1.1M tokens). 89 `paRequired`
    reasons across 5 payers needed the established reword-not-reclassify fix; the one commercial
    payer (`bcbs-illinois-commercial`) had already correctly modeled its real tiered items as
    `alternatives`. `KNOWN_UNPRICED_GAP` 327→339. All of `npm test`/`typecheck`/`trace`/
    `validate-coverage`/`archive-sources` green, verified live in browser. National grid moved
    34/357 → 35/357. See `docs/RESUME-EXPANSION.md`'s ledger for full detail.
  - **Step 2 (PA/AL/CA payer discovery) partially started 2026-07-22 — new-state PDL identities
    confirmed via live search, full payer rosters NOT yet built.** Findings, none yet committed to
    `state-index.json`:
    - **Pennsylvania**: DHS runs one **Statewide Preferred Drug List** (papdl.com) that applies to
      BOTH the FFS delivery system AND every HealthChoices/Community HealthChoices MCO — i.e. a
      single shared PDL like NY's NYRx, not per-MCO formularies. Current version: "Pennsylvania PDL
      2026" v10, effective January 2026, hosted at papdl.com (direct PDF link pattern:
      `/content/dam/ffs-medicaid/pa/pdl/penn-statewide-pdl-<mmyyyy>-v<N>.pdf`). MCO roster for the
      guide's payer list still needs picking (10 Physical HealthChoices MCOs + 3 CHC MCOs — probably
      pick the 2-3 largest of each, not all 13, matching other states' payer-count norm).
    - **Alabama**: genuinely simpler than any state gathered so far — Medicaid operates almost
      entirely **fee-for-service, with no MCO contracts for the general adult population**
      (confirmed via search, not assumed). One statewide PDL (`medicaid.alabama.gov`), updated
      quarterly (Jan/Apr/Jul/Oct), P&T-committee-driven. A future AL guide likely needs a much
      shorter payer list than other states: AL Medicaid FFS + a couple commercial/Medicare Part D
      plans, not 8 MCOs.
    - **California**: confirmed as predicted — **Medi-Cal Rx is a single statewide FFS pharmacy
      carve-out** (DHCS-administered) covering all Medi-Cal beneficiaries regardless of which
      managed-care plan they're enrolled in for other benefits (carved out since 2022-01-01). The
      **Medi-Cal Rx Contract Drugs List (CDL)**, effective **2026-07-01**, is the authoritative PDL
      — confirmed live and current via direct fetch. Spot-checked the two topics already scoped:
      all 6 SSRI molecules (citalopram/escitalopram/fluoxetine/fluvoxamine/paroxetine/sertraline)
      and the oral-bisphosphonate class (alendronate/ibandronate/risedronate) plus raloxifene
      (SERM) appear unrestricted (no PA/step asterisk) in the base CDL — a good sign for a future
      CA gather. Did NOT confirm denosumab (RANKL) or the anabolic-agent class (teriparatide/
      abaloparatide/romosozumab) in this pass — not spotted in the sampled sections, may be billed
      as a medical benefit rather than through the retail pharmacy CDL, matching the IV/injectable
      pattern seen in every other state's osteoporosis gather; needs confirming before a CA
      osteoporosis guide is built.
    - **CAUTION for next session**: confirming the CA CDL was live cost far more context than
      intended — the `WebFetch` tool returned the *entire* 242-page PDF as inline document content
      rather than a summary (see the new CLAUDE.md scar-tissue note on this). For any future
      large-PDF confirmation, use a page-range-limited read or `curl`+`grep` for the specific
      keyword instead of a blanket `WebFetch` on a URL suspected to serve a large PDF.
    - **Not yet done for any of the 3 new states**: full payer-roster JSON entries in
      `state-index.json`, per-payer formulary URL verification via live fetch, or any actual
      drug-class data gather. This is still a substantial next-session task before a single
      guide can be built for PA, AL, or CA.
  - **UPDATE 2026-07-23 through 2026-07-26 — superseded, see `docs/RESUME-EXPANSION.md`'s ledger
    for full detail:** PA/AL/CA payer rosters are now all in `state-index.json`. **AL is complete
    across all 7 topics** (`al-ssris`, `al-inhalers`, `al-menopause`, `al-ace`, `al-diabetes`,
    `al-nsaids`, `al-osteoporosis` — 3-payer roster, `KNOWN_UNPRICED_GAP` reached 361). **PA has
    its first guide, `pa-ssris`** (proof guide for the new-state gate, 3 payers, shipped
    2026-07-26 by recovering an already-gathered-but-unmerged checkpoint from
    `data-gathering/pa-all-topics-2026-07-25/` — zero new agent calls). PA's other 20 classes (all
    remaining 6 topics) are **already fully gathered for the same 3 payers** in that checkpoint
    directory, ready to merge for free once the user approves scaling past `pa-ssris`. CA remains
    fully unstarted (roster only, no data gathered). Stopped per the same proof-guide-first gate
    applied to every prior new topic/state.
- **Close the cash-price gap on the *headline* recommendation — DONE.** The per-*cell* sweep
  (every guide record's `preferredAgent.inn`/`brand` against `hasCashLinkRule`) confirms **0/510
  cells have an unpriced preferred agent**. What's left is the `alternatives`-list long tail — see
  below, now an active work item (user re-flagged directly 2026-07-16 with a screenshot of unpriced
  NSAID alternatives, and asked for a full sweep + a check of competing cash-price vendors).
- **Close the cash-price gap on `alternatives` lists — DONE 2026-07-16 (575 → 0).**
  `KNOWN_UNPRICED_GAP` in `src/lib/cash.ts` reached **0** — every one of the 1,973 covered-drug
  names in the live formulary now has an explicit cash-link rule, across three sessions the same
  day. Scope check first (script in issues.md's 2026-07-16 entries): 3,079 distinct name strings
  referenced across all 25 guides collapsed to a much smaller set of real molecules once you
  account for each source PDF's own verbatim phrasing — fixed in `cash.ts`'s regex rules, never by
  editing the data strings directly.
  **NSAIDs, ACE inhibitors, and inhalers are fully resolved.** Diabetes closed its largest chunk
  (glipizide/glyburide/glimepiride/pioglitazone + combos, sitagliptin/Janumet, exenatide, Xigduo
  XR); the entire insulin-brand family (NovoLog, Humulin, Novolin, Fiasp, Levemir, Lyumjev,
  Soliqua, Merilog), Mounjaro/tirzepatide, Invokana/canagliflozin, and the empagliflozin-based
  combos (Synjardy/Trijardy/Glyxambi) are confirmed **not carried by Cost Plus at all** —
  GoodRx-link-only by design, matching this file's pre-existing "Cost Plus doesn't carry insulins"
  finding, not a research gap. Menopause-HT (the last topic standing) closed with Prempro/
  Premphase/Duavee/megestrol priced, Abigale/Gallifrey/Zafemy folded into the existing Activella
  rule (same molecule, real price), and 15 confirmed-not-carried products (Evamist, Depo-Estradiol,
  Crinone, Femring, Endometrin, injectable/vaginal progesterone, Intrarosa, Osphena, Menest family,
  Angeliq, Bijuva, Prefest, Estring, estradiol valerate IM, estropipate) given explicit
  GoodRx-slug-only rules instead of falling to the fallback slug guesser.
  - **Caught and fixed 2 real embedded-substring mispricing bugs via a full-formulary audit** (run
    after a UI click-through surfaced one live) — a class of bug worth remembering for any future
    short bare (non-word-bounded) regex trigger: "Angeliq" contains the literal substring "gel"
    (an-GEL-iq), so a bare `gel` alternation in the estradiol-gel rule mispriced it as Divigel; a
    new estropipate rule's bare `ogen` trigger (meant for the brand "Ogen") matched "ogen" embedded
    inside "estrogen"/"estrogens" everywhere, silently shadowing the correctly-priced Prempro/
    Premphase/Duavee/Premarin rules. Both fixed with `\b` word boundaries; 2 regression tests
    added. **Before adding any future bare short (3–6 char) alternation token to a `cash.ts` rule,
    grep the full formulary for that substring embedded mid-word first** — this bug class is easy
    to reintroduce and easy to miss without a dedicated audit (see the script referenced in
    issues.md's 2026-07-16 cont. 3 entry).
  - **Also found and fixed 3 earlier regex precedence bugs** (same day, unrelated to any new
    drug): the gel/patch estradiol rules required the literal word "estradiol" to co-occur with a
    brand name in the same string, so bare "DIVIGEL"/"ESTROGEL"/"ELESTRIN"/"ALORA"/"MENOSTAR"
    mentions (common when an alternatives list doesn't repeat the generic name) fell through with
    zero rule at all.
  - **GoodRx access was highly inconsistent all day — not a stable block, not stable access
    either.** Started fully CAPTCHA-walled (a real "Press & Hold" challenge, harder than the usual
    plain-fetch 403), recovered a few times for short runs of successful lookups (one run of
    ~15), then the browser tool's own classifier infrastructure (separate from GoodRx)
    intermittently denied calls for stretches of several consecutive attempts. **The large
    majority of rules added this day have a real Cost Plus price but GoodRx still pending** —
    explicitly marked "pending" not "confirmed unavailable" in code comments. **Retry GoodRx for
    the full list in a future session** rather than assuming it's permanently blocked — this
    project's GoodRx access has recovered from every prior block, just unpredictably.
  - **3rd cash-price vendor (SingleCare) — researched, deferred.** User asked whether to add a
    fallback vendor for what Cost Plus doesn't carry. SingleCare is the strongest candidate (no
    membership fee, more pharmacies than Cost Plus, commonly recommended as "the best fallback
    when GoodRx doesn't work"); Amazon Pharmacy RxPass ($5/mo flat fee, Prime-gated) and RxSaver/
    WellRx are secondary options. User's call: decide once GoodRx is filled in, not now.
- **Redesign the omni-search.** The drug search bar (`src/components/Search.tsx`) is parked
  (removed from the App render) pending a rethink. Wanted: layperson synonyms ("HRT", "estrogen
  patch", "rescue spray") mapping to classes/molecules, search scoped to or across guides, and a
  clearer results UI. The lib `searchFormulary` index still exists and is tested.
- **Archive source PDFs + extract from them (`trace:live` content-tracing).** Save each cited
  formulary PDF to a local provenance store with metadata (URL, `fetched_at`, `sha256`, HTTP status,
  content-type, size, method) so we track where/when/how each was scraped; commit the metadata
  manifest + extracted-text excerpts (not the binaries — gitignore those). Then add a PDF text parser
  (devDependency; run the supply-chain advisory check first) so `npm run trace:live` reads inside the
  PDFs and verifies the actual tier/drug lines, not just reachability. User approved the dependency.
- **Backfill MA inhaler `tier`.** The MA cells have no insurance-cost tier, so the options table
  shows "see plan tier" for the recommended row. Read each MA formulary's tier table and set `tier`.
- **Add the remaining MD HealthChoice MCOs.** Johns Hopkins Priority Partners is now sourced
  (`verified`); the MD Medicaid FFS cells stay `partial` because the FFS PDL structurally doesn't
  manage HRT (not a closeable gap — it's a carve-out). Pull the other HealthChoice MCO formularies
  (Maryland Physicians Care, Wellpoint/Amerigroup, Aetna Better Health, UnitedHealthcare Community
  Plan, CareFirst Community Health Plan) so a Medicaid member can pick their actual MCO.
- **Finish verifying the `partial` / `example` cells — the BCBS MA cluster is DONE (2026-07-16).**
  Current state (`npm run validate-coverage`): **487 verified / 18 partial / 5 example** of 510
  cells (was 472/29/9 right after the 2026-07-16 UAT found the clusters below — the BCBS MA fix
  closed 11 `partial` + 4 `example` cells; was 463/38/9 on 2026-07-10). Root causes, in priority
  order:
  - **BCBS Massachusetts — FIXED 2026-07-16, all 15/15 cells now verified.** The blocker wasn't
    really "PDF extraction fails" as previously assumed — it was that 4 of the 5 MA guides
    (`ma-ace`/`ma-diabetes`/`ma-menopause`/`ma-nsaids`) had been sourced from the wrong BCBS MA
    formulary family (the Blue-Cross-managed one) when the payer's own `pbm` field says CVS
    Caremark. Found the correct CVS Caremark "Standard Control" formulary via a real browser
    session on `provider.bluecrossma.com` (same "looks blocked, isn't" pattern as GoodRx/Cost
    Plus — see CLAUDE.md), and its 3 PDFs (comprehensive covered list, drug removal list,
    quarterly updates, all effective July 2026) fetched clean via plain `curl` + browser UA, with
    clean `pypdf` text extraction (per-drug tier table, no fragmentation this time). Standardizing
    all 15 cells onto this one source fixed several real errors along the way, not just filled in
    blanks — see issues.md's 2026-07-16 entry for the full list (ACE brand tiers, a materially
    better SGLT2 pick, a flipped insulin alternatives/nonformulary list, the LAMA device
    preference, menopause-HT alternative misclassifications). Also surfaced and worked around a
    live UI bug (`roleOf()` in `PrescribeOptions.tsx` false-"Generic"-badges any alternative whose
    text contains the substring "generic", even in "no generic exists" — spun off as its own task
    rather than patched per-record). **FIXED 2026-07-16** in a parallel spawn_task session
    (`roleOf()` now requires "generic" not be preceded by "no " via a negative lookbehind regex,
    with a regression test); cherry-picked into this branch alongside an unrelated `autoPort` dev-
    server fix from the same background session — see issues.md.
  - **AARP Medicare Rx Preferred (UHC PDP) extraction is incomplete — 5 cells, still open.**
    `md-inhalers` (ics, lama) + `md-diabetes` (glp1, sglt2, insulin), all payer `medicare-partd`.
    Fetched via curl with a browser UA (plain WebFetch 403'd) but the PDF only partially
    extracted. Re-attempt with a dedicated PDF-reading tool before concluding it's unreadable —
    same "looks dead but isn't" pattern the NYRx PDL hit (see CLAUDE.md).
  - **Structural carve-outs — 12 cells, not closeable, already correctly labeled.** MD Medicaid
    FFS doesn't manage menopause HT as a PDL category (`md-menopause` mdmedicaid × 5); VA's
    statewide PDL likewise doesn't manage oral estrogen (`va-menopause` va-medicaid-ffs +
    aetna-better-health × 2, matching FFS twins); NY Medicaid's PA column uses an undocumented `G`
    code (`ny-menopause` × 5 example — logged in issues.md, blocked on the eMedNY code legend).
    Leave as-is; these are honest "no PDL entry" states, not extraction failures.
  - **6 standalone cells worth individual re-checks:** `il-nsaids` il-medicaid nsaid-oral (already
    re-read once, still partial — check what specifically is missing before re-reading again),
    `md-inhalers` cigna (ics), `md-ace` aetna (ace-inhibitor), `ma-menopause` mgb (vaginal),
    `il-inhalers` wellcare-value-script (ics), `il-diabetes` aetna-better-health-il (glp1).
- **Biologics & non-inhaler class** (currently a disabled tab). Omalizumab (Xolair, now with the
  Omlyclo biosimilar), mepolizumab, benralizumab, dupilumab, tezepelumab — specialty-pharmacy /
  buy-and-bill with their own PA pathway. Cite FDA + manufacturer; the sources research already
  gathered the key facts.
- **Patient Synonym search mapping** (Newbie/Patient): Support mapping layperson search terms
  (e.g., "rescue spray", "blue inhaler", "steroid pump", "COPD breath") to their clinical drug classes
  or specific molecules in the search index so patients without medical background find what they need.

## Medium

- **Fix `trace-sources.mjs` false-positive dead/drift detection on 3 known-good hosts.**
  `mhdl.pharmacy.services.conduent.com`, `massgeneralbrighamhealthplan.org`, and
  `client.formularynavigator.com/Search.aspx` all flagged DEAD or DRIFT in the 2026-08-03
  `trace:live` run despite serving real, unchanged, correct content when checked in a real browser
  (see issues.md's 2026-08-03 entry) — two are bot/host-gated against a plain `fetch()`, one
  JS-renders its results client-side. Extend the script with a known-host allowlist (same shape as
  `validate-prices.mjs`'s existing GoodRx/Cost Plus BLOCKED-is-expected handling) so future runs
  don't report false gaps needing a manual browser re-check every time. **Impact: medium** (removes
  recurring false-alarm noise from the quarterly refresh report, and a real drift on these hosts is
  currently indistinguishable from this noise). **Effort: low** (a host-match list + a new
  "known-gated, not counted as drift" status, mirroring existing code). **Cost: zero**.
- **CSV/bulk export of a payer's full formulary grid.** A clinic's EHR or pharmacy-ops team
  importing formulary data into their own system currently has to copy cells by hand. Add a
  download-as-CSV button per payer (the data is already structured JSON — just needs a serializer).
  **Impact: medium** (serves a practice-ops audience beyond the point-of-care lookup). **Effort:
  low** (client-side CSV serialization + a button). **Cost: zero**.
- **Pin/star favorite payers in the plan picker (localStorage).** Prescribers typically work with
  the same 2-3 payers repeatedly; let them star a payer so the picker defaults to their common ones
  instead of the full alphabetical list every time. **Impact: medium** (daily-use quality-of-life
  for repeat users). **Effort: low** (localStorage + picker sort). **Cost: zero**.
- **Cmd+K quick-switch command palette for class/payer.** A keyboard-driven jump between drug class
  and payer would speed up rapid lookups during a busy clinic day, especially for power users
  (pharmacists checking many cells back-to-back). **Impact: medium** (efficiency for high-frequency
  users). **Effort: low-medium** (a searchable overlay + keybinding). **Cost: zero**.
- **Document a stable JSON API contract for EHR/CDS integration.** The formulary data is already
  static JSON served from GitHub Pages; formalizing a versioned schema doc (what fields are stable,
  what's guide-scoped vs. global) would let a clinic's engineering team pull this into their own
  EHR's clinical decision support without scraping the rendered HTML. **Impact: medium** (opens an
  integration path — audience is EHR/CDS developers, not the direct prescriber user). **Effort:
  low** (mostly documentation; data shape is already stable). **Cost: zero**.
- **SSRI cash-price gap — CLOSED 2026-07-29 (scheduled run).** A real browser session was
  available (rare for a scheduled run); added the 6 broad per-molecule regex rules this item
  called for (sertraline, citalopram, escitalopram, fluoxetine, paroxetine, fluvoxamine — real
  GoodRx + Cost Plus Drugs prices, `src/lib/cash.ts`). Collapsed every SSRI name variant across
  all 7 shipped SSRI guides (NY/MA/MD/VA/IL/AL/PA) in one pass. `KNOWN_UNPRICED_GAP` 377→155.
  GoodRx bot-blocked partway through (paroxetine/fluvoxamine are Cost-Plus-only) — not a gap in
  this item's scope, just an incomplete GoodRx side; revisit those 2 molecules' GoodRx price if a
  future session has clean access.
- **Osteoporosis cash-price gap — FURTHER CLOSED 2026-08-02 (scheduled run), 2 of 3 remaining
  molecules still open.** A real browser session was available at the start (no vendor block).
  Added denosumab/Prolia + every biosimilar name variant (rankl-inhibitor preferred agent, GoodRx
  ~$1,832.87 for 1 syringe 60mg/mL, `src/lib/cash.ts`) — the bare `goodrx.com/prolia` slug landed
  on the exact right osteoporosis-strength product by default, verified live in the browser.
  `KNOWN_UNPRICED_GAP` 129→90. **GoodRx then hit the same session-wide "Access to this page has
  been denied" block as 2026-07-30, this time after only 2 lookups** — zoledronic acid/Reclast was
  the 2nd lookup and its bare slug defaulted to the WRONG product (4mg/5mL Zometa oncology-dosing
  vial, not the 5mg/100mL Reclast once-yearly osteoporosis infusion — a real dosage-form mismatch,
  same trap class as the GoodRx bare-slug-picks-wrong-strength note in CLAUDE.md); that wrong price
  was discarded, not shipped. **Still open**: zoledronic acid/Reclast (iv-bisphosphonate — needs the
  Edit-flow or a correct `dosage=5mg&quantity=100` -style param, not the bare slug) and
  teriparatide/Forteo + abaloparatide/Tymlos (anabolic — never reached before the block). These 3
  are also the same classes carrying most of the guides' `partial` cells (medical-benefit/Part-B
  carve-outs per the 2026-07-25/07-28 audits) — a plain GoodRx consumer-cash price may not even be
  the right price to show for a physician-administered infusion/injection the same way it is for a
  take-home pill; worth checking each drug's own manufacturer copay-card page (same pattern already
  used for the Ozempic pen: NovoCare $199) rather than assuming GoodRx retail applies once GoodRx
  access is clean again.
  - **Checked 2026-08-03 (scheduled run) — GoodRx hard-blocked immediately this session** ("Access
    to this page has been denied" on the very first lookup, worse than 2026-08-02's 2-lookup grace
    period). Cost Plus Drugs was not re-checked — already confirmed 2026-07-30 not to carry any of
    these 3 molecules. Pivoted to the manufacturer-copay-card idea this item itself suggested:
    **Forteo's own site (`forteo.lilly.com`) advertises "Pay as little as $4 per month" — but its
    own terms explicitly restrict the card to patients "enrolled in a commercial drug insurance
    plan with coverage for Forteo" and explicitly exclude anyone on Medicaid/Medicare/any government
    program.** This is a copay-*reduction* card for the already-insured, not a cash/self-pay price —
    fundamentally different from the Ozempic-pen (NovoCare $199) and Jardiance/Lantus precedents
    this item cited, which are real list/cash prices usable by an uninsured or self-pay patient.
    Shipping the $4 figure as a "cash price" would misrepresent it — a self-pay patient without
    commercial insurance cannot use it at all. **Did not add a cash-link rule for Forteo** to avoid
    that misrepresentation. Tymlos's patient site (`tymlos.com`) has no pricing information on its
    homepage and its `/savings-support` path 404s (needs the real path, not found this session);
    Reclast's own manufacturer domain no longer resolves (`reclast.com` — expected, it's long
    genericized, Novartis has no reason to maintain a branded patient site for it anymore). **Net:
    all 3 remaining osteoporosis molecules stay unpriced.** No cash rule added, `KNOWN_UNPRICED_GAP`
    unchanged at 90. Recommendation for a future session: before trusting any manufacturer "savings
    card" page as a cash-price source, check its own eligibility terms for a commercial-insurance
    requirement — several major manufacturer copay cards are structurally unusable by the cash-pay
    patient this feature is meant to help, so they're not a valid GoodRx-price substitute even when
    they show a small headline number.
- **Candidate topics for a future expansion round, beyond SSRIs/osteoporosis (already scoped in
  `docs/RESUME-EXPANSION.md`) — surfaced by a 2026-07-19 scheduled-run web-search sweep (research
  only, no data gathered, no agents spawned).** Ranked by how much real-world PA friction they carry
  (source: web search, not gathered/cited formulary data — treat as a shortlist to scope, not a
  claim about any specific payer):
  - **GLP-1s for weight-loss/obesity indication (Wegovy/Zepbound/Saxenda) — distinct from the
    existing `glp1` diabetes class.** Same molecules, different indication and a much harsher PA
    gate (BMI threshold + documented prior weight-loss attempts almost everywhere it's covered at
    all). Coverage is unusually state-variable and currently in flux — KFF reports only 13 state
    Medicaid FFS programs cover it for obesity as of Jan 2026, and CA/NH/PA/SC *dropped* coverage
    since Oct 2025 (notable: PA and CA are both already on this project's new-state list for other
    topics, so this could piggyback on their existing payer-roster discovery). CMS's new BALANCE
    model (opt-in for states, May 2026–Jan 2027) may reshape this fast — check the coverage
    landscape again before scoping, not just the search snapshot above, given how fast it's moving.
  - **ADHD stimulants (methylphenidate/amphetamine salts + non-stimulant guanfacine/atomoxetine).**
    Every state Medicaid program covers at least one stimulant, but PA-for-brand/ER and step-therapy
    rules vary widely, and Schedule II status adds its own friction (e.g. Florida requires PA on all
    Schedule II ADHD drugs). Likely a clean single-class or two-class taxonomy (stimulant + non-
    stimulant) similar in shape to `ssri-oral`.
  - **DOAC anticoagulants (apixaban/Eliquis, rivaroxaban/Xarelto, + warfarin as the old-line
    comparator).** High-volume, chronic, PDL-driven — same shape as ACE inhibitors, likely a quick
    single-class guide reusing the `ny-ace`/`va-ace` taxonomy pattern.
  - **CGRP inhibitors for chronic migraine (Aimovig/Ajovy/Emgality/Nurtec/Qulipta/Ubrelvy) —
    added 2026-07-20, unusually high, well-documented PA friction.** An AJMC-published MCO survey
    found 96% of surveyed Medicaid MCOs require a documented trial-and-failure of ≥1 non-CGRP
    prophylactic before approving a CGRP antagonist, and most require 2+ prior agents; 69% also
    layer step therapy through a cheaper nonspecialty drug first. This project's own primary source
    corroborates it directly — NYRx's July 16 2026 Preferred Drug Quick List (fetched this session,
    see issues.md) flags Aimovig/Ajovy/Emgality/Qulipta/Ubrelvy with F/Q/D (frequency/quantity/
    duration) limits and Qulipta/Ubrelvy additionally with ST (step therapy), while ordinary
    oral migraine triptans carry no such flags — a clean, sourced contrast for a guide's PA-barrier
    story. Likely taxonomy: one `cgrp-inhibitor` class (the 4-5 injectable/oral CGRP mAbs/gepants)
    reusing the `ssri-oral` single-class shape; consider a second `triptan` class as the cheap
    first-line comparator if a payer's own PDL treats them as a step.
  - Not pursued further this run per the standing gate: the SSRI proof guide (`ny-ssris`) is still
    awaiting the user's review before *any* further scaling, per `docs/RESUME-EXPANSION.md`'s
    explicit stop-and-report instruction — these are ideas to scope next, not started.
  - **Re-verified 2026-07-24 (scheduled run):** the CA/PA GLP-1-weight-loss coverage drop above is
    still current — a Stateline piece from 2026-04-30 confirms both states (plus NH and SC)
    eliminated Medicaid FFS coverage for the obesity indication over budget strain, with MA and RI
    now "considering" the same cut. No change to the scoping note above; still worth flagging in a
    future `pa`/`ca` guide's PA-barrier narrative if that class ever gets built (state dropped
    coverage entirely ≠ ordinary PA friction, a stronger and more citable story).
- **Candidate 4th new state (after PA/AL/CA finish): Texas — surfaced 2026-07-24 (scheduled-run
  web-search, research only, no data gathered).** Texas Medicaid runs one **single statewide PDL**
  (Vendor Drug Program, `txvendordrug.com`, published every Jan/Jul — current edition effective
  2026-01-30) that every Medicaid/CHIP MCO must follow, same "one shared PDL, not per-MCO
  formularies" shape as NY/PA/AL/CA already in this project — meaning payer-roster discovery would
  be unusually cheap (one PDL + a couple commercial/Medicare Part D payers, not 8 independent MCO
  formularies). Texas also has the 2nd-largest Medicaid population in the country after CA, so it's
  a high-value target once the current PA/AL/CA new-state gate clears. Not started — no
  `state-index.json` entry, no payer verification, no guide data.
  - **Re-checked 2026-07-25 (scheduled run): the semi-annual PDL refresh landed right on schedule.**
    `txvendordrug.com`'s own news feed confirms the July 2026 semi-annual Medicaid PDL update was
    published 2026-07-24 (one day before this check), incorporating the January and April 2026 DUR
    Board recommendations — so a future TX gather should cite this fresh July edition, not the
    January one referenced in the initial 2026-07-24 note. The specific news-page URL 403'd
    `WebFetch` (server-side block, not the usual PDF-dump issue); the PDL identity/cadence itself is
    already well-confirmed via the site's own formulary/PDL pages, so this wasn't chased further —
    still research-only, no `state-index.json` entry, no payer verification, no guide data.
- **Existing-guide depth gaps (`partial`/`example` cells), from the 2026-07-19 `validate-coverage`
  run — worth a verification pass before/alongside adding new topics/states:** `ny-menopause` (5
  `example` cells — the only guide with any `example`-quality data left), `md-menopause` (5
  `partial`), `md-inhalers` (3 `partial`), `md-diabetes` (3 `partial`), `va-menopause` (2 `partial`),
  `md-ace` (1 `partial`), `il-nsaids` (1 `partial`), `il-inhalers` (1 `partial`), `il-diabetes` (1
  `partial`), `ma-menopause` (1 `partial`), `ny-ssris` (1 `partial` — the proof guide itself). None
  of these fail `validate()` (partial/example are valid states), but they're the cells a future
  "verify the soft spots" pass (same shape as PR #13's MA/VA/IL/NY soft-cell sweep) should target
  first, cheaper than gathering a brand-new topic.
  - **Updated 2026-07-25 (scheduled run) — this list predates the osteoporosis expansion (shipped
    2026-07-21/22) and is now missing its largest chunk of `partial` cells.** Current
    `npm run validate-coverage` + a direct read of `formulary.json` shows **48 `partial` cells
    across the 5 osteoporosis guides**, none previously logged here: `il-osteoporosis` (13:
    iv-bisphosphonate 5, rankl-inhibitor 4, anabolic 3, serm 1), `md-osteoporosis` (12:
    iv-bisphosphonate 6, rankl-inhibitor 4, anabolic 2), `va-osteoporosis` (12: iv-bisphosphonate 5,
    anabolic 4, rankl-inhibitor 2, oral-bisphosphonate 1), `ny-osteoporosis` (6: iv-bisphosphonate 4,
    rankl-inhibitor 1, serm 1), `ma-osteoporosis` (5: rankl-inhibitor 3, iv-bisphosphonate 2). The
    per-guide ledger entries in `docs/RESUME-EXPANSION.md` already named the root cause in passing
    ("IV-bisphosphonate medical-benefit absence again the majority partial cause") but never rolled
    it up here — **iv-bisphosphonate (zoledronic acid) alone accounts for 22/48**, consistent with
    every state's IV/injectable classes structurally sitting outside a retail-pharmacy PDL (same
    carve-out pattern as the pre-existing menopause `example`/`partial` cells above), followed by
    rankl-inhibitor (14/48) and anabolic (9/48) — both plausibly the same medical-benefit carve-out
    for denosumab/teriparatide/romosozumab injectables. `serm`/`oral-bisphosphonate` are nearly
    clean (2/48, 1/48) since those are ordinary oral retail drugs. Worth confirming whether these are
    genuine structural carve-outs (like MD/VA/NY's menopause gaps, already correctly labeled
    `partial` and not closeable) before spending a verification pass on them — if so, this may be a
    labeling/documentation task (note the carve-out explicitly per-cell) rather than a re-gather.
  - **Audited 2026-07-28 (scheduled run) — confirmed genuine, one cell fixed.** Read every
    osteoporosis `partial` cell's `verificationNote` directly (no agents, no new gathers): the
    overwhelming majority are already-exhaustive, well-cited medical-benefit/Part-B carve-out
    confirmations (cross-checked against payer PA-criteria docs, NYS DOH's practitioner-
    administered-drug list, Part D "B/D" coding conventions) — genuinely not closeable via a
    retail-pharmacy PDL re-read, matching the menopause-HT precedent exactly. One cell WAS
    fixable: `md-osteoporosis` mdmedicaid/rankl-inhibitor was held `partial` only pending
    denosumab-biosimilar strength disambiguation (60mg Prolia vs. 120mg Xgeva) — one `WebSearch`
    resolved it, cell upgraded to `verified` (commit `15cd119`). New, previously-unlogged finding:
    **`al-osteoporosis`'s `al-medicaid` payer has zero osteoporosis-agent mentions in either
    published AL Medicaid PDL document, across every class** (oral-bisphosphonate/anabolic/serm) —
    a distinct "whole therapeutic area absent from the PDL" gap type, not the injectable-carve-out
    pattern seen elsewhere; already correctly documented, not a research failure.
- **PR #6 review nitpicks, deferred rather than blocking merge.** From the two-persona review
  (SW engineer + data reviewer) of the state/topic-picker split and NY/IL NSAID guides:
  - `Controls.tsx`'s state/topic segmented tablists omit `aria-controls` (unlike the existing class
    tabs, which set it to the result panel id) — minor a11y gap; there's arguably no single stable
    panel these two new tabs "control" the way class tabs do, so decide the right target before
    adding it.
  - Rapid double-arrow-key navigation on the state/topic tablist can land focus on a button that's
    mid-fetch-disabled; `.focus()` on a disabled element silently no-ops, dropping focus to
    `document.body`. Narrow today (most combos have no guide yet), will widen as more guides ship.
  - `onTabKeyDown`/`onStateKeyDown`/`onTopicKeyDown` in `Controls.tsx` are copy-pasted
    roving-tabindex logic, differing only in the array/getter/setter — worth one generic factory.
  - The `!activeGuideId` "Not covered yet" panel and the "No record for this payer/class" panel in
    `App.tsx` are two near-identical empty-state JSX blocks — worth one small `EmptyState`
    component (this is the second occurrence of the pattern, per the repo's own "build the helper
    the second time" rule).
  - `findGuideId` re-scans `guideOptions` (currently 6 entries) on every render — not worth a
    `useMemo` at this scale, revisit if the guide count grows a lot.
  - ~~Grouped `paRequired`/`alternatives` entries lose per-drug accountability~~ — **FIXED**: the
    codex bot caught this concretely (IL's original grouped entry misclassified Etodolac,
    Flurbiprofen, and Ketoprofen as PA-required when the PDL lists all three preferred); the
    `il-nsaids` cell now transcribes every PREFERRED/NON_PREFERRED line item individually. Keep this
    per-drug granularity for future guides instead of reverting to grouped entries.
  - Confirm whether Illinois's HFS PDL has an equivalent to NY's "PA required if 2+ concurrent
    NSAIDs" class-wide criterion (captured on NY's record as `preferredRestriction`) or genuinely
    lacks one — the `il-nsaids` cell currently has no `preferredRestriction` set.
  - **Persist the state/topic pick in the URL, not just a valid `?guide=` id** (codex bot, P3).
    Landing on an uncovered (state, topic) combo today only clears a stale `guide` param — it
    doesn't add a `state=`/`topic=` param, so reloading or sharing that URL lands on the default
    guide instead of reproducing the exact gap the user was looking at. Deliberately out of scope
    for the initial picker split (see the "Separate the state and prescription-type selectors"
    item); worth adding `state=`/`topic=` URL params once the gap-browsing use case matters enough.
- **Cash-link rules for the VA diabetes drugs.** The `va-diabetes` guide shipped with no explicit
  GoodRx/Cost Plus rules, raising `KNOWN_UNPRICED_GAP` from 72 to 148 (`src/lib/cash.ts`).
  Metformin, generic dapagliflozin, insulin glargine biosimilars, and generic lispro/aspart are
  exactly the drugs where a cash price beats insurance often enough to matter. Use the browser
  session (GoodRx 403s plain fetch) + `costplusdrugs.com/medications/?query=` slug search;
  guess GoodRx exact-dosage params directly per the CLAUDE.md pattern. **Status 2026-07-06: still
  0/76 priced** — the single biggest remaining chunk of the cash-price gap below.
- **Dosage/strength as a first-class field.** `PreferredAgent.strength` (and every cash-link rule
  in `cash.ts`) pins one representative strength per drug rather than letting a user pick the
  strength actually prescribed and see the sig/price/PA rule for that exact dose. This has bitten
  us twice this session: GoodRx's bare slug page defaults to whichever strength/form it picks
  first (already worked around per-rule via `goodRxParams` deep links — see the HRT-patch and
  ACE-inhibitor price fixes in `issues.md`), and insulin dosing is individualized enough that a
  single `sig` string can't represent it honestly. Some formularies also gate PA/quantity limits
  by strength (e.g. only the highest-dose SKU needs PA), which today's schema can't express at
  all. The VA diabetes guide (shipped 2026-07-02) makes this gap bigger: each cell pins one
  representative strength/sig for drugs whose dosing is inherently titrated (GLP-1 escalation
  schedules, individualized insulin units, metformin ramp-up), and the VA Medicaid PDL itself
  gates metformin differently *by strength* (500 mg PA'd, 1000 mg not) — exactly what this item
  exists to express. Add a strength dimension to `FormularyRecord`/`PreferredAgent` (or a `strengths[]` list of
  `{strength, sig, sigShort, plainSig, tier?, paRequired?}` variants) so a drug can carry more than
  one dose, and have cash-link resolution key off `(name, strength)` instead of name alone. Do
  this *after* — and folding in — the existing low-priority `goodRxParams` structured-fields item,
  since both touch the same "one drug, several dose variants" shape.
- **Recommended-dosage data is unsourced standard-of-care, not cited (flagged in the 2026-07-09
  validation run).** Every one of the 510 cells carries a `preferredAgent.strength` + `sig` +
  `sigShort` + `plainSig` (0 missing), so the *field* coverage is complete — but the values are
  first-line clinical dosing filled in by the gather agents, **not read off the payer source**. The
  formularies list drug names / coverage / PA only, never a dose, so the dose carries no
  `sourceId` of its own and `verification` on the cell speaks only to the preferred/PA
  determination (see the `ny-ace` `verificationNote`, which says this explicitly; 224/510 cells'
  notes already hedge the dose this way). Improvements, in priority order: (1) give the dose its
  own provenance — cite a clinical reference (FDA label / Lexicomp / AHFS) per drug and add a
  `dosageSourceIds` (or a `dosage.verified` flag) so a shown sig is traceable, not assumed;
  (2) capture titration / renal-adjustment / max-dose rather than a single representative string
  (GLP-1 escalation, insulin individualization, metformin ramp, renal-dosed ACE inhibitors) —
  overlaps the structured-`strengths[]` item above; (3) add an explicit "confirm dose against
  current labeling" disclaimer on any cell whose dose is un-cited. Do NOT let a future gather treat
  the standard-of-care dose as source-verified. Medium priority — the data is clinically reasonable
  today, this is about honesty of provenance and titration nuance.
- **Separate the state and prescription-type selectors — Phase 1 SHIPPED 2026-07-05.** `Guide`
  gained explicit `stateCode`/`topicId` keys (plus a short `topic` display label); `App.tsx`/
  `Controls.tsx` now expose two independent segmented-button controls (both state and
  therapeutic-area render as `.seg` tab groups — `src/lib/formulary.ts`'s
  `stateOptions`/`topicOptions`/`findGuideId`) instead of one flat guide-switch button row. Picking
  a (state, topic) pair with no guide shows an explicit "Not covered yet" panel instead of hiding
  the combination.
  - **NSAIDs topic added 2026-07-05:** `ny-nsaids` (NY Medicaid/NYRx) and `il-nsaids` (Illinois
    Medicaid/HFS, a brand-new state for this app) shipped, each 1 payer × 1 class (`nsaid-oral`),
    both cells `verified`. See `data-sources.md`. This makes **NY the first state with 2 topics**
    (ace-inhibitors + nsaids) — the Phase 2 trigger condition below has now actually occurred.
  - **Next: fill remaining (state, topic) gaps.** MA/MD/NY/VA/IL × {inhalers, menopause-ht,
    ace-inhibitors, diabetes, nsaids} is a big grid; most cells are still empty. Each missing cell
    needs a full `formulary-data` skill run (every payer × active class in the guide sourced and
    cited) before it can ship — do these one (state, topic) combo at a time, confirming scope
    before any Workflow fan-out (hard ≤2-concurrent-agent cap). Also still open: `ny-ace`'s
    remaining 5 NY commercial payers, NY/IL NSAIDs' remaining commercial payers (tracked in
    `data-sources.md`), and cash-link rules for the 5 NSAID drug names (`KNOWN_UNPRICED_GAP` raised
    148 → 161, see `src/lib/cash.ts`).
  - **Phase 2 (schema change) — trigger condition now met, still not urgent.** Factor `payers[]`
    out of `Guide` into a per-state pool shared across that state's topics, so adding a payer to
    NY's next topic doesn't mean re-entering NYRx's identity a 3rd time. NY now has 2 topics
    (`ny-ace`, `ny-nsaids`) with the exact same single payer object duplicated verbatim between
    them — real but small duplication cost today (1 payer object, not 8). Worth doing next time NY
    gets a 3rd topic or gains more payers, rather than before then.
- **Drug-level data for NY, VA, DC.** The state map indexes their plans/PBMs/formulary URLs
  (`src/data/state-index.json`); turn those into in-app guides with drug-level cells. DC not started.
  **NY ACE inhibitors: 1/6 intended payers shipped** (`ny-ace` guide, NY Medicaid/NYRx only —
  verified, dual-sourced). The other 5 NY payers (Empire BCBS, Excellus BCBS, Cigna, Aetna, UHC
  commercial) need a fresh gather — the `data-gathering/ny-ace-2026-07-01/payer-*.json` checkpoints
  a prior backlog note pointed at no longer exist on disk (see issues.md); there is no shortcut,
  they need re-gathering from scratch.
  **VA diabetes: SHIPPED 2026-07-02** — `va-diabetes` guide, all 8 payers × 4 classes
  (metformin-oral/glp1/sglt2/insulin), every cell `verified` off the payer's own formulary
  document. 6 payers gathered by a fresh chunked (≤2-concurrent) Workflow run; the last 2
  (Sentara Commercial, Wellcare Value Script) hit the session usage limit as agents and were
  finished inline off the same PDFs. Remaining VA follow-up: cash-link rules for the diabetes
  drugs (see below) and a quarterly re-verify.
- **Wire `trace` + `build:map` into CI / a pre-commit.** `npm run trace` (static provenance) should
  gate commits so a line item without a resolvable source fails loud; `build:map` should regenerate
  and assert `docs/formulary-map.md` matches the data (generated output must commit with its source).
  `trace:live` is too network-flaky for CI — run it on a schedule instead.
- **Prune dead CSS from the reflow.** `.cost-note*`, `.reject__intro`, `.coverage-panels`,
  `.coverage-panel--covered`, `.detail-stack`/`.detail-block` are now unmatched (see `issues.md`).
- **MD menopause: ship the `combo` class + more payers.** Estrogen–progestogen combination products
  (Combipatch, Bijuva, Climara Pro, generic estradiol/norethindrone) are scaffolded as a disabled
  `combo` tab — source and enable them. Add UnitedHealthcare and Aetna of Maryland as payers.
- **Deep-link state to the URL** (`?plan=masshealth&class=icslaba`) so a prescriber can bookmark or
  share a specific cell, and the search result can be shared.
- **Freshness badge** that turns amber when a cell's `lastReviewed` is > 90 days old (formularies
  change quarterly).
- **Print / hand-out view** of a plan's full preferred grid for a clinic binder or the patient.
- **Quantity limits** as a first-class field (the formularies carry QL codes alongside PA/ST).
- **Surface the strength/dose in the open answer** (Expert): the patient-first refactor moved the
  strength (e.g. "90 mcg") and clinical sig behind the "Prescription text for clinician" `<details>`.
  That is the one load-bearing number a prescriber needs every time — show it as a quiet line in the
  open answer (DESIGN.md "one surface, two audiences"), without bringing back the rest of the jargon.
- **Inhaler Spacer & Technique instructions** (Patient/Newbie): Show simple device-specific instructions
  (MDI vs. DPI technique) based on the preferred agent's delivery type (e.g. HFA inhalers benefit from
  spacers and slow deep breathing, while dry-powder inhalers need a fast, forceful breath).
- **Insurance Card Helper (Payer finder)** (Newbie): Add a mini-guide explaining how patients can locate
  their plan, PBM, RxBIN, and RxGroup on their physical insurance card to select the correct plan.
- **PA appeal as a payer's own pre-filled PDF form.** The letter now downloads as a real PDF
  (`lib/letterPdf.ts`, jspdf@4.2.1 lazy-loaded on click, shipped 2026-07-01); what remains is
  filling a payer's *official* appeal-form PDF (some plans require their form, not a letter).
  Needs a per-payer PDF form template — jspdf can't fill AcroForms, so that phase wants pdf-lib
  instead (advisory-swept clean 2026-07-01 alongside jspdf).

## Low

- **Remove or rewrite `scripts/validate-links.cjs`.** It predates `validate-prices.mjs`, re-derives
  GoodRx slugs naively from raw drug names instead of the real per-dosage `goodRxParams` logic in
  `src/lib/cash.ts`, and HEAD-checks ~2240 URLs with no batching (several minutes, mostly noise —
  see REFRESH.md's 2026-08-03 learned-pattern entry). `validate-prices.mjs --live` (215 URLs, pulled
  from the actual `CASH_LINK_RULES`) is the accurate, current replacement. **Impact: low** (pure
  maintenance — no user-facing effect). **Effort: low** (delete the script + its `npm run` alias, or
  fold any unique check it does into `validate-prices.mjs`). **Cost: zero** (net negative
  maintenance cost today — it burns CI/refresh time for redundant, less-accurate signal).
- **`goodRxParams` as structured fields.** `src/lib/cash.ts`'s exact-dosage deep links are hand-
  written query strings (`label_override=...&form=...&dosage=...`); worth turning into a
  `{form, dosage, quantity}` object + one shared builder once a 4th/5th rule needs the same
  treatment (only 3 do today — not worth the abstraction yet per "build the helper the second time
  you need it"). Flagged in code review.
- **`cashLinkRule()` per-row re-scan.** Each of `goodRxUrl`/`costPlusUrl`/`goodRxPrice`/
  `costPlusPrice`/`pricesCapturedAt` independently re-scans the ~20-rule regex table for the same
  drug name; harmless at this scale, worth a single `resolveCashLink(name)` if the rule table grows
  much larger. Flagged in code review.
- ESLint + Prettier (kept out of MVP to minimize dependency surface; tsc strict covers types). When
  added, wire the design ban-list regex (no `bg-(indigo|violet|purple)`, `rounded-2xl`, `shadow-lg`,
  gradients) into CI per docs/design.md.
- GitHub Actions Pages deploy (SHA-pinned `actions/*`) as an alternative to the `gh-pages` branch.
- Dark theme — invert to a warm near-black canvas, darken the three status hues one stop to hold AA.
- **Compact Clinic Grid Layout** (Expert/UX): Add a toggle for a compact side-by-side comparison matrix of
  all 5 plans for the active class, optimized for rapid clinical scanning and printing.


- **(low) One reference id per document per guide.** The va-diabetes guide registers the statewide
  DMAS PDL PDF under 2 ids (and the DMAS bulletin under 3) because each payer's gather agent minted
  its own; validation passes but single-source-of-truth favors deduping and remapping sourceIds.
  Flagged by the PR #5 data review.
- **(low) `npm ci --omit=optional` in CI/deploy.** jspdf's optionalDependencies pull core-js (has an
  install script) + canvg/html2canvas/dompurify, all unused by our code path (no `html()`/`svg()`
  calls). Omitting optionals shrinks the install-script and supply-chain surface at zero runtime
  cost. Flagged by the PR #5 SW review.
- **(low) Consider Git LFS for `sources/` if it keeps growing.** Committing the archived source
  documents (2026-07-07) put `sources/` at ~509MB and it grows every time a new state/topic gather
  ships (each guide adds up to 8 payers' worth of PDFs). Every future clone downloads this full
  history. Not urgent today, but worth moving to Git LFS (or an external bucket, keeping only
  `sources/manifest.json` committed to the main repo) if the directory keeps scaling with new
  states — flagged by the PR #11 data review.
