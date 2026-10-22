#!/usr/bin/env node
// Replace preferred-agent sigs with reviewed label dosing (indication-specific doses, titration,
// required overlaps) from scripts/data/label-sigs.json: [[innRegex, sig, sigShort, plainSig, strengthRegex?], ...].
// First matching row wins. Gathering agents write "standard label dosing" sigs that are often a
// single fixed dose; this makes the copy-ready sig deterministic and reviewable in one table.
//
//   node scripts/apply-label-sigs.mjs --guides=ma-pain,ma-oab [--dry-run]
//   node scripts/apply-label-sigs.mjs --state=MA --topics=pain,oab
//
// Records whose preferred agent matches no row are listed, never guessed. Writes are validated.
import { readFileSync } from 'node:fs'
import { FORMULARY, writeValidatedFormulary } from './write-formulary.mjs'

const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3)
const DRY = process.argv.includes('--dry-run')
const GUIDES = new Set(arg('guides').split(',').filter(Boolean))
const STATE = arg('state')
const TOPICS = new Set(arg('topics').split(',').filter(Boolean))
if (!GUIDES.size && !STATE) {
  console.error('usage: --guides=a,b | --state=XX [--topics=t1,t2] [--dry-run]')
  process.exit(2)
}
const rules = JSON.parse(readFileSync(new URL('./data/label-sigs.json', import.meta.url), 'utf8')).map(
  ([re, sig, sigShort, plainSig, strength]) => ({ re: new RegExp(re, 'i'), strength: strength ? new RegExp(strength, 'i') : null, sig, sigShort, plainSig }),
)
const data = JSON.parse(readFileSync(FORMULARY, 'utf8'))
let updated = 0
const unmatched = []
for (const g of data.guides) {
  const pick = GUIDES.size ? GUIDES.has(g.id) : g.stateCode === STATE && (!TOPICS.size || TOPICS.has(g.topicId))
  if (!pick) continue
  for (const r of g.records) {
    if (r.noCoveredAgent) continue
    const a = r.preferredAgent
    const rule = rules.find((x) => x.re.test(a.inn) && (!x.strength || x.strength.test(a.strength ?? '')))
    if (!rule) {
      unmatched.push(`${g.id}/${r.payerId}/${r.classId}: ${a.inn}`)
      continue
    }
    if (a.sig === rule.sig) continue
    Object.assign(a, { sig: rule.sig, sigShort: rule.sigShort, plainSig: rule.plainSig })
    updated++
  }
}
console.log(`label sigs: updated ${updated}; unmatched ${unmatched.length}`)
for (const u of unmatched.slice(0, 30)) console.log(`  - ${u}`)
if (DRY) console.log('(dry run: nothing written)')
else if (updated) writeValidatedFormulary(data)
