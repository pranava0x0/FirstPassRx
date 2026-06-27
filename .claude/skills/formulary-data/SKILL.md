---
name: formulary-data
description: Gather or update FirstPassRx formulary data (preferred agents, BOGL, PA/step rules, citations) for a given location (state), payer/insurance, and drug class/type. Use when adding a new payer or state, refreshing a quarter's formulary, verifying `partial`/`example` cells, or adding a drug class (e.g. biologics). Pulls from reputable sources (gov / insurer / PBM / FDA / guideline) with citations, checkpoints every source to disk so a connection drop never loses work, and validates against the formulary schema before merging.
---

# Gathering & updating formulary data

The data lives in `src/data/formulary.json`, shaped by `src/types/formulary.ts` and validated by
`validate()` in `src/lib/formulary.ts`. This skill produces sourced cells with honest verification
states, **without losing work when an agent or connection drops mid-run.**

## Schema: guides, not a flat file

The file is `{ meta, guides[] }`. Global `meta` holds only `title`, `disclaimer`, `version`,
`defaultGuideId`. **Each guide is one region × therapeutic area and self-contained** — it owns its
`payers[]`, `classes[]`, `references[]`, `glossary[]`, `records[]`, plus its display copy
(`region`, `topic`, `classNoun`, `unitNoun`, `tagline`) and its own `dataStatus` / `lastUpdated` /
`capturedAt`. `sourceIds` resolve **within the guide** (references are per-guide; shared clinical
terms like PA / BOGL / step-therapy are duplicated into each guide's glossary). So everywhere below
that says `meta.payers` / `meta.classes` / `meta.references` / `meta.dataStatus`, read it as
**`guides[<the target guide>]`** instead. First confirm which guide id you're updating (e.g.
`ma-inhalers`, `md-menopause`) — or scaffold a new guide entry before gathering.

## Inputs (always confirm before starting)

- **Guide** — which `guides[].id` this run updates (a region × therapeutic area), or a new guide to
  create.
- **Location** — the US state. Determines the Medicaid plan (e.g. MA → MassHealth, MD → Maryland
  Medicaid) and which commercial payers/PBMs are in scope.
- **Payer(s) / insurance** — one or more plans. Each maps to a `guides[].payers[]` entry with its
  `formularyUrl`, `paPolicyUrl`, and `pbm`.
- **Drug class / type** — one of the guide's `classes[]` ids (inhalers: `saba`, `ics`, `icslaba`,
  `lama`, `biologics`; MD menopause: `est-td`, `progestogen`, `vaginal`, `combo`) or a new class to
  add. Record the indication.

## Reputable-source allowlist (enforce; never invent a URL)

Cite only origins you actually fetched and that returned real, on-topic content:

- **Gov:** `*.gov` — `mass.gov`, `health.maryland.gov` (Maryland Medicaid PDL), `cms.gov`,
  `fda.gov` (Orange Book / Purple Book / first-generic lists), `nih.gov`, `ncbi.nlm.nih.gov`,
  `nhlbi.nih.gov`, `dailymed.nlm.nih.gov` (FDA labels).
- **Guideline:** asthma/COPD — `ginasthma.org`, GOLD report; menopause HT — `acog.org`,
  `menopause.org` (The Menopause Society / NAMS position statements).
- **Payer:** the plan's own domain or its formulary host (e.g. `optumrx.com` content hub,
  `formularynavigator.com`, the Conduent MHDL host for MassHealth, `carefirst.com`,
  `healthy.kaiserpermanente.org`).
- **PBM:** `caremark.com`, `express-scripts.com`, `optum.com`.

A 200 + a real PDF is **not** proof — confirm the document's effective date and that the drug-class
section actually backs the claim (page-1 caption: publisher, plan, effective date). Prefer a
downloaded PDF with real page text over a metadata-only "verified" flag.

## Procedure — checkpoint every source to disk

Run gathering as a Workflow with **one agent per (payer × topic)**, and make each agent **Write its
result to a checkpoint file as its final step, before returning.** This is the resilience fix: if a
later agent or the connection dies, every completed source is already on disk.

1. **Scope inline** (cheap): list the target payers × classes; create `data-gathering/<stamp>/`.
2. **Gather (fan-out).** Each research agent (agentType `general-purpose`, has WebSearch/WebFetch +
   Write):
   - searches → fetches the reputable source → extracts the preferred agent, BOGL/brand flag,
     reject list + reasons, step text, and citation URLs with effective dates;
   - **Writes `data-gathering/<stamp>/<payer>-<class>.json` (its findings + sources) BEFORE
     returning**, then returns the same object. (Checkpoint-then-return — never only return.)
3. **Verify (fan-out).** For each payer's primary URL, a second agent re-fetches and confirms it
   resolves + correct publisher + effective date. Write `…/<payer>-verify.json`.
4. **Merge inline.** Read the checkpoint files (not just the workflow return value — they survive a
   dropped run), map each into a `FormularyRecord` with the right `verification` state, and merge
   into the target guide's `records[]` + `references[]` inside `src/data/formulary.json`.

### Resilience rules

- **Read checkpoints, not just the return value.** On any failure (`connection closed`,
  `API Error`, partial workflow), re-read `data-gathering/<stamp>/*.json` — completed sources are
  intact. Resume the Workflow with `resumeFromRunId` to re-run only what's missing.
- **Never overwrite the whole file from a partial run.** Merge new/changed cells into the existing
  `formulary.json`; a capped run must not drop cells gathered earlier.
- One agent died last time (`research:biologics`, connection closed) and its output was lost because
  it only returned — checkpointing prevents the recurrence.

## Verification states (be honest)

- `verified` — preferred agent + key restriction read directly off the cited document.
- `partial` — correct current formulary cited, exact value inferred (confirm in the doc).
- `example` — illustrative; right formulary family, value unconfirmed (e.g. the PDF blocked the
  fetcher). The UI must surface this (verify stamp + `verificationNote`); never present as fact.

## Finish

- Set the **guide's** `dataStatus` (`verified` only when every cell in that guide is), its
  `capturedAt` / `lastUpdated`, and bump global `meta.version`.
- Run `npm run typecheck && npm test` — the suite enforces that every cell cites a resolvable source,
  PA/alt items are well-formed, and the verified MassHealth Ventolin BOGL finding stays intact.
- Update `data-sources.md` with the new sources and per-payer status; log any walled/403 sources so
  the next run doesn't re-confirm a dead end.
