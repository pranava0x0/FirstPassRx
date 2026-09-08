#!/usr/bin/env node
// Assembles the payerTasks[] gather-agent arguments for a new (state, class) cell by reusing an
// EXISTING guide's already-vetted payer roster (name/pbm/formularyUrl/marketSegment) instead of
// re-discovering it from state-index.json or the web -- see CLAUDE.md's "check for existing
// pre-vetted data before spawning a discovery phase" rule and docs/agent-runs.md cost lever #9.
//
// Usage:
//   node scripts/build-gather-args.mjs \
//     --state PA --reuse-payers-from pa-ssris \
//     --class-id doac-anticoagulant \
//     --class-name "Oral Anticoagulants (DOACs)" \
//     --class-desc "Direct oral anticoagulants (apixaban/Eliquis, rivaroxaban/Xarelto, dabigatran/Pradaxa, edoxaban/Savaysa) -- first-line therapy for stroke prevention in atrial fibrillation and treatment/prevention of venous thromboembolism, largely supplanting warfarin." \
//     --stamp pa-doac-2026-09-14
//
// Prints the exact `args` JSON object formulary-gather.js expects (Workflow tool), AND a plain
// per-payer prompt list (for hand-launching individual Agent tool calls at the 2-concurrent cap
// when the Workflow tool isn't opted into this session -- both consume the identical roster).
//
// Multiple --class-id/--class-name/--class-desc triples may be repeated to gather several classes
// from the same payers in one pass (see agent-runs.md lever #7 -- one fetch per payer covers every
// class you ask for, so batch everything you'll need from a state's payers into one run).

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const formularyPath = path.join(root, 'src/data/formulary.json')

function parseArgs(argv) {
  const out = { classes: [] }
  let pendingClass = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--state') out.state = argv[++i]
    else if (a === '--reuse-payers-from') out.reusePayersFrom = argv[++i]
    else if (a === '--stamp') out.stamp = argv[++i]
    else if (a === '--today') out.today = argv[++i]
    else if (a === '--class-id') {
      if (pendingClass) out.classes.push(pendingClass)
      pendingClass = { classId: argv[++i] }
    } else if (a === '--class-name') {
      if (!pendingClass) throw new Error('--class-name given before --class-id')
      pendingClass.className = argv[++i]
    } else if (a === '--class-desc') {
      if (!pendingClass) throw new Error('--class-desc given before --class-id')
      pendingClass.classDescription = argv[++i]
    } else {
      throw new Error(`Unknown argument: ${a}`)
    }
  }
  if (pendingClass) out.classes.push(pendingClass)
  return out
}

const args = parseArgs(process.argv.slice(2))
for (const req of ['state', 'reusePayersFrom', 'stamp']) {
  if (!args[req]) {
    console.error(`Missing required --${req.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`)
    process.exit(1)
  }
}
if (args.classes.length === 0) {
  console.error('At least one --class-id (with --class-name/--class-desc) is required')
  process.exit(1)
}

const formulary = JSON.parse(fs.readFileSync(formularyPath, 'utf8'))
const sourceGuide = formulary.guides.find((g) => g.id === args.reusePayersFrom)
if (!sourceGuide) {
  console.error(
    `No guide "${args.reusePayersFrom}" found in formulary.json. ` +
      `Guides for state codes: ${[...new Set(formulary.guides.map((g) => g.stateCode))].join(', ')}`,
  )
  process.exit(1)
}
// The whole point of --state is to say which state this gather is for -- if it doesn't match the
// reused guide's own stateCode (a typo'd --reuse-payers-from, or a guide from another state), fail
// loud instead of silently launching an expensive gather for the wrong state's payers.
if (args.state.trim().toUpperCase() !== sourceGuide.stateCode.toUpperCase()) {
  console.error(
    `--state ${args.state} does not match guide "${args.reusePayersFrom}"'s stateCode ` +
      `"${sourceGuide.stateCode}" (region "${sourceGuide.region}"). Pass --state ${sourceGuide.stateCode} ` +
      `or double-check --reuse-payers-from.`,
  )
  process.exit(1)
}

const today = args.today || new Date().toISOString().slice(0, 10)

const payerTasks = sourceGuide.payers.map((p) => ({
  payerId: p.id,
  payerName: p.name,
  payerFormularyUrl: p.formularyUrl,
  payerFormularyLabel: p.productName || p.formularyId || undefined,
  payerPbm: p.pbm,
  classes: args.classes,
}))

const workflowArgs = {
  stamp: args.stamp,
  state: sourceGuide.region,
  today,
  payerTasks,
}

console.log('=== formulary-gather.js `args` (Workflow tool) ===')
console.log(JSON.stringify(workflowArgs, null, 2))

console.log('\n=== Per-payer prompt reminders (individual Agent tool calls, chunk to <=2 concurrent) ===')
for (const p of payerTasks) {
  console.log(`\n--- ${p.payerId} ---`)
  console.log(`Payer: ${p.payerName}`)
  console.log(`PBM: ${p.payerPbm ?? '(unknown)'}`)
  console.log(`Known source: ${p.payerFormularyUrl}`)
  console.log(`Checkpoint target: data-gathering/${args.stamp}/${p.payerId}-<classId>.json`)
  console.log(
    `Classes to cover from ONE fetch: ${p.classes.map((c) => `${c.className} (${c.classId})`).join(', ')}`,
  )
}

console.log(
  `\nReminder: fm.formularynavigator.com and uhcprovider.com 403 WebFetch's safe-browsing check ` +
    `but a plain curl with a browser User-Agent works (see CLAUDE.md scar tissue). Never launch ` +
    `more than 2 of these agents concurrently.`,
)
