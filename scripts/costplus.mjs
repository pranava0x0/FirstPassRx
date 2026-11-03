#!/usr/bin/env node
// Cost Plus Drugs coverage check against the vendor's own public price list
// (https://api.costplusdrugs.com/pricelist/cpd, docs: mccpdc-llc.github.io/pricing-api-documentation).
// One JSON request returns every product with its slug, strength, form, stock and per-unit price,
// so this needs no browser and no scraping. The site's cash price for N units is
// round(price_per_unit * N, 2) + cash_dispensing_fee (shipping excluded), which matches the prices
// captured by hand in src/lib/cash.ts.
//
//   node scripts/costplus.mjs            audit every rule's costPlusPath + price, then list
//                                        preferred-agent cells with no Cost Plus link and the
//                                        catalog products that could fill them
//   --refresh                            re-download even if today's list is cached
//   --json=<file>                        also write the full report as JSON
//   --write                              refresh src/data/costplus-prices.json, the snapshot the app
//                                        reads: each rule's price at its own quantity label, stock,
//                                        and delisted paths (whose links the app then withholds)
//   --strict                             exit 1 on DEAD paths or price DRIFT
//
// The list is cached at data-gathering/costplus/pricelist-<date>.json (gitignored).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { CASH_LINK_RULES, costPlusUrl, priceSuppressedByForm } from '../src/lib/cash.ts'
import { cashPrice, formOf, strengthKey, sameForm, sameMolecule, slugOf, strengthNum, unitsFor, words } from './costplus-lib.mjs'

const ruleFor = (name) => CASH_LINK_RULES.find((r) => r.matches.test(name))

const flag = (n) => process.argv.includes(`--${n}`)
const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3)
const API = 'https://api.costplusdrugs.com/pricelist/cpd'
const today = new Date().toLocaleDateString('en-CA') // local date: the UTC date runs a day ahead in the evening
const cacheDir = 'data-gathering/costplus'
const SNAPSHOT = 'src/data/costplus-prices.json'
const cacheFile = `${cacheDir}/pricelist-${today}.json`

async function loadCatalog() {
  if (existsSync(cacheFile) && !flag('refresh')) return JSON.parse(readFileSync(cacheFile, 'utf8'))
  const res = await fetch(API, { headers: { 'User-Agent': 'FirstPassRx price validator' } })
  if (!res.ok) throw new Error(`${API} -> HTTP ${res.status}`)
  const body = await res.text()
  const list = JSON.parse(body)
  if (!Array.isArray(list) || list.length < 500) throw new Error(`unexpected price list (${list.length} entries)`)
  mkdirSync(cacheDir, { recursive: true })
  writeFileSync(cacheFile, body)
  console.log(`fetched ${list.length} products -> ${cacheFile}`)
  return list
}

