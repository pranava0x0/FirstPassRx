#!/usr/bin/env node
// Apply reviewed cell fixes (from an audit review) to src/data/formulary.json deterministically.
//
//   node scripts/apply-cell-fixes.mjs <fixes.json> [...] [--dry-run]
//
// fixes.json: [{ guideId, payerId, classId, op, ...args, why }] where op is one of:
//   setField        { field: "tier"|"preferredRestriction"|"verification"|..., value }
//   setAgentField   { field: "strength"|"sig"|..., value }            (preferredAgent)
//   moveToAlternatives { drug, note }        paRequired item -> alternatives (no barrier)
//   moveToPaRequired   { drug, outcome, reason }  alternative -> paRequired (barrier)
//   removeItem      { drug }                 remove from paRequired or alternatives
//   addAlternative  { item: {drug, note, sourceIds} }
//   addPaRequired   { item: {drug, outcome, reason, sourceIds} }
//   editItem        { drug, patch: {...} }   merge fields into the matching item
// Every applied fix appends "[Audit 2026-xx-xx: why]" to the record's verificationNote. Drug
// names must match exactly; unmatched fixes are reported and nothing is guessed. Writes are
// validated (scripts/write-formulary.mjs) so a bad fix cannot land.
import { readFileSync } from 'node:fs'
import { FORMULARY, writeValidatedFormulary } from './write-formulary.mjs'

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))
if (!files.length) {
  console.error('usage: node scripts/apply-cell-fixes.mjs <fixes.json> [...] [--dry-run]')
  process.exit(2)
}
const DRY = process.argv.includes('--dry-run')
const today = new Date().toISOString().slice(0, 10)
const data = JSON.parse(readFileSync(FORMULARY, 'utf8'))
let applied = 0
const problems = []

for (const file of files) {
  for (const fx of JSON.parse(readFileSync(file, 'utf8'))) {
    const at = `${fx.guideId}/${fx.payerId}/${fx.classId} ${fx.op}${fx.drug ? ` "${fx.drug}"` : ''}`
    const g = data.guides.find((x) => x.id === fx.guideId)
    const r = g?.records.find((x) => x.payerId === fx.payerId && x.classId === fx.classId)
    if (!r) { problems.push(`${at}: no such record`); continue }
    const find = (list) => (list ?? []).findIndex((x) => x.drug === fx.drug)
    const pa = find(r.paRequired)
    const alt = find(r.alternatives)
    switch (fx.op) {
      case 'setField': r[fx.field] = fx.value; break
      case 'setAgentField': r.preferredAgent[fx.field] = fx.value; break
      case 'moveToAlternatives': {
        if (pa < 0) { problems.push(`${at}: not in paRequired`); continue }
        const [it] = r.paRequired.splice(pa, 1)
        ;(r.alternatives ??= []).push({ drug: it.drug, note: fx.note, sourceIds: it.sourceIds })
        break
      }
      case 'moveToPaRequired': {
        if (alt < 0) { problems.push(`${at}: not in alternatives`); continue }
        const [it] = r.alternatives.splice(alt, 1)
        r.paRequired.push({ drug: it.drug, outcome: fx.outcome, reason: fx.reason, sourceIds: it.sourceIds })
        break
      }
      case 'removeItem': {
        if (pa >= 0) r.paRequired.splice(pa, 1)
        else if (alt >= 0) r.alternatives.splice(alt, 1)
        else { problems.push(`${at}: not found`); continue }
        break
      }
      // Adds are idempotent: re-running a fixes file must not duplicate items.
      case 'addAlternative':
        if ((r.alternatives ?? []).some((x) => x.drug === fx.item.drug)) continue
        ;(r.alternatives ??= []).push(fx.item)
        break
      case 'addPaRequired':
        if (r.paRequired.some((x) => x.drug === fx.item.drug)) continue
        r.paRequired.push(fx.item)
        break
      case 'editItem': {
        const list = pa >= 0 ? r.paRequired : alt >= 0 ? r.alternatives : null
        if (!list) { problems.push(`${at}: not found`); continue }
        Object.assign(list[pa >= 0 ? pa : alt], fx.patch)
        break
      }
      default: problems.push(`${at}: unknown op`); continue
    }
    if (!r.verificationNote.includes(fx.why)) r.verificationNote = `${r.verificationNote} [Audit ${today}: ${fx.why}]`
    applied++
  }
}
console.log(`cell fixes: applied ${applied}; problems ${problems.length}`)
for (const p of problems) console.log(`  - ${p}`)
if (DRY) console.log('(dry run: nothing written)')
else if (applied) writeValidatedFormulary(data)
