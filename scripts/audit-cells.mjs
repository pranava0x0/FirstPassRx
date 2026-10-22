#!/usr/bin/env node
// Deterministic cell audit: re-check every record's preferred agent, paRequired items and
// alternatives against the rows extracted from its cited source documents (scripts/source_rows.py),
// so LLM agents only review checks this tool flags. See docs/data-audit.md.
//
//   node scripts/audit-cells.mjs --state=MA [--guides=ma-lipids,ma-ace] [--out=dir] [--strict] [--no-extract]
//
// Statuses: OK, NOT_FOUND, FLAG_MISMATCH, AGE_QUALIFIED, AMBIGUOUS, plus SKIPPED (no extractable source
// or non-specific drug text) so skipped coverage is visible rather than silently "clean".
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ROWS_DIR = join(ROOT, 'data-gathering/rows')

// ---------------------------------------------------------------- args
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/)
    return m ? [m[1], m[2] ?? true] : [a, true]
  }),
)
const state = String(args.state ?? 'MA').toUpperCase()
const today = new Date().toISOString().slice(0, 10)
const outDir = resolve(ROOT, String(args.out ?? `data-gathering/audit-${state.toLowerCase()}-${today}`))
const wantGuides = args.guides ? String(args.guides).split(',') : null

// ---------------------------------------------------------------- name normalization
const SALTS = new Set(
  ('calcium sodium potassium hcl hydrochloride hydrobromide besylate maleate fumarate tartrate succinate mesylate ' +
    'phosphate phos sulfate bromide acetate citrate magnesium dihydrate monohydrate anhydrous hemihydrate mal sod ' +
    'chloride nacl hbr hydrobrom').split(' '),
)
const NOISE = new Set(
  ('tablet tablets tab tabs capsule capsules cap caps oral solution soln solr sol susp suspension susr sus injection ' +
    'injectable inj cream crea gel patch patches kit pen pens prefilled syringe syringes sosy soct soaj suer mis ' +
    'autoinjector injector auto vial inhaler inhalation aerosol aer powder spray nasal topical external transdermal ' +
    'subcutaneous intravenous intramuscular ophthalmic ophth vaginal rectal film chewable sprinkle packet pack pak ' +
    'hfa mdi dpi diskus ellipta respimat generic generics brand branded preferred non nonpreferred only any all other ' +
    'the of with for plain combination combo product products agent agents formulation formulations immediate ir ' +
    'tier pa no covered mg mcg ml gm g unit units iu meq hr hour hours day days dose doses act ut mm l w in or and ' +
    'a an per lanc lancets lance oint ointment liq liquid lotion lotn sub sublingual buccal reconstituted needle ' +
    'tb tbdp tbec tbcr tb12 cp cpep cpdr sopn thin starter x d').split(' '),
)
// Dosage-form classes. Forms never enter the name core, but two names with disjoint known forms
// ("estradiol patch" vs "estradiol vaginal cream") must not match.
const FORM_MAP = {}
for (const [cls, words] of Object.entries({
  tablet: 'tablet tablets tab tabs tbec tbcr tb12 tbdp chewable',
  capsule: 'capsule capsules cap caps cp cpep cpdr sprinkle',
  liquid: 'solution soln solr sol suspension susp susr sus liquid liq syrup concentrate elixir',
  inject: 'injection injectable inj syringe syringes sosy soct soaj suer pen pens autoinjector injector vial cartridge cartridges prefilled intravenous subcutaneous intramuscular sopn',
  patch: 'patch patches',
  oral: 'oral',
  topical: 'cream crea gel ointment oint lotion lotn foam topical external shampoo',
  vaginal: 'vaginal insert',
  inhal: 'inhaler inhalation aerosol aer hfa mdi dpi diskus ellipta respimat',
  eye: 'ophthalmic ophth',
  nasal: 'nasal',
})) for (const w of words.split(' ')) FORM_MAP[w] = cls
const MOD_MAP = { er: 'er', xr: 'er', xl: 'er', cr: 'er', sr: 'er', la: 'er', dr: 'dr', ec: 'dr', odt: 'odt', rdt: 'odt' }

