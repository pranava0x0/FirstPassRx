#!/usr/bin/env node
// Fold per-payer gather checkpoints into whole new guides in src/data/formulary.json.
//
//   node scripts/merge-gather.mjs --dir=data-gathering/<stamp> --state=MA --payers-from=ma-ssris [--exclude-payers=a,b] [--dry-run]
//
// <dir>/taxonomy.json defines topics -> classes (see data-gathering/*/taxonomy.json). Each
// <dir>/<payerId>.json holds { payerId, references[], records[] } for every class it covers
// (shape in <dir>/BRIEF.md). Payer metadata (names, PBM, segment, formulary URL) is copied
// from an existing guide for the same state (--payers-from), so the roster stays consistent.
//
// A topic is merged only when EVERY payer has a record for EVERY class in it: validate()'s
// count floor rejects partial guides, and a half-merged guide is worse than none (CLAUDE.md).
// Topics that fall short are reported and skipped. Existing guide ids are never overwritten.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1]
const DIR = arg('dir')
const STATE = arg('state')
const PAYERS_FROM = arg('payers-from')
const DRY = process.argv.includes('--dry-run')
// --exclude-payers=a,b: leave payers out of the new guides (e.g. only a not-yet-effective list exists).
const EXCLUDE = new Set((arg('exclude-payers') || '').split(',').filter(Boolean))
// --payers-file=<json> {region, payers:[...]} for a state with no guide yet (else --payers-from).
const PAYERS_FILE = arg('payers-file')
if (!DIR || !STATE || (!PAYERS_FROM && !PAYERS_FILE)) {
  console.error('usage: --dir=<checkpoint dir> --state=<XX> (--payers-from=<guide id> | --payers-file=<json>) [--exclude-payers=a,b] [--dry-run]')
  process.exit(2)
}

const FORMULARY = 'src/data/formulary.json'
const data = JSON.parse(readFileSync(FORMULARY, 'utf8'))
const taxonomy = JSON.parse(readFileSync(join(DIR, 'taxonomy.json'), 'utf8'))
const source = PAYERS_FILE
  ? { ...JSON.parse(readFileSync(PAYERS_FILE, 'utf8')), stateCode: STATE }
  : data.guides.find((g) => g.id === PAYERS_FROM)
if (!source) throw new Error(`no guide ${PAYERS_FROM}`)
if (source.stateCode !== STATE) throw new Error(`${PAYERS_FROM} is ${source.stateCode}, not ${STATE}`)
// A filtered COPY: never mutate the source guide, which is written back with the file.
const sourcePayers = source.payers.filter((p) => !EXCLUDE.has(p.id))

const checkpoints = new Map()
for (const p of sourcePayers) {
  const file = join(DIR, `${p.id}.json`)
  if (existsSync(file)) checkpoints.set(p.id, JSON.parse(readFileSync(file, 'utf8')))
}

