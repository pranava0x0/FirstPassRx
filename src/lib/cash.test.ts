import { describe, expect, it } from 'vitest'
import { costPlusUrl, goodRxUrl, hasCashLinkRule, goodRxPrice, costPlusPrice, pricesCapturedAt, priceSuppressedByForm, KNOWN_UNPRICED_GAP } from './cash'
import rawData from '../data/formulary.json'
import type { Formulary } from '../types/formulary'

const guides = (rawData as Formulary).guides

describe('cash price links', () => {
  it.each([
    ['Albuterol sulfate HFA', 'https://www.goodrx.com/albuterol'],
    ['Budesonide/formoterol', 'https://www.goodrx.com/budesonide-formoterol'],
    ['Advair Diskus (fluticasone/salmeterol)', 'https://www.goodrx.com/fluticasone-salmeterol'],
    ['Tiotropium', 'https://www.goodrx.com/tiotropium'],
    ['Estradiol transdermal patch (weekly)', 'https://www.goodrx.com/estradiol?label_override=estradiol&form=carton&dosage=4-once-weekly-patches-of-0.05mg-day&quantity=1'],
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

  // Regression tests for two embedded-substring bugs caught by a full-formulary audit on
  // 2026-07-16: a short bare alternation token (no word boundary) matched as a substring inside
  // an unrelated brand/generic name, silently routing it to the wrong rule instead of its own
  // (correctly priced) rule.
  it('does not route Angeliq (contains "gel" mid-word) to the estradiol-gel rule', () => {
    // "Angeliq" contains the literal substring "gel" (an-GEL-iq); a bare (non-word-bounded) "gel"
    // alternation in the estradiol-gel rule matched it and mispriced it as Divigel.
    expect(goodRxUrl('estradiol / drospirenone (generic of Angeliq)')).toContain('angeliq')
    expect(goodRxPrice('estradiol / drospirenone (generic of Angeliq)')).toBeNull()
  })

  it.each([
    'conjugated estrogens (Premarin)',
    'PREMARIN (conjugated estrogens)',
    'Prempro (conjugated estrogens/medroxyprogesterone)',
  ])('does not route %s (contains "ogen" inside "estrogen") to the estropipate rule', (name) => {
    // Bare "ogen" (meant to catch the brand name Ogen) matched the substring "ogen" embedded in
    // every "estrogen"/"estrogens" mention, shadowing the real Premarin/Prempro/Premphase/Duavee
    // prices for any string not already caught by a more specific rule earlier in the array.
    expect(goodRxUrl(name)).not.toContain('estropipate')
  })

  // Regression tests for two rule-shadowing bugs (a broader/earlier rule intercepting a
  // narrower/later one; .find() returns first match) caught by code review on 2026-07-16.
  it('does not route Arnuity Ellipta (fluticasone furoate) to the bare fluticasone-propionate rule', () => {
    // The bare "fluticasone" rule (broadened 2026-07-16 to catch DISKUS/nasal-only phrasings) sat
    // before the Arnuity rule in the array, so "ARNUITY ELLIPTA (fluticasone furoate)" resolved to
    // fluticasone propionate HFA pricing instead of its own (unpriced, link-only) Arnuity rule.
    expect(goodRxUrl('ARNUITY ELLIPTA (fluticasone furoate)')).toContain('arnuity')
    expect(costPlusUrl('ARNUITY ELLIPTA (fluticasone furoate)')).toBeNull()
  })

  it.each([
    ['XIGDUO XR (dapagliflozin-metformin)', 'xigduo'],
    ['SYNJARDY (empagliflozin-metformin)', 'synjardy'],
  ])('routes %s to its own combo rule, not the single-agent SGLT2 rule', (name, expectedSlug) => {
    // The single-agent dapagliflozin/empagliflozin rules sat before the Xigduo/Synjardy combo
    // rules in the array, so a combo name matched (and was priced/linked as) the single agent --
    // e.g. Xigduo XR resolving to plain dapagliflozin at $8.35 instead of the $19.77 combo price.
    expect(goodRxUrl(name)).toContain(expectedSlug)
  })

  // Regression tests for 2 more rule-shadowing bugs, caught 2026-08-05 by a full-formulary sweep
  // (not the CA/PA merges' original bugs, but found in passing while verifying today's other
  // regex broadenings didn't shadow anything).
  it.each(['ESTRING (estradiol vaginal ring 2 mg)', 'IMVEXXY (estradiol vaginal insert)', 'Femring (higher-systemic-dose estradiol vaginal ring)'])(
    'does not route %s to the Vagifem/vaginal-tablet rule',
    (name) => {
      // Broadening the vaginal-tablet rule to catch a bare "Estradiol vaginal" (no "tablet"/
      // "insert" word) also caught Estring/Femring/Imvexxy ring/insert product names, which
      // contain "estradiol vaginal" as a substring too -- they'd have gotten the tablet rule's
      // $90.88 GoodRx price instead of their own correct (link-only or differently-priced) rules.
      expect(goodRxUrl(name)).not.toContain('vagifem')
    },
  )

  it.each(['Norethindrone ac-eth estradiol oral tablet 0.5-2.5 mg-mcg or 1-5 mg-mcg', 'norethindrone-eth estradiol oral tablet'])(
    'routes %s to the norethindrone/ethinyl-estradiol combo rule, not plain oral estradiol',
    (name) => {
      // Sources abbreviate "ethinyl" to "eth"/"ac-eth"; neither abbreviation contains the literal
      // phrase "ethinyl estradiol" the combo rule required, so both fell through to the plain
      // oral-estradiol rule and were priced as single-agent estradiol ($34.18) instead of the
      // combo's real price ($61.49).
      expect(goodRxPrice(name)?.price).toBe(61.49)
    },
  )

  it.each([
    'risedronate delayed-release (dr/ec) 35mg',
    'Atelvia (brand risedronate DR)',
    'ATELVIA (brand delayed-release risedronate, tbec 35mg)',
  ])('prices %s as the Atelvia delayed-release product, not the bare 5mg-daily rule', (name) => {
    // Caught by Codex review 2026-08-05: the bare risedronate rule's own comment said Atelvia
    // "should not be folded into" the 5mg-daily rule, but every DR/Atelvia name also contains the
    // word "risedronate" and matched the bare rule first anyway -- $31.54/30-tablet-5mg instead of
    // the DR product's real $101.53/4-tablet-35mg price.
    expect(costPlusPrice(name)?.price).toBe(101.53)
  })

  it('still prices plain risedronate/Actonel mentions at the 5mg-daily rate', () => {
    expect(costPlusPrice('risedronate (Actonel) tablets')?.price).toBe(31.54)
  })

  it('prices the correct osteoporosis-dose zoledronic acid/Reclast, not the oncology dose', () => {
    expect(goodRxPrice('zoledronic acid')?.price).toBe(81.49)
    expect(goodRxPrice('Reclast (brand zoledronic acid)')?.price).toBe(81.49)
    // The 4mg/5mL oncology-dosing formulation (Paget's disease/malignancy) is a real, distinct,
    // unpriced product -- pricing it at the 5mg/100mL osteoporosis rate would be a dosage mismatch.
    expect(goodRxPrice('Zoledronic acid 4 mg')).toBeNull()
    expect(goodRxPrice('zoledronic acid intravenous solution 4 mg/5 mL (Zometa-equivalent)')).toBeNull()
  })

  it('prices abaloparatide/Tymlos without colliding with the teriparatide/Forteo rule', () => {
    expect(goodRxPrice('abaloparatide (Tymlos)')?.price).toBe(3030)
    expect(goodRxPrice('teriparatide (Forteo)')).toBeNull()
    expect(costPlusPrice('teriparatide (Forteo)')?.price).toBe(775.15)
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
      // 2026-10-22 MA next-11 topics: specialty brands and injectables with no plain cash price, and
      // tofacitinib, whose Cost Plus price could not be re-verified.
      /tofacitinib|xeljanz/i,
      /sofosbuvir|epclusa|bictegravir|biktarvy|dupilumab|dupixent|ixekizumab|taltz/i,
      /upadacitinib|rinvoq|suvorexant|belsomra|paliperidone|invega|risperdal consta|microsphere|glecaprevir|mavyret/i,
      /adalimumab|humira|hadlima|hyrimoz|cyltezo|yusimry|simlandi|amjevita|ustekinumab|stelara|wezlana|selarsdi|pyzchiva|otulfi|imuldosa|yesintek|steqeyma|starjemza/i,
      // 2026-10-21 new topics: brand weight-loss GLP-1s and CGRP/PCSK9 injectables show only
      // manufacturer savings offers on GoodRx, not a cash price.
      /wegovy|zepbound|saxenda|foundayo|weight management/i,
      /qulipta|atogepant|praluent|alirocumab/i,
      /nurtec|rimegepant|repatha|evolocumab|aimovig|erenumab|ajovy|fremanezumab|emgality|galcanezumab/i,
      /menostar/i,
      /levonorgestrel/i,
      /combipatch/i,
      /norethindrone.*(transdermal|patch)/i,
      /evamist/i,
      /alora/i,
      /estradiol transdermal(?! system)/i,
      /estradiol patch/i,
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
      /evamist/i,
      /depo-estradiol/i,
      /crinone/i,
      /femring/i,
      /endometrin/i,
      /intrarosa/i,
      /prasterone/i,
      /osphena/i,
      /ospemifene/i,
      /menest/i,
      /estratest/i,
      /\beemt\b/i,
      /covaryx/i,
      /esterified estrogens/i,
      /estrogens-methyltestosterone/i,
      /angeliq/i,
      /drospirenone/i,
      /bijuva/i,
      /prefest/i,
      /norgestimate/i,
      /estring/i,
      /estradiol valerate/i,
      /estropipate/i,
      /progesterone.*(intramuscular|injection|\boil\b)/i,
      /progesterone.*(suppositor|insert)/i,
      // Premarin's regex broadened 2026-07-16 to catch "estrogens conjugated" (reversed word
      // order) -- this now also matches Premarin Vaginal cream and other conjugated-estrogens
      // phrasings that were never priced (only the 0.3mg oral tablet is captured above).
      /premarin/i,
      /conjugated estrogen/i,
      /estrogens?,? conjugated/i,
      // 2026-08-11: VoSpire ER / oral extended-release albuterol tablet (Cost Plus doesn't carry
      // it, GoodRx blocked before a price could be captured) and Apidra/glulisine (Cost Plus
      // doesn't carry any insulin, GoodRx blocked) -- both link-only rules added this session,
      // see cash.ts.
      /vospire/i,
      /albuterol.*\bER\b/i,
      /apidra/i,
      /glulisine/i,
    ]
    const matched = coveredDrugNames().filter((name) => hasCashLinkRule(name))
    const missingPrice = matched.filter((name) => !goodRxPrice(name) && !costPlusPrice(name))
    const unexpected = missingPrice.filter((name) => !priceSuppressedByForm(name) && !KNOWN_PRICE_UNAVAILABLE.some((re) => re.test(name)))
    expect(unexpected).toEqual([])
  })
})

// Codex review, PR 20: combo and low-dose patches must not inherit the plain 0.05 mg price.
describe('distinct estradiol patch products stay unpriced', () => {
  it.each([
    'CLIMARA PRO',
    'CLIMARA PRO (estradiol-levonorgestrel patch)',
    'CombiPatch (estradiol/norethindrone acetate transdermal)',
    'Menostar (estradiol 0.014 mg/day)',
    'CLIMARA (brand)',
    'EVAMIST (estradiol transdermal spray)',
    'TWIRLA (contraceptive patch, ethinyl estradiol/levonorgestrel)',
  ])(
    '%s has no borrowed price',
    (name) => {
      expect(goodRxPrice(name)).toBeNull()
      expect(costPlusPrice(name)).toBeNull()
    },
  )
  it('a contraceptive levonorgestrel patch never links to Climara Pro', () => {
    expect(goodRxUrl('TWIRLA (contraceptive patch, ethinyl estradiol/levonorgestrel)')).not.toMatch(/climara-pro/)
  })
  it('plain weekly patch keeps its captured price', () => {
    expect(goodRxPrice('Estradiol transdermal patch (weekly)')?.price).toBe(51.66)
  })
})

// Weight-loss GLP-1s share an INN with diabetes products; a Wegovy cell once showed Ozempic's $199
// and a Saxenda cell Victoza's $154 (found 2026-10-21). They must never borrow those prices.
describe('weight-loss GLP-1s never borrow a diabetes product price', () => {
  it.each(['Semaglutide (weight management)', 'semaglutide (Wegovy)', 'Wegovy', 'Liraglutide 3 mg (weight management)', 'Saxenda', 'Zepbound (tirzepatide)', 'Tirzepatide (weight management)'])(
    '%s',
    (name) => {
      expect(goodRxPrice(name)).toBeNull()
      expect(goodRxUrl(name)).not.toMatch(/ozempic|victoza|mounjaro/)
    },
  )
  it('diabetes semaglutide keeps its Ozempic price', () => {
    expect(goodRxPrice('Semaglutide (Ozempic)')).not.toBeNull()
  })
})

// Codex review, PR 22: methylphenidate rules priced other dosage forms with tablet quotes.
describe('methylphenidate prices only the captured forms', () => {
  it.each(['Methylphenidate ER (generic Ritalin LA)', 'Methylphenidate ER capsule', 'Onyda XR (methylphenidate ER suspension)', 'Methylphenidate transdermal patch (Daytrana)', 'Methylphenidate oral solution', 'Methylphenidate chewable tablet', 'Ritalin LA', 'Dexmethylphenidate ER', 'Methylphenidate ER (diffusion) tablet 27, 36, 54 mg', 'Methylphenidate ER tablet 10 mg and 20 mg (generic)', 'Methylphenidate HCl Cap,Er Sprinkle,Biphasic 40-60 (10 mg, 15 mg)', 'Methylphenidate ER'])(
    '%s has no borrowed price',
    (name) => expect(goodRxPrice(name)).toBeNull(),
  )
  it('mixed amphetamine salts IR phrasings share the captured price', () => {
    expect(goodRxPrice('Amphetamine salt combination (immediate-release)')?.price).toBe(32.31)
    expect(goodRxPrice('Adderall XR (amphetamine salt combination ER)')).toBeNull()
  })
  it('phentermine capsules never borrow the tablet price', () => {
    expect(goodRxPrice('Phentermine HCl oral capsule')).toBeNull()
    expect(goodRxPrice('Phentermine HCl')?.price).toBe(21.52)
  })
  it('lisdexamfetamine chewables never borrow the capsule price', () => {
    expect(goodRxPrice('Lisdexamfetamine chewable tablet (generic Vyvanse chewable)')).toBeNull()
    expect(goodRxPrice('Lisdexamfetamine dimesylate')?.price).toBe(67.78)
  })
  it('prices osmotic ER tablets and plain IR tablets', () => {
    expect(goodRxPrice('Methylphenidate hydrochloride extended-release (osmotic)')?.price).toBe(39.49)
    expect(goodRxPrice('Methylphenidate ER (osmotic tablet)')?.price).toBe(39.49)
    expect(goodRxPrice('Methylphenidate ER 24 hr tablet 18 mg, 27 mg')?.price).toBe(39.49)
    expect(goodRxPrice('Methylphenidate ER-OROS (generic Concerta)')?.price).toBe(39.49)
    expect(goodRxPrice('Methylphenidate hydrochloride')?.price).toBe(25.78)
  })
})

// Codex review, PR 22: more dosage forms that must not borrow a tablet price.
describe('form-specific prices for the new topics', () => {
  it.each([
    'Sumatriptan Succinate Subcutaneous Cartridge',
    'Sumatriptan succinate subcutaneous solution',
    'Amphetamine-dextroamphetamine CP24 capsule, 5/10/15/20/25/30 mg',
    'Phendimetrazine Tartrate Capsule, Extended Release (105 mg)',
    'Atorvastatin oral suspension (Atorvaliq)',
    'Amphetamine sulfate ER oral suspension (Adzenys ER)',
  ])('%s has no borrowed price', (name) => expect(goodRxPrice(name)).toBeNull())
  it('the captured tablet forms keep their prices', () => {
    expect(goodRxPrice('Sumatriptan succinate')?.price).toBe(29.85)
    expect(goodRxPrice('Phendimetrazine tartrate')?.price).toBe(32.51)
    expect(goodRxPrice('Atorvastatin calcium')?.price).toBe(15.24)
  })
})

// Dataset-wide guard (2026-10-21, after Codex flagged ~10 form mismatches one by one): a priced
// match must not cross dosage forms. If the captured quantity is for tablets, a covered name that
// says capsule/solution/patch/etc. is a different product and must not borrow the price.
describe('no covered name borrows a price captured for a different dosage form', () => {
  const FORMS: [RegExp, RegExp][] = [
    [/\b(tablets?|tabs?)\b/i, /\b(capsules?|cp24|solution|suspension|patch|transdermal|injection|subcutaneous|cartridge|pen|syringe|spray|nasal|chewable|ODT|orally disintegrating|gel|cream)\b/i],
    [/\b(capsules?|caps?)\b/i, /\b(tablets?|solution|suspension|patch|injection|chewable|ODT)\b/i],
  ]
  const ALL_GUIDES = true
  it('holds for every covered drug name', () => {
    const offenders: string[] = []
    for (const g of (rawData as unknown as Formulary).guides) {
      if (!ALL_GUIDES && !['adhd', 'lipids', 'weight', 'migraine'].includes(g.topicId)) continue
      for (const r of g.records) {
        const names = [r.preferredAgent.inn, ...(r.alternatives ?? []).map((a) => a.drug)]
        for (const n of names) {
          const q = goodRxPrice(n)?.quantity
          if (!q) continue
          for (const [captured, other] of FORMS) {
            if (captured.test(q) && other.test(n) && !captured.test(n)) offenders.push(`${n} -> ${q}`)
          }
        }
      }
    }
    expect([...new Set(offenders)]).toEqual([])
  })
})

// Codex review, PR 22: a suppressed cross-form price must not keep the other form's deep links.
describe('form-conflicting names drop the captured product links', () => {
  it('Premarin vaginal cream gets no tablet params and no Cost Plus tablet link', () => {
    const name = 'Premarin vaginal cream'
    expect(priceSuppressedByForm(name)).toBe(true)
    expect(goodRxUrl(name)).not.toContain('?')
    expect(costPlusUrl(name)).toBeNull()
  })
})

// Found adding the MA dermatology and pain guides (2026-10-22): molecule-only rules borrowed prices.
describe('topical mometasone and hydrocodone-ibuprofen do not borrow other products\' prices', () => {
  it.each(['Mometasone furoate 0.1% cream', 'Mometasone furoate external', 'Hydrocodone and ibuprofen tablets'])(
    '%s has no borrowed price',
    (name) => expect(goodRxPrice(name)).toBeNull(),
  )
  it('the Asmanex inhaler and plain ibuprofen keep theirs', () => {
    expect(goodRxPrice('Asmanex HFA (mometasone furoate)')).not.toBeNull()
    expect(goodRxPrice('Ibuprofen 600 mg tablet')).not.toBeNull()
  })
})

// 2026-10-22: the new single-agent HCTZ rule sits at the top of the list; ACE/HCTZ combinations
// must keep falling through to their ACE-inhibitor rules.
describe('HCTZ rule leaves ACE combinations alone', () => {
  it.each(['benazepril-hydrochlorothiazide', 'Enalapril (and enalapril HCTZ) tablets', 'quinapril-hydrochlorothiazide'])(
    '%s does not resolve to the HCTZ product',
    (name) => expect(goodRxUrl(name)).not.toContain('/hydrochlorothiazide'),
  )
})

// Codex review, PR 23: each adalimumab biosimilar links to its own GoodRx page, not Humira's.
describe('adalimumab biosimilars keep their own cash links', () => {
  it.each([['Adalimumab-adaz', 'hyrimoz'], ['Adalimumab-bwwd', 'hadlima'], ['Adalimumab-ryvk', 'simlandi'], ['Humira', 'humira']])(
    '%s -> %s',
    (name, slug) => expect(goodRxUrl(name)).toBe(`https://www.goodrx.com/${slug}`),
  )
})

describe('ustekinumab biosimilars keep their own cash links', () => {
  it.each([['Ustekinumab-kfce', 'yesintek'], ['Ustekinumab-ttwe', 'pyzchiva'], ['Stelara', 'stelara']])(
    '%s -> %s',
    (name, slug) => expect(goodRxUrl(name)).toBe(`https://www.goodrx.com/${slug}`),
  )
})

// Code review, PR 23: molecule-substring matches priced the wrong product.
describe('new-topic rules do not capture neighbouring products', () => {
  it('metoprolol tartrate is not priced as succinate ER', () => {
    expect(goodRxUrl('Metoprolol tartrate 25, 50 mg tablet')).toContain('/metoprolol?')
    expect(goodRxUrl('Metoprolol succinate ER 50 mg')).toContain('/metoprolol-succinate-er')
    // Brand-first names do not take the generic quote (code review round 2).
    expect(goodRxPrice('Toprol XL (metoprolol succinate)')).toBeNull()
    expect(goodRxPrice('Myrbetriq (mirabegron)')).toBeNull()
    expect(goodRxPrice('Hydrocodone-acetaminophen 7.5/325 and 10/325 mg')).toBeNull()
    expect(goodRxUrl('amlodipine-benazepril')).not.toContain('/benazepril')
  })
  it.each(['Desvenlafaxine ER (generic)', 'Pristiq (desvenlafaxine)', 'Levamlodipine 2.5, 5 mg tablets', 'Benzhydrocodone/acetaminophen (Apadaz)', 'Seroquel, Zyprexa, Risperdal (brands)'])(
    '%s has no borrowed price',
    (name) => expect(goodRxPrice(name)).toBeNull(),
  )
})
