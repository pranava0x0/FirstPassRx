#!/usr/bin/env node
// Merges a completed data-gathering/<stamp>/ checkpoint directory (one JSON file per
// payerId-classId, in the shape .claude/workflows/formulary-gather.js writes) into a new
// single-class guide in src/data/formulary.json.
//
// Generalizes the ad-hoc merge_state()-style Python script CLAUDE.md's scar tissue says every
// prior multi-topic merge recreated by hand in a scratchpad and then threw away. Scoped to the
// DOAC anticoagulant scale-out (one class, `doac-anticoagulant`) rather than the fully generic
// multi-class merge_state() shape -- extend it if a future single-class topic needs the same
// treatment.
//
// Usage:
//   node scripts/merge-doac-guide.mjs \
//     --checkpoint-dir data-gathering/pa-doac-2026-09-14 \
//     --guide-id pa-doac --label "PA · DOAC Anticoagulants" \
//     --state-code PA --region Pennsylvania \
//     --reuse-payers-from pa-ssris --reuse-class-from al-doac \
//     --today 2026-09-14
//
// Reuses:
//   --reuse-payers-from <guideId>  base payer metadata (name/shortName/pbm/aka) -- formularyUrl/
//                                  sourceIds/productName/formularyId are overwritten per-payer
//                                  from what each checkpoint's primarySource actually cites.
//   --reuse-class-from <guideId>   the doac-anticoagulant class definition + glossary, verbatim.
//
// Fails loud (no guide written) if any payer expected by --reuse-payers-from is missing a
// checkpoint file, or if the target guide id already exists -- run `npm run data:split && npm
// test` after this succeeds.

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const formularyPath = path.join(root, 'src/data/formulary.json')

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) throw new Error(`Unexpected argument: ${a}`)
    out[a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i]
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
for (const req of ['checkpointDir', 'guideId', 'label', 'stateCode', 'region', 'reusePayersFrom', 'reuseClassFrom']) {
  if (!args[req]) {
    console.error(`Missing required --${req.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`)
    process.exit(1)
  }
}
const today = args.today || new Date().toISOString().slice(0, 10)
const CLASS_ID = 'doac-anticoagulant'

const formulary = JSON.parse(fs.readFileSync(formularyPath, 'utf8'))

if (formulary.guides.some((g) => g.id === args.guideId)) {
  console.error(`Guide "${args.guideId}" already exists in formulary.json -- aborting.`)
  process.exit(1)
}

const payerGuide = formulary.guides.find((g) => g.id === args.reusePayersFrom)
if (!payerGuide) {
  console.error(`No guide "${args.reusePayersFrom}" found for --reuse-payers-from.`)
  process.exit(1)
}
const classGuide = formulary.guides.find((g) => g.id === args.reuseClassFrom)
if (!classGuide) {
  console.error(`No guide "${args.reuseClassFrom}" found for --reuse-class-from.`)
  process.exit(1)
}
const doacClassTemplate = classGuide.classes.find((c) => c.id === CLASS_ID)
if (!doacClassTemplate) {
  console.error(`Guide "${args.reuseClassFrom}" has no class "${CLASS_ID}" to reuse.`)
  process.exit(1)
}

const checkpointDir = path.join(root, args.checkpointDir)
if (!fs.existsSync(checkpointDir)) {
  console.error(`Checkpoint directory not found: ${checkpointDir}`)
  process.exit(1)
}

const expectedPayerIds = payerGuide.payers.map((p) => p.id)
const checkpointsByPayer = new Map()
let skippedOtherClasses = 0
for (const file of fs.readdirSync(checkpointDir)) {
  if (!file.endsWith('.json')) continue
  const data = JSON.parse(fs.readFileSync(path.join(checkpointDir, file), 'utf8'))
  // A stamp directory can hold checkpoints for OTHER classes too -- build-gather-args.mjs's
  // repeated --class-id lets one gather cover several classes from the same payers in one pass
  // (see agent-runs.md lever #7). Skip anything that isn't this class rather than aborting the
  // whole merge on it.
  if (data.classId !== CLASS_ID) {
    skippedOtherClasses++
    continue
  }
  checkpointsByPayer.set(data.payerId, data)
}
if (skippedOtherClasses > 0) {
  console.log(`Skipped ${skippedOtherClasses} checkpoint(s) for other classes in this stamp directory.`)
}

