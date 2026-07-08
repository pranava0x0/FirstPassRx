#!/usr/bin/env node
// Archives every cited source document with provenance metadata, so we track where/when/how each
// formulary was scraped — and have a frozen copy to extract from even after the live site changes.
//
// For each reference in src/data/formulary.json (+ src/data/state-index.json) it fetches the URL,
// saves the body to sources/<id>.<ext> (committed -- not under public/ and never imported by app
// code, so Vite's build never ships these to the deployed site), and records a provenance entry
// in sources/manifest.json (also committed): url, final URL, HTTP status, content-type, byte
// size, sha256, fetch method, first-archived and last-verified timestamps. Signature-keyed: a
// re-run only bumps last_verified when the bytes are unchanged, and flags a new sha256 as drift.
//
// These are THIRD-PARTY pages, not content we author -- an embedded map/analytics/chat widget can
// carry a live API key in the raw HTML (confirmed 2026-07-07: a Mapbox token embedded in an
// Illinois HFS page reached a commit before GitHub's push protection caught it -- see issues.md
// for the incident). Every fetch is scanned for common secret patterns and redacted in place
// before it's ever written to disk, so this can't recur silently regardless of whether whoever's
// committing remembers to grep first.
//
// Usage:  node scripts/archive-sources.mjs [--timeout=30000]   (npm run archive-sources)

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stateSourceId } from './source-id.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = join(ROOT, 'sources')
const MANIFEST = join(SRC_DIR, 'manifest.json')
const args = process.argv.slice(2)
const TIMEOUT = Number((args.find((a) => a.startsWith('--timeout=')) || '').split('=')[1]) || 30000
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0 Safari/537.36 FirstPassRx-source-archiver/1.0'
const now = () => new Date().toISOString()

