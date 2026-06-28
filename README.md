# FirstPassRx

Find the first-pass drug for each major plan and avoid a Prior Authorization round-trip. A
prescriber picks the insurance plan and drug class (or searches a drug); the app shows the agent that
ships clean, the brand-required (BOGL) warning, the drugs that reject and why, an editable Rx sig to
paste into Epic/Cerner, and a numbered **source citation** on every result. Clinical terms carry a
tap-for-plain-English glossary so patients can use it too.

A top-level toggle switches between **guides** — each a region × therapeutic area with its own plans,
classes, and sourced data:

- **MA · Inhalers** — Massachusetts inhaler formularies (MassHealth, BCBS MA, Tufts, Harvard Pilgrim, MGB).
- **MD · Menopause HT** — Maryland menopause hormone therapy across 8 plans (Maryland Medicaid,
  CareFirst, Kaiser Mid-Atlantic, Johns Hopkins Priority Partners, UnitedHealthcare, Cigna, Aetna,
  and a representative Medicare Part D plan).

Static single-page app — React + Vite, no backend, deploys to GitHub Pages. Design identity is
"Monograph" (a dated drug-compendium page); see [docs/design.md](docs/design.md).

> ⚠️ **Reference only.** Data is drawn from real, cited sources (MassHealth MHDL, payer formularies,
> FDA, NHLBI, GINA) but each cell carries a `verification` state — `verified`, `partial`, or
> `example`. Confirm every agent and restriction against the linked source before prescribing;
> formularies change quarterly. See [data-sources.md](data-sources.md).

## Run it

```sh
npm install      # or: npm ci  (uses the committed lockfile — preferred)
npm run dev      # http://localhost:5173/FirstPassRx/
```

## Verify before you ship

```sh
npm run typecheck   # tsc strict, no emit
npm test            # vitest: data integrity + sig + app behavior
npm run trace       # provenance gate: every line item resolves to a cited source
npm run trace:live  # re-fetch every source, flag website drift (moved/404 URLs)
npm run build:map   # regenerate docs/formulary-map.md (state · plan · PBM · formulary)
npm run build       # tsc -b && vite build  → dist/
npm run preview     # serve the production build locally
```

`npm run trace` is a static, offline gate (exits non-zero if any cell's preferred agent,
alternative, reject, or tier doesn't trace to a resolvable cited source). `npm run trace:live`
re-fetches each cited formulary/PDL — source **websites** move over time even when the **material**
stays similar, so this catches dead/moved citations (run it each quarter). See
[scripts/trace-sources.mjs](scripts/trace-sources.mjs).

## Deploy to GitHub Pages

The Vite `base` is set to `/FirstPassRx/` in [vite.config.ts](vite.config.ts) — change it if you
fork to a differently named repo. Then:

```sh
npm run deploy      # builds, then pushes dist/ to the gh-pages branch (gh-pages -d dist -t)
```

In the repo's **Settings → Pages**, set the source to the `gh-pages` branch. The site publishes at
`https://<user>.github.io/FirstPassRx/`. (`-t` includes the `.nojekyll` dotfile so GitHub serves
Vite's `assets/` output verbatim.)

## Update the data (the main contribution path)

Everything lives in one file: [`src/data/formulary.json`](src/data/formulary.json), shaped as
`{ meta, guides[] }`. Global `meta` holds only the title, disclaimer, version, and `defaultGuideId`.

- Each **guide** (`guides[]`) is one region × therapeutic area and self-contained: its own
  `payers[]`, `classes[]`, `references[]`, `glossary[]`, `records[]`, plus the masthead/label copy
  (`region`, `topic`, `classNoun`, `unitNoun`, `tagline`) and its own `dataStatus` / dates.
- `payers` / `classes` are the **single source of truth** for that guide's dropdown and tabs — add a
  payer or class there and the toggle/UI picks it up. To add a new region or drug type, add a guide.
- `records[]` is one entry per payer × class within the guide. Each carries the preferred agent,
  `boglActive` (forces brand), `paRequired` (hard-reject list), and `stepTherapy`.
- `npm test` enforces the invariants **per guide**: every payer × active class is covered, no record
  points at a coming-soon class, every BOGL cell names a brand + a reason, and every `sourceId`
  resolves within its guide. A bad PR fails loud.

When you verify a cell against a real formulary, set its `sourceIds` and `lastReviewed`, and set the
guide's `dataStatus` (`verified` only when every cell in that guide is sourced).

## Structure

```
src/
  data/formulary.json     the data: meta (payers, classes, references, glossary) + records (edit this)
  types/formulary.ts      the shape (single source of truth)
  lib/formulary.ts        load + validate + index the data; search index; glossary + source lookup
  lib/sig.ts              build the EHR-ready Rx string (brand under BOGL, else generic)
  components/             Search, Controls, ResultCard, BoglBanner, RejectList, RxSig,
                          Citations, GlossaryTerm, Disclaimer
  App.tsx                 plan/class state + search wiring + layout
```

Every cell links its sources (`sourceIds` → `meta.references`) and declares a `verification` state.
The UI renders the citations and the state on each result; `npm test` enforces that every cell
cites a resolvable source and that the verified MassHealth Ventolin BOGL finding stays intact.

See [CLAUDE.md](CLAUDE.md) for engineering principles, [docs/design.md](docs/design.md) for the visual
identity, and [backlog.md](backlog.md) for what's next (omni-search, real sourced data, the
"Automate PA Appeal" and biologics features that ship disabled today).
