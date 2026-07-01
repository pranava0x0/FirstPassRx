import { describe, expect, it } from 'vitest'
import { costPlusUrl, goodRxUrl, hasCashLinkRule, goodRxPrice, costPlusPrice, pricesCapturedAt, KNOWN_UNPRICED_GAP } from './cash'
import { guides } from './formulary'

describe('cash price links', () => {
  it.each([
    ['Albuterol sulfate HFA', 'https://www.goodrx.com/albuterol'],
    ['Budesonide/formoterol', 'https://www.goodrx.com/budesonide-formoterol'],
    ['Advair Diskus (fluticasone/salmeterol)', 'https://www.goodrx.com/fluticasone-salmeterol'],
    ['Tiotropium', 'https://www.goodrx.com/tiotropium'],
    ['Estradiol transdermal patch (weekly)', 'https://www.goodrx.com/estradiol'],
    ['Progesterone, micronized (oral)', 'https://www.goodrx.com/progesterone'],
  ])('links %s to its canonical GoodRx page', (name, expected) => {
    expect(goodRxUrl(name)).toBe(expected)
  })

  it.each([
    ['Albuterol sulfate HFA', 'albuterol-90mcg-inhaler18g'],
    ['Budesonide/formoterol', 'budesonide-formoterol-fumarate'],
    ['Estradiol vaginal cream', 'estradiol-0_01-tubeofcream42_5g'],
    ['Estradiol transdermal patch (weekly)', 'carton-of-weekly-patches'],
    ['Progesterone (micronized)', 'progesterone-100mg-capsule'],
  ])('links %s to its matching Cost Plus product page', (name, expectedPath) => {
    const url = costPlusUrl(name)
    expect(url).toContain(expectedPath)
    expect(url).not.toBe('https://www.costplusdrugs.com/medications/')
  })

  it('does not offer Cost Plus when no matching product is known', () => {
    expect(costPlusUrl('Dulera (mometasone/formoterol)')).toBeNull()
  })
})

/** Every drug name a live cell can render: the preferred agent + its covered alternatives,
 * across active (non-comingSoon) classes only -- what a user can actually see today. */
function coveredDrugNames(): string[] {
  const names = new Set<string>()
  for (const guide of guides) {
    const activeClassIds = new Set(guide.activeClasses.map((c) => c.id))
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
  // Baseline as of 2026-07-01 (see issues.md): 76 covered-drug name variants have no explicit
  // cash-link rule yet and fall to the generic slug guesser -- 72 from the MD menopause gap
  // (Premarin/Prempro/Duavee/Bijuva family, vaginal rings, non-inhaler respiratory drugs), plus
  // 4 new ones from the NY ACE inhibitor guide (lisinopril, benazepril, enalapril, ramipril --
  // a whole new drug class cash.ts has no rules for yet). KNOWN_UNPRICED_GAP is exported from
  // cash.ts (shared with validate-prices.mjs) so the two never drift out of sync.

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
    // (Climara/Menostar) and generic "estradiol transdermal/patch" phrasings that fall to this rule.
    const KNOWN_PRICE_UNAVAILABLE = [/climara/i, /menostar/i, /evamist/i, /estradiol transdermal(?! system)/i]
    const matched = coveredDrugNames().filter((name) => hasCashLinkRule(name))
    const missingPrice = matched.filter((name) => !goodRxPrice(name) && !costPlusPrice(name))
    const unexpected = missingPrice.filter((name) => !KNOWN_PRICE_UNAVAILABLE.some((re) => re.test(name)))
    expect(unexpected).toEqual([])
  })
})