// ---- redact common live-secret patterns before anything touches disk ----
// Third-party pages routinely embed API keys for maps/analytics/chat widgets. These patterns
// cover the credential shapes seen in practice; extend this list rather than relying on someone
// remembering to grep before a commit (see the header comment above for the incident this fixes).
//
// Every replacement is LENGTH-PRESERVING (masked with `*`, never a fixed string like `[REDACTED]`)
// so a match inside a binary format (PDF) can't shift byte offsets and corrupt xref tables/stream
// lengths -- flagged independently by both the automated review and a human reviewer on the PR
// that introduced this script; a fixed-length replacement was the exact bug they caught.
const mask = (s) => '*'.repeat(s.length)
const SECRET_PATTERNS = [
  { name: 'Mapbox token', re: /\b(?:pk|sk)\.eyJ[A-Za-z0-9._-]{20,}/g, replacer: (match) => mask(match) },
  { name: 'Google API key', re: /\bAIzaSy[A-Za-z0-9_-]{33}\b/g, replacer: (match) => mask(match) },
  { name: 'AWS access key ID', re: /\bAKIA[0-9A-Z]{16}\b/g, replacer: (match) => mask(match) },
  { name: 'Slack token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g, replacer: (match) => mask(match) },
  {
    name: 'PEM private key',
    re: /-----BEGIN[ A-Z]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z]*PRIVATE KEY-----/g,
    replacer: (match) => mask(match),
  },
  {
    // Keeps the key name (e.g. "apiKey") and surrounding quotes/separators, masks only the value
    // itself -- character-for-character, so the assignment still looks parseable and no byte
    // length changes. Matches bare credential names (password/pass/pwd) as well as compound
    // "prefix + key/secret/token" names, and tolerates a quoted key (JSON: "apiKey": "...").
    name: 'generic key/secret/token assignment',
    re: /(["']?(?:api[_-]?key|client[_-]?secret|secret[_-]?key|access[_-]?token|password|pass|pwd)["']?)(\s*[:=]\s*["'])([A-Za-z0-9_\-.]{16,})(["'])/gi,
    replacer: (_match, keyName, sep, value, quote) => `${keyName}${sep}${mask(value)}${quote}`,
  },
]

/** Scans+redacts in a byte-exact way (latin1 round-trips 1:1, and every replacement preserves the
 * original matched length) so binary formats like PDF aren't corrupted. Returns the redacted
 * buffer and a list of {name, count} for anything found. */
function redactSecrets(buf) {
  let text = buf.toString('binary')
  const found = []
  for (const { name, re, replacer } of SECRET_PATTERNS) {
    let count = 0
    text = text.replace(re, (...args) => {
      count++
      return replacer(...args)
    })
    if (count > 0) found.push({ name, count })
  }
  return { buf: found.length ? Buffer.from(text, 'binary') : buf, found }
}

// ---- collect the sources to archive (deduped by id) ----
const formulary = JSON.parse(readFileSync(join(ROOT, 'src/data/formulary.json'), 'utf8'))
const targets = new Map() // id -> { id, label, url }
for (const g of formulary.guides) {
  for (const r of g.references) if (!targets.has(r.id)) targets.set(r.id, { id: r.id, label: r.label, url: r.url })
}
try {
  const idx = JSON.parse(readFileSync(join(ROOT, 'src/data/state-index.json'), 'utf8'))
  for (const s of idx.states)
    for (const p of s.plans) {
      const id = stateSourceId(s.code, p.formularyUrl)
      if (!targets.has(id) && p.fetchedOk) targets.set(id, { id, label: `${s.code}: ${p.name}`, url: p.formularyUrl })
    }
} catch {
  /* state-index optional */
}

if (!existsSync(SRC_DIR)) mkdirSync(SRC_DIR, { recursive: true })
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { entries: {} }

// ---- prune manifest entries for ids no longer in the current target set ----
// An id scheme change (e.g. stateSourceId() moving from a truncated-URL slice to a proper sha256
// hash) or a reference simply dropping out of formulary.json/state-index.json leaves the OLD id's
// manifest entry behind forever -- the loop below only ever adds/updates entries for ids in
// `targets`, never removes ones that fell out of it. Confirmed in review (2026-07-08): 18 such
// orphaned entries had `ok: true` with a `saved_path` pointing at a file that was never fetched
// under the current scheme, so anything trusting `ok && saved_path` would try to read a file that
// doesn't exist. Prune before archiving, not after, so a run that fails partway still leaves a
// clean manifest rather than a stale one plus a partial one.
let pruned = 0
for (const id of Object.keys(manifest.entries)) {
  if (!targets.has(id)) {
    delete manifest.entries[id]
    pruned++
  }
}
if (pruned) console.log(`  (pruned ${pruned} manifest entr${pruned === 1 ? 'y' : 'ies'} no longer in the current target set)`)

async function fetchBytes(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': UA, Accept: '*/*' } })
    const buf = Buffer.from(await res.arrayBuffer())
    return { status: res.status, ok: res.ok, type: res.headers.get('content-type') || '', finalUrl: res.url, buf }
  } catch (e) {
    return { status: 0, ok: false, type: '', finalUrl: url, buf: null, error: e.name === 'AbortError' ? 'timeout' : e.message }
  } finally {
    clearTimeout(timer)
  }
}

async function mapLimit(items, limit, fn) {
  const out = []
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++
        out[idx] = await fn(items[idx])
      }
    }),
  )
  return out
}

const items = [...targets.values()]
let saved = 0
let drifted = 0
let failed = 0

await mapLimit(items, 5, async (t) => {
  const r = await fetchBytes(t.url)
  const prev = manifest.entries[t.id]
  if (!r.ok || !r.buf) {
    failed++
    manifest.entries[t.id] = {
      ...(prev || {}),
      id: t.id,
      label: t.label,
      url: t.url,
      method: 'GET (browser UA)',
      last_attempt: now(),
      last_status: r.error || `HTTP ${r.status}`,
      ok: false,
      first_archived: prev?.first_archived,
      sha256: prev?.sha256,
      saved_path: prev?.saved_path,
    }
    console.log(`  ✗ ${t.id} — ${r.error || `HTTP ${r.status}`}`)
    return
  }
  const isPdf = /application\/pdf/i.test(r.type) || /\.pdf($|\?)/i.test(t.url)
  const ext = isPdf ? 'pdf' : /html/i.test(r.type) ? 'html' : 'bin'
  const { buf: cleanBuf, found: secretsFound } = redactSecrets(r.buf)
  if (secretsFound.length) {
    console.warn(`  ⚠ ${t.id} — redacted ${secretsFound.map((f) => `${f.count}× ${f.name}`).join(', ')}`)
  }
  const sha = createHash('sha256').update(cleanBuf).digest('hex')
  const rel = `sources/${t.id}.${ext}`
  writeFileSync(join(SRC_DIR, `${t.id}.${ext}`), cleanBuf)
  const changed = prev && prev.sha256 && prev.sha256 !== sha
  if (changed) drifted++
  manifest.entries[t.id] = {
    id: t.id,
    label: t.label,
    url: t.url,
    final_url: r.finalUrl !== t.url ? r.finalUrl : undefined,
    method: 'GET (browser UA)',
    http_status: r.status,
    content_type: r.type.split(';')[0],
    bytes: cleanBuf.length,
    sha256: sha,
    saved_path: rel,
    ok: true,
    redacted: secretsFound.length ? secretsFound : undefined,
    first_archived: prev?.first_archived || now(),
    last_verified: now(),
    drift: changed ? `sha256 changed from ${prev.sha256.slice(0, 12)}…` : undefined,
  }
  saved++
  console.log(`  ✓ ${t.id} — ${(cleanBuf.length / 1024).toFixed(0)} KB ${ext}${changed ? '  [DRIFT: content changed]' : ''}`)
})

manifest.note =
  'Provenance manifest for archived source documents. Both sources/ and this manifest are ' +
  'committed (not under public/, never imported by app code, so Vite never ships them to the ' +
  'deployed site). Regenerate with `npm run archive-sources`. sha256 is the signature for drift ' +
  'detection; first_archived/last_verified track when each was scraped. Every fetch is scanned ' +
  'for common secret patterns (API keys, tokens) before being written to disk -- an entry\'s ' +
  '"redacted" field lists what was found and stripped, if anything.'
manifest.generated_at = now()
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')

const redactedCount = Object.values(manifest.entries).filter((e) => e.redacted?.length).length
console.log(
  `\n  archived ${saved} · ${drifted} drifted · ${failed} unreachable` +
    (redactedCount ? ` · ${redactedCount} had secrets redacted` : '') +
    ` · manifest: sources/manifest.json`,
)

// ---- integrity check: every `ok` entry must have a tracked file with matching bytes/sha ----
// Catches exactly the class of bug review caught (an `ok: true` entry whose file was never
// committed, or a file that's drifted out from under a stale manifest entry) the moment it
// happens, rather than letting it surface later in an unrelated offline-extraction/drift-check run.
const integrityIssues = []
for (const [id, e] of Object.entries(manifest.entries)) {
  if (!e.ok) continue
  const path = join(ROOT, e.saved_path)
  if (!existsSync(path)) {
    integrityIssues.push(`${id}: saved_path "${e.saved_path}" does not exist on disk`)
    continue
  }
  const stat = statSync(path)
  if (stat.size !== e.bytes) {
    integrityIssues.push(`${id}: manifest says ${e.bytes} bytes, file is ${stat.size} bytes`)
    continue
  }
  const actualSha = createHash('sha256').update(readFileSync(path)).digest('hex')
  if (actualSha !== e.sha256) {
    integrityIssues.push(`${id}: manifest sha256 ${e.sha256.slice(0, 12)}… doesn't match file's ${actualSha.slice(0, 12)}…`)
  }
}
if (integrityIssues.length) {
  console.error(`\n  ⚠ manifest integrity check found ${integrityIssues.length} issue(s):`)
  for (const issue of integrityIssues) console.error(`    - ${issue}`)
  process.exitCode = 1
} else {
  console.log(`  ✓ manifest integrity check: every "ok" entry has a matching file with matching bytes/sha256`)
}
