import { describe, expect, it } from 'vitest'
import { costPlusUrl, goodRxUrl, hasCashLinkRule, goodRxPrice, costPlusPrice, pricesCapturedAt, KNOWN_UNPRICED_GAP } from './cash'
import rawData from '../data/formulary.json'
import type { Formulary } from '../types/formulary'

const guides = (rawData as Formulary).guides

describe('cash price links', () => {
  it.each([
    ['Albuterol sulfate HFA', 'https://www.goodrx.com/albuterol'],
    ['Budesonide/formoterol', 'https://www.goodrx.com/budesonide-formoterol'],
    ['Advair Diskus (fluticasone/salmeterol)', 'https://www.goodrx.com/fluticasone-salmeterol'],
    ['Tiotropium', 'https://www.goodrx.com/tiotropium'],
    ['Estradiol transdermal patch (weekly)', 'https://www.goodrx.com/estradiol'],
    ['Progesterone, micronized (oral)', 'https://www.goodrx.com/progesterone'],
    ['Lisinopril', 'https://www.goodrx.com/lisinopril?label_override=lisinopril&form=tablet&dosage=10mg&quantity=30'],
    ['Benazepril', 'https://www.goodrx.com/benazepril?label_override=benazepril&form=tablet&dosage=10mg&quantity=30'],
    ['Enalapril', 'https://www.goodrx.com/enalapril?label_override=enalapril&form=tablet&dosage=10mg&quantity=30'],
    ['Ramipril', 'https://www.goodrx.com/ramipril?label_override=ramipril&form=capsule&dosage=10mg&quantity=30'],
  ])('links %s to its canonical GoodRx page', (name, expected) => {
    expect(goodRxUrl(name)).toBe(expected)
  })

  it.each([
    ['Albuterol sulfate HFA', 'albuterol-90mcg-inhaler18g'],
    ['Budesonide/formoterol', 'budesonide-formoterol-fumarate'],
    ['Estradiol vaginal cream', 'estradiol-0_01-tubeofcream42_5g'],
    ['Estradiol transdermal patch (weekly)', 'carton-of-weekly-patches'],
    ['Progesterone (micronized)', 'progesterone-100mg-capsule'],
    ['Lisinopril', 'lisinopril-10mg-tablet'],
    ['Benazepril', 'benazeprilhcl-10mg-tablet'],
    ['Enalapril', 'enalaprilmaleate-10mg-tablet'],
    ['Ramipril', 'ramipril-10mg-capsule'],
  ])('links %s to its matching Cost Plus product page', (name, expectedPath) => {
    const url = costPlusUrl(name)
    expect(url).toContain(expectedPath)
    expect(url).not.toBe('https://www.costplusdrugs.com/medications/')
  })

  it('does not offer Cost Plus when no matching product is known', () => {
    expect(costPlusUrl('Dulera (mometasone/formoterol)')).toBeNull()
  })

  it.each([
    'Qbrelis (lisinopril oral solution)',
    'Epaned (enalapril oral solution, brand)',
  ])('does not attach a tablet/capsule price to the oral-solution form of %s', (name) => {
    expect(hasCashLinkRule(name)).toBe(false)
  })
})

/** Every drug name a live cell can render: the preferred agent + its covered alternatives,
 * across active (non-comingSoon) classes only -- what a user can actually see today. */
function coveredDrugNames(): string[] {
  const names = new Set<string>()
  for (const guide of guides) {
    const activeClassIds = new Set(guide.classes.filter((c) => !c.comingSoon).map((c) => c.id))
    for (const record of guide.records) {
      if (!activeClassIds.has(record.classId)) continue
      names.add(record.preferredAgent.inn)
      if (record.preferredAgent.brand) names.add(record.preferredAgent.brand)
      for (const alt of record.alternatives ?? []) names.add(alt.drug)
    }
  }
  return [...names]
}

describe('cash price coverage across the live formulary', () => {
  // Baseline as of 2026-07-01 (see issues.md): 72 covered-drug name variants have no explicit
  // cash-link rule yet and fall to the generic slug guesser -- all from the MD menopause gap
  // (Premarin/Prempro/Duavee/Bijuva family, vaginal rings, non-inhaler respiratory drugs). The
  // NY ACE inhibitor guide's 4 names (lisinopril, benazepril, enalapril, ramipril) now have
  // explicit rules. KNOWN_UNPRICED_GAP is exported from cash.ts (shared with
  // validate-prices.mjs) so the two never drift out of sync.

  it('does not silently grow the set of covered drugs without an explicit cash-link rule', () => {
    const unmatched = coveredDrugNames().filter((name) => !hasCashLinkRule(name))
    expect(unmatched.length).toBeLessThanOrEqual(KNOWN_UNPRICED_GAP)
  })

  it('every explicit cash-link rule carries a captured-at date', () => {
    const matched = coveredDrugNames().filter((name) => hasCashLinkRule(name))
    for (const name of matched) {
      expect(pricesCapturedAt(name), `${name} has a rule but no pricesCapturedAt`).not.toBeNull()
    }
  })

  it('every explicit cash-link rule has a price snapshot, except known unavailable cases', () => {
    // Weekly-patch family (rule: estradiol.*(weekly|patch|transdermal)|climara): GoodRx's generic
    // page defaults to a different dose than the 0.05mg Climara product cited, and Cost Plus Drugs
    // had 0.05mg out of stock at capture time -- link-only by design, not a bug. Covers the brand
    // (Climara/Menostar/Alora) and generic "estradiol transdermal/patch" phrasings that fall to
    // this rule. Alora added 2026-07-07 (VA gather) -- same brand family, no separate price rule.
    // meclofenamate/salsalate/quinapril: confirmed not carried by Cost Plus (search returns only
    // an unrelated fuzzy match); GoodRx pending -- a real "Press & Hold" bot-check blocked
    // repeated attempts in the 2026-07-16 session after one successful lookup. Bare "ketoprofen"
    // (not ER): Cost Plus only carries the 200mg extended-release capsule, not the
    // immediate-release 50/75mg one; GoodRx pending for the same reason.
    const KNOWN_PRICE_UNAVAILABLE = [
      /climara/i,
      /menostar/i,
      /evamist/i,
      /alora/i,
      /estradiol transdermal(?! system)/i,
      /meclofenamate/i,
      /salsalate/i,
      /ketoprofen/i,
      /quinapril/i,
      /accupril/i,
      /striverdi/i,
      /olodaterol/i,
      /trelegy/i,
      /epinephrine/i,
      /bevespi/i,
      /metaproterenol/i,
      /seebri/i,
      /duaklir/i,
      /serevent/i,
      /breztri/i,
      /mounjaro/i,
      /tirzepatide/i,
      /invokana/i,
      /canagliflozin/i,
      /novolog/i,
      /insulin aspart/i,
      /merilog/i,
      /humulin/i,
      /novolin/i,
      /fiasp/i,
      /levemir/i,
      /detemir/i,
      /soliqua/i,
      /lixisenatide/i,
      /alogliptin/i,
      /saxagliptin/i,
      /synjardy/i,
      /trijardy/i,
      /glyxambi/i,
    ]
    const matched = coveredDrugNames().filter((name) => hasCashLinkRule(name))
    const missingPrice = matched.filter((name) => !goodRxPrice(name) && !costPlusPrice(name))
    const unexpected = missingPrice.filter((name) => !KNOWN_PRICE_UNAVAILABLE.some((re) => re.test(name)))
    expect(unexpected).toEqual([])
  })
})