const missing = expectedPayerIds.filter((id) => !checkpointsByPayer.has(id))
if (missing.length > 0) {
  console.error(
    `Missing checkpoint(s) for payer(s): ${missing.join(', ')} -- every payer in "${args.reusePayersFrom}" ` +
      `needs a checkpoint before this guide can be merged (formulary.json's own validate() enforces a ` +
      `full payer x class grid per guide -- see CLAUDE.md). Not writing formulary.json.`,
  )
  process.exit(1)
}

function withSourceId(items, sourceId) {
  return (items ?? []).map((it) => ({ ...it, sourceIds: [sourceId] }))
}

const newPayers = []
const newReferences = []
const newRecords = []
const classSourceIds = []

for (const payerId of expectedPayerIds) {
  const ckpt = checkpointsByPayer.get(payerId)
  const src = ckpt.primarySource
  const sourceId = `${payerId}-doac-source-${today.replace(/-/g, '').slice(0, 6)}`
  classSourceIds.push(sourceId)

  const basePayer = payerGuide.payers.find((p) => p.id === payerId)
  newPayers.push({
    ...basePayer,
    sourceIds: [sourceId],
    formularyUrl: src.url,
    formularyId: src.effectiveDate ? `${src.label}, effective ${src.effectiveDate}` : src.label,
    productName: src.label,
  })

  newReferences.push({
    id: sourceId,
    label: src.label,
    publisher: src.publisher,
    type: /medicaid|nyrx|\bstate\b|\.gov/i.test(`${payerId} ${src.publisher}`) ? 'gov' : 'payer',
    url: src.url,
    effectiveDate: src.effectiveDate ?? null,
    accessed: today,
  })

  newRecords.push({
    payerId,
    classId: CLASS_ID,
    preferredAgent: ckpt.preferredAgent,
    preferredRestriction: ckpt.preferredRestriction ?? null,
    boglActive: ckpt.boglActive ?? false,
    boglNote: ckpt.boglNote ?? null,
    alternatives: withSourceId(ckpt.alternatives, sourceId),
    paRequired: withSourceId(ckpt.paRequired, sourceId),
    stepTherapy: ckpt.stepTherapy ?? null,
    tier: ckpt.tier ?? null,
    verification: ckpt.verification,
    verificationNote: ckpt.verificationNote,
    sourceIds: [sourceId],
    coverageSourceIds: [sourceId],
    restrictionSourceIds: [sourceId],
    lastReviewed: ckpt.lastReviewed ?? today,
  })
}

// Derive from the actual per-record verification, not a blind 'verified' -- a checkpoint that
// came back 'partial'/'example' must not silently inflate validate-coverage.mjs's full-depth
// count (it treats a guide as full-depth only when every record is 'verified' AND
// dataStatus === 'verified'). Matches the convention every other multi-verification guide in
// formulary.json already follows (dataStatus: 'mixed' whenever any record isn't 'verified').
const dataStatus = newRecords.every((r) => r.verification === 'verified') ? 'verified' : 'mixed'

const newGuide = {
  id: args.guideId,
  label: args.label,
  stateCode: args.stateCode,
  region: args.region,
  topicId: 'doac',
  topic: 'DOAC Anticoagulants',
  classNoun: 'Prescription type',
  unitNoun: 'medication',
  tagline: '',
  dataStatus,
  lastUpdated: today,
  capturedAt: today,
  payers: newPayers,
  classes: [{ ...doacClassTemplate, sourceIds: classSourceIds }],
  references: newReferences,
  glossary: JSON.parse(JSON.stringify(classGuide.glossary)),
  records: newRecords,
}

formulary.guides.push(newGuide)
fs.writeFileSync(formularyPath, `${JSON.stringify(formulary, null, 2)}\n`)

console.log(
  `Merged guide "${args.guideId}" (${newPayers.length} payers, ${newRecords.length} records) into formulary.json.`,
)
console.log('Next: npm run data:split && npm test -- and add the guide id to formulary.test.ts\'s expected-order list.')
console.log(
  `Reminder: also add a paRequired reason-wording check -- avoid the words "non-preferred"/"higher ` +
    `tier" in any barrier's reason unless it is genuinely a cost-tier-only item (see formulary.ts's ` +
    `validate() heuristic and CLAUDE.md's reword-vs-reclassify rule).`,
)
