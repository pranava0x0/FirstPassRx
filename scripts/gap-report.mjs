#!/usr/bin/env node
// Offline gap-prioritization report for FirstPassRx's data.
//
// Purpose: automate the manual "eyeball formulary.json / write an inline python3 -c Counter
// script" audits that several past sessions did by hand (2026-07-25, 07-28, 07-29 partial-cell
// audits; today's cash-price molecule survey) into one repeatable, agent-free command. Pure data
// analysis over files already on disk -- no network calls, no LLM judgment, no Agent/Workflow
// spawn. Run it BEFORE starting any cash-price or verification-upgrade pass so the highest-
// leverage targets are picked by evidence, not by re-reading the whole dataset again.
//
// Usage:  node scripts/gap-report.mjs [--top=15]
//
// What it can't do (by design, not oversight): decide whether a `partial` cell is closeable, or
// judge whether a PA reason is genuinely a barrier vs. a cost-tier. Those need a human/agent to
// read the source document. This script only prioritizes -- it groups and counts so that
// judgment time goes to the highest-leverage items first.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA = join(HERE, '..', 'src', 'data', 'formulary.json')
const CASH_LIB = join(HERE, '..', 'src', 'lib', 'cash.ts')

const args = process.argv.slice(2)
const TOP = Number((args.find((a) => a.startsWith('--top=')) || '').split('=')[1]) || 15

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
}

let cashLib
try {
  cashLib = await import(CASH_LIB)
} catch (e) {
  console.error(c.red(`\nFailed to import ${CASH_LIB}: ${e.message}`))
  console.error(
    c.dim(
      '  This script imports a .ts file directly, which needs Node >=22.18.0 (or >=22.12 with\n' +
        '  the --experimental-strip-types flag). Run `node --version` to check yours.\n',
    ),
  )
  process.exit(1)
}
const { hasCashLinkRule } = cashLib

const formulary = JSON.parse(readFileSync(DATA, 'utf8'))

// ---- 1. Cash-price gap, grouped by molecule stem (leverage = how many cells one new regex rule
// would price) ----

// Strips salt forms, brand parentheticals, and combination-product noise so name variants that
// are really "the same molecule" collapse into one bucket. Deliberately crude (word-based, not a
// drug-name ontology) -- good enough to rank candidates, not to auto-generate a rule.
const SALT_WORDS = new Set([
  'hcl', 'hydrochloride', 'sodium', 'maleate', 'oxalate', 'bromide', 'acetate', 'succinate',
  'fumarate', 'tartrate', 'mesylate', 'besylate', 'citrate', 'sulfate', 'phosphate', 'propanediol',
  'er', 'xr', 'dr', 'cr', 'ir', 'brand', 'generic', 'tablet', 'tablets', 'capsule', 'capsules',
  'oral', 'the',
])
function stem(name) {
  const noParens = name.replace(/\(.*?\)/g, ' ')
  const words = noParens
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !SALT_WORDS.has(w) && Number.isNaN(Number(w)))
  return words[0] || noParens.trim().toLowerCase()
}

const covered = new Set()
const cellsByName = new Map() // name -> cell count (how many payer x class records reference it)
for (const guide of formulary.guides) {
  const comingSoon = new Set(guide.classes.filter((cl) => cl.comingSoon).map((cl) => cl.id))
  for (const r of guide.records) {
    if (comingSoon.has(r.classId)) continue
    const names = [r.preferredAgent.inn, r.preferredAgent.brand, ...(r.alternatives || []).map((a) => a.drug)]
    for (const n of names) {
      if (!n) continue
      covered.add(n)
      cellsByName.set(n, (cellsByName.get(n) || 0) + 1)
    }
  }
}

const unmatched = [...covered].filter((n) => !hasCashLinkRule(n))
const stemCounts = new Map() // stem -> { names: [], cells: 0 }
for (const n of unmatched) {
  const s = stem(n)
  if (!stemCounts.has(s)) stemCounts.set(s, { names: [], cells: 0 })
  const entry = stemCounts.get(s)
  entry.names.push(n)
  entry.cells += cellsByName.get(n) || 0
}
const rankedStems = [...stemCounts.entries()].sort((a, b) => b[1].cells - a[1].cells)

