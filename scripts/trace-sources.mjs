#!/usr/bin/env node
// Traceability / provenance validator for src/data/formulary.json.
//
// Every line item shown on the page (a preferred agent, an alternative, a reject, a tier) is a
// claim that must trace back to a cited source. This script evaluates those claims two ways:
//
//   default (static, offline, CI gate): every record cites >=1 sourceId, all sourceIds resolve to
//     a reference with a valid http(s) URL, the tier/insurance-cost field is present, and PA reason
//     tags are well-formed. Exits non-zero on a hard provenance gap.
//
//   --live (network, drift detector): re-fetch each cited source. The source WEBSITE drifts over
//     time (URLs move, docs get re-issued) even when the underlying MATERIAL is similar, so we
//     report reachability (ok / redirected / blocked / dead) and, for HTML sources, whether the
//     cited drug names still appear in the live text (tolerant substring match — reformatting is
//     fine). PDF sources (the formularies themselves) get reachability + a content-trace stub
//     (full PDF text-tracing needs a parser; flagged, not silently skipped). Add --strict to make
//     drift fail the run.
//
// Usage:  node scripts/trace-sources.mjs [--live] [--strict] [--timeout=15000]

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA = join(HERE, '..', 'src', 'data', 'formulary.json')

const args = process.argv.slice(2)
const LIVE = args.includes('--live')
const STRICT = args.includes('--strict')
const TIMEOUT = Number((args.find((a) => a.startsWith('--timeout=')) || '').split('=')[1]) || 15000
const UA = 'FirstPassRx-source-validator/1.0 (+https://github.com/pranava0x0/FirstPassRx)'
const BARRIER_OUTCOMES = new Set(['pa', 'step', 'nonformulary'])

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
}

/** First alphabetic word of a drug name, lowercased — the token we trace in source text. */
function coreToken(name) {
  const m = String(name).match(/[A-Za-z][A-Za-z-]{2,}/)
  return m ? m[0].toLowerCase() : ''
}

function htmlToText(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

// ---- load ----
const formulary = JSON.parse(readFileSync(DATA, 'utf8'))
const problems = [] // hard provenance failures (exit 1)
const warnings = [] // soft issues (reported, never fail unless --strict for live)

// ---- static provenance: every line item traces to a resolvable cited source ----
console.log(c.bold('\n── Static provenance ──'))
let recordCount = 0
let claimCount = 0
const liveTargets = new Map() // url -> { refId, label, citedTerms:Set, records:[] }

for (const guide of formulary.guides) {
  const refs = new Map(guide.references.map((r) => [r.id, r]))
  let guideIssues = 0
  let missingTier = 0

  for (const r of guide.records) {
    recordCount++
    const at = `${guide.id} ${r.payerId}/${r.classId}`

    if (!r.sourceIds || r.sourceIds.length === 0) {
      problems.push(`${at}: no sourceIds — coverage claim has no source`)
      guideIssues++
      continue
    }
    const resolved = new Map()
    for (const id of r.sourceIds) {
      const ref = refs.get(id)
      if (!ref) {
        problems.push(`${at}: sourceId "${id}" does not resolve to a reference`)
        guideIssues++
      } else if (!/^https?:\/\//.test(ref.url)) {
        problems.push(`${at}: source "${id}" has a non-http URL (${ref.url})`)
        guideIssues++
      } else {
        resolved.set(ref.id, ref)
      }
    }

    if (!r.tier) missingTier++

    for (const pa of r.paRequired || []) {
      if (!BARRIER_OUTCOMES.has(pa.outcome))
        problems.push(`${at}: barrier "${pa.drug}" has invalid outcome "${pa.outcome}"`)
      if (/higher tier|non-preferred/i.test(pa.reason))
        problems.push(`${at}: covered/cost-sharing item "${pa.drug}" is incorrectly modeled as a barrier`)
    }

    // collect the page's line items as drugs to trace in the live source
    const preferredTerms = [r.preferredAgent.brand || r.preferredAgent.inn]
    const restrictionTerms = [
      ...(r.stepTherapy ? [r.preferredAgent.brand || r.preferredAgent.inn] : []),
      ...(r.boglActive ? [r.preferredAgent.brand || r.preferredAgent.inn] : []),
    ]
    claimCount += preferredTerms.length + (r.alternatives || []).length + restrictionTerms.length + (r.tier ? 1 : 0)

    const sourceLanes = [
      ...(r.coverageSourceIds || []).map((id) => [id, preferredTerms]),
      ...(r.alternatives || []).flatMap((alt) =>
        (alt.sourceIds || []).map((id) => [id, [alt.drug]]),
      ),
      ...(r.paRequired || []).flatMap((barrier) =>
        (barrier.sourceIds || []).map((id) => [id, [barrier.drug]]),
      ),
      ...(r.restrictionSourceIds || []).map((id) => [id, restrictionTerms]),
    ]
    if (!r.coverageSourceIds?.length) problems.push(`${at}: no claim-specific coverageSourceIds`)
    if (!r.restrictionSourceIds?.length) problems.push(`${at}: no claim-specific restrictionSourceIds`)
    for (const alt of r.alternatives || [])
      if (!alt.sourceIds?.length) problems.push(`${at}: alternative "${alt.drug}" has no sourceIds`)
    for (const barrier of r.paRequired || [])
      if (!barrier.sourceIds?.length) problems.push(`${at}: barrier "${barrier.drug}" has no sourceIds`)

    for (const [id, terms] of sourceLanes) {
      const ref = resolved.get(id)
      if (!ref) {
        problems.push(`${at}: claim-specific source "${id}" is absent from sourceIds or unresolved`)
        continue
      }
      if (!liveTargets.has(ref.url)) {
        liveTargets.set(ref.url, { refId: ref.id, label: ref.label, citedTerms: new Set(), records: [] })
      }
      const t = liveTargets.get(ref.url)
      t.records.push(at)
      for (const term of terms) t.citedTerms.add(term)
    }
  }

  if (missingTier > 0) warnings.push(`${guide.id}: ${missingTier}/${guide.records.length} cells have no insurance tier/cost`)
  const tag = guideIssues === 0 ? c.green('OK') : c.red(`${guideIssues} issue(s)`)
  console.log(`  ${guide.id.padEnd(14)} ${guide.records.length} records · ${guide.references.length} sources · ${tag}`)
}

console.log(
  c.dim(`  ${recordCount} records, ~${claimCount} line-item claims, ${liveTargets.size} distinct source URLs`),
)

// ---- live drift detector ----
async function fetchSource(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: '*/*' },
    })
    const type = res.headers.get('content-type') || ''
    let text = ''
    if (res.ok && /text\/html/i.test(type)) text = htmlToText(await res.text())
    return { status: res.status, ok: res.ok, type, finalUrl: res.url, text }
  } catch (e) {
    return { status: 0, ok: false, type: '', finalUrl: url, text: '', error: e.name === 'AbortError' ? 'timeout' : e.message }
  } finally {
    clearTimeout(timer)
  }
}

