// Pure helpers for scripts/costplus.mjs: map Cost Plus Drugs price-list entries to the app's
// cash-link rules and formulary picks. No I/O, so they are unit-tested (costplus-lib.test.ts).

export const slugOf = (url) => (url || '').split('/medications/')[1]?.split(/[/?]/)[0]?.toLowerCase() ?? ''

/** Cash price shown on the product page for `count` units (dispensing fee in, shipping out). */
export function cashPrice(entry, count) {
  const c = entry.cpd_channel
  if (!c || typeof c.price_per_unit !== 'number') return null
  return Math.round((c.price_per_unit * count + (c.cash_dispensing_fee ?? 0)) * 100) / 100
}

const UNIT_WORDS = /^(tablets?|tabs?|capsules?|caps?|patch(es)?|pills?|doses?)$/i
const MASS_WORDS = /^(g|gm|grams?|ml)$/i
const PACKAGE_WORDS = /^(inhalers?|pens?|cartons?|vials?|tubes?|bottles?|kits?|boxe?s?|packs?|blisters?|canisters?|pen-injectors?|syringes?|cans?|rings?|dose)$/i
/** Units the stored quantity label prices, in the catalog entry's own billing unit, or null when
 * the label doesn't say (e.g. "20mg tablet" names a strength, not a count). */
export function unitsFor(label, entry) {
  const m = (label || '').match(/^\s*(\d+(?:\.\d+)?)\s*(?:x\s*)?([a-z- ]+)/i)
  if (!m) return null
  // The unit word may follow a qualifier ("1 HFA inhaler", "1 dose pack"); look at up to 3 words.
  const n = Number(m[1])
  if (/^(mg|mcg|units?|iu|meq|%)\b/i.test(m[2].trim()) || /^\s*\d+(\.\d+)?\s*%/.test(label)) return null // a strength
  const word = m[2].trim().split(/\s+/).slice(0, 3).find((w) => UNIT_WORDS.test(w) || MASS_WORDS.test(w) || PACKAGE_WORDS.test(w)) ?? ''
  const byMass = /^(g|gm|grams|ml)$/i.test(entry.unit)
  // An explicit count anywhere wins over a package word: "1 bottle (30 tablets)" is 30 tablets.
  const counted = !byMass && label.match(/(\d+(?:\.\d+)?)\s*(tablets?|tabs?|capsules?|caps?|patch(es)?|pills?)\b/i)
  if (counted) return Number(counted[1])
  if (UNIT_WORDS.test(word)) return byMass ? null : n
  if (MASS_WORDS.test(word)) return byMass ? n : null
  if (PACKAGE_WORDS.test(word)) return n * (Number(entry.pack_size) || 1) / (byMass ? 1 : Number(entry.quantity) || 1)
  return null
}

// Lower-case words of a name that identify the molecule (salts and dosage words dropped).
const NOISE = new Set(['hcl', 'hydrochloride', 'sodium', 'potassium', 'calcium', 'mesylate', 'maleate', 'fumarate',
  'succinate', 'tartrate', 'besylate', 'citrate', 'phosphate', 'acetate', 'bromide', 'chloride',
  'sulfate', 'magnesium', 'disodium', 'hyclate', 'monohydrate', 'dihydrate', 'trihydrate', 'and', 'with', 'tablet', 'tablets', 'capsule', 'capsules', 'oral', 'er', 'xr',
  'xl', 'sr', 'dr', 'ir', 'extended', 'release', 'delayed', 'immediate', 'generic', 'brand', 'mg', 'mcg'])
export const words = (s) => (s || '').toLowerCase().replace(/\(.*?\)/g, ' ').split(/[^a-z]+/).filter((w) => w.length > 2 && !NOISE.has(w))
const FORMS = ['tablet', 'capsule', 'gel', 'cream', 'ointment', 'foam', 'lotion', 'solution', 'suspension', 'patch', 'inhaler', 'pen', 'spray', 'injection', 'film']
const EXTENDED = /\b(er|xr|xl|sr|la|cd|extended|24[ -]?h(ou)?r?|osmotic)\b/i
/** Dosage form and release named in a covered drug's text; the catalog product must agree. */
export function formOf(text) {
  const t = (text || '').toLowerCase()
  return { form: FORMS.find((f) => new RegExp(`\\b${f}`).test(t)) ?? null, extended: EXTENDED.test(t) }
}
export function sameForm(want, entry) {
  const t = `${entry.form} ${entry.medication_name} ${slugOf(entry.url).replace(/[-_]/g, ' ')}`.toLowerCase()
  if (want.extended !== EXTENDED.test(t)) return false
  if (!want.form) return /tablet|capsule/.test(entry.form.toLowerCase()) && !/odt|disintegrat|chew/.test(t)
  if (want.form === 'pen' || want.form === 'injection') return /pen|injector|syringe|injection|vial/.test(t)
  return t.includes(want.form)
}
// Every molecule word on both sides: "atenolol" must not match atenolol/chlorthalidone.
const ROUTE = new Set(['vaginal', 'topical', 'ophthalmic', 'nasal', 'hfa', 'unbranded', 'micronized'])
export function sameMolecule(want, entry) {
  const have = words(entry.medication_name).filter((w) => !ROUTE.has(w))
  return want.filter((w) => !ROUTE.has(w)).every((w) => have.includes(w)) && have.every((w) => want.includes(w))
}
export const strengthNum = (s) => ((s || '').match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|%|unit)/i) || [])[1]

