#!/usr/bin/env node
// Build docs/data-sources-map.html: where formulary / PA / price data lives, how it can be read, the
// laws that make it public, and how far FirstPassRx covers each state.
//
//   node scripts/build-sources-map.mjs
//
// Inputs (edit these, then re-run): docs/research/sources-graph.json (sources + laws, cited),
// docs/research/states-roster-*.json (latest; uncovered states and territories), and
// src/data/formulary.json (covered states, cited hosts). No network.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const graph = JSON.parse(readFileSync(join(ROOT, 'docs/research/sources-graph.json'), 'utf8'))
const rosterFile = readdirSync(join(ROOT, 'docs/research')).filter((f) => /^states-roster-.*\.json$/.test(f)).sort().pop()
const roster = JSON.parse(readFileSync(join(ROOT, 'docs/research', rosterFile), 'utf8'))
const data = JSON.parse(readFileSync(join(ROOT, 'src/data/formulary.json'), 'utf8'))

// Hosts FirstPassRx cites today, counted by reference.
const hostCount = new Map()
const covered = new Map()
for (const g of data.guides) {
  const c = covered.get(g.stateCode) ?? { guides: 0, payers: new Set() }
  c.guides++
  for (const p of g.payers) c.payers.add(p.id)
  covered.set(g.stateCode, c)
  for (const r of g.references ?? []) {
    try { const h = new URL(r.url).hostname.replace(/^www\./, ''); hostCount.set(h, (hostCount.get(h) ?? 0) + 1) } catch { /* non-URL reference */ }
  }
}
const topHosts = [...hostCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)

const ALL = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','PR','GU','VI','AS','MP']
const rosterBy = Object.fromEntries(roster.jurisdictions.map((j) => [j.code, j]))
const tiles = ALL.map((code) => {
  const c = covered.get(code)
  if (c) return { code, status: 'covered', label: `${c.guides} guides, ${c.payers.size} payers` }
  const j = rosterBy[code]
  if (!j) return { code, status: 'unknown', label: 'not researched yet' }
  const u = String(j.medicaidPdl?.uniform ?? '').toLowerCase()
  const status = u.startsWith('yes') ? 'single' : u.startsWith('partial') ? 'partial' : u.startsWith('no') ? 'permco' : 'unknown'
  return { code, status, label: `${String(j.medicaidPdl?.uniform ?? 'unconfirmed').split('(')[0].trim()}; cost ${j.cost ?? '?'}` }
})

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const LANES = [
  ['medicaid', 'Medicaid', (s) => s.payerTypes.some((t) => /medicaid|chip/.test(t))],
  ['partd', 'Medicare Part D', (s) => s.payerTypes.some((t) => /medicare|part-?d|ma-pd/.test(t))],
  ['commercial', 'Commercial and Marketplace', (s) => s.payerTypes.some((t) => /commercial|marketplace|qhp|employer/.test(t))],
  ['reference', 'Prices and drug reference', () => true],
]
const placed = new Set()
const lanes = LANES.map(([id, name, test]) => {
  const items = graph.sources.filter((s) => !placed.has(s.id) && test(s))
  items.forEach((s) => placed.add(s.id))
  return { id, name, items }
})
const usedIds = new Set(['state-pdl-pdf', 'masshealth-mhdl', 'mco-formulary', 'commercial-pdf', 'pa-criteria', 'humana-pdp', 'fn-fbo', 'costplus', 'goodrx', 'partd-prescribers'])
const lawName = Object.fromEntries(graph.laws.map((l) => [l.id, l.name]))

