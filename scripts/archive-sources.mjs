#!/usr/bin/env node
// Archives every cited source document with provenance metadata, so we track where/when/how each
// formulary was scraped — and have a frozen copy to extract from even after the live site changes.
//
// For each reference in src/data/formulary.json (+ src/data/state-index.json) it fetches the URL,
// saves the body to sources/<id>.<ext> (gitignored — binaries don't belong in git), and records a
// provenance entry in sources/manifest.json (committed): url, final URL, HTTP status, content-type,
// byte size, sha256, fetch method, first-archived and last-verified timestamps. Signature-keyed: a
// re-run only bumps last_verified when the bytes are unchanged, and flags a new sha256 as drift.
//
// Usage:  node scripts/archive-sources.mjs [--timeout=30000]   (npm run archive-sources)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
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
  const sha = createHash('sha256').update(r.buf).digest('hex')
  const rel = `sources/${t.id}.${ext}`
  writeFileSync(join(SRC_DIR, `${t.id}.${ext}`), r.buf)
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
    bytes: r.buf.length,
    sha256: sha,
    saved_path: rel,
    ok: true,
    first_archived: prev?.first_archived || now(),
    last_verified: now(),
    drift: changed ? `sha256 changed from ${prev.sha256.slice(0, 12)}…` : undefined,
  }
  saved++
  console.log(`  ✓ ${t.id} — ${(r.buf.length / 1024).toFixed(0)} KB ${ext}${changed ? '  [DRIFT: content changed]' : ''}`)
})

manifest.note =
  'Provenance manifest for archived source documents. Binaries live in sources/ (gitignored); this ' +
  'manifest is committed. Regenerate with `npm run archive-sources`. sha256 is the signature for ' +
  'drift detection; first_archived/last_verified track when each was scraped.'
manifest.generated_at = now()
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')

console.log(`\n  archived ${saved} · ${drifted} drifted · ${failed} unreachable · manifest: sources/manifest.json`)
