#!/usr/bin/env node
// Coverage-completeness validator for src/data/formulary.json.
//
// This does NOT replace validate() in src/lib/formulary.ts (which enforces that an EXISTING
// guide's payer x class grid is complete — a hard build/test gate). This script answers the
// broader product question: across every US jurisdiction and every drug-class topic the app
// knows about, which (state, topic) cells have a guide at all, and for the ones that do, is every
// "relevant" health plan for that state actually represented?
//
// "Relevant health plans" for a state come from src/data/state-index.json when that state has an
// entry there (a payer directory populated by earlier research passes). Without an index entry we
// can only report "no roster to check against" rather than silently assuming completeness.
//
// Usage:  node scripts/validate-coverage.mjs [--strict] [--state=NY] [--verbose]
//   --strict   exit 1 if any indexed payer is entirely missing from every guide for its state
//   --state=XX limit the payer cross-check + grid print to one state code
//   --verbose  print the full per-state grid, not just the summary + gaps

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA = join(HERE, '..', 'src', 'data', 'formulary.json')
const STATE_INDEX = join(HERE, '..', 'src', 'data', 'state-index.json')

const args = process.argv.slice(2)
const STRICT = args.includes('--strict')
const VERBOSE = args.includes('--verbose')
const STATE_FILTER = (args.find((a) => a.startsWith('--state=')) || '').split('=')[1]?.toUpperCase()

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
}

// The 50 states + DC. Territories (PR, GU, VI, AS, MP) are out of scope until product decides
// they're in scope — deliberately not listed here so they never silently read as "missing".
const US_JURISDICTIONS = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
]

if (!existsSync(DATA)) {
  console.error(c.red(`formulary.json not found at ${DATA}`))
  process.exit(1)
}
const formulary = JSON.parse(readFileSync(DATA, 'utf8'))
const stateIndex = existsSync(STATE_INDEX) ? JSON.parse(readFileSync(STATE_INDEX, 'utf8')) : { states: [] }
const rosterByState = new Map(stateIndex.states.map((s) => [s.code, s]))

// ---- derive the topic list and the (state, topic) -> guide map from the guides that exist ----
const topics = []
const seenTopic = new Set()
for (const g of formulary.guides) {
  if (!seenTopic.has(g.topicId)) {
    seenTopic.add(g.topicId)
    topics.push({ id: g.topicId, label: g.topic })
  }
}
const guideByStateTopic = new Map(formulary.guides.map((g) => [`${g.stateCode}|${g.topicId}`, g]))

const activeClassCount = (g) => g.classes.filter((cl) => !cl.comingSoon).length
const cellCount = (g) => g.payers.length * activeClassCount(g)
const filledCellCount = (g) => g.records.length
const verificationCounts = (g) => {
  const out = { verified: 0, partial: 0, example: 0 }
  for (const r of g.records) out[r.verification] = (out[r.verification] || 0) + 1
  return out
}