console.log(c.bold('\n── Cash-price gap: unpriced molecule stems, by leverage ──'))
console.log(c.dim(`  ${unmatched.length} of ${covered.size} covered drug names have no cash-link rule`))
console.log(c.dim(`  Top ${TOP} stems by cell count (adding one regex rule here prices the most cells):\n`))
for (const [s, { names, cells }] of rankedStems.slice(0, TOP)) {
  console.log(`  ${c.bold(String(cells).padStart(3))} cells  ${c.green(s)}  ${c.dim(`(${names.length} name variant(s))`)}`)
  if (names.length <= 4) console.log(c.dim(`         ${names.join(' · ')}`))
}
if (rankedStems.length > TOP) console.log(c.dim(`  … ${rankedStems.length - TOP} more stems not shown (--top=N to see more)`))

// ---- 2. Verification gap: partial/example cells grouped by class + a rough cause bucket ----
// Bucket keywords are deliberately coarse pattern-matches over verificationNote prose, not a
// classifier -- they exist to sort review time toward the biggest buckets, not to auto-resolve
// anything. A cell can match multiple buckets; it's counted in the first one that hits.
const CAUSE_BUCKETS = [
  ['medical-benefit / Part B carve-out', /medical.benefit|part b|infusion|physician.administer|not.*retail.pharmacy/i],
  ['PDL section absent for this drug/class', /not (?:listed|present|found)|absen(?:t|ce)|no (?:mention|section)|zero.*mention/i],
  ['biosimilar / strength ambiguity', /biosimilar|ambigu|60mg|120mg|strength.*(?:unclear|unconfirmed)/i],
  ['OCR / table-extraction artifact', /ocr|ndc collision|table.*(?:collaps|duplicate)|extraction/i],
  ['payer document access blocked', /403|blocked|bot.protection|access denied|ssl|cert/i],
]
function bucketFor(note) {
  if (!note) return 'no verificationNote'
  for (const [label, re] of CAUSE_BUCKETS) if (re.test(note)) return label
  return 'other / needs manual read'
}

const partialByClass = new Map() // "guideId/classId" -> { total, byBucket: Map }
for (const guide of formulary.guides) {
  for (const r of guide.records) {
    if (r.verification === 'verified') continue
    const key = `${guide.id}/${r.classId}`
    if (!partialByClass.has(key)) partialByClass.set(key, { total: 0, byBucket: new Map() })
    const entry = partialByClass.get(key)
    entry.total++
    const b = bucketFor(r.verificationNote)
    entry.byBucket.set(b, (entry.byBucket.get(b) || 0) + 1)
  }
}
const rankedPartial = [...partialByClass.entries()].sort((a, b) => b[1].total - a[1].total)
const totalPartial = rankedPartial.reduce((sum, [, v]) => sum + v.total, 0)

console.log(c.bold('\n── Verification gap: partial/example cells by (guide, class) ──'))
console.log(c.dim(`  ${totalPartial} non-verified cells across ${rankedPartial.length} (guide, class) pairs\n`))
for (const [key, { total, byBucket }] of rankedPartial.slice(0, TOP)) {
  const buckets = [...byBucket.entries()].sort((a, b) => b[1] - a[1]).map(([b, n]) => `${b} (${n})`).join(', ')
  console.log(`  ${c.bold(String(total).padStart(3))}  ${c.yellow(key)}`)
  console.log(c.dim(`       ${buckets}`))
}
if (rankedPartial.length > TOP) console.log(c.dim(`  … ${rankedPartial.length - TOP} more (guide, class) pairs not shown (--top=N)`))

// Roll up cause buckets across the whole dataset -- tells you which cause dominates overall,
// independent of which class it's in.
const globalBuckets = new Map()
for (const [, { byBucket }] of partialByClass) {
  for (const [b, n] of byBucket) globalBuckets.set(b, (globalBuckets.get(b) || 0) + n)
}
console.log(c.bold('\n── Verification gap: cause-bucket rollup (dataset-wide) ──'))
for (const [b, n] of [...globalBuckets.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${c.bold(String(n).padStart(3))}  ${b}`)
}

console.log(c.dim('\n  Buckets are coarse keyword matches over verificationNote prose, not a verdict --'))
console.log(c.dim('  "closeable" vs. "structural, permanent" still needs a human/agent read per row.\n'))
