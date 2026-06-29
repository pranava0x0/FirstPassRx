# FirstPassRx

Find the first-pass drug for each major plan and avoid a Prior Authorization round-trip. A
prescriber picks the exact benefit product and drug class; the app shows the formulary first-pass
agent, covered alternatives, true coverage barriers, and a numbered **source citation** on every
result. It does not recommend treatment or generate prescription directions: patient-specific
clinical selection and dosing remain outside the formulary tool.

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

`npm run trace` is a static, offline gate (exits non-zero if any visible coverage or restriction
claim lacks the correct claim-specific source lane). `npm run trace:live`
re-fetches each cited formulary/PDL — source **websites** move over time even when the **material**
stays similar, so this catches dead/moved citations (run it each quarter). See
[scripts/trace-sources.mjs](scripts/trace-sources.mjs).

## Deploy to GitHub Pages

The application is configured to deploy to GitHub Pages automatically via GitHub Actions on every push/merge to the `main` branch.

### Automatic Deploy (Recommended)
We use a GitHub Actions workflow in `.github/workflows/deploy.yml` that builds and deploys the app.
To enable this:
1. Go to your repository on GitHub.
2. Navigate to **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions** (instead of "Deploy from a branch").

### Manual Deploy (Alternative)
You can still deploy manually from your local machine to the `gh-pages` branch:

```sh
npm run deploy      # builds, then pushes dist/ to the gh-pages branch (gh-pages -d dist -t)
```

In this case, the Pages source in Settings must be set to deploy from the `gh-pages` branch.
The site publishes at `https://<user>.github.io/FirstPassRx/`. (`-t` includes the `.nojekyll` dotfile so GitHub serves Vite's `assets/` output verbatim.)

## Update the data (the main contribution path)

Everything lives in one file: [`src/data/formulary.json`](src/data/formulary.json), shaped as
`{ meta, guides[] }`. Global `meta` holds only the title, disclaimer, version, and `defaultGuideId`.

- Each **guide** (`guides[]`) is one region × therapeutic area and self-contained: its own
  `payers[]`, `classes[]`, `references[]`, `glossary[]`, `records[]`, plus the masthead/label copy
  (`region`, `topic`, `classNoun`, `unitNoun`, `tagline`) and its own `dataStatus` / dates.
- `payers` / `classes` are the **single source of truth** for that guide's dropdown and tabs — add a
  payer or class there and the toggle/UI picks it up. To add a new region or drug type, add a guide.
- Every payer identifies the exact `productName`, `marketSegment`, and `formularyId`; a carrier name
  alone is never treated as a coverage key.
- `records[]` is one entry per product × class. Each carries the formulary first-pass agent,
  alternatives, true barriers (`pa` / `step` / `nonformulary`), and separate
  `coverageSourceIds` / `restrictionSourceIds`.
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
  components/             Search, Controls, ResultCard, BoglBanner, RejectList,
                          Citations, GlossaryTerm, Disclaimer
  App.tsx                 plan/class state + search wiring + layout
```

Every cell links claim-specific sources (`coverageSourceIds` / `restrictionSourceIds` → references)
and declares a coverage `verification` state.
The UI renders the citations and the state on each result; `npm test` enforces that every cell
cites a resolvable source and that the verified MassHealth Ventolin BOGL finding stays intact.

See [CLAUDE.md](CLAUDE.md) for engineering principles, [docs/design.md](docs/design.md) for the visual
identity, and [backlog.md](backlog.md) for what's next (omni-search, real sourced data, the
"Automate PA Appeal" and biologics features that ship disabled today).