// ---- normalize a plan name to a bag of significant words for fuzzy cross-checking ----
const STOPWORDS = new Set([
  'the', 'of', 'and', 'plan', 'plans', 'health', 'healthcare', 'care', 'insurance', 'inc',
  'llc', 'community', 'medicaid', 'medicare', 'commercial', 'part', 'd', 'ffs', 'mco', 'exchange',
  'individual', 'small', 'group', 'family', 'families', 'blue', 'cross', 'shield', 'blueshield',
])
function significantWords(name) {
  return (name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
}
function planRepresented(planName, guidePayers) {
  const words = significantWords(planName)
  if (words.length === 0) return true // nothing distinctive to match on (e.g. bare "Medicaid")
  const haystacks = guidePayers.map((p) => `${p.name} ${p.aka || ''} ${p.productName || ''}`.toLowerCase())
  // Require at least one strongly distinctive word (>=5 chars) to hit, to avoid false positives
  // like "health" matching everything.
  const distinctive = words.filter((w) => w.length >= 5)
  const checkWords = distinctive.length > 0 ? distinctive : words
  return haystacks.some((h) => checkWords.some((w) => h.includes(w)))
}

// ---- national grid: (state x topic) -> covered / partial / none ----
const gridStates = STATE_FILTER
  ? US_JURISDICTIONS.filter(([code]) => code === STATE_FILTER)
  : US_JURISDICTIONS

let totalCells = 0
let coveredCells = 0
let fullDepthCells = 0
const statesWithAnyGuide = new Set()

const rows = gridStates.map(([code, name]) => {
  const cells = topics.map((t) => {
    totalCells++
    const g = guideByStateTopic.get(`${code}|${t.id}`)
    if (!g) return { topic: t.label, status: 'none' }
    statesWithAnyGuide.add(code)
    coveredCells++
    const total = cellCount(g)
    const filled = filledCellCount(g)
    const full = filled >= total && g.dataStatus === 'verified'
    if (full) fullDepthCells++
    return {
      topic: t.label,
      status: full ? 'full' : 'partial',
      filled,
      total,
      payers: g.payers.length,
      dataStatus: g.dataStatus,
    }
  })
  return { code, name, cells }
})

// ---- payer-roster cross-check (only for states with both a guide and a state-index roster) ----
// A "Medicaid MCO" plan can legitimately be absent as its own payer entry when the state carved
// pharmacy benefits out to a single statewide FFS/PDL payer that the guide already lists (e.g. NY's
// NYRx) -- that's a documented design choice, not a gap. Detect that carve-out heuristically: an
// FFS payer in the guide whose own aka/productName says it covers Medicaid Managed Care statewide.
const CARVEOUT_HINT = /medicaid managed care.*(statewide|every)|covers every.*medicaid managed care/i
function hasDocumentedCarveout(guidePayers) {
  return guidePayers.some(
    (p) => p.marketSegment === 'medicaid-ffs' && CARVEOUT_HINT.test(`${p.aka || ''} ${p.productName || ''}`),
  )
}

const rosterGaps = [] // { stateCode, guideId, missingPlan, likelyCarveout }
for (const g of formulary.guides) {
  if (STATE_FILTER && g.stateCode !== STATE_FILTER) continue
  const roster = rosterByState.get(g.stateCode)
  if (!roster) continue
  const carveout = hasDocumentedCarveout(g.payers)
  for (const plan of roster.plans) {
    if (!planRepresented(plan.name, g.payers)) {
      const likelyCarveout = carveout && plan.kind === 'Medicaid MCO'
      rosterGaps.push({ stateCode: g.stateCode, guideId: g.id, missingPlan: plan.name, likelyCarveout })
    }
  }
}
const realGaps = rosterGaps.filter((g) => !g.likelyCarveout)
const carveoutGaps = rosterGaps.filter((g) => g.likelyCarveout)

// ---- report ----
console.log(c.bold('\n=== FirstPassRx coverage report ==='))
console.log(`Topics currently defined: ${topics.map((t) => t.label).join(', ')}`)
console.log(`Jurisdictions in scope: ${US_JURISDICTIONS.length} (50 states + DC)\n`)

console.log(c.bold('-- National grid --'))
console.log(
  `${coveredCells}/${totalCells} (state x topic) cells have any guide` +
    ` -- ${fullDepthCells}/${totalCells} are full-depth verified.`,
)
console.log(`${statesWithAnyGuide.size}/${US_JURISDICTIONS.length} jurisdictions have at least one guide.`)

const missingStates = gridStates.filter(([code]) => !statesWithAnyGuide.has(code))
if (!STATE_FILTER && missingStates.length > 0) {
  console.log(c.yellow(`\n${missingStates.length} states have ZERO guides for any topic:`))
  console.log(c.dim(missingStates.map(([code]) => code).join(', ')))
}

if (VERBOSE || STATE_FILTER) {
  console.log(c.bold('\n-- Per-state grid --'))
  for (const row of rows) {
    if (!VERBOSE && row.cells.every((c) => c.status === 'none')) continue
    console.log(`\n${c.bold(row.name)} (${row.code})`)
    for (const cell of row.cells) {
      if (cell.status === 'none') {
        console.log(`  ${c.dim('·')} ${cell.topic}: ${c.dim('no guide')}`)
      } else if (cell.status === 'full') {
        console.log(`  ${c.green('✓')} ${cell.topic}: ${cell.payers} payers, verified`)
      } else {
        console.log(
          `  ${c.yellow('○')} ${cell.topic}: ${cell.filled}/${cell.total} cells, ${cell.payers} payers, ${cell.dataStatus}`,
        )
      }
    }
  }
}

console.log(c.bold('\n-- Verification quality per guide --'))
for (const g of formulary.guides) {
  if (STATE_FILTER && g.stateCode !== STATE_FILTER) continue
  const vc = verificationCounts(g)
  console.log(
    `  ${g.id}: ${g.payers.length} payers x ${activeClassCount(g)} classes` +
      ` -- verified ${vc.verified}, partial ${vc.partial}, example ${vc.example}`,
  )
}

console.log(c.bold('\n-- Health-plan roster cross-check --'))
const statesWithRoster = [...rosterByState.keys()].filter((code) => !STATE_FILTER || code === STATE_FILTER)
if (statesWithRoster.length === 0) {
  console.log(c.dim('  No state-index.json entries in scope.'))
} else {
  console.log(
    c.dim(
      `  Checked ${statesWithRoster.length} state(s) with a known payer roster (state-index.json): ${statesWithRoster.join(', ')}`,
    ),
  )
  if (rosterGaps.length === 0) {
    console.log(c.green('  Every indexed health plan is represented in its state\'s guide(s).'))
  } else {
    if (realGaps.length > 0) {
      console.log(c.yellow(`  ${realGaps.length} indexed health plan(s) not yet represented in a guide:`))
      for (const gap of realGaps) {
        console.log(`    - [${gap.stateCode}] ${gap.missingPlan} (missing from guide "${gap.guideId}")`)
      }
    }
    if (carveoutGaps.length > 0) {
      console.log(
        c.dim(
          `  ${carveoutGaps.length} Medicaid MCO(s) not listed separately, but the guide documents a statewide FFS carve-out that likely already covers them (verify, don't assume):`,
        ),
      )
      for (const gap of carveoutGaps) {
        console.log(c.dim(`    - [${gap.stateCode}] ${gap.missingPlan} (guide "${gap.guideId}")`))
      }
    }
  }
}

console.log('')

if (STRICT && realGaps.length > 0) {
  console.error(c.red(`FAIL: ${realGaps.length} known health plan(s) missing from a guide (--strict).`))
  process.exit(1)
}
process.exit(0)