function normText(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/\b(?:df|tdf)\b/g, ' disoproxil ')
    .replace(/immediate[\s-]*release/g, ' ir ')
    .replace(/extended[\s-]*release|ext[\s-]*rel|extended[\s-]*rel/g, ' er ')
    .replace(/delayed[\s-]*release|delayed[\s-]*rel/g, ' dr ')
    .replace(/sustained[\s-]*release/g, ' er ')
    .replace(/orally[\s-]*disintegrating|dissolving|disintegrating/g, ' odt ')
    .replace(/[\u2010-\u2015]/g, '-')
}

/** { core:Set<string>, mods:Set<string> } for one drug name fragment. */
function nameKey(text) {
  const core = new Set()
  const mods = new Set()
  const forms = new Set()
  for (let tok of normText(text).split(/[^a-z0-9.]+/)) {
    tok = tok.replace(/^\.+|\.+$/g, '')
    if (!tok || /\d/.test(tok)) continue
    if (MOD_MAP[tok]) {
      mods.add(MOD_MAP[tok])
      continue
    }
    if (FORM_MAP[tok]) forms.add(FORM_MAP[tok])
    if (NOISE.has(tok) || FORM_MAP[tok] || SALTS.has(tok)) continue
    if (tok.length > 4 && tok.endsWith('s') && !tok.endsWith('ss')) tok = tok.slice(0, -1)
    if (tok.length < 2) continue
    core.add(tok)
  }
  return { core, mods, forms }
}

function numberTokens(text) {
  const out = new Set()
  for (const m of String(text ?? '').matchAll(/\d+(?:\.\d+)?/g)) out.add(m[0])
  return [...out]
}

const NONSPECIFIC_RE = /\b(all other|any other|other (?:brand|generic|agents?)|remaining|all (?:brand|generic|inhaled|oral|other)|class[- ]wide|any (?:brand|generic))\b/i

/**
 * Split a record drug string into targets. Base segments (outside parentheses, split on and/or/;/,/+)
 * are primary; parenthetical segments are fallback aliases used only when no primary segment matches
 * ("Lipitor (brand atorvastatin)": try lipitor, then atorvastatin; "(generic Crestor)" never overrides generic rosuvastatin).
 */
function parseTargets(text) {
  const t = String(text ?? '')
  const parens = [...t.matchAll(/\(([^)]*)\)/g)].map((m) => m[1])
  const base = t.replace(/\([^)]*\)/g, ' ')
  const split = (s) =>
    s
      .split(/\s+(?:and|or|plus)\s+|\s*[;,+]\s*|\s+\/\s+/i)
      .map((x) => x.trim())
      .filter(Boolean)
  const build = (segs) => {
    const out = []
    let prevCore = null
    for (const seg of segs) {
      const k = nameKey(seg)
      if (!k.core.size && k.mods.size && prevCore) {
        out.push({ label: seg, core: prevCore, mods: k.mods, forms: k.forms })
        continue
      }
      if (!k.core.size) continue
      prevCore = k.core
      out.push({ label: seg, core: k.core, mods: k.mods, forms: k.forms })
    }
    return out
  }
  const primary = build(split(base))
  // pure descriptors in parentheses ("(extended-release XL)", "(SR)", "(generic, IR capsule)") describe the primary drug
  for (const p of parens.flatMap((x) => split(x))) {
    const k = nameKey(p)
    if (k.core.size) continue
    for (const t of primary) {
      if (!t.mods.size) k.mods.forEach((m) => t.mods.add(m))
      if (!t.forms.size) k.forms.forEach((m) => t.forms.add(m))
    }
  }
  // "emtricitabine and tenofovir DF" is one combination product, not two drugs: try the union first
  let combined = null
  if (primary.length > 1) {
    const core = new Set(primary.flatMap((x) => [...x.core]))
    if (core.size >= 2)
      combined = {
        label: base.trim(),
        core,
        mods: new Set(primary.flatMap((x) => [...x.mods])),
        forms: new Set(primary.flatMap((x) => [...x.forms])),
      }
  }
  return { primary, combined, fallback: build(parens.flatMap((p) => split(p))), nums: numberTokens(t) }
}

