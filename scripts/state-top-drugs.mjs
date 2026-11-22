#!/usr/bin/env node
// Which commonly prescribed drugs does each state lack a guide for?
//
//   node scripts/state-top-drugs.mjs [--top=40] [--year=2024] [--states=KY,OH] [--out=docs/state-top-drugs.md]
//
// Source: CMS "Medicare Part D Prescribers - by Geography and Drug" (data.cms.gov, public, yearly).
// The CSV is cached at data-gathering/cms/geo-<year>.csv (downloaded once, ~14 MB); a re-run reads
// the cache. Ranks each state's generics by total claims, then checks whether the generic name
// appears anywhere in that state's guides (pick, alternatives, PA items). Medicare-only data: it
// under-counts pediatric and reproductive-age drugs (ADHD, contraception, acne), so read the gaps as
// a prioritisation signal, not a census.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true] }))
const TOP = Number(args.top ?? 40)
const YEAR = String(args.year ?? '2024')
// data.cms.gov distribution URLs per data year (from https://data.cms.gov/data.json)
const CSV_URL = {
  2024: 'https://data.cms.gov/sites/default/files/2026-05/3e80b44e-5a87-4414-959a-b6a7c8c18720/MUP_DPR_RY26_P04_V10_DY24_Geo.csv',
  2023: 'https://data.cms.gov/sites/default/files/2025-04/9fe6b8a6-0cb9-4b7c-9760-87800da010a8/MUP_DPR_RY25_P04_V10_DY23_Geo.csv',
}
const STATE_CODES = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE',
  'District of Columbia': 'DC', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN',
  Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR',
  Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT',
  Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY', 'Puerto Rico': 'PR',
  Guam: 'GU', 'Virgin Islands': 'VI', 'Northern Mariana Islands': 'MP', 'American Samoa': 'AS',
}
// Not prescription drugs a formulary guide would cover.
const NON_DRUG = /pen needle|syringe|blood sugar|blood-glucose|lancet|test strip|insulin pump|sensor|alcohol prep|diabetic supplies|glucose monitor/i

function loadCsv() {
  const file = join(ROOT, 'data-gathering/cms', `geo-${YEAR}.csv`)
  if (!existsSync(file)) {
    if (!CSV_URL[YEAR]) throw new Error(`no CSV URL known for data year ${YEAR}; add it from data.cms.gov/data.json`)
    mkdirSync(dirname(file), { recursive: true })
    console.error(`downloading ${CSV_URL[YEAR]}`)
    const tmp = `${file}.part`
    const r = spawnSync('curl', ['-sSL', '--fail', '-o', tmp, CSV_URL[YEAR]], { stdio: 'inherit' })
    if (r.status !== 0) throw new Error('download failed')
    renameSync(tmp, file) // only a complete download becomes the cache
  }
  return readFileSync(file, 'utf8')
}

function parseLine(line) {
  const out = []; let cur = ''; let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') q = false; else cur += c }
    else if (c === '"') q = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}

const lines = loadCsv().split(/\r?\n/).filter(Boolean)
const head = parseLine(lines[0])
const col = (n) => head.indexOf(n)
head[0] = head[0].replace(/^\uFEFF/, '')
const COLS = ['Prscrbr_Geo_Lvl', 'Prscrbr_Geo_Desc', 'Gnrc_Name', 'Tot_Clms', 'Tot_Drug_Cst', 'Tot_Benes']
const missing = COLS.filter((c) => col(c) < 0)
if (missing.length) throw new Error(`CMS CSV is missing columns ${missing.join(', ')}; delete the cached file if it is truncated`)
const [iLvl, iDesc, iGen, iClm, iCst, iBen] = COLS.map(col)
const byState = new Map()
for (const line of lines.slice(1)) {
  const f = parseLine(line)
  if (f[iLvl] !== 'State') continue
  const st = STATE_CODES[f[iDesc]]
  if (!st) continue
  const gen = f[iGen].trim()
  if (NON_DRUG.test(gen)) continue
  if (!byState.has(st)) byState.set(st, new Map())
  const m = byState.get(st)
  const e = m.get(gen) ?? { generic: gen, claims: 0, cost: 0, benes: 0 }
  e.claims += Number(f[iClm]) || 0
  e.cost += Number(f[iCst]) || 0
  e.benes += Number(f[iBen]) || 0 // summed across brand rows: an upper bound
  m.set(gen, e)
}

