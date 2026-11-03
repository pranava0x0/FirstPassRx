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
//
// --all-states: the payer's document is national (a Part D PDP, a national commercial PDL), so a
// set written for one state's guide also applies to every other guide on the same topic where the
// same payer lists the same exact drug string. Only use it for genuinely state-neutral documents.
import { readFileSync } from 'node:fs'
import { writeValidatedFormulary } from './write-formulary.mjs'

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const DRY = process.argv.includes('--dry-run')
const ALL_STATES = process.argv.includes('--all-states')
const FORMULARY = 'src/data/formulary.json'
const data = JSON.parse(readFileSync(FORMULARY, 'utf8'))

for (const file of files) {
  const f = JSON.parse(readFileSync(file, 'utf8'))
  let applied = 0
  let copied = 0
  const unmatched = []
  // One criteria set per drug: a drug listed in two sets would be silently overwritten.
  const seen = new Set()
  for (const set of f.sets ?? [])
    for (const drug of set.drugs ?? []) {
      const key = `${set.guideId}|${set.classId}|${drug}`
      if (seen.has(key)) throw new Error(`${file}: "${drug}" is in more than one set for ${set.guideId}/${set.classId}`)
      seen.add(key)
    }
  for (const set of f.sets ?? []) {
    if (set.criteriaMode !== 'any' && set.criteriaMode !== 'all') throw new Error(`${file}: bad criteriaMode`)
    const criteria = (set.criteria ?? []).map((c) => String(c).trim()).filter(Boolean)
    if (!criteria.length || !set.reference?.id || !set.reference?.url) continue
    const home = data.guides.find((x) => x.id === set.guideId)
    const copies = ALL_STATES && home ? data.guides.filter((x) => x !== home && x.topicId === home.topicId) : []
    for (const g of [home, ...copies]) {
      const isHome = g === home
      const r = g?.records.find((x) => x.payerId === f.payerId && x.classId === set.classId)
      if (!g || !r) {
        if (isHome) unmatched.push(`${set.guideId}/${set.classId} (no record)`)
        continue
      }
      const ref = { ...set.reference }
      if (!ref.effectiveDate) delete ref.effectiveDate
      const before = applied
      for (const drug of set.drugs ?? []) {
        if (drug.startsWith('[preferred]')) {
          // A copy only applies when that guide's pick is the same product as the home guide's.
          const homePick = home.records.find((x) => x.payerId === f.payerId && x.classId === set.classId)?.preferredAgent?.inn
          if (!isHome && r.preferredAgent?.inn !== homePick) continue
          if (!r.preferredRestriction) {
            if (isHome) unmatched.push(`${set.guideId}/${set.classId}: ${drug} (preferred has no restriction)`)
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
          if (isHome) unmatched.push(`${set.guideId}/${set.classId}: ${drug}`)
          continue
        }
        item.criteria = criteria
        item.criteriaMode = set.criteriaMode
        item.criteriaSourceIds = [ref.id]
        applied++
        if (!isHome) copied++
      }
      // Cite the document only in guides where it now backs at least one item.
      if (applied > before && !g.references.some((x) => x.id === ref.id)) g.references.push(ref)
    }
  }
  console.log(`${f.payerId}: criteria on ${applied} item(s)${ALL_STATES ? ` (${copied} in other states)` : ''}; unmatched ${unmatched.length}`)
  for (const u of unmatched.slice(0, 15)) console.log(`  - ${u}`)
}
if (DRY) console.log('(dry run: nothing written)')
else writeValidatedFormulary(data)
