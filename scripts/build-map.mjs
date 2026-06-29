#!/usr/bin/env node
// Generates docs/formulary-map.md — the auditable state → plan → PBM → formulary index.
// MA and MD come from src/data/formulary.json (full drug-level data in the app); NY, VA, DC come
// from src/data/state-index.json (formulary links only, drug-level pending). Run: npm run build:map.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const formulary = JSON.parse(readFileSync(join(ROOT, 'src/data/formulary.json'), 'utf8'))
const stateIndex = JSON.parse(readFileSync(join(ROOT, 'src/data/state-index.json'), 'utf8'))

const cell = (s) => String(s ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim()

/** Best-effort plan category for the MA/MD payers (which carry no explicit kind). */
function kindOf(name, aka = '') {
  const t = `${name} ${aka}`.toLowerCase()
  if (/medicare|part d/.test(t)) return 'Medicare'
  if (/priority partners|healthchoice|community plan|better health|amerigroup|wellpoint|family choice/.test(t))
    return 'Medicaid MCO'
  if (/medicaid|masshealth|medical assistance/.test(t)) return 'Medicaid'
  return 'Commercial'
}

const STATE_OF = { 'ma-inhalers': ['MA', 'Massachusetts'], 'md-menopause': ['MD', 'Maryland'] }

const out = []
out.push('# FirstPassRx — state · plan · PBM · formulary map\n')
out.push(
  '> Auditable index of where each plan publishes its drug coverage. Every formulary links to its\n' +
    '> source. **Generated** from `src/data/formulary.json` (MA, MD — full drug-level data in the app)\n' +
    `> and \`src/data/state-index.json\` (NY, VA, DC — formulary links, drug-level data pending).\n` +
    '> Do not edit by hand — run `npm run build:map`. Verify links with `npm run trace:live`.\n' +
    `> Captured ${cell(stateIndex.capturedAt)}. Scope: ${cell(stateIndex.scope)}.\n`,
)

// coverage-status summary
out.push('## Coverage status\n')
out.push('| State | In app | Plans listed |')
out.push('| --- | --- | --- |')
for (const g of formulary.guides) {
  const [code, name] = STATE_OF[g.id] ?? [g.id, g.id]
  out.push(`| ${cell(name)} (${code}) | ${cell(g.topic)} — drug-level | ${g.payers.length} |`)
}
for (const s of stateIndex.states) {
  out.push(`| ${cell(s.name)} (${s.code}) | index only | ${s.plans.length} |`)
}
out.push('')

// MA / MD — generated from the app data, with the cited source per plan
for (const g of formulary.guides) {
  const [code, name] = STATE_OF[g.id] ?? [g.id, g.id]
  const refs = new Map(g.references.map((r) => [r.id, r]))
  out.push(`## ${name} (${code}) — ${cell(g.topic)} · in app\n`)
  out.push('| Plan | Type | PBM | Published formulary (as of) |')
  out.push('| --- | --- | --- | --- |')
  for (const p of g.payers) {
    const ref = refs.get(p.sourceIds?.[0])
    const link = ref
      ? `[${cell(ref.label)}](${ref.url})${ref.effectiveDate ? ` — eff. ${cell(ref.effectiveDate)}` : ''}`
      : p.formularyUrl
        ? `[formulary](${p.formularyUrl})`
        : '—'
    out.push(`| ${cell(p.name)} | ${kindOf(p.name, p.aka)} | ${cell(p.pbm)} | ${link} |`)
  }
  out.push('')
}

// NY / VA / DC — index only
for (const s of stateIndex.states) {
  out.push(`## ${s.name} (${s.code}) — index only\n`)
  if (s.note) out.push(`> ${cell(s.note)}\n`)
  out.push('| Plan | Type | PBM | Published formulary |')
  out.push('| --- | --- | --- | --- |')
  for (const p of s.plans) {
    const flag = p.fetchedOk ? '' : ' ⚠️ (landing page only — drug list not directly reachable)'
    const link = `[${cell(p.formularyLabel || 'formulary')}](${p.formularyUrl})${p.effectiveDate ? ` — eff. ${cell(p.effectiveDate)}` : ''}${flag}`
    out.push(`| ${cell(p.name)} | ${cell(p.kind)} | ${cell(p.pbm)} | ${link} |`)
  }
  out.push('')
}

out.push('---\n')
out.push(
  'Auditability: each MA/MD row cites the exact formulary document the app read (with its effective\n' +
    'date); each NY/VA/DC row links the live formulary/PDL the index agent fetched. `npm run trace:live`\n' +
    're-fetches every cited source and flags any that moved or 404d.\n',
)

writeFileSync(join(ROOT, 'docs/formulary-map.md'), out.join('\n'))
const planTotal =
  formulary.guides.reduce((n, g) => n + g.payers.length, 0) +
  stateIndex.states.reduce((n, s) => n + s.plans.length, 0)
console.log(
  `docs/formulary-map.md — ${formulary.guides.length} in-app states + ${stateIndex.states.length} index states, ${planTotal} plans`,
)
