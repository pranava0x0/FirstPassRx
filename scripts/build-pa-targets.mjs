#!/usr/bin/env node
// List paRequired drugs that still lack approval criteria, grouped per payer -> guide/class, as the
// targets.json an extraction agent works from (data-gathering/pa-criteria-*/BRIEF.md), plus the
// criteria documents this payer was already cited for (so the agent starts from a known source).
//
//   node scripts/build-pa-targets.mjs --payers=oh-medicaid,pa-medicaid [--topics=pain,hiv] [--out=<file>]
//   node scripts/build-pa-targets.mjs --summary            counts per payer, largest first
import { readFileSync, writeFileSync } from 'node:fs'

const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3)
const PAYERS = new Set(arg('payers').split(',').filter(Boolean))
const TOPICS = new Set(arg('topics').split(',').filter(Boolean))
const data = JSON.parse(readFileSync('src/data/formulary.json', 'utf8'))

const targets = {}
const known = {}
const counts = new Map()
for (const g of data.guides) {
  if (TOPICS.size && !TOPICS.has(g.topicId)) continue
  const refs = new Map(g.references.map((r) => [r.id, r]))
  for (const r of g.records) {
    for (const it of r.paRequired ?? []) {
      for (const id of it.criteriaSourceIds ?? []) {
        const ref = refs.get(id)
        if (ref) (known[r.payerId] ??= new Map()).set(ref.url, ref.label)
      }
    }
    const missing = (r.paRequired ?? []).filter((it) => !it.criteria?.length).map((it) => it.drug)
    if (!missing.length) continue
    counts.set(r.payerId, (counts.get(r.payerId) ?? 0) + missing.length)
    if (PAYERS.size && !PAYERS.has(r.payerId)) continue
    ;(targets[r.payerId] ??= []).push({ guideId: g.id, classId: r.classId, paDrugs: missing })
  }
}

if (process.argv.includes('--summary')) {
  for (const [p, n] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(5)}  ${p}`)
} else {
  const out = Object.fromEntries(Object.entries(targets).map(([p, t]) => [p, { knownCriteriaSources: [...(known[p] ?? new Map())].map(([url, label]) => ({ url, label })), targets: t }]))
  const text = JSON.stringify(out, null, 2)
  if (arg('out')) writeFileSync(arg('out'), text)
  for (const [p, v] of Object.entries(out)) console.log(`${p}: ${v.targets.reduce((s, t) => s + t.paDrugs.length, 0)} drugs in ${v.targets.length} cells; ${v.knownCriteriaSources.length} known criteria sources`)
}