// ---------------------------------------------------------------- row facts
const AGE_RE = /\bage\b|\byears?\b|\byrs?\b|younger|older|pediatric|children|adolescent|<\s*\d+|\d+\s*\+|members? \d+/i
const QTY_RE = /units?\s*\/\s*day|units?\s*per|quantit|per\s+day|\/\s*day|>\s*\d|\bup to\b|\bQL\b|limit/i

function segmentsOf(notes) {
  return String(notes ?? '')
    .split(/;|,(?![^(]*\))/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Normalize one extracted row into facts the claims are checked against. */
function rowFacts(row) {
  const flags = new Set(row.flags ?? [])
  let paText = ''
  if ('pa' in row) paText = row.pa ?? '' // MassHealth: PA status cell
  else {
    const seg = segmentsOf(row.notes).find((s) => /^PA\b/.test(s) && s.length > 3)
    if (seg) paText = seg
    else if (flags.has('PA')) paText = 'PA'
  }
  const hasPa = flags.has('PA') || /^\s*PA\b/.test(paText)
  const rest = paText.replace(/^\s*PA\b/, '').replace(/^[\s:\-,]+/, '')
  const conditional = hasPa && rest.length > 0
  const ageCond = conditional && AGE_RE.test(rest)
  const qtyCond = conditional && !ageCond && QTY_RE.test(rest)
  const ageLimit = flags.has('AL')
  const step = flags.has('ST')
  // MassHealth '#' = "A-rated generic payable; Brand requires PA" (title text is lost in the extract)
  const brandPaMarker = 'pa' in row && /(^|[\s,])#(\s|,|$)/.test(row.notes ?? '')
  const numericTier = /^[1-6]$/.test(String(row.tier ?? '')) ? String(row.tier) : null
  return {
    hasPa,
    conditional,
    ageCond,
    qtyCond,
    otherCond: conditional && !ageCond && !qtyCond,
    ageLimit,
    step,
    brandPaMarker,
    tier: numericTier,
    paText,
  }
}

// ---------------------------------------------------------------- source rows
function ensureRows(urls) {
  const indexPath = join(ROWS_DIR, 'index.json')
  const have = () => (existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : {})
  // Always call the extractor: cached bytes/rows make it cheap, and it re-extracts when the script changed.
  const missing = urls
  if (missing.length && !args['no-extract']) {
    console.log(`checking ${missing.length} source(s) via scripts/source_rows.py (cached ones are reused)`)
    for (let i = 0; i < missing.length; i += 8) {
      const r = spawnSync('python3', [join(ROOT, 'scripts/source_rows.py'), ...missing.slice(i, i + 8)], {
        cwd: ROOT,
        stdio: ['ignore', 'inherit', 'inherit'],
      })
      if (r.error) console.error(`source_rows.py failed to start: ${r.error.message}`)
    }
  }
  return have()
}

const sourceCache = new Map()
/** Load a source's rows and build a token index; returns null when none were extracted. */
function loadSource(url, index) {
  if (sourceCache.has(url)) return sourceCache.get(url)
  let src = null
  const e = index[url]
  const f = e && join(ROWS_DIR, `${e.sha256}.json`)
  if (f && existsSync(f)) {
    const d = JSON.parse(readFileSync(f, 'utf8'))
    if (d.rows?.length) {
      const rows = d.rows.map((r, i) => {
        const names = []
        for (const n of [r.drug, r.brand, r.reference]) {
          if (!n) continue
          names.push(n)
          // "Seroquel (quetiapine)" and "Abilify (aripiprazole tablet)": brand and generic are both names
          for (const m of String(n).matchAll(/\(([^)]*)\)/g)) names.push(m[1])
          const bare = String(n).replace(/\([^)]*\)/g, ' ')
          if (bare !== n) names.push(bare)
        }
        return { i, row: r, keys: names.map(nameKey).filter((k) => k.core.size), facts: rowFacts(r) }
      })
      const tokIndex = new Map()
      for (const r of rows)
        for (const k of r.keys)
          for (const t of k.core) {
            if (!tokIndex.has(t)) tokIndex.set(t, new Set())
            tokIndex.get(t).add(r.i)
          }
      src = { url, layout: d.layout, rows, tokIndex }
    }
  }
  sourceCache.set(url, src)
  return src
}

