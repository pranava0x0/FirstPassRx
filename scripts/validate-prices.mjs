#!/usr/bin/env node
// Cash-price coverage + link validator for src/lib/cash.ts.
//
// Every GoodRx/Cost Plus price shown in the app is a snapshot (CLAUDE.md: capture dates, don't
// bake volatile numbers as live fact) tied to an explicit CASH_LINK_RULE. This script checks that
// two ways:
//
//   default (static, offline, CI-safe): every covered drug across active (non-comingSoon) classes
//     either resolves to an explicit rule or is accounted for in the known coverage-gap ceiling
//     (see src/lib/cash.test.ts); every rule with a price has a pricesCapturedAt date. Exits
//     non-zero on a real regression (a priced rule losing its date, or a malformed price).
//
//   --live (network, drift detector): re-fetch each rule's GoodRx/Cost Plus URL. Both vendors
//     bot-block plain fetches (403), so BLOCKED is expected and does not fail the run — the
//     signal that matters is DEAD (404/other), which means the URL slug/path itself is wrong.
//     Add --strict to make DEAD fail the run.
//
// Usage:  node scripts/validate-prices.mjs [--live] [--strict] [--timeout=15000]

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA = join(HERE, '..', 'src', 'data', 'formulary.json')
const CASH_LIB = join(HERE, '..', 'src', 'lib', 'cash.ts')

const args = process.argv.slice(2)
const LIVE = args.includes('--live')
const STRICT = args.includes('--strict')
const TIMEOUT = Number((args.find((a) => a.startsWith('--timeout=')) || '').split('=')[1]) || 15000
const UA = 'FirstPassRx-price-validator/1.0 (+https://github.com/pranava0x0/FirstPassRx)'

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
}

// Baseline as of 2026-06-30 (see issues.md) -- must never grow silently.
const KNOWN_UNPRICED_GAP = 76

const { goodRxUrl, costPlusUrl, goodRxPrice, costPlusPrice, pricesCapturedAt, hasCashLinkRule } =
  await import(CASH_LIB)

const formulary = JSON.parse(readFileSync(DATA, 'utf8'))
const problems = []

// ---- static: every covered drug traces to a rule (or the known gap), every price is dated ----
console.log(c.bold('\n── Static price coverage ──'))

const covered = new Set()
for (const guide of formulary.guides) {
  const comingSoon = new Set(guide.classes.filter((cl) => cl.comingSoon).map((cl) => cl.id))
  for (const r of guide.records) {
    if (comingSoon.has(r.classId)) continue
    covered.add(r.preferredAgent.inn)
    if (r.preferredAgent.brand) covered.add(r.preferredAgent.brand)
    for (const alt of r.alternatives || []) covered.add(alt.drug)
  }
}

const unmatched = [...covered].filter((name) => !hasCashLinkRule(name))
console.log(`  ${covered.size} covered drug names · ${covered.size - unmatched.length} have an explicit cash-link rule`)
if (unmatched.length > KNOWN_UNPRICED_GAP) {
  problems.push(
    `coverage regressed: ${unmatched.length} unpriced drugs, ceiling is ${KNOWN_UNPRICED_GAP} (see issues.md)`,
  )
} else {
  console.log(c.dim(`  ${unmatched.length}/${KNOWN_UNPRICED_GAP} known-gap drugs unpriced (tracked in issues.md)`))
}

const matched = [...covered].filter((name) => hasCashLinkRule(name))
const rules = new Map() // url -> { name, hasPrice }
for (const name of matched) {
  const gr = goodRxPrice(name)
  const cp = costPlusPrice(name)
  const at = pricesCapturedAt(name)
  if ((gr || cp) && !at) problems.push(`${name}: has a price but no pricesCapturedAt`)
  if (gr && (typeof gr.price !== 'number' || gr.price <= 0)) problems.push(`${name}: malformed goodRxPrice`)
  if (cp && (typeof cp.price !== 'number' || cp.price <= 0)) problems.push(`${name}: malformed costPlusPrice`)

  const grUrl = goodRxUrl(name)
  if (!rules.has(grUrl)) rules.set(grUrl, { vendor: 'GoodRx', names: [] })
  rules.get(grUrl).names.push(name)

  const cpUrl = costPlusUrl(name)
  if (cpUrl) {
    if (!rules.has(cpUrl)) rules.set(cpUrl, { vendor: 'Cost Plus', names: [] })
    rules.get(cpUrl).names.push(name)
  }
}
console.log(c.dim(`  ${rules.size} distinct vendor URLs across ${matched.length} priced/linked drugs`))

// ---- live: re-fetch each vendor URL, classify OK / BLOCKED / DEAD ----
async function fetchUrl(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': UA } })
    return { status: res.status, ok: res.ok }
  } catch (e) {
    return { status: 0, ok: false, error: e.name === 'AbortError' ? 'timeout' : e.message }
  } finally {
    clearTimeout(timer)
  }
}

async function mapLimit(items, limit, fn) {
  const out = []
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  })
  await Promise.all(workers)
  return out
}

if (LIVE) {
  console.log(c.bold('\n── Live vendor link trace ──'))
  const urls = [...rules.keys()]
  let dead = 0
  let blocked = 0
  const results = await mapLimit(urls, 4, async (url) => ({ url, ...(await fetchUrl(url)) }))

  for (const r of results.sort((a, b) => a.url.localeCompare(b.url))) {
    const info = rules.get(r.url)
    let label
    if (r.error) {
      label = c.red(`DEAD (${r.error})`)
      dead++
      if (STRICT) problems.push(`live: ${r.url} unreachable (${r.error})`)
    } else if (r.status === 403 || r.status === 401) {
      label = c.yellow(`BLOCKED (${r.status} bot-protection)`)
      blocked++
    } else if (!r.ok) {
      label = c.red(`DEAD (HTTP ${r.status})`)
      dead++
      if (STRICT) problems.push(`live: ${r.url} HTTP ${r.status}`)
    } else {
      label = c.green(`OK (HTTP ${r.status})`)
    }
    console.log(`  ${label}  ${c.dim(`${info.vendor} · ${info.names.length} drug(s)`)}`)
    console.log(c.dim(`     ${r.url}`))
  }
  console.log(c.dim(`\n  ${urls.length} URLs · ${dead} dead · ${blocked} blocked (expected bot-protection)`))
}

// ---- report ----
console.log(c.bold('\n── Summary ──'))
if (problems.length) {
  console.log(c.red(`  ${problems.length} failure(s):`))
  for (const p of problems) console.log(`    ${c.red('✗')} ${p}`)
  console.log(c.red('\n  FAIL\n'))
  process.exit(1)
}
console.log(c.green('  ✓ Price coverage and rule data are consistent.'))
if (!LIVE) console.log(c.dim('  Run `npm run validate-prices:live` to re-fetch vendor URLs and detect dead links.'))
console.log('')
