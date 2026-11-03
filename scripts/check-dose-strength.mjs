#!/usr/bin/env node
// Flag preferred picks whose listed strength can't deliver the sig's starting dose: a 600 mg
// gabapentin tablet with a sig that starts at 300 mg, a 10 mg pick whose sig starts at 2.5 mg.
// Deterministic text check, no inference: the first "<n> mg|mcg" in the sig is the starting dose;
// the strengths are every "<n> mg|mcg" in the pick's strength field. A dose is deliverable when
// some strength divides it into 1-4 whole units. Everything else is listed for review.
//
//   node scripts/check-dose-strength.mjs [--state=XX] [--guides=a,b] [--json=<file>] [--fixes=<file>]
//
// --fixes writes apply-cell-fixes.mjs ops for the unambiguous cases only: one listed strength, and
// the Cost Plus price list (latest data-gathering/costplus/pricelist-*.json, from costplus.mjs)
// carries the same molecule, form and release at exactly the starting dose -- proof the strength
// exists as a single unit. Review the file, then apply it.
//
// Exit 0 always: this is a review list, not a gate (some flags are legitimate, e.g. a pick whose
// strength field names the maintenance dose while the sig titrates up to it).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { formOf, sameForm, sameMolecule, strengthNum, words } from './costplus-lib.mjs'
import { amounts, deliverable, mg } from './dose-lib.mjs'

const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3)
const data = JSON.parse(readFileSync('src/data/formulary.json', 'utf8'))
const STATE = arg('state').toUpperCase()
const GUIDES = new Set(arg('guides').split(',').filter(Boolean))

const lists = (() => { try { return readdirSync('data-gathering/costplus').filter((f) => f.startsWith('pricelist-')).sort() } catch { return [] } })()
const catalog = lists.length ? JSON.parse(readFileSync(`data-gathering/costplus/${lists.at(-1)}`, 'utf8')) : []
function soldAt(inn, strengthText, dose) {
  const want = words(inn)
  const shape = formOf(`${inn} ${strengthText}`)
  return catalog.some((e) => e.cpd_channel && sameMolecule(want, e) && sameForm(shape, e) && Number(strengthNum(e.strength)) === dose.n && new RegExp(`\\d\\s*${dose.unit}\\b`, 'i').test(e.strength))
}
const fixes = []
const flags = []
for (const g of data.guides) {
  if (STATE && g.stateCode !== STATE) continue
  if (GUIDES.size && !GUIDES.has(g.id)) continue
  for (const r of g.records) {
    const a = r.preferredAgent
    if (!a?.strength || !a?.sig) continue
    const strengths = amounts(a.strength)
    // Parentheticals list what the plan covers ("plan lists 25, 50, 100 mg"), not a dose.
    const sig = a.sig.replace(/\([^)]*\)/g, ' ')
    const [dose] = amounts(sig.split(/[.;]\s/)[0]).length ? amounts(sig.split(/[.;]\s/)[0]) : amounts(sig)
    if (!strengths.length || !dose || deliverable(dose, strengths)) continue
    // A sig that names the pick's strength as a labeled dose ("25, 50 or 100 mg", "may increase to
    // 15 mg", "(40 mg if LDL-C must fall more than 45%)") is consistent with it.
    const named = amounts(a.sig.replace(/(\d)\s*-\s*(\d)/g, '$1 to $2'))
    if (strengths.some((st) => named.some((n) => mg(n) === mg(st)))) continue
    if (strengths.length === 1 && soldAt(a.inn, a.strength, dose)) {
      const num = String(strengths[0].n).replace('.', '\\.')
      const value = a.strength.replace(new RegExp(`\\b${num}0*\\s*${strengths[0].unit}`, 'i'), `${dose.n} ${dose.unit}`)
      if (value === a.strength) continue
      fixes.push({ guideId: g.id, payerId: r.payerId, classId: r.classId, op: 'setAgentField', field: 'strength', value,
        why: `pick strength ${a.strength} -> ${value}: the sig starts at ${dose.n} ${dose.unit} (scripts/check-dose-strength.mjs)` })
    }
    flags.push({ guide: g.id, payerId: r.payerId, classId: r.classId, inn: a.inn, strength: a.strength, startDose: `${dose.n} ${dose.unit}`, sigShort: a.sigShort })
  }
}
const byPick = new Map()
for (const f of flags) {
  const k = `${f.inn} | ${f.strength} | starts ${f.startDose}`
  byPick.set(k, [...(byPick.get(k) ?? []), `${f.guide}/${f.payerId}`])
}
console.log(`${flags.length} cells (${byPick.size} picks) whose strength can't deliver the sig's starting dose`)
for (const [k, cells] of [...byPick].sort((a, b) => b[1].length - a[1].length)) console.log(`  ${String(cells.length).padStart(3)}  ${k}`)
console.log(`${fixes.length} unambiguous strength fixes (single strength; Cost Plus sells the starting dose)`)
if (arg('fixes')) writeFileSync(arg('fixes'), JSON.stringify(fixes, null, 2))
if (arg('json')) writeFileSync(arg('json'), JSON.stringify(flags, null, 2))
