#!/usr/bin/env node
// Attach a plan's published PA approval criteria to the matching paRequired items.
//
//   node scripts/apply-pa-criteria.mjs <file.json> [...] [--dry-run]
//
// File shape (data-gathering/pa-criteria-*/BRIEF.md): { payerId, sets: [{ guideId, classId,
// drugs: [exact paRequired drug strings], criteriaMode, criteria: [], reference: {...} }] }.
// paRequired items whose drug string matches exactly get criteria; a "[preferred] …" target sets
// the record's preferredCriteria (only when the preferred agent carries a restriction). Anything
// unmatched is reported, never guessed.
import { readFileSync, writeFileSync } from 'node:fs'

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const DRY = process.argv.includes('--dry-run')
const FORMULARY = 'src/data/formulary.json'
const data = JSON.parse(readFileSync(FORMULARY, 'utf8'))

for (const file of files) {
  const f = JSON.parse(readFileSync(file, 'utf8'))
  let applied = 0
  const unmatched = []
  for (const set of f.sets ?? []) {
    if (set.criteriaMode !== 'any' && set.criteriaMode !== 'all') throw new Error(`${file}: bad criteriaMode`)
    const criteria = (set.criteria ?? []).map((c) => String(c).trim()).filter(Boolean)
    if (!criteria.length || !set.reference?.id || !set.reference?.url) continue
    const g = data.guides.find((x) => x.id === set.guideId)
    const r = g?.records.find((x) => x.payerId === f.payerId && x.classId === set.classId)
    if (!g || !r) {
      unmatched.push(`${set.guideId}/${set.classId} (no record)`)
      continue
    }
    const ref = { ...set.reference }
    if (!ref.effectiveDate) delete ref.effectiveDate
    if (!g.references.some((x) => x.id === ref.id)) g.references.push(ref)
    for (const drug of set.drugs ?? []) {
      if (drug.startsWith('[preferred]')) {
        if (!r.preferredRestriction) {
          unmatched.push(`${set.guideId}/${set.classId}: ${drug} (preferred has no restriction)`)
          continue
        }
        r.preferredCriteria = criteria
        r.preferredCriteriaMode = set.criteriaMode
        r.preferredCriteriaSourceIds = [ref.id]
        applied++
        continue
      }
      const item = r.paRequired.find((x) => x.drug === drug)
      if (!item) {
        unmatched.push(`${set.guideId}/${set.classId}: ${drug}`)
        continue
      }
      item.criteria = criteria
      item.criteriaMode = set.criteriaMode
      item.criteriaSourceIds = [ref.id]
      applied++
    }
  }
  console.log(`${f.payerId}: criteria on ${applied} item(s); unmatched ${unmatched.length}`)
  for (const u of unmatched.slice(0, 15)) console.log(`  - ${u}`)
}
if (!DRY) writeFileSync(FORMULARY, JSON.stringify(data, null, 2) + '\n')
console.log(DRY ? '(dry run: nothing written)' : `wrote ${FORMULARY}`)
