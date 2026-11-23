#!/usr/bin/env node
// UAT for "By medication": every catalog entry × every state/class it lists must show at least one plan
// card, and each product should appear once. Mirrors MedicationLookup + productFindings.
//
//   node scripts/check-medication-catalog.mjs [--json=out.json]
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { medicationEntries, productKey, rawProductKey } from '../src/lib/medicationEntries.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const gen = (f) => JSON.parse(readFileSync(join(ROOT, 'src/data/generated', f), 'utf8'))
const catalog = gen('medications.json')
const aliases = gen('medication-aliases.json')
const data = JSON.parse(readFileSync(join(ROOT, 'src/data/formulary.json'), 'utf8'))
const guides = new Map(data.guides.map((g) => [g.id, g]))
const problems = { emptyScope: [], dupKey: [], unknownScope: [], badName: [], mixedForms: [] }
// One entry must never mix two forms (tablet vs pen, HFA vs nebulizer, patch vs vaginal): every label
// grouped under a product may differ only by naming its form or not.
const formsOf = new Map()
for (const g of data.guides) for (const r of g.records) for (const { label } of medicationEntries(r)) {
  const k = productKey(label, aliases)
  const f = rawProductKey(label).split(' ').filter((w) => w.startsWith('~')).join(' ')
  if (!formsOf.has(k)) formsOf.set(k, new Map())
  if (f) formsOf.get(k).set(f, label)
}
for (const [k, fs] of formsOf) if (fs.size > 1) problems.mixedForms.push([k, [...fs.values()].slice(0, 3)])
let combos = 0
let cards = 0

const byKey = new Map()
for (const [name, scopes] of Object.entries(catalog)) {
  const key = productKey(name, aliases)
  if (!key) problems.badName.push(name)
  if (byKey.has(key)) problems.dupKey.push([byKey.get(key), name])
  else byKey.set(key, name)
  for (const scope of scopes) {
    combos++
    const [gid, cid] = scope.split('/')
    const g = guides.get(gid)
    if (!g || !g.classes.some((c) => c.id === cid)) { problems.unknownScope.push([name, scope]); continue }
    const hits = g.payers.filter((p) => {
      const r = g.records.find((x) => x.payerId === p.id && x.classId === cid)
      return r && medicationEntries(r).some((e) => productKey(e.label, aliases) === key)
    })
    cards += hits.length
    if (!hits.length) problems.emptyScope.push([name, scope])
  }
}
const n = (k) => problems[k].length
console.log(`${Object.keys(catalog).length} products · ${combos} product×state/class combos · ${cards} plan cards`)
console.log(`✗ empty scope ${n('emptyScope')} · duplicate key ${n('dupKey')} · unknown scope ${n('unknownScope')} · unnamed ${n('badName')} · mixed forms ${n('mixedForms')}`)
for (const k of Object.keys(problems)) for (const p of problems[k].slice(0, 5)) console.log(`  ${k}: ${JSON.stringify(p)}`)
const out = process.argv.find((a) => a.startsWith('--json='))
if (out) writeFileSync(out.slice(7), JSON.stringify(problems, null, 1))
process.exit(Object.values(problems).some((v) => v.length) ? 1 : 0)