function main(catalog) {
  const bySlug = new Map(catalog.map((e) => [slugOf(e.url), e]))
  const problems = []

  // 0. The app's snapshot: one entry per rule path, priced at the rule's own quantity label.
  const snapshot = { source: API, fetchedAt: today, paths: {} }
  for (const rule of CASH_LINK_RULES) {
    if (!rule.costPlusPath) continue
    const key = rule.costPlusPath.toLowerCase()
    const e = bySlug.get(key)
    const n = e && rule.costPlusPrice && unitsFor(rule.costPlusPrice.quantity, e)
    if (!e) {
      snapshot.paths[key] = { delisted: true }
      continue
    }
    snapshot.paths[key] = { price: n ? cashPrice(e, n) : null, inStock: !!e.cpd_channel?.in_stock }
    // Same product at other strengths (same name, form and brand/generic), priced for the same
    // count, so a pick at a different strength gets its own price and link (cash.ts).
    if (!n) continue
    const variants = {}
    for (const v of catalog) {
      if (v === e || !v.cpd_channel?.in_stock || v.medication_name !== e.medication_name || v.form !== e.form || v.brand_generic !== e.brand_generic) continue
      const k = strengthKey(v.strength)
      const units = k && unitsFor(rule.costPlusPrice.quantity, v)
      if (!units || variants[k]) continue
      variants[k] = { path: slugOf(v.url), price: cashPrice(v, units) }
    }
    if (Object.keys(variants).length) snapshot.paths[key].variants = variants
  }
  if (flag('write')) {
    writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2) + '\n')
    console.log(`wrote ${SNAPSHOT} (${Object.keys(snapshot.paths).length} paths)`)
  }

  // 1. Every rule's Cost Plus path still exists, is in stock, and its stored price is current.
  const audit = { ok: 0, dead: [], outOfStock: [], drift: [] }
  for (const rule of CASH_LINK_RULES) {
    if (!rule.costPlusPath) continue
    const e = bySlug.get(rule.costPlusPath.toLowerCase())
    if (!e) { audit.dead.push(rule.costPlusPath); continue }
    if (!e.cpd_channel?.in_stock) audit.outOfStock.push(rule.costPlusPath)
    const p = rule.costPlusPrice
    const n = p && unitsFor(p.quantity, e)
    const now = n && cashPrice(e, n)
    if (p && now != null && Math.abs(now - p.price) > Math.max(1, p.price * 0.15)) {
      audit.drift.push({ path: rule.costPlusPath, stored: p.price, current: now, quantity: p.quantity, captured: rule.pricesCapturedAt })
    } else audit.ok++
  }
  console.log(`\nRules with a Cost Plus path: ${audit.ok + audit.dead.length + audit.drift.length} -- ok ${audit.ok}, dead ${audit.dead.length}, drift ${audit.drift.length}, out of stock ${audit.outOfStock.length}`)
  for (const d of audit.dead) console.log(`  DEAD   ${d}`)
  for (const d of audit.drift) console.log(`  DRIFT  ${d.path}: $${d.stored} (${d.captured}) -> $${d.current} for ${d.quantity}`)
  for (const d of audit.outOfStock) console.log(`  STOCK  ${d} is out of stock`)
  problems.push(...audit.dead, ...audit.drift)

  // 2. Preferred-agent cells (the headline pick) with no Cost Plus link, and what the catalog has.
  const data = JSON.parse(readFileSync('src/data/formulary.json', 'utf8'))
  const gaps = new Map()
  let cells = 0
  for (const g of data.guides) {
    const active = new Set(g.classes.filter((c) => !c.comingSoon).map((c) => c.id))
    for (const r of g.records) {
      if (!active.has(r.classId) || !r.preferredAgent?.inn) continue
      cells++
      const { inn, strength, brand } = r.preferredAgent
      if (costPlusUrl(inn) || priceSuppressedByForm(inn)) continue
      const key = `${inn} | ${strength ?? ''}`
      const gap = gaps.get(key) ?? { inn, strength, brand, cells: 0, guides: new Set() }
      gap.cells++
      gap.guides.add(g.id)
      gaps.set(key, gap)
    }
  }
  const rows = [...gaps.values()].map((gap) => {
    const want = words(gap.inn)
    const num = strengthNum(gap.strength)
    const shape = formOf(`${gap.inn} ${gap.strength ?? ''}`)
    const candidates = catalog
      .filter((e) => e.cpd_channel && want.length && sameMolecule(want, e) && sameForm(shape, e))
      .map((e) => ({ slug: slugOf(e.url), name: e.medication_name, brand: e.brand_name, bg: e.brand_generic, form: e.form, strength: e.strength,
        inStock: e.cpd_channel.in_stock, price30: cashPrice(e, 30), strengthMatch: !!num && strengthNum(e.strength) === num }))
      .sort((a, b) => Number(b.strengthMatch) - Number(a.strengthMatch) || Number(b.inStock) - Number(a.inStock))
    return { ...gap, guides: [...gap.guides], candidates }
  }).sort((a, b) => b.cells - a.cells)
  const missing = rows.filter((r) => !r.candidates.length)
  const exact = rows.filter((r) => r.candidates.some((c) => c.strengthMatch && c.inStock))
  console.log(`\nPreferred-agent cells: ${cells}; without a Cost Plus link: ${rows.reduce((s, r) => s + r.cells, 0)} (${rows.length} drug/strength pairs)`)
  console.log(`  carried at the same strength: ${exact.length} pairs (${exact.reduce((s, r) => s + r.cells, 0)} cells) -- add these`)
  console.log(`  carried at another strength or out of stock: ${rows.length - exact.length - missing.length} pairs`)
  console.log(`  not in the Cost Plus catalog: ${missing.length} pairs (${missing.reduce((s, r) => s + r.cells, 0)} cells)`)
  const bySuggestion = new Map()
  for (const r of exact) {
    const c = r.candidates.find((x) => x.strengthMatch && x.inStock)
    const s = bySuggestion.get(c.slug) ?? { ...c, cells: 0, names: new Set(), rules: new Set() }
    s.rules.add(ruleFor(r.inn)?.goodRxSlug ?? '(no rule)')
    s.cells += r.cells
    s.names.add(r.inn)
    bySuggestion.set(c.slug, s)
  }
  for (const s of [...bySuggestion.values()].sort((a, b) => b.cells - a.cells)) {
    console.log(`  ADD ${String(s.cells).padStart(3)} cells -> ${s.slug} ($${s.price30}/30)  [rule: ${[...s.rules].join(', ')}] <- ${[...s.names].slice(0, 3).join(' / ')}`)
  }

  if (arg('json')) writeFileSync(arg('json'), JSON.stringify({ date: today, audit, gaps: rows }, null, 2))
  if (flag('strict') && problems.length) process.exit(1)
}

main(await loadCatalog())
