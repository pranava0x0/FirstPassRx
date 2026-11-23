// Shared by catalog generation and lookup. Only names explicitly present on the
// record are indexed. An INN is searchable, but does not stand in for a brand.
export function preferredLabel({ inn, brand, strength }) {
  return [brand && brand !== inn ? `${brand} (${inn})` : inn, strength].filter(Boolean).join(' · ')
}
export function medicationEntries(record) {
  if (record.verification === 'example') return []
  return [
    ...(record.noCoveredAgent ? [] : [{ label: preferredLabel(record.preferredAgent), kind: 'pick' }]),
    ...(record.alternatives || []).map((a, index) => ({ label: a.drug, kind: 'alternative', index })),
    ...record.paRequired.map((a, index) => ({ label: a.drug, kind: 'barrier', index })),
  ]
}

// One product under its many spellings across plans ("DOVATO (dolutegravir/lamivudine)", "Dolutegravir-
// lamivudine (Dovato) 50-300 mg", "Dovato® tabs"...). The key is the product's words (brand, molecules,
// distinguishing salts) plus its form/device as tokens (~po, ~inj, ~td, ~vag, ~mdi, ~dpi, ~neb, ~er...),
// read from the whole label, so Ozempic tablets ≠ Ozempic pen and Humulin N ≠ Humulin R. Strengths,
// quantity-limit notes and dosing notes in the " · strength" part never enter it. A brand never merges
// with its generic. Data-driven merges (a spelling with no form, a branded salt spelling) live in the
// generated medication-aliases.json (see brandAliases), applied here.
const FORM = {
  tablet: '~po', tablets: '~po', tab: '~po', tabs: '~po', capsule: '~po', capsules: '~po', cap: '~po', caps: '~po', caplet: '~po',
  pen: '~inj', pens: '~inj', injection: '~inj', injectable: '~inj', injector: '~inj', autoinjector: '~inj', syringe: '~inj',
  vial: '~inj', subcutaneous: '~inj', kwikpen: '~inj', flextouch: '~inj', solostar: '~inj', prefilled: '~inj',
  infusion: '~iv', intravenous: '~iv', iv: '~iv',
  patch: '~td', transdermal: '~td',
  vaginal: '~vag', insert: '~vag', ring: '~vag',
  nasal: '~nasal',
  nebulizer: '~neb', nebulized: '~neb', nebulizing: '~neb', respules: '~neb', nebules: '~neb',
  hfa: '~mdi', mdi: '~mdi', aerosol: '~mdi', aero: '~mdi',
  powder: '~dpi', diskus: '~dpi', dpi: '~dpi', flexhaler: '~dpi', ellipta: '~dpi', respiclick: '~dpi', handihaler: '~dpi',
  digihaler: '~dpi', twisthaler: '~dpi', pressair: '~dpi', inhub: '~dpi',
  respimat: '~smi',
  er: '~er', xr: '~er', xl: '~er', sr: '~er', cr: '~er', la: '~er', extended: '~er',
  dr: '~dr', ec: '~dr', delayed: '~dr',
}
// Words that are form-like but must stay as written (topical gel ≠ topical solution).
const KEEP_FORM = new Set(['gel', 'cream', 'ointment', 'lotion', 'foam', 'shampoo', 'solution', 'suspension', 'granules', 'packet', 'packets', 'chewable', 'odt', 'film', 'spray', 'drops', 'sublingual', 'buccal', 'ophthalmic', 'otic', 'topical', 'rectal', 'suppository', 'enema', 'lozenge', 'troche'])
const KEY_STRIP = new Set(['oral', 'brand', 'name', 'generic', 'and', 'mg', 'mcg', 'ml', 'unit', 'units', 'hcl', 'hydrochloride',
  'sulfate', 'inhalation', 'inhaler', 'inhal', 'actuation', 'act', 'base', 'release', 'release', 'dose', 'per', 'day', 'daily', 'only'])
const SALTS = new Set(['sodium', 'potassium'])

