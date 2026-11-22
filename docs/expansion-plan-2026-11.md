# Expansion and research plan (2026-11-22)

Status on 2026-11-22: 18 jurisdictions (17 states + DC), 23 topics each, plus the six common-drug
topics in 15 of them (MA, AL and DC still need those). This plan covers what comes next. Each item
ends in a `backlog.md` entry, and the daily run (`docs/daily-burndown.md`) takes them in queue order.

Companion files:
- [data-sources-map.html](data-sources-map.html): where the data lives, its format and access, and
  the laws that make it public (built by `node scripts/build-sources-map.mjs`).
- [research/data-access-and-law-2026-11-22.md](research/data-access-and-law-2026-11-22.md): cited
  research behind the map. Items it could not confirm are marked "unconfirmed".
- [research/states-roster-2026-11-22.json](research/states-roster-2026-11-22.json): Medicaid PDL
  shape, MCOs and top carriers for the 32 remaining states and 5 territories. Many MCO rosters are
  single-source and marked unconfirmed, so re-check each one when its state comes up (CLAUDE.md:
  rosters churn).
- [state-top-drugs.md](state-top-drugs.md): each state's top Part D generics against our guides
  (`node scripts/state-top-drugs.mjs --top=50`).

## 1. Change the cost curve before adding states

A cell currently costs about 16-19K agent tokens, because a Haiku agent reads a PDF and a Sonnet
agent checks it. Two federal data feeds can turn most commercial and Medicare cells into scripts
that need no agent at all:

| Feed | Covers | Format | Script to build | What it replaces |
|---|---|---|---|---|
| CMS QHP machine-readable formularies (MR-PUF → issuer `index.json` → `drugs.json`) | Every Marketplace issuer, every state (108 index URLs for PY2026) | JSON per RxCUI: tier, PA, step, QL | `scripts/fetch-qhp.mjs --state=XX` | Anthem/BCBS/Ambetter/Oscar PDF reads |
| CMS Part D formulary PUF (monthly, pipe-delimited) | Every PDP and MA-PD, including Puerto Rico MA plans | Flat files: tier, PA, step, QL per RxCUI | `scripts/fetch-partd-puf.mjs` | Humana PDP PDF reads; adds every other PDP |
| FormularyNavigator `FBO/<n>/<payer>.json` | Plans that use FormularyNavigator (Anthem state lists, Aetna Better Health, several BCBS) | NDC-level JSON | `scripts/fetch-fbo.mjs` | PDF reads for those plans |

The QHP drug list is not identical to an employer group list. Label a QHP-derived cell
"Marketplace plan" and keep group PDFs where we already cite them. The tier vocabulary is free text
per issuer, so `scripts/data/tier-map.json` normalises it (one row per issuer label, reviewed once).

Medicaid has no machine-readable mandate in practice. 42 CFR 438.10(i)(3) asks for a "machine
readable" MCO drug list in a format the Secretary specifies, but no format has been specified, so
state PDLs stay PDF or HTML. For those, the work is to make each PDL layout extractable once
(`scripts/source_rows.py` now has the generic `pdlcols` and `tiered` layouts) so the audit, and
eventually the gather itself, become deterministic.

**Order:** QHP fetcher → Part D PUF fetcher → re-derive UHC/Humana/Anthem cells in the 18 states and
diff them against the agent-gathered cells (this doubles as an accuracy audit) → only then add
states.

## 2. All 50 states, then the territories

Cost per state depends almost entirely on whether Medicaid has one PDL. Commercial and Part D cells
come from the feeds above once section 1 lands.

| Wave | States | Why |
|---|---|---|
| A (single PDL, low cost) | MN, LA, IN, MS, SC, ND, AR, WY, AK, VT, KS, MO, ID, MT | One statewide PDL binds every MCO (MN uniform PDL, LA single PDL, SC state-directed PDL since 2024-07). |
| A' (date-gated) | IA | Outpatient pharmacy moves to one Optum Rx PDL on 2026-12-01. Gather after that date, not before. |
| B (hybrid PDL) | AZ, CO, NE, NJ, NM, UT, NH, DE, CT, ME, WI | State PDL for some classes, plan lists for the rest. Expect one extra document per MCO for the non-PDL classes. |
| C (per-MCO lists) | HI, OK, OR, NV, RI, SD, WV | Each MCO publishes its own PDL (OR: each CCO). Most expensive; WV not yet researched. |
| Territories | PR, GU, VI, AS, MP | See below. |

