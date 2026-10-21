#!/usr/bin/env node
// Export one payer's records from existing guides as a gather checkpoint, so a payer whose
// formulary is the SAME document in another state (a national commercial PDL, a national Part D
// plan, a multi-state marketplace formulary) can be merged into a new state without re-gathering.
//
//   node scripts/export-payer-checkpoint.mjs --payer=uhc-md --guides=md-inhalers,md-ace,... \
//     --as=uhc-fl --out=data-gathering/fl-old8-2026-10-21/uhc-fl.json --note="same national UHC PDL"
//
// Only reuse when the document is genuinely identical; say why in --note (appended to each
// record's verificationNote). Records keep their sources and verification as checked. Prose that
// names the source state blocks the export until reviewed (--allow-state-text).
import { readFileSync, writeFileSync } from 'node:fs'

const arg = (n) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').slice(n.length + 3)
const PAYER = arg('payer')
const GUIDES = arg('guides').split(',').filter(Boolean)
const AS = arg('as') || PAYER
const OUT = arg('out')
const NOTE = arg('note')
if (!PAYER || !GUIDES.length || !OUT || !NOTE) {
  console.error('usage: --payer=<id> --guides=a,b --out=<file> --note="<why the document is identical>" [--as=<new id>]')
  process.exit(2)
}

const data = JSON.parse(readFileSync('src/data/formulary.json', 'utf8'))
const records = []
const refs = new Map()
const cites = new Map()
for (const gid of GUIDES) {
  const g = data.guides.find((x) => x.id === gid)
  if (!g) throw new Error(`no guide ${gid}`)
  const byId = new Map(g.references.map((r) => [r.id, r]))
  const r = g.records.filter((x) => x.payerId === PAYER)
  if (!r.length) throw new Error(`${gid} has no records for ${PAYER}`)
  for (const rec of r) {
    const copy = structuredClone(rec)
    delete copy.payerId
    copy.verificationNote = `${copy.verificationNote} [Reused: ${NOTE}]`
    records.push(copy)
    const ids = [
      ...rec.sourceIds, ...rec.coverageSourceIds, ...rec.restrictionSourceIds,
      ...(rec.alternatives ?? []).flatMap((a) => a.sourceIds),
      ...rec.paRequired.flatMap((x) => [...x.sourceIds, ...(x.criteriaSourceIds ?? [])]),
      ...(rec.preferredCriteriaSourceIds ?? []),
    ]
    for (const id of ids) refs.set(id, byId.get(id))
    for (const id of rec.coverageSourceIds) cites.set(id, (cites.get(id) ?? 0) + 1)
  }
}
// Records gathered for one state often say so ("Maryland is not one of the three states...").
// Refuse to export prose that names a source guide's state unless the caller has reviewed it and
// passes --allow-state-text (after rewriting it for the target state).
const regions = [...new Set(GUIDES.map((gid) => data.guides.find((x) => x.id === gid).region))]
const stateHits = records.flatMap((r) =>
  regions.filter((name) => JSON.stringify(r).includes(name)).map((name) => `${r.classId}: mentions ${name}`),
)
if (stateHits.length && !process.argv.includes('--allow-state-text')) {
  console.error(`refusing: ${stateHits.length} record(s) carry source-state prose; rewrite them for the target state first, or pass --allow-state-text after review:`)
  for (const h of stateHits.slice(0, 20)) console.error(`  - ${h}`)
  process.exit(1)
}
const references = [...refs.keys()].sort((a, b) => (cites.get(b) ?? 0) - (cites.get(a) ?? 0)).map((k) => refs.get(k))
writeFileSync(OUT, JSON.stringify({ payerId: AS, references, records }, null, 2) + '\n')
console.log(`${AS}: ${records.length} records from ${GUIDES.length} guide(s) -> ${OUT}`)