const today = new Date().toISOString().slice(0, 10)
const report = []
for (const [topicId, topic] of Object.entries(taxonomy.topics)) {
  // Optional topic.slug keeps ids consistent with existing guides (menopause-ht -> xx-menopause).
  const guideId = `${STATE.toLowerCase()}-${topic.slug ?? topicId}`
  if (data.guides.some((g) => g.id === guideId)) {
    report.push(`skip ${guideId}: already exists`)
    continue
  }
  const classIds = topic.classes.map((c) => c.id)
  const missing = []
  for (const p of sourcePayers) {
    const cp = checkpoints.get(p.id)
    for (const cid of classIds) {
      if (!cp?.records?.some((r) => r.classId === cid)) missing.push(`${p.id}/${cid}`)
    }
  }
  if (missing.length) {
    report.push(`skip ${guideId}: missing ${missing.length} cell(s): ${missing.join(', ')}`)
    continue
  }

  const records = []
  const refs = new Map()
  for (const p of sourcePayers) {
    const cp = checkpoints.get(p.id)
    for (const r of cp.references) refs.set(r.id, r)
    for (const cid of classIds) records.push({ ...cp.records.find((r) => r.classId === cid), payerId: p.id })
  }
  const usedRefIds = new Set(records.flatMap((r) => [
    ...r.sourceIds, ...r.coverageSourceIds, ...r.restrictionSourceIds,
    ...(r.alternatives ?? []).flatMap((a) => a.sourceIds),
    ...r.paRequired.flatMap((x) => [...x.sourceIds, ...(x.criteriaSourceIds ?? [])]),
    ...(r.preferredCriteriaSourceIds ?? []),
  ]))
  // Fail before anything is written if a record cites a reference no checkpoint carries.
  const unresolved = [...usedRefIds].filter((id) => !refs.has(id))
  if (unresolved.length) throw new Error(`${guideId}: unresolved sourceIds ${unresolved.join(', ')}`)
  const references = [...refs.values()].filter((r) => usedRefIds.has(r.id))
  // Class metadata cites the first payer's reference that the class's own records use.
  const classes = topic.classes.map((c) => ({
    ...c,
    sourceIds: [records.find((r) => r.classId === c.id).coverageSourceIds[0]],
  }))
  // Payer sourceIds must resolve inside this guide: point each at its own checkpoint reference.
  const payers = sourcePayers.map((p) => {
    const { paSubmission, ...rest } = p // channels were verified per guide; don't copy unchecked
    void paSubmission
    // Link the payer to the document this gather actually read, not the source guide's (a
    // per-class table like MassHealth's MHDL differs by topic; CLAUDE.md 2026-07-21 note).
    // Use the payer's reference that this topic's own records cite most, so it resolves in-guide.
    const cited = records.filter((r) => r.payerId === p.id).flatMap((r) => r.coverageSourceIds)
    const topId = [...new Set(cited)].sort((a, b) => cited.filter((x) => x === b).length - cited.filter((x) => x === a).length)[0]
    const primary = refs.get(topId)
    // formularyId too: the copied one names the source guide's document (Codex review, PR 22).
    return { ...rest, formularyId: primary.label, formularyUrl: primary.url, sourceIds: [primary.id] }
  })
  const verified = records.filter((r) => r.verification === 'verified').length
  data.guides.push({
    id: guideId,
    label: `${STATE} · ${topic.topic}`,
    stateCode: STATE,
    region: source.region,
    topicId,
    topic: topic.topic,
    classNoun: 'Prescription type',
    unitNoun: topic.unitNoun,
    tagline: '',
    dataStatus: verified === records.length ? 'verified' : 'mixed',
    lastUpdated: today,
    capturedAt: today,
    payers,
    classes,
    records,
    references,
    glossary: [
      { term: 'Prior authorization (PA)', short: 'Insurer sign-off first', definition: 'Insurer sign-off needed before the drug is covered.' },
      { term: 'Step therapy', short: 'Try a preferred drug first', definition: 'Must fail a preferred drug first before the plan covers this one.' },
    ],
  })
  report.push(`merge ${guideId}: ${sourcePayers.length} payers × ${classIds.length} classes, ${verified}/${records.length} verified`)
}

console.log(report.join('\n'))
if (!DRY) {
  // Run the app's full validate() (it executes when formulary.test.ts loads) against the merged
  // file, and put the original back if it fails, so a malformed checkpoint never lands.
  const original = readFileSync(FORMULARY, 'utf8')
  writeFileSync(FORMULARY, JSON.stringify(data, null, 2) + '\n')
  const check = spawnSync('npx', ['vitest', 'run', 'src/lib/formulary.test.ts', '-t', '__validate_only__', '--passWithNoTests'], { encoding: 'utf8' })
  if (check.status !== 0) {
    writeFileSync(FORMULARY, original)
    console.error((check.stdout + check.stderr).split('\n').filter((l) => / - guide |Invalid formulary/.test(l)).slice(0, 30).join('\n'))
    console.error(`validation failed: ${FORMULARY} left unchanged`)
    process.exit(1)
  }
}
console.log(DRY ? '(dry run: nothing written)' : `wrote ${FORMULARY} (validated)`)
