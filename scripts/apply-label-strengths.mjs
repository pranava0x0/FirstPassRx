#!/usr/bin/env node
// Give preferred picks a real strength when the plan list printed none ("standard label dosing",
// "strength not printed on PDL"). The value comes from one reviewed table,
// scripts/data/label-strengths.json: the product a prescriber would write for the label starting
// dose ("15 mg tablet" for mirtazapine). The copy-ready Rx line, the cash-price match and the
// dose check all read the strength field, so a placeholder there breaks all three.
//
//   node scripts/apply-label-strengths.mjs [--state=XX] [--guides=a,b] [--dry-run]
//
// Only picks whose strength has no digit are touched. A row whose strength can't deliver the
// sig's starting dose is skipped and listed. Picks no row matches (form not stated, e.g. "estradiol
// patch or cream") are listed, never guessed. Each change appends the old text to the record's
// verificationNote, so the plan's own wording is kept. Writes are validated.
import { readFileSync } from 'node:fs'
import { compileStrengthRules, fitsSig, labelStrength } from './dose-lib.mjs'
import { FORMULARY, writeValidatedFormulary } from './write-formulary.mjs'

const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3)
const DRY = process.argv.includes('--dry-run')
const STATE = arg('state').toUpperCase()
const GUIDES = new Set(arg('guides').split(',').filter(Boolean))
const today = new Date().toLocaleDateString('en-CA')

const rules = compileStrengthRules(JSON.parse(readFileSync(new URL('./data/label-strengths.json', import.meta.url), 'utf8')))
const data = JSON.parse(readFileSync(FORMULARY, 'utf8'))
let updated = 0
const unmatched = new Map()
const misfit = []
for (const g of data.guides) {
  if (STATE && g.stateCode !== STATE) continue
  if (GUIDES.size && !GUIDES.has(g.id)) continue
  const active = new Set(g.classes.filter((c) => !c.comingSoon).map((c) => c.id))
  for (const r of g.records) {
    const a = r.preferredAgent
    if (r.noCoveredAgent || !active.has(r.classId) || !a?.inn || /\d/.test(a.strength ?? '')) continue
    const value = labelStrength(rules, { classId: r.classId, inn: a.inn, strength: a.strength })
    if (!value) {
      const k = `${a.inn} | ${a.strength}`
      unmatched.set(k, [...(unmatched.get(k) ?? []), `${g.id}/${r.payerId}`])
      continue
    }
    if (!fitsSig(value, a.sig)) {
      misfit.push(`${g.id}/${r.payerId}/${r.classId}: ${a.inn} -> ${value} doesn't fit "${a.sig.slice(0, 80)}"`)
      continue
    }
    r.verificationNote = `${r.verificationNote ?? ''} [Strength ${today}: list names no strength ("${a.strength}"); set to the label starting dose (scripts/data/label-strengths.json)]`.trim()
    a.strength = value
    updated++
  }
}
console.log(`label strengths: updated ${updated}; no row ${[...unmatched.values()].flat().length}; doesn't fit the sig ${misfit.length}`)
for (const m of misfit) console.log(`  MISFIT ${m}`)
for (const [k, cells] of [...unmatched].sort((x, y) => y[1].length - x[1].length)) console.log(`  ${String(cells.length).padStart(3)}  ${k}`)
if (DRY) console.log('(dry run: nothing written)')
else if (updated) writeValidatedFormulary(data)