const expandOral = (f) => (f.size === 1 && f.has('oral') ? new Set([...f, 'tablet', 'capsule', 'liquid']) : f)
const formsCompatible = (a, b) => {
  if (!a.size || !b.size) return true
  const [x, y] = [expandOral(a), expandOral(b)]
  return [...x].some((f) => y.has(f)) && x.has('vaginal') === y.has('vaginal')
}
const eqSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x))
const subSet = (a, b) => [...a].every((x) => b.has(x))

/** Rows of one source matching a target: tier 'exact' (same core+mods), 'form' (core same, mods differ), 'partial' (row has extra words). */
function matchTarget(src, target) {
  const toks = [...target.core]
  const rare = toks.reduce((best, t) => {
    const n = src.tokIndex.get(t)?.size ?? 0
    return best === null || n < best.n ? { t, n } : best
  }, null)
  const cand = rare && rare.n ? [...src.tokIndex.get(rare.t)] : []
  const exact = []
  const form = []
  const partial = []
  for (const i of cand) {
    const r = src.rows[i]
    let best = 0
    for (const k of r.keys) {
      if (!formsCompatible(target.forms, k.forms)) continue
      if (eqSet(k.core, target.core)) best = Math.max(best, eqSet(k.mods, target.mods) ? 3 : 2)
      else if (subSet(target.core, k.core) && k.core.size - target.core.size <= 3) best = Math.max(best, 1)
    }
    if (best === 3) exact.push(r)
    else if (best === 2) form.push(r)
    else if (best === 1) partial.push(r)
  }
  return { exact, form, partial }
}

/** Keep the rows that best fit the strengths named in the item (max number of strength tokens present). */
function narrowByStrength(rows, nums) {
  if (!nums.length) return rows
  const score = (r) => {
    const text = `${r.row.drug} ${r.row.reference ?? ''}`
    return nums.filter((n) => new RegExp(`(?<![\\d.])${n.replace('.', '\\.')}(?![\\d]|\\.\\d)`).test(text)).length
  }
  const scored = rows.map((r) => [r, score(r)])
  const best = Math.max(...scored.map((x) => x[1]))
  if (best) return scored.filter((x) => x[1] === best).map((x) => x[0])
  // named strengths appear in no row: the rows are other strengths, so a verdict on them is only a hint
  const strengthMiss = rows.some((r) => /\d\s*(mg|mcg|%|unit|gm)/i.test(r.row.drug))
  const out = [...rows]
  out.strengthMiss = strengthMiss
  return out
}

/** With no form named in the item, prefer oral solids when the matches mix solids with solutions/injectables. */
function preferSolids(rows, targetForms) {
  if (targetForms.size || rows.length < 2) return rows
  const solid = rows.filter((r) => r.keys.some((k) => k.forms.has('tablet') || k.forms.has('capsule')))
  return solid.length ? solid : rows
}