Per state, the unit stays the same: the Medicaid PDL (one Haiku read for all classes, one Sonnet
check), the largest BCBS/Anthem list or its QHP JSON, and the reused national UHC and Humana records.

**Territories.** We found no published Medicaid formulary for GU, AS or MP, and PR's Medicaid PBM is
being re-procured (ASES RFP 2026-001). What can ship:
- **PR:** Medicare Advantage plans (MMM, Triple-S Advantage, MCS) are a large share of enrollment and
  are in the Part D PUF, so PR can ship as a Medicare-and-commercial guide set once the PUF fetcher
  exists. Add PR Medicaid (Plan Vital) when ASES publishes the new PDL.
- **GU, VI, AS, MP:** ship national Part D plans only, with an explicit "no published Medicaid
  formulary" empty state (CLAUDE.md: empty is not broken). Revisit the VI PBM (SGRx) list yearly.

## 3. More medications per state

`scripts/state-top-drugs.mjs` ranks each state's Medicare Part D generics by claims and checks
whether any guide in that state mentions them. Across the 18 covered states, 87% of the top 50 are
already mentioned. The gaps that recur in most states define the next topic batch:

| Topic (new) | Driving generics (top-50 gap in N of 18 states) | Likely PA value |
|---|---|---|
| Antiplatelets | clopidogrel (18); prasugrel, ticagrelor (Brilinta) | Brilinta step and PA on some plans |
| Gout | allopurinol (17); febuxostat, colchicine (Mitigare/Gloperba), Krystexxa | febuxostat step, colchicine brands |
| Asthma controller, oral | montelukast (16); zafirlukast | low; pairs with existing inhaler guides |
| Glaucoma | latanoprost (16); timolol, dorzolamide, Rhopressa, Vyzulta | brand prostaglandins PA |
| Heart failure / MRA | spironolactone (13); eplerenone, Kerendia, Entresto | Kerendia, Entresto PA |
| Dementia | donepezil (7); memantine, Namzaric; Leqembi/Kisunla are medical benefit | low (mostly generic) |
| Potassium | potassium chloride ER | formulation-level tiering |

Medicare data under-counts children and younger adults. Add a Medicaid counterpart from State Drug
Utilization Data (data.medicaid.gov, per-state, quarterly) to rank ADHD, contraception, pediatric
asthma, antibiotics, antipsychotics and buprenorphine by Medicaid volume. Build it as
`scripts/state-top-drugs.mjs --source=sdud`. Two candidate topics already stand out from clinical
practice and should be checked against SDUD before adding: **contraception** (ACA no-cost-share
rules make the "which product is $0" question high-value) and **opioid use disorder**
(buprenorphine/naloxone; most states removed PA for MOUD, and that is worth showing per state).

## 4. Costs beyond the prescription price

| Cost | Source | How to show it |
|---|---|---|
| OTC equivalents (omeprazole, famotidine, loratadine, cetirizine, naproxen, ibuprofen, docusate, polyethylene glycol) | NADAC per unit (weekly, public domain) for the pharmacy acquisition cost; retail shelf prices are volatile and per-store | Show NADAC × quantity as a floor and say so; link out to a retail search. Note when Medicaid covers the OTC with a prescription (most PDLs list covered OTCs) |
| Dispensing fees | State Medicaid fee schedules (public); Cost Plus `cash_dispensing_fee` already in the API | Fold into the Cost Plus total (already done) and show the Medicaid fee per state |
| Supplies and devices (spacers, pen needles, glucose strips and meters, CGMs) | Medicaid DME and pharmacy lists; Part D PUF covers pen needles and strips | A "you will also need" line under each injectable or inhaler pick |
| Medicare out-of-pocket cap and insulin cap | IRA provisions in the Part D rules (the 2026 cap amount needs a citation before it ships) | One line on Part D cells: how the cap limits what a patient pays for an expensive pick |
| Manufacturer copay cards and patient assistance | Manufacturer sites (volatile; link only, never bake the amount); Medicare and Medicaid patients are excluded from copay cards by the federal anti-kickback statute | Link per brand, with the eligibility caveat |
| Administration costs for physician-administered drugs | Medicare Part B ASP pricing files (quarterly, CMS) | ASP + 6% as the Part B allowed amount for clinic-administered picks (Prolia, Reclast, LAIs) |
| Monitoring labs a pick requires (TDM, LFTs, lipid panels, eye exams for hydroxychloroquine) | FDA label "Warnings" and "Monitoring" sections (DailyMed API) | A small "requires monitoring" chip; no dollar figure |

