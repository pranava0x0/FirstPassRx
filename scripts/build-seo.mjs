import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

// Regenerates the discoverability files (robots.txt, sitemap.xml, llms.txt) from the canonical
// src/data/formulary.json so they can never drift from the guides actually shipped — the same
// "generated output commits with its source" contract split-formulary.mjs already follows.
// Run via `npm run build:seo`; `--check` (used by `npm test`) fails loud if committed output is stale.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const formulary = JSON.parse(fs.readFileSync(path.join(root, 'src/data/formulary.json'), 'utf8'))
const checkOnly = process.argv.includes('--check')

const SITE_URL = 'https://pranava0x0.github.io/FirstPassRx'
const REPO_URL = 'https://github.com/pranava0x0/FirstPassRx'

const guides = [...formulary.guides].sort((a, b) => a.id.localeCompare(b.id))

const byState = new Map()
for (const g of guides) {
  if (!byState.has(g.stateCode)) byState.set(g.stateCode, { region: g.region, topics: new Set() })
  byState.get(g.stateCode).topics.add(g.topic)
}
const states = [...byState.entries()].sort(([a], [b]) => a.localeCompare(b))
const allTopics = [...new Set(guides.map((g) => g.topic))].sort()

// ---- robots.txt ----
const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`

// ---- sitemap.xml ----
const today = new Date().toISOString().slice(0, 10)
const urlEntries = [
  `  <url>\n    <loc>${SITE_URL}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
  ...guides.map((g) => {
    const lastmod = g.lastUpdated || g.capturedAt || today
    return `  <url>\n    <loc>${SITE_URL}/?guide=${g.id}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`
  }),
]
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries.join('\n')}
</urlset>
`

// ---- llms.txt ----
const stateLines = states
  .map(([code, { region, topics }]) => `- **${region} (${code})**: ${[...topics].sort().join(', ')}`)
  .join('\n')

const llmsTxt = `# FirstPassRx

> Point-of-care formulary reference: the first-pass drug to prescribe on a given U.S. health plan so
> the prescription clears without a prior-authorization round-trip. Each result gives the recommended
> agent, the also-covered alternatives, what rejects and why, cost in plan (formulary tier) vs cash
> (GoodRx / Cost Plus Drugs), and a cited source on every claim. Reference only — confirm against the
> linked formulary before prescribing; formularies change quarterly.

## The app

[FirstPassRx](${SITE_URL}/): pick a state, a therapeutic area, an insurance plan, and a drug class.
${guides.length} plan × drug-class guides are live across ${states.length} states and ${allTopics.length} therapeutic areas as of ${today}:

${stateLines}

Every guide result shows the preferred (formulary-first) agent, covered alternatives, drugs that
require prior authorization and why, cost under the plan vs. cash-pay price, and a link to the
payer's own source document for every claim.

## Data and provenance

- [State · plan · PBM · formulary map](${REPO_URL}/blob/main/docs/formulary-map.md): every plan's published formulary source.
- [Formulary data (formulary.json)](${REPO_URL}/blob/main/src/data/formulary.json): one record per plan × class, each with sources and a verification state.
- [Data sources and verification states](${REPO_URL}/blob/main/data-sources.md)
- [Source code](${REPO_URL})
- [Sitemap](${SITE_URL}/sitemap.xml) — every guide as a direct \`?guide=<id>\` link.

## Attribution

- Formulary and preferred-drug-list data is drawn from each payer's or state Medicaid agency's own
  published document (PDL, formulary PDF, or provider portal), cited per record — see the sources
  above for the exact link and capture date behind every claim.
- Cash prices link out to [GoodRx](https://www.goodrx.com) and [Cost Plus Drugs](https://costplusdrugs.com);
  GoodRx and Cost Plus Drugs are trademarks of their respective owners, unaffiliated with this project.
  Prices are snapshots as of the date shown on each result and can change — the linked page is the
  source of truth, not this app.
- This project is independent and not affiliated with, endorsed by, or sponsored by any payer, PBM,
  state Medicaid agency, GoodRx, or Cost Plus Drugs.

## Scope and caveats

- Every cell declares a verification state — verified (read off the cited document), partial (right
  formulary cited, exact value inferred), or example (unconfirmed) — and links its source.
- Not medical advice and not a substitute for the plan's current formulary or clinical judgment.
`

const outputs = new Map([
  [path.join(root, 'public/robots.txt'), robotsTxt],
  [path.join(root, 'public/sitemap.xml'), sitemapXml],
  [path.join(root, 'public/llms.txt'), llmsTxt],
])

const changed = [...outputs].filter(
  ([filePath, content]) => !fs.existsSync(filePath) || fs.readFileSync(filePath, 'utf8') !== content,
)

if (checkOnly) {
  if (changed.length > 0) {
    const names = changed.map(([filePath]) => path.relative(root, filePath)).join(', ')
    throw new Error(`SEO files are stale: ${names}. Run npm run build:seo.`)
  }
  console.log(`SEO files match ${guides.length} canonical guides.`)
  process.exit(0)
}

for (const [filePath, content] of changed) fs.writeFileSync(filePath, content)
console.log(`Wrote robots.txt, sitemap.xml (${guides.length + 1} URLs), and llms.txt.`)