// ---------------------------------------------------------------- claim evaluation
const saysAge = (txt) => AGE_RE.test(txt)
const saysQty = (txt) => QTY_RE.test(txt)
// Keep only clauses about the drug itself: drop clauses about the brand ('#' = brand requires PA) and
// negated mentions ("no tier, PA or ST flag", "without PA"), then ask whether PA/step is still claimed.
function affirmative(txt) {
  return String(txt ?? '')
    .split(/[;.]/)
    .filter((c) => !/\bbrand\b|["'#]#["']|["']#["']|\bblank\b/i.test(c))
    .join('; ')
    .replace(
      /\b(no|not|without)\b(?:[\s,/]+[\w'"#$%-]+){0,5}?[\s,/]+(?:PA|ST|prior auth\w*|step therapy|authorization)\b(?:\s*(?:,|or|and|\/)\s*(?:PA|ST|step therapy|prior auth\w*|authorization|QL|flag))*/gi,
      ' ',
    )
}
const claimsPaIn = (txt) => /\b(PA|prior auth\w*|authorization|criteria|exception)\b/i.test(affirmative(txt))
const claimsStepIn = (txt) => /\bstep\b|\bST\b/i.test(affirmative(txt))

/** claim: {expect:'covered-nopa'|'pa'|'step'|'absent', text, tier?} → {status, reason} for one matched row. */
function evalRow(claim, r, ctx = {}) {
  const f = r.facts
  const txt = claim.text
  if (claim.expect === 'absent') return { status: 'FLAG_MISMATCH', reason: 'record says not on list, but a source row lists it' }
  if (claim.expect === 'pa' || claim.expect === 'step') {
    if (!f.hasPa && !f.step && ctx.brandish && f.brandPaMarker) return { status: 'OK', reason: "brand requires PA ('#': A-rated generic payable)" }
    if (!f.hasPa && !f.step) return { status: 'FLAG_MISMATCH', reason: `record says ${claim.expect === 'pa' ? 'PA' : 'step therapy'}; source row shows no PA/ST` }
    if (f.ageCond && !saysAge(txt)) return { status: 'AGE_QUALIFIED', reason: `source PA is age-limited ("${f.paText.slice(0, 90)}") but record states PA without an age` }
    if (f.qtyCond && !saysQty(txt)) return { status: 'AMBIGUOUS', reason: `source PA is quantity-conditional ("${f.paText.slice(0, 90)}")` }
    return { status: 'OK', reason: 'restriction present in source' }
  }
  // covered, no PA claimed
  if (claim.tier && f.tier && claim.tier !== f.tier) return { status: 'FLAG_MISMATCH', reason: `record tier ${claim.tier}; source tier ${f.tier}` }
  if (f.hasPa && !f.conditional) return { status: 'FLAG_MISMATCH', reason: 'record says no PA; source row has PA' }
  if (f.ageCond) return saysAge(txt) ? { status: 'OK', reason: 'age-limited PA acknowledged' } : { status: 'AGE_QUALIFIED', reason: `source PA is age-limited ("${f.paText.slice(0, 90)}"); record silent on age` }
  if (f.qtyCond) return saysQty(txt) ? { status: 'OK', reason: 'quantity-conditional PA acknowledged' } : { status: 'AMBIGUOUS', reason: `source PA is quantity-conditional ("${f.paText.slice(0, 90)}"); record silent` }
  if (f.otherCond) return { status: 'AMBIGUOUS', reason: `source PA has a condition ("${f.paText.slice(0, 90)}")` }
  if (f.ageLimit && !saysAge(txt)) return { status: 'AGE_QUALIFIED', reason: 'source row has an age limit (AL); record silent on age' }
  if (f.step && !claimsStepIn(txt)) return { status: 'FLAG_MISMATCH', reason: 'record says no step therapy; source row has ST' }
  return { status: 'OK', reason: 'consistent with source row' }
}

const RANK = { FLAG_MISMATCH: 5, AMBIGUOUS: 4, AGE_QUALIFIED: 3, NOT_FOUND: 2, OK: 1, ACCEPTED: 1, SKIPPED: 0 }

// Reviewed false positives (scripts/data/audit-accepted.json). Keyed on the check AND every matched
// source row's raw text, so a change to any matched row re-flags the check automatically.
const ACCEPTED_FILE = resolve(ROOT, 'scripts/data/audit-accepted.json')
const acceptedList = existsSync(ACCEPTED_FILE) ? JSON.parse(readFileSync(ACCEPTED_FILE, 'utf8')) : []
const acceptKey = (c) => [c.guide, c.payer, c.class, c.kind, c.drug, c.status, c.raw ?? ''].join('|')
const accepted = new Set(acceptedList.map(acceptKey))
const worst = (statuses) => statuses.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'SKIPPED')

function slimRow(r, src) {
  const x = r.row
  return {
    source: src.url,
    layout: src.layout,
    page: x.page ?? null,
    table: x.table ?? null,
    tier: x.tier ?? null,
    flags: x.flags ?? [],
    raw: x.raw,
  }
}

/** Run one claim against every extractable source for the item. */
function runCheck({ kind, drug, claim, urls, index }) {
  const check = { kind, drug, claim: claim.expect, sources: urls, status: 'SKIPPED', reason: '', matched: [], fingerprint: [], targets: [] }
  if (NONSPECIFIC_RE.test(drug)) return { ...check, reason: 'non-specific drug text (class/other)' }
  const sources = urls.map((u) => loadSource(u, index)).filter(Boolean)
  if (!sources.length) return { ...check, reason: 'no extractable source rows (unsupported layout or fetch failed)' }
  const { primary: splitPrimary, combined, fallback, nums } = parseTargets(drug)
  let primary = splitPrimary
  const brandish = /\bbrand\b/i.test(drug) && !/\bgeneric\b/i.test(drug)
  if (!primary.length && !fallback.length) return { ...check, reason: 'no drug name parsed' }

  const evalTargets = (targets, via) => {
    const results = []
    for (const target of targets) {
      let rows = []
      let conf = 'high'
      let tier = null
      let miss = false
      for (const src of sources) {
        const m = matchTarget(src, target)
        const pick = m.exact.length ? ['exact', m.exact] : m.form.length ? ['form', m.form] : m.partial.length ? ['partial', m.partial] : null
        if (pick) {
          const narrowed = narrowByStrength(preferSolids(pick[1], target.forms), nums)
          if (narrowed.strengthMiss) miss = true
          rows.push(...narrowed.map((r) => ({ r, src })))
          if (!tier || ['exact', 'form', 'partial'].indexOf(pick[0]) < ['exact', 'form', 'partial'].indexOf(tier)) tier = pick[0]
        }
      }
      conf = tier === 'exact' && !miss && !(via === 'alias' && brandish) ? 'high' : 'low'
      const seen = new Set()
      rows = rows.filter(({ r, src }) => !seen.has(src.url + r.i) && seen.add(src.url + r.i))
      results.push({ target, rows, conf, tier, via })
    }
    return results
  }

  if (combined) {
    const c = evalTargets([combined], 'primary')
    if (c[0].tier === 'exact') primary = [combined]
  }
  let results = evalTargets(primary, 'primary')
  const found = results.filter((x) => x.rows.length)
  if (!found.length && fallback.length) results = results.concat(evalTargets(fallback, 'alias'))
  const foundAll = results.filter((x) => x.rows.length)
  check.targets = results.map((x) => ({ name: x.target.label, via: x.via, match: x.tier ?? 'none', rows: x.rows.length }))

  if (claim.expect === 'absent' && brandish && foundAll.every((x) => x.via === 'alias')) {
    return { ...check, status: 'OK', reason: 'brand name absent from source rows (only the generic is listed), as the record claims' }
  }
  if (!foundAll.length) {
    if (claim.expect === 'absent') return { ...check, status: 'OK', reason: 'absent from source rows, as the record claims (absence can also be an extraction miss)' }
    return { ...check, status: 'NOT_FOUND', reason: 'no source row matches this drug name' }
  }

  const perTarget = []
  for (const res of foundAll) {
    const verdicts = res.rows.map(({ r, src }) => ({ ...evalRow(claim, r, { brandish }), row: slimRow(r, src) }))
    const uniq = new Set(verdicts.map((v) => v.status))
    let status = uniq.size === 1 ? [...uniq][0] : 'AMBIGUOUS'
    let reason = uniq.size === 1 ? verdicts[0].reason : `source rows disagree: ${[...uniq].join(' vs ')}`
    if (res.conf === 'low' && status !== 'OK') {
      reason = `(low-confidence ${res.tier} name/strength match) ${reason}`
      status = 'AMBIGUOUS'
    }
    perTarget.push({ status, reason, verdicts, via: res.via, name: res.target.label })
    check.matched.push(...verdicts.slice(0, 6).map((v) => ({ target: res.target.label, verdict: v.status, ...v.row })))
    // The report shows at most 6 rows per target, but acceptance fingerprints every matched row.
    check.fingerprint.push(...verdicts.map((v) => v.row.raw))
  }
  check.status = worst(perTarget.map((p) => p.status))
  const top = perTarget.find((p) => p.status === check.status)
  check.reason = top.reason
  const notFound = results.filter((x) => !x.rows.length && x.via === 'primary')
  if (notFound.length && check.status === 'OK') check.reason += ` (partial: no row for ${notFound.map((x) => x.target.label).join(', ')})`
  if (claim.expect === 'absent' && check.status === 'FLAG_MISMATCH') check.reason = 'record says not on list, but a source row lists it'
  return check
}

// ---------------------------------------------------------------- build checks
const formulary = JSON.parse(readFileSync(join(ROOT, 'src/data/formulary.json'), 'utf8'))
const prefix = `${state.toLowerCase()}-`
const guides = formulary.guides.filter((g) => (wantGuides ? wantGuides.includes(g.id) : g.id.startsWith(prefix)))
if (!guides.length) {
  console.error(`no guides for state ${state}`)
  process.exit(2)
}

const allUrls = new Set()
for (const g of guides) for (const r of g.references) allUrls.add(r.url)
const index = ensureRows([...allUrls])

const cells = []
for (const g of guides) {
  const refUrl = Object.fromEntries(g.references.map((r) => [r.id, r.url]))
  const urlsFor = (ids) => [...new Set((ids ?? []).map((id) => refUrl[id]).filter(Boolean))]
  for (const rec of g.records) {
    const checks = []
    const recSources = urlsFor([...(rec.coverageSourceIds ?? []), ...(rec.restrictionSourceIds ?? [])])
    const pa = rec.preferredAgent
    const prefText = `${rec.preferredRestriction ?? ''} ${rec.tier ?? ''} ${rec.boglNote ?? ''} ${rec.stepTherapy ?? ''}`
    const prefNeedsPa = rec.noCoveredAgent
      ? false
      : rec.preferredPaRequired !== undefined
        ? rec.preferredPaRequired
        : Boolean(rec.preferredCriteria?.length) || claimsPaIn(rec.preferredRestriction) || claimsStepIn(rec.preferredRestriction)
    const tierMatch = /\bTier\s*(\d)\b/i.exec(rec.tier ?? '')
    // brand-first when a brand is prescribed, else generic; the other name is the alias
    const prefDrug = pa.brand ? `${pa.brand} (${pa.inn})` : pa.inn
    checks.push(
      runCheck({
        kind: 'preferred',
        drug: `${prefDrug} ${pa.strength ?? ''}`.trim(),
        claim: {
          expect: rec.noCoveredAgent ? 'absent' : prefNeedsPa ? (claimsStepIn(rec.preferredRestriction) && !claimsPaIn(rec.preferredRestriction) ? 'step' : 'pa') : 'covered-nopa',
          text: prefText,
          tier: tierMatch ? tierMatch[1] : null,
        },
        urls: recSources,
        index,
      }),
    )
    for (const it of rec.paRequired ?? []) {
      const urls = urlsFor(it.sourceIds).length ? urlsFor(it.sourceIds) : recSources
      checks.push(
        runCheck({
          kind: 'paRequired',
          drug: it.drug,
          claim: { expect: it.outcome === 'nonformulary' ? 'absent' : it.outcome, text: `${it.reason} ${(it.criteria ?? []).join(' ')}` },
          urls,
          index,
        }),
      )
    }
    for (const it of rec.alternatives ?? []) {
      const urls = urlsFor(it.sourceIds).length ? urlsFor(it.sourceIds) : recSources
      const note = it.note ?? ''
      checks.push(
        runCheck({
          kind: 'alternative',
          drug: it.drug,
          claim: { expect: claimsPaIn(note) ? 'pa' : 'covered-nopa', text: note },
          urls,
          index,
        }),
      )
    }
    for (const c of checks) {
      if (c.status === 'OK' || c.status === 'SKIPPED') continue
      const key = acceptKey({ guide: g.id, payer: rec.payerId, class: rec.classId, kind: c.kind, drug: c.drug, status: c.status, raw: (c.fingerprint ?? []).join(' || ') })
      if (accepted.has(key)) Object.assign(c, { status: 'ACCEPTED', reason: `reviewed false positive (${c.status}): ${c.reason}` })
    }
    cells.push({
      guide: g.id,
      payer: rec.payerId,
      class: rec.classId,
      verification: rec.verification,
      status: worst(checks.map((c) => c.status)),
      checks,
    })
  }
}

// ---------------------------------------------------------------- summary
const STATUSES = ['OK', 'ACCEPTED', 'NOT_FOUND', 'FLAG_MISMATCH', 'AGE_QUALIFIED', 'AMBIGUOUS', 'SKIPPED']
const tally = (key) => {
  const m = new Map()
  for (const c of cells)
    for (const ch of c.checks) {
      const k = key(c, ch)
      if (!m.has(k)) m.set(k, Object.fromEntries(STATUSES.map((s) => [s, 0])))
      m.get(k)[ch.status]++
    }
  return m
}
const table = (m, label) => {
  const rows = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const total = (o) => STATUSES.reduce((n, s) => n + o[s], 0)
  return [
    `| ${label} | checks | ${STATUSES.join(' | ')} |`,
    `|---|---:|${STATUSES.map(() => '---:').join('|')}|`,
    ...rows.map(([k, o]) => `| ${k} | ${total(o)} | ${STATUSES.map((s) => o[s]).join(' | ')} |`),
  ].join('\n')
}

const overall = tally(() => 'ALL').get('ALL')
const flagged = cells
  .map((c) => ({
    c,
    score: c.checks.filter((x) => x.status === 'FLAG_MISMATCH').length * 100 + c.checks.filter((x) => x.status === 'AGE_QUALIFIED').length * 10 + c.checks.filter((x) => x.status === 'AMBIGUOUS').length,
  }))
  .filter((x) => x.score > 0)
  .sort((a, b) => b.score - a.score)

const unextractable = new Map()
for (const c of cells)
  for (const ch of c.checks)
    if (ch.status === 'SKIPPED' && ch.reason.startsWith('no extractable'))
      for (const u of ch.sources) if (!loadSource(u, index)) unextractable.set(u, (unextractable.get(u) ?? 0) + 1)

const lines = []
lines.push(`# Cell audit: ${state} (${today})`, '')
lines.push(`${cells.length} cells, ${STATUSES.reduce((n, s) => n + overall[s], 0)} checks across ${guides.length} guides.`, '')
lines.push('## Totals', '', STATUSES.map((s) => `${s}: ${overall[s]}`).join(' · '), '')
lines.push('## By payer', '', table(tally((c) => c.payer), 'payer'), '')
lines.push('## By guide', '', table(tally((c) => c.guide), 'guide'), '')
lines.push('## Cells flagged for review (FLAG_MISMATCH > AGE_QUALIFIED > AMBIGUOUS)', '')
for (const { c } of flagged.slice(0, 40)) {
  lines.push(`- **${c.guide} / ${c.payer} / ${c.class}** (${c.status})`)
  for (const ch of c.checks.filter((x) => ['FLAG_MISMATCH', 'AGE_QUALIFIED'].includes(x.status)).slice(0, 4))
    lines.push(`  - ${ch.status} ${ch.kind} "${ch.drug.slice(0, 70)}": ${ch.reason} | row: ${ch.matched[0]?.raw?.slice(0, 140) ?? 'n/a'} (${ch.matched[0]?.page ? `p.${ch.matched[0].page}` : (ch.matched[0]?.table ?? '')})`)
}
lines.push('', '## Sources without extractable rows (their checks are SKIPPED)', '')
for (const [u, n] of [...unextractable.entries()].sort((a, b) => b[1] - a[1])) lines.push(`- ${n} checks: ${u}`)
lines.push('')
mkdirSync(outDir, { recursive: true })
writeFileSync(
  join(outDir, 'report.json'),
  JSON.stringify({ generated_at: new Date().toISOString(), state, guides: guides.map((g) => g.id), totals: overall, cells }, null, 1),
)
writeFileSync(join(outDir, 'summary.md'), lines.join('\n'))
console.log(`wrote ${join(outDir, 'report.json')} and summary.md`)
console.log(STATUSES.map((s) => `${s} ${overall[s]}`).join(' · '))
// --accept-remaining: after a review has cleared every still-flagged check, record them as accepted.
if (args['accept-remaining']) {
  const add = []
  for (const c of cells)
    for (const ch of c.checks)
      if (!['OK', 'SKIPPED', 'ACCEPTED'].includes(ch.status))
        add.push({ guide: c.guide, payer: c.payer, class: c.class, kind: ch.kind, drug: ch.drug, status: ch.status, raw: (ch.fingerprint ?? []).join(' || '), reason: ch.reason, reviewed: today })
  writeFileSync(ACCEPTED_FILE, JSON.stringify([...acceptedList, ...add], null, 1) + '\n')
  console.log(`accepted ${add.length} reviewed checks -> ${ACCEPTED_FILE}`)
}
process.exit(args.strict && overall.FLAG_MISMATCH > 0 ? 1 : 0)