// Words from every drug string in a state's guides.
const data = JSON.parse(readFileSync(join(ROOT, 'src/data/formulary.json'), 'utf8'))
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const coveredText = new Map()
for (const g of data.guides) {
  const parts = []
  for (const r of g.records) {
    parts.push(r.preferredAgent?.inn, r.preferredAgent?.brand)
    for (const a of r.alternatives ?? []) parts.push(a.drug)
    for (const a of r.paRequired ?? []) parts.push(a.drug)
  }
  coveredText.set(g.stateCode, `${coveredText.get(g.stateCode) ?? ''} ${norm(parts.join(' '))} `)
}
const isCovered = (st, generic) => {
  const text = coveredText.get(st)
  if (!text) return false
  // Every molecule of a combo must appear as a whole word, and a single-molecule generic must not be
  // satisfied only by a combo that contains it ("atenolol" inside "atenolol chlorthalidone").
  const mols = generic.split(/\/|-(?=[A-Z])/).map((m) => norm(m).split(' ')[0]).filter((w) => w.length > 3)
  if (!mols.length) return false
  const whole = (w) => new RegExp(`(?<![a-z])${w}(?![a-z])`).test(text)
  if (!mols.every(whole)) return false
  if (mols.length > 1) return true
  // single molecule: needs at least one mention not immediately joined to another molecule
  return new RegExp(`(?<![a-z])${mols[0]}(?![a-z])(?! (?:hydrochlorothiazide|chlorthalidone|metformin|ezetimibe|amlodipine|valsartan|losartan|olmesartan|benazepril|lisinopril|clavulanate|naloxone|acetaminophen|tamsulosin|dapagliflozin|empagliflozin|sitagliptin))`).test(text)
}

if (byState.size < 50) throw new Error(`only ${byState.size} jurisdictions parsed from the CMS CSV; expected 50+`)
const want = args.states ? String(args.states).split(',') : [...byState.keys()].sort()
const report = { source: CSV_URL[YEAR], dataYear: YEAR, top: TOP, generatedFrom: 'src/data/formulary.json', states: {} }
const gapCount = new Map()
for (const st of want) {
  const m = byState.get(st)
  if (!m) continue
  const ranked = [...m.values()].sort((a, b) => b.claims - a.claims).slice(0, TOP)
  const rows = ranked.map((e, i) => ({ rank: i + 1, ...e, covered: isCovered(st, e.generic) }))
  report.states[st] = { hasGuides: coveredText.has(st), rows }
  if (coveredText.has(st)) for (const r of rows) if (!r.covered) gapCount.set(r.generic, (gapCount.get(r.generic) ?? 0) + 1)
}

const fmt = (n) => Math.round(n).toLocaleString('en-US')
const md = [
  `# Top Medicare Part D drugs by state vs FirstPassRx coverage`,
  '',
  `Generated by \`node scripts/state-top-drugs.mjs --top=${TOP} --year=${YEAR}\`. Source: CMS Medicare Part D Prescribers by Geography and Drug, data year ${YEAR} (${CSV_URL[YEAR]}). Medicare-only: it under-counts drugs used mostly by children and younger adults.`,
  '',
  `## Generics in a covered state's top ${TOP} that no guide in that state mentions`,
  '',
  '| Generic | Covered states where it is a top-' + TOP + ' gap |',
  '|---|---|',
  ...[...gapCount.entries()].sort((a, b) => b[1] - a[1]).map(([g, n]) => `| ${g} | ${n} |`),
  '',
  `## Per state (top 15; ✓ = mentioned in a guide)`,
  '',
]
for (const [st, s] of Object.entries(report.states)) {
  md.push(`- **${st}**${s.hasGuides ? '' : ' (no guides yet)'}: ` + s.rows.slice(0, 15).map((r) => `${r.generic}${s.hasGuides ? (r.covered ? ' ✓' : '') : ''} (${fmt(r.claims)})`).join(', '))
}
const outMd = args.out ?? join(ROOT, 'docs/state-top-drugs.md')
writeFileSync(outMd, md.join('\n') + '\n')
writeFileSync(join(ROOT, 'data-gathering/cms', `state-top-drugs-${YEAR}.json`), JSON.stringify(report, null, 1))
const covered = Object.values(report.states).filter((s) => s.hasGuides)
const pct = covered.length ? Math.round(100 * covered.flatMap((s) => s.rows).filter((r) => r.covered).length / (covered.length * TOP)) : 0
console.log(`✓ ${Object.keys(report.states).length} jurisdictions · ${covered.length} with guides · ${pct}% of their top-${TOP} mentioned · ${gapCount.size} distinct gap generics → ${outMd}`)
