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

const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3)
const data = JSON.parse(readFileSync('src/data/formulary.json', 'utf8'))
const STATE = arg('state').toUpperCase()
const GUIDES = new Set(arg('guides').split(',').filter(Boolean))

// Amounts with their unit; a list shares its trailing unit ("0.5 / 1 / 2 mg", "25, 50, 100 mg").
// Combination strengths ("400 mg/100 mg") and concentrations ("6 mg/mL", "1%") are skipped.
const DOSE = /((?:\d+(?:\.\d+)?\s*(?:,|\/|or|and|to)\s*)*)(\d+(?:\.\d+)?)\s*(mg|mcg)\b(?!\s*\/)/gi
export function amounts(text) {
  if (!text || /\d\s*-\s*\d+(\.\d+)?\s*(mg|mcg)/i.test(text) || /\d\s*(mg|mcg)\s*\/\s*(\d|m?l\b|ml|act|hr|24)/i.test(text)) return []
  return [...text.matchAll(DOSE)].flatMap((m) =>
    [...(m[1].match(/\d+(?:\.\d+)?/g) ?? []), m[2]].map((n) => ({ n: Number(n), unit: m[3].toLowerCase() })),
  )
}
export function deliverable(dose, strengths) {
  return strengths.some((s) => s.unit === dose.unit && [1, 2, 3, 4].some((k) => Math.abs(s.n * k - dose.n) < 1e-9))
}

const lists = (() => { try { return readdirSync('data-gathering/costplus').filter((f) => f.startsWith('pricelist-')).sort() } catch { return [] } })()
const catalog = lists.length ? JSON.parse(readFileSync(`data-gathering/costplus/${lists.at(-1)}`, 'utf8')) : []
function soldAt(inn, strengthText, dose) {
  const want = words(inn)
  const shape = formOf(`${inn} ${strengthText}`)
  return catalog.some((e) => e.cpd_channel && sameMolecule(want, e) && sameForm(shape, e) && Number(strengthNum(e.strength)) === dose.n && /mg|mcg/i.test(e.strength))
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
    if (strengths.length === 1 && soldAt(a.inn, a.strength, dose)) {
      const value = a.strength.replace(new RegExp(`${strengths[0].n}\\s*${strengths[0].unit}`, 'i'), `${dose.n} ${dose.unit}`)
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