## 5. Better prior authorization

What exists: criteria sets per payer, a PA worksheet, and draft letters and PDFs. Next, ordered by
value per effort:

1. **Criteria coverage as a metric.** `build-pa-targets.mjs --summary` already counts barrier drugs
   without criteria. Publish it per state in `docs/` and stop calling a state "done" while a
   multi-state payer has gaps.
2. **Step-therapy override rights per state.** About 38 states plus DC have step-therapy exception
   laws (ABA, 2026). A per-state table (statute, the exception grounds it lists, and the
   insurer's response deadline) lets the PA letter cite the state's own law. Fully insured plans
   only, not self-funded ERISA plans, and the letter has to say so.
3. **Decision deadlines on the worksheet.** Medicaid PA must answer in 24 hours with a 72-hour
   emergency supply (SSA 1927(d)(5)). QHP exceptions take 72 hours standard and 24 hours expedited
   (45 CFR 156.122(c)), and Part D 72/24 hours. Show the clock that applies to the selected plan.
4. **Payer PA metrics.** CMS-0057-F required payers to post PA approval and denial metrics from
   2026-03-31. Those reports exclude drugs, but they still rank payers by how they handle PA. Scrape
   them per payer (they are public web pages) as context, labelled "medical items only".
5. **ePA channel per payer.** Which payers take ePA through the PBM (CoverMyMeds, Surescripts) and
   which want fax. This builds on queue item 5 (PA submission channels).
6. **Gold-card status.** Texas HB 3459 exempts prescribers with high approval rates; note where a
   state has a gold-card law. Prescriber-specific status is private, so only the rule ships.
7. **Watch CMS-0062-P.** It proposes drug PA through NCPDP standards and 24-hour Medicaid decisions
   from 2027-10-01. If it becomes final, a payer's ePA endpoint becomes a real data source. Re-check
   the Federal Register monthly.

## 6. Who makes the drug, and how far to trust them

Keep this lane separate from coverage, and show facts, not a score (CLAUDE.md: no black-box
scores; separate facts from judgments).

| Fact | Authoritative source (free) | Script |
|---|---|---|
| Labeler / application holder per product | openFDA NDC + Orange Book (applicant), DailyMed SPL | `scripts/fetch-manufacturers.mjs` keyed by RxCUI → NDC → labeler |
| Parent company | SEC EDGAR company search (CIK); labeler-to-parent table reviewed by hand | `scripts/data/labeler-parents.json` |
| Recalls and enforcement | openFDA drug enforcement API | per labeler, last 5 years, with class (I/II/III) |
| Warning letters and inspections | FDA warning letter database, FDA Data Dashboard (inspection classifications, Form 483s) | per facility FEI |
| Shortages | FDA drug shortage database (openFDA shortages endpoint) | per product; also useful for "the preferred pick is short" warnings |
| Payments to prescribers | CMS Open Payments (public, per manufacturer, per drug) | total general payments per brand per year |
| Patent and exclusivity, generic entry | Orange Book patent and exclusivity files | "generic expected" date on brand picks |
| Settlements and fines | DOJ press releases (no API) | manual, cited, only when ≥ 2 independent sources (CLAUDE.md contested rule) |
| Advertising spend | No free per-drug source. Company-level advertising expense is in 10-K notes (EDGAR XBRL `AdvertisingExpense`); per-drug TV spend is paid data (iSpot, Kantar) or appears in published research | Ship company-level 10-K figures with the filing year; do not estimate per-drug spend |

"Trustworthy" is a judgment. Show the facts (recalls by class, warning letters, shortage history,
Open Payments) and let the prescriber judge. If a summary label is ever wanted, it needs a written
rubric reviewed by a pharmacist, and it lives in the judgment lane.

## 7. Comparing drugs in the same class

Coverage says which drug a plan prefers, not which drug is better. Add an "evidence" lane per class
with cited, authoritative comparisons:

- **AHRQ Effective Health Care** comparative effectiveness reviews (federal, free).
- **Drug Effectiveness Review Project (DERP, OHSU Center for Evidence-based Policy)**: built for
  state Medicaid P&T committees, so it is the evidence base the PDLs themselves use. Access is by
  membership, so confirm what is public.
- **State P&T committee packets**: public meeting materials often include the class review the PDL
  decision rests on (PA DHS, WA HCA, many others). They show both the evidence and the reason a
  class is preferred.
- **VA/DoD clinical practice guidelines and VA National Formulary drug class reviews** (public).
- **ICER** reports for new brand-only products (net-price and value assessments, public summaries).
- **Cochrane** reviews (abstracts free).
- **Specialty guidelines**: ADA Standards of Care, ACC/AHA, GINA and GOLD, AGA (GERD, P-CABs), AUA
  (BPH), IDSA (UTI, C. difficile), ACR (gout, RA), AAN.
- **FDA labels** for head-to-head trial data and boxed warnings (DailyMed API).

Each class gets 3-5 bullets, each tied to one citation, and a "last reviewed" date. Write them in a
Sonnet pass with web search, then fact-check them with a second Sonnet pass (the pattern that found
3 wrong sigs on 2026-10-27).

## 8. Deterministic scripts, one per source, validated every run

The goal is that anyone can add a state by adding a row to a registry, not by reading a 1,200-line
CLAUDE.md. What exists after this PR:

| Step | Script | Deterministic? |
|---|---|---|
| Archive source bytes + provenance | `npm run archive-sources` | yes |
| Extract rows from a source | `python3 scripts/source_rows.py <url>`: archived bytes first, `--live` for the current edition; layouts optum, mgb, bcbs, mhdl, **pdlcols**, **tiered** | yes |
| Audit every record against its rows | `node scripts/audit-cells.mjs --state=XX`; many states: `scripts/audit-states.sh <out> <topics|all> XX YY` | yes |
| Rank common drugs per state | `node scripts/state-top-drugs.mjs` | yes (cached CMS CSV) |
| Source map | `node scripts/build-sources-map.mjs` | yes |
| Gather (read a payer document for N classes) | Haiku agents via `formulary-gather.js` | no: the one step that still needs agents |

To build next, in order:
1. **`scripts/data/source-registry.json`** (state → payer → document id, URL, fetch tier
   curl/node/browser, layout, expected minimum rows). Generate the first version from guide
   references, the manifest and the rows index. `npm run sources:check` fails when a cited
   source has no archived bytes, extracts zero rows, or changes sha256 (a reissue). Today, extracting
   the KY Medicaid PDL live (on 2026-11-22) gave a different sha256 from the 2026-11-03 archive, and
   nothing flagged it.
2. **Audit coverage gate.** Each state's audit must report its OK + flagged share. A state whose
   checks are mostly SKIPPED is not verified. Before this PR, every check in the 14 common-drug
   states was SKIPPED because the extractor only knew the MA layouts.
3. **Gather from rows.** Once a document extracts cleanly, a script can propose the cell (pick =
   preferred generic in the class, barriers = non-preferred/PA rows) and the agent only reviews the
   proposal. That makes the Haiku pass a check instead of a read.
4. **Fetchers** for QHP JSON, the Part D PUF and FBO JSON (section 1).

## 9. MCP servers

No MCP server exists today for payer formulary tiers or PA rules (research, 2026-11-22). Build in
this order:

1. **`firstpassrx` MCP over our own data** (read-only, no network): `lookup(state, payer, class)`,
   `search_drug(name)`, `compare(state, drug, payerA, payerB)`, `sources(guide)`. It reads the
   generated chunks, so it is always as fresh as the site. Cheapest, and it lets agents verify
   their own merges.
2. **QHP formulary MCP**: wraps the MR-PUF → `index.json` → `drugs.json` walk with an on-disk cache
   keyed by URL + ETag; `coverage(rxcui, state)` returns every Marketplace plan's tier, PA, step and
   QL. Public data, no auth.
3. **Part D PUF MCP**: the monthly files loaded into SQLite; `coverage(rxcui, contract_id)`.
4. **Reference MCP**: RxNorm (20 req/s limit, attribution required), openFDA (NDC, enforcement,
   shortages), DailyMed, NADAC, Open Payments. Existing open-source MCPs cover RxNorm and openFDA;
   evaluate those before writing our own (supply-chain check first, per CLAUDE.md).
5. **Not MCPs:** state PDL PDFs, GoodRx and commercial PDFs stay behind the archive + extractor
   pipeline. GoodRx's usage guide forbids storing API data, so it stays a link-out with a price read
   in the browser at capture time.

## 10. Routine changes made in this PR

- The daily run now merges the rolling PR itself once it has been open more than 3 days, when CI is
  green and the review comments are resolved, then starts a fresh `burndown/rolling` from `main`
  (docs/daily-burndown.md, "Every run").
- The common-drug queue item now ends with the deterministic audit, which needs the new generic
  layouts, before the Sonnet check.
