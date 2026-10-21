#!/usr/bin/env node
// Apply verified PA submission channels to every guide where the payer appears.
//
//   node scripts/apply-pa-submission.mjs <file.json> [<file.json> ...] [--dry-run]
//
// Each file: { payerId, state, paSubmission: {fax?, phone?, portal?, epa?, note?},
//              reference: {id, label, publisher, type, url, accessed, effectiveDate?}, evidence: [] }
// (shape in data-gathering/pa-submission-*/BRIEF.md). A payer's pharmacy PA intake is the same for
// every drug class, so one verified file fills that payer's "Send to" in all of its state's guides.
// The reference is added to each guide (sourceIds are guide-scoped). Existing paSubmission values
// that were verified per guide are left alone unless --overwrite is passed.
import { readFileSync, writeFileSync } from 'node:fs'

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const DRY = process.argv.includes('--dry-run')
const OVERWRITE = process.argv.includes('--overwrite')
const FORMULARY = 'src/data/formulary.json'
const data = JSON.parse(readFileSync(FORMULARY, 'utf8'))

for (const file of files) {
  const s = JSON.parse(readFileSync(file, 'utf8'))
  const sub = Object.fromEntries(
    Object.entries(s.paSubmission ?? {}).filter(([, v]) => typeof v === 'string' && v.trim() !== ''),
  )
  if (!sub.fax && !sub.phone && !sub.portal && !sub.epa) {
    console.log(`skip ${file}: no channel`)
    continue
  }
  if (!s.reference?.id || !s.reference?.url) throw new Error(`${file}: reference id/url required`)
  let applied = 0
  let kept = 0
  for (const g of data.guides) {
    if (g.stateCode !== s.state) continue
    const payer = g.payers.find((p) => p.id === s.payerId)
    if (!payer) continue
    if (payer.paSubmission && !OVERWRITE) {
      kept++
      continue
    }
    const ref = { ...s.reference }
    if (!ref.effectiveDate) delete ref.effectiveDate
    if (!g.references.some((r) => r.id === ref.id)) g.references.push(ref)
    const items = Object.entries(payer).filter(([k]) => k !== 'paSubmission')
    const idx = items.findIndex(([k]) => k === 'sourceIds')
    items.splice(idx, 0, ['paSubmission', { ...sub, sourceIds: [ref.id] }])
    for (const k of Object.keys(payer)) delete payer[k]
    Object.assign(payer, Object.fromEntries(items))
    applied++
  }
  console.log(`${s.state} ${s.payerId}: applied to ${applied} guide(s)${kept ? `, kept existing in ${kept}` : ''}`)
}
if (!DRY) writeFileSync(FORMULARY, JSON.stringify(data, null, 2) + '\n')
console.log(DRY ? '(dry run: nothing written)' : `wrote ${FORMULARY}`)