const sourceCard = (s) => `
  <article class="src" data-id="${esc(s.id)}" data-laws="${esc(s.governedBy.join(' '))}">
    <header><h4>${esc(s.name)}</h4>${usedIds.has(s.id) ? '<span class="pill used">used today</span>' : '<span class="pill new">not used yet</span>'}</header>
    <p class="pub">${esc(s.publisher)}</p>
    <div class="chips"><span class="chip fmt">${esc(s.format)}</span><span class="chip acc acc-${esc(s.access)}">${esc(s.access)}</span>${s.machineReadable ? '<span class="chip mr">machine-readable</span>' : '<span class="chip nmr">needs parsing</span>'}</div>
    ${s.governedBy.length ? `<p class="gov">Required by: ${s.governedBy.map((g) => `<a href="#law-${esc(g)}">${esc(lawName[g] ?? g)}</a>`).join('; ')}</p>` : '<p class="gov">No publication mandate (voluntary or commercial)</p>'}
    <p class="note">${esc(s.notes)}</p>
    ${s.url ? `<a class="url" href="${esc(s.url)}" rel="noopener">${esc(s.url.replace(/^https?:\/\//, '').slice(0, 70))}</a>` : ''}
  </article>`

const html = `<title>FirstPassRx Source Map</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,600&display=swap">
<style>
/* Layout: laws column on the left, four payer lanes of source cards, a state tile grid below. */
:root {
  --bg: #f6f7f5; --panel: #ffffff; --ink: #1d2421; --muted: #5d6a64; --line: #d6ddd9;
  --accent: #1f6f5c; --accent-soft: #dcefe8; --warn: #9a5b00; --warn-soft: #fbecd2; --bad: #a33a2b; --bad-soft: #f7dcd7;
  --tile-covered: #1f6f5c; --tile-single: #7fb8a6; --tile-partial: #e3c27d; --tile-permco: #d99280; --tile-unknown: #cfd5d2;
  --display: 'Fraunces', Georgia, serif; --body: 'IBM Plex Sans', system-ui, sans-serif; --mono: 'IBM Plex Mono', ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #121715; --panel: #1a211e; --ink: #e4ebe7; --muted: #9aa8a1; --line: #2e3833;
  --accent: #5cc3a5; --accent-soft: #1d3a31; --warn: #e3b25e; --warn-soft: #3a2d17; --bad: #f08b79; --bad-soft: #3c211c;
  --tile-covered: #4fb394; --tile-single: #2f6d5c; --tile-partial: #8a7032; --tile-permco: #8a4c3f; --tile-unknown: #39433f; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #121715; --panel: #1a211e; --ink: #e4ebe7; --muted: #9aa8a1; --line: #2e3833;
  --accent: #5cc3a5; --accent-soft: #1d3a31; --warn: #e3b25e; --warn-soft: #3a2d17; --bad: #f08b79; --bad-soft: #3c211c;
  --tile-covered: #4fb394; --tile-single: #2f6d5c; --tile-partial: #8a7032; --tile-permco: #8a4c3f; --tile-unknown: #39433f; color-scheme: dark }
body { background: var(--bg); color: var(--ink); font: 15px/1.5 var(--body); }
.wrap { max-width: 1240px; margin: 0 auto; padding-block: 32px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 36px; }
h1 { font: 600 2rem/1.15 var(--display); margin: 0; text-wrap: balance; }
h2 { font: 600 1.25rem/1.2 var(--display); margin: 0 0 12px; }
h3 { font: 600 .78rem/1 var(--body); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 0 0 10px; }
h4 { font: 600 .95rem/1.3 var(--body); margin: 0; }
p { margin: 0; }
.lede { max-width: 68ch; color: var(--muted); display: grid; gap: 8px; }
.grid { display: grid; grid-template-columns: minmax(250px, 1fr) 3fr; gap: 24px; align-items: start; }
@media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }
.laws { display: grid; gap: 10px; position: sticky; top: calc(env(safe-area-inset-top, 0px) + 12px); }
@media (max-width: 860px) { .laws { position: static; } }
.law { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px; display: grid; gap: 4px; min-width: 0; }
.law.on { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
.law .cite { font: .75rem/1.35 var(--mono); color: var(--muted); overflow-wrap: anywhere; }
.law .eff { font-size: .8rem; }
.law .drugs-no { color: var(--bad); font-size: .78rem; font-weight: 500; }
.lanes { display: grid; gap: 22px; min-width: 0; }
.lane-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.src { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 12px; display: grid; gap: 7px; align-content: start; min-width: 0; cursor: default; }
.src:hover, .src:focus-within { border-color: var(--accent); }
.src header { display: flex; justify-content: space-between; gap: 8px; align-items: start; }
.pub, .note { font-size: .82rem; color: var(--muted); }
.gov { font-size: .8rem; } .gov a { color: var(--accent); }
.url { font: .72rem/1.3 var(--mono); color: var(--muted); overflow-wrap: anywhere; }
.chips { display: flex; flex-wrap: wrap; gap: 5px; }
.chip, .pill { font: 500 .7rem/1 var(--mono); padding: 4px 6px; border-radius: 3px; background: var(--bg); border: 1px solid var(--line); white-space: nowrap; }
.chip.mr, .pill.used { background: var(--accent-soft); border-color: transparent; color: var(--accent); }
.chip.nmr { background: var(--warn-soft); border-color: transparent; color: var(--warn); }
.pill.new { color: var(--muted); }
.acc-browser-only, .acc-blocked-to-bots, .acc-auth { background: var(--bad-soft) !important; color: var(--bad); border-color: transparent !important; }
.hosts { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 6px 18px; font: .8rem/1.4 var(--mono); }
.hosts div { display: flex; justify-content: space-between; gap: 8px; border-bottom: 1px dashed var(--line); padding-block: 3px; min-width: 0; }
.hosts span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.hosts span:last-child { font-variant-numeric: tabular-nums; color: var(--muted); }
.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 6px; }
.tile { border-radius: 4px; padding: 8px 6px; font: 600 .85rem/1 var(--mono); color: #fff; display: grid; gap: 4px; min-height: 48px; }
.tile small { font: 400 .62rem/1.2 var(--body); opacity: .92; }
.t-covered { background: var(--tile-covered); } .t-single { background: var(--tile-single); } .t-partial { background: var(--tile-partial); color: var(--ink); }
.t-permco { background: var(--tile-permco); } .t-unknown { background: var(--tile-unknown); color: var(--ink); }
.legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: .8rem; color: var(--muted); margin-bottom: 10px; }
.legend i { display: inline-block; width: 12px; height: 12px; border-radius: 2px; vertical-align: -1px; margin-right: 5px; }
.flow { overflow-x: auto; }
.flow ol { display: flex; gap: 8px; list-style: none; padding: 0; margin: 0; min-width: 760px; counter-reset: s; }
.flow li { flex: 1; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 10px; font-size: .82rem; display: grid; gap: 4px; align-content: start; }
.flow li b { font-size: .85rem; } .flow code { font: .72rem/1.35 var(--mono); color: var(--accent); overflow-wrap: anywhere; }
a:focus-visible, .src:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (prefers-reduced-motion: no-preference) { .law, .src { transition: border-color .15s, box-shadow .15s; } }
</style>
<div class="wrap">
  <header class="lede">
    <h1>Where formulary data lives, and the rules that make it public</h1>
    <p>Each card is one kind of source FirstPassRx reads or could read. The left column lists the federal rules, case law and state laws behind them. Hover a source to light up the rules that require it. Built ${esc(new Date().toISOString().slice(0, 10))} from <code>docs/research/sources-graph.json</code> (researched 2026-11-22, cited in <code>docs/research/data-access-and-law-2026-11-22.md</code>) and <code>src/data/formulary.json</code>.</p>
  </header>

  <section class="flow" aria-label="How a cell gets built">
    <h3>How a coverage cell is built today</h3>
    <ol>
      <li><b>Find the document</b>Payer roster per state, state PDL first<code>docs/research/states-roster-*.json</code></li>
      <li><b>Archive the bytes</b>sha256 + fetch tier per host<code>npm run archive-sources</code></li>
      <li><b>Extract rows</b>Layouts: optum, mgb, bcbs, mhdl, pdlcols, tiered<code>scripts/source_rows.py</code></li>
      <li><b>Gather and check</b>Haiku reads one document for every class; Sonnet checks<code>.claude/workflows/formulary-gather.js</code></li>
      <li><b>Merge and audit</b>Every claim against its source row<code>merge-gather.mjs · audit-cells.mjs</code></li>
      <li><b>Price and sig</b>Cost Plus API, GoodRx in Chrome, label table<code>costplus.mjs · apply-label-sigs.mjs</code></li>
    </ol>
  </section>

  <div class="grid">
    <aside class="laws" aria-label="Laws and rules">
      <h3>Laws and rules</h3>
      ${graph.laws.map((l) => `<div class="law" id="law-${esc(l.id)}" data-law="${esc(l.id)}"><h4>${esc(l.name)}</h4><span class="cite">${esc(l.citation)}</span><span class="eff">${esc(l.effective)}</span>${l.coversDrugs ? '' : '<span class="drugs-no">Does not cover drugs</span>'}</div>`).join('')}
    </aside>
    <div class="lanes">
      ${lanes.filter((l) => l.items.length).map((l) => `<section><h2>${esc(l.name)}</h2><div class="lane-items">${l.items.map(sourceCard).join('')}</div></section>`).join('')}
    </div>
  </div>

  <section>
    <h2>Hosts FirstPassRx cites most</h2>
    <div class="hosts">${topHosts.map(([h, n]) => `<div><span>${esc(h)}</span><span>${n}</span></div>`).join('')}</div>
  </section>

  <section>
    <h2>Coverage by state and territory</h2>
    <div class="legend"><span><i class="t-covered"></i>Covered</span><span><i class="t-single"></i>Single Medicaid PDL (cheap next)</span><span><i class="t-partial"></i>Partial or hybrid PDL</span><span><i class="t-permco"></i>Per-MCO lists</span><span><i class="t-unknown"></i>Unconfirmed</span></div>
    <div class="tiles">${tiles.map((t) => `<div class="tile t-${t.status}" title="${esc(t.label)}">${t.code}<small>${esc(t.label.split(';')[0].slice(0, 22))}</small></div>`).join('')}</div>
  </section>
</div>
<script>
document.querySelectorAll('.src').forEach((card) => {
  card.tabIndex = 0
  const laws = (card.dataset.laws || '').split(' ').filter(Boolean)
  const on = (v) => laws.forEach((id) => document.querySelector('[data-law="' + id + '"]')?.classList.toggle('on', v))
  card.addEventListener('mouseenter', () => on(true)); card.addEventListener('mouseleave', () => on(false))
  card.addEventListener('focus', () => on(true)); card.addEventListener('blur', () => on(false))
})
</script>
`
writeFileSync(join(ROOT, 'docs/data-sources-map.html'), html)
console.log(`✓ docs/data-sources-map.html · ${graph.sources.length} sources · ${graph.laws.length} laws · ${covered.size} covered jurisdictions`)