async function mapLimit(items, limit, fn) {
  const out = []
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  })
  await Promise.all(workers)
  return out
}

if (LIVE) {
  console.log(c.bold('\n── Live source trace (re-fetching cited documents) ──'))
  const urls = [...liveTargets.keys()]
  let dead = 0
  let drift = 0
  const results = await mapLimit(urls, 6, async (url) => ({ url, ...(await fetchSource(url)) }))

  for (const r of results.sort((a, b) => a.url.localeCompare(b.url))) {
    const t = liveTargets.get(r.url)
    const isPdf = /\.pdf($|\?)/i.test(r.url) || /application\/pdf/i.test(r.type)
    let label
    if (r.error) {
      label = c.red(`DEAD (${r.error})`)
      dead++
      if (STRICT) problems.push(`live: ${r.refId} unreachable (${r.error})`)
    } else if (r.status === 403 || r.status === 401) {
      label = c.yellow(`BLOCKED (${r.status} bot-protection)`)
    } else if (!r.ok) {
      label = c.red(`DEAD (HTTP ${r.status})`)
      dead++
      if (STRICT) problems.push(`live: ${r.refId} HTTP ${r.status}`)
    } else if (isPdf) {
      label = c.green('OK') + c.dim(' · PDF (reachable; content-trace needs a parser)')
    } else if (r.text) {
      // content trace: do the cited drug names still appear in the live HTML?
      const missing = [...t.citedTerms].filter((d) => coreToken(d) && !r.text.includes(coreToken(d)))
      if (missing.length === 0) {
        label = c.green('OK') + c.dim(` · ${t.citedTerms.size} claim term(s) traced`)
      } else {
        label = c.yellow(`DRIFT · ${missing.length}/${t.citedTerms.size} claim term(s) not found in live text`)
        drift++
        if (STRICT) problems.push(`live: ${r.refId} drift — not found: ${missing.map(coreToken).join(', ')}`)
      }
    } else {
      label = c.green(`OK (HTTP ${r.status})`) + c.dim(` · ${r.type.split(';')[0] || 'unknown type'}`)
    }
    const moved = r.finalUrl && r.finalUrl !== r.url ? c.yellow(' [redirected]') : ''
    console.log(`  ${label}${moved}`)
    console.log(c.dim(`     ${t.refId} — ${t.label}`))
    console.log(c.dim(`     ${r.url}${r.finalUrl !== r.url ? `  →  ${r.finalUrl}` : ''}  (${t.records.length} cell(s))`))
  }
  console.log(c.dim(`\n  ${urls.length} sources · ${dead} dead · ${drift} drifted (HTML content)`))
}

// ---- report ----
console.log(c.bold('\n── Summary ──'))
if (warnings.length) {
  console.log(c.yellow(`  ${warnings.length} warning(s):`))
  for (const w of warnings.slice(0, 30)) console.log(c.dim(`    · ${w}`))
  if (warnings.length > 30) console.log(c.dim(`    … and ${warnings.length - 30} more`))
}
if (problems.length) {
  console.log(c.red(`  ${problems.length} failure(s):`))
  for (const p of problems) console.log(`    ${c.red('✗')} ${p}`)
  console.log(c.red('\n  FAIL — line items without traceable sources.\n'))
  process.exit(1)
}
console.log(c.green('  ✓ Every line item traces to a resolvable cited source.'))
if (!LIVE) console.log(c.dim('  Run `npm run trace:live` to re-fetch sources and detect website drift.'))
console.log('')
