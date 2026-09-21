# Burndown plan — 2026-09-21

Snapshot and prioritized plan for closing out unfinished work, requested alongside the SEO pass
below. This is a plan, not a tracker — ongoing status lives in `backlog.md` (feature/data backlog),
`issues.md` (bugs), and `docs/RESUME-EXPANSION.md` (the live DOAC/state-expansion ledger); update
those, not this file, as work lands.

## 1. Repo health at session start

- Working tree clean, no uncommitted changes.
- No open GitHub PRs or issues (`gh pr list` / `gh issue list` both empty).
- No unmerged local branches (only `gh-pages`, the deploy target, differs from `main`).
- "Unfinished work" is entirely in this project's own tracking files, not in stalled review/merge
  state — there was nothing blocked on a human, just a long backlog of scoped-but-not-done data and
  feature work.

## 2. Shipped this session

1. **Site discoverability** — `robots.txt` and `sitemap.xml` didn't exist; `llms.txt` still
   described the original 2-guide MVP against a live app with 62+ guides. Added
   `scripts/build-seo.mjs`, which regenerates all three straight from `src/data/formulary.json`
   (same pattern as `split-formulary.mjs`), wired into `predev`/`prebuild`/`pretest` so they can't
   drift again. `llms.txt` now also carries an explicit attribution section (data provenance,
   GoodRx/Cost Plus trademark note, no-affiliation disclaimer). `index.html`'s meta/OG/JSON-LD copy
   updated off the stale 2-guide framing.
2. **`md-doac`** — Maryland's DOAC anticoagulant guide, the heart-related priority, continuing the
   established state-by-state scale-out (`al-doac` proof → `ny-doac` → `pa-doac` → `ca-doac` →
   `ma-doac` → **`md-doac`**). All 8 payers gathered live and cited; one genuine finding (Kaiser
   Permanente Mid-Atlantic doesn't cover apixaban at all — first payer in the dataset where that's
   true). Full validation suite green; sources archived.

## 3. Heart-related priority (next up, per explicit request)

The DOAC anticoagulant topic is the only shipped/in-progress "heart meds" thread in this dataset.
Remaining states, in the order `docs/doac-expansion-playbook.md` already tracks:

| State | Payers | Status |
|---|---|---|
| VA | 8 (va-ace roster) | **Next** |
| IL | 8 (il-ace roster) | After VA |

Each is a bounded, well-scoped unit (~2-4 hours of chunked live research per state, following the
proven recipe in `docs/doac-expansion-playbook.md`) — recommend continuing one state per session,
per the standing "state by state, to save tokens" pacing this project has used since 2026-09-07.

**After DOAC finishes (VA, IL), the next heart-related candidate is PCSK9 inhibitors** (evolocumab/
Repatha, alirocumab/Praluent for high cholesterol) — already scoped and ranked in `backlog.md`'s
candidate-topic scorecard as the single strongest PA-friction stat of any candidate (82-97% PA
rate, up to 79% rejection) with a confirmed real, self-pay-eligible GoodRx cash price. It reuses the
existing single-class taxonomy shape (`ssri-oral`/`ace-inhibitor`) and needs no new payer discovery
in any already-built state. This is a scoping decision for the user, not something to start
unilaterally — flagged here so it's the obvious next pick once DOAC wraps.

## 4. Everything else in the backlog — deferred, not attempted

`backlog.md` runs to ~1,000 lines of scoped-but-optional feature and data-depth work. None of it is
blocking, broken, or time-sensitive; deferring all of it this session to stay token-efficient and
avoid unrequested scope. Highest-value items if the user wants to pick one next:

- **National coverage expansion** (43 states have zero guides) — explicitly gated on the user
  picking a prioritization axis; not resumed without that answer.
- **Other candidate topics** beyond DOAC/PCSK9 — atypical antipsychotics (strong PA-friction +
  cash-price story, zero new payer-discovery cost in CA/IL) is the next-best-ranked after PCSK9.
- **UI/feature backlog** (formulary change-history view, multi-class patient med list, CSV export,
  Cmd+K palette, dosage/strength as a first-class field) — all scoped, all optional, none urgent.
- **Existing-guide depth gaps** (`partial`/`example` cells, mostly IV/injectable medical-benefit
  carve-outs already correctly labeled, not broken) — a verification pass, not a bug fix.

## 5. Open issues — minor, non-blocking

Three tooling issues remain open in `issues.md`, all informational/non-blocking per their own
write-ups: `trace-sources.mjs` false-positive drift on 3 bot-gated hosts, `archive-sources` 403s on
`medicaid.alabama.gov`'s non-standard TLS config, and a stale VA diabetes gather checkpoint
reference. None affect shipped data correctness. Also flagged separately this session (spawned as a
background task, not fixed inline to stay in scope): a display-copy regex in
`PrescribeOptions.tsx` mangles "no PA/ST/QL" into "no prior authorization required/ST/QL" — a
pre-existing bug affecting several guides, caught while browser-verifying `md-doac`.

## Recommendation

Continue the DOAC scale-out one state per session (VA next), merging each to `main` as it lands —
the model this project has used successfully five times already. Revisit the 43-state
prioritization question and the PCSK9/atypical-antipsychotics topic choice explicitly with the user
rather than picking unilaterally, per this project's own "confirm scale before scaling" rule.
