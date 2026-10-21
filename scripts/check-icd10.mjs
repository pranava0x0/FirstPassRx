#!/usr/bin/env node
// Check every code in src/lib/icd10.ts against an official ICD-10-CM order file: it must exist
// and be billable (header flag 1). Prints the official long title next to ours so wording drift
// is visible. Re-run each October when CMS publishes the new fiscal year.
//
//   curl -4 -sSLO https://www.cms.gov/files/zip/2027-code-descriptions-tabular-order.zip && unzip …
//   node scripts/check-icd10.mjs "<dir>/icd10cm_order_2027.txt"
import { readFileSync } from 'node:fs'

const orderFile = process.argv[2]
if (!orderFile) {
  console.error('usage: node scripts/check-icd10.mjs <icd10cm_order_YYYY.txt>')
  process.exit(2)
}
// Order file layout (CMS icd10OrderFiles.pdf): order no. (5), space, code without dot (7),
// space, billable flag 0/1, space, short title (60), space, long title.
const official = new Map()
for (const line of readFileSync(orderFile, 'latin1').split(/\r?\n/)) {
  if (line.length < 16) continue
  const code = line.slice(6, 13).trim()
  official.set(code, { billable: line[14] === '1', title: line.slice(77).trim() })
}

const src = readFileSync(new URL('../src/lib/icd10.ts', import.meta.url), 'utf8')
const ours = [...src.matchAll(/code: '([A-Z0-9.]+)', label: '([^']+)'/g)].map((m) => ({ code: m[1], label: m[2] }))
let bad = 0
for (const { code, label } of new Map(ours.map((o) => [o.code, o])).values()) {
  const hit = official.get(code.replace('.', ''))
  if (!hit) {
    bad++
    console.log(`✗ ${code}  NOT IN FILE  (ours: ${label})`)
  } else if (!hit.billable) {
    bad++
    console.log(`✗ ${code}  NOT BILLABLE  ${hit.title}`)
  } else {
    console.log(`✓ ${code}  ${hit.title}${hit.title.toLowerCase() === label.toLowerCase() ? '' : `   (ours: ${label})`}`)
  }
}
console.log(`\n${ours.length} entries, ${bad} problem(s)`)
process.exit(bad ? 1 : 0)