function words(text) {
  return String(text)
    .toLowerCase()
    .replace(/[®™]/g, ' ')
    .replace(/\((?:ql|quantity|limit|max)[^)]*\)/g, ' ')
    .replace(/\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|%|units?)?(?:\s*\/\s*\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|%)?)*/g, ' ')
    .split(/[^a-z]+/)
    .filter(Boolean)
}
// "dapagliflozin (generic Farxiga)" is the generic, not Farxiga: the brand named after "generic"
// (or "generic for/of/version of") is the reference product and leaves the key (Codex review, PR #40).
const GENERIC_LINK = new Set(['for', 'of', 'to', 'version', 'equivalent', 'the'])
function dropReferenceBrand(ws) {
  const out = []
  for (let i = 0; i < ws.length; i++) {
    out.push(ws[i])
    if (ws[i] !== 'generic' || i === 0) continue // "Generic dapagliflozin" names the molecule next
    let j = i + 1
    while (j < ws.length && GENERIC_LINK.has(ws[j])) j++
    if (j < ws.length && !FORM[ws[j]] && !KEEP_FORM.has(ws[j]) && ws[j] !== 'available') i = j
  }
  return out
}
export function rawProductKey(label) {
  const [head, ...tail] = String(label).split(' · ')
  const out = new Set()
  for (const w of dropReferenceBrand(words(head))) {
    if (FORM[w]) out.add(FORM[w])
    else if (!KEY_STRIP.has(w)) out.add(w)
  }
  // the strength part contributes only its form/device words, never its dosing notes
  for (const w of words(tail.join(' '))) {
    if (FORM[w]) out.add(FORM[w])
    else if (KEEP_FORM.has(w)) out.add(w)
  }
  return [...out].sort().join(' ')
}
export function productKey(label, aliases) {
  const key = rawProductKey(label)
  return (aliases && aliases[key]) || key
}
const formOf = (key) => key.split(' ').filter((w) => w.startsWith('~')).join(' ')
const baseOf = (key) => key.split(' ').filter((w) => !w.startsWith('~')).join(' ')

// Merges the data can justify, built at split time from every label:
// 1. a bare brand ("Dovato® tabs") → the product the plans name with that brand (preferredAgent brand + inn);
// 2. a branded spelling with sodium/potassium → the same brand without the salt (one brand is one
//    product; generic diclofenac sodium vs potassium stay apart);
// 3. a spelling with no form → the product's only form, when every listing of that product across all
//    plans has the same form (Dovato: tablets only). Ozempic has tablets and pens, so it stays apart.
export function brandAliases(records, labels) {
  const brandWords = new Set()
  const bareToFull = new Map()
  for (const r of records) {
    const a = r.preferredAgent
    if (!a?.brand || a.brand === a.inn) continue
    const bare = rawProductKey(a.brand)
    for (const w of bare.split(' ')) if (w && !w.startsWith('~')) brandWords.add(w)
    if (!bare || bare.includes(' ')) continue
    const full = rawProductKey(`${a.brand} (${a.inn})`)
    if (full === bare) continue
    if (!bareToFull.has(bare)) bareToFull.set(bare, new Set())
    bareToFull.get(bare).add(full)
  }
  const out = {}
  const resolve = (k) => { let seen = 0; while (out[k] && seen++ < 5) k = out[k]; return k }
  for (const [bare, fulls] of bareToFull) if (fulls.size === 1) out[bare] = [...fulls][0]
  const keys = new Set([...(labels ?? [])].map(rawProductKey))
  // a bare brand with a form ("Dovato® tabs" → "dovato ~po") joins the brand's product, keeping its form
  for (const k of keys) {
    const b = baseOf(k)
    const f = formOf(k)
    if (!f || b.includes(' ') || bareToFull.get(b)?.size !== 1) continue
    const full = [...bareToFull.get(b)][0]
    if (formOf(full) && formOf(full) !== f) continue // "Adderall XR" is not the IR Adderall pick
    out[k] = [...new Set([...full.split(' '), ...f.split(' ')])].sort().join(' ')
  }
  for (const k of keys) {
    const ws = k.split(' ')
    if (ws.some((w) => SALTS.has(w)) && ws.some((w) => brandWords.has(w))) {
      const without = ws.filter((w) => !SALTS.has(w)).join(' ')
      if (without !== k) out[k] = without
    }
  }
  const formsByBase = new Map()
  for (const k of keys) {
    const r = resolve(out[k] ?? k)
    const b = baseOf(r)
    if (!formsByBase.has(b)) formsByBase.set(b, new Set())
    formsByBase.get(b).add(formOf(r))
  }
  for (const [b, forms] of formsByBase) {
    const real = [...forms].filter(Boolean)
    if (forms.has('') && real.length === 1) out[b] = `${b} ${real[0]}`.split(' ').sort().join(' ')
  }
  for (const k of Object.keys(out)) out[k] = resolve(out[k])
  for (const k of Object.keys(out)) if (out[k] === k) delete out[k]
  return Object.fromEntries(Object.entries(out).sort())
}
