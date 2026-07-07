// Vendor URLs must use canonical medication names, not the clinical labels shown in the UI.

/** Ceiling on covered-drug names with no explicit cash-link rule (see issues.md) -- a ceiling,
 * not a target: it must never grow silently. Shared by cash.test.ts and validate-prices.mjs so
 * the two never drift out of sync with each other. Raised 72 → 148 on 2026-07-02 when the VA
 * diabetes guide shipped (8 payers × 4 classes) with no cash-link rules yet -- adding rules for
 * the diabetes drugs (metformin, GLP-1s, SGLT2s, insulins) is a logged backlog item. Raised
 * 148 → 161 on 2026-07-05 when the ny-nsaids and il-nsaids guides shipped (1 payer × 1 class
 * each) with no cash-link rules yet -- oral NSAIDs are mostly cheap OTC-adjacent generics, but
 * adding real GoodRx/Cost Plus rules for naproxen/ibuprofen/meloxicam/celecoxib/diclofenac is a
 * logged backlog item. Raised 161 → 168 the same day when a PR review (codex bot) caught the
 * il-nsaids cell misclassifying several preferred drugs (Etodolac, Flurbiprofen, Ketoprofen) as
 * PA-required -- correcting the cell against the source PDL surfaced additional real preferred
 * drug names (Indomethacin, Ketorolac, Nabumetone, Sulindac) that also have no cash-link rule.
 * Raised 168 → 232 on 2026-07-06 when the ny-ace and ny-nsaids guides gained 4 new payers each
 * (Excellus BCBS, UnitedHealthcare, Anthem BCBS NY, Excellus Medicare) -- each payer's own
 * formulary names its own long tail of ACE-inhibitor/NSAID brand and generic-form variants
 * (ALTACE, VASOTEC, ZESTRIL, LOTENSIN family; CELEBREX, ANAPROX DS, NAPROSYN, RELAFEN, FELDENE,
 * DAYPRO, EC-NAPROSYN, diclofenac submicronized, etc.) that the existing 20-drug cash.ts ruleset
 * has no entry for. Adding real GoodRx/Cost Plus rules for these is a logged backlog item.
 * Lowered 232 → 219 on 2026-07-06 (same day): added real GoodRx rules for all 8 remaining
 * ma-inhalers drugs (Dulera, Incruse Ellipta, Arnuity Ellipta, Yupelri, Tudorza Pressair, Asmanex
 * Twisthaler, Alvesco, QVAR RediHaler), captured via a real browser session. None of the 8 had a
 * Cost Plus Drugs match (searched each generic name -- Cost Plus doesn't carry any of these
 * specialty inhalers/devices, only the combo or topical/nasal forms of a couple of their
 * components), so those rules are GoodRx-only by design, not an oversight. md-menopause (59),
 * ny-nsaids (66), va-diabetes (76, currently zero priced), and il-nsaids (12) remain open --
 * logged in issues.md/backlog.md.
 * Raised 219 → 235 on 2026-07-06 (same day) when the new `va-ace` guide shipped (8 payers, 1
 * class, reusing VA's existing payer roster) -- the non-preferred/non-formulary ACE inhibitors
 * (captopril, fosinopril, moexipril, perindopril, quinapril, trandolapril, plus their brand and
 * combo-product name variants) have no cash-link rule yet. Adding them would also help the
 * existing `ny-ace` guide, which has the same gap for the same drugs -- logged as one combined
 * backlog item rather than two.
 * Raised 235 → 401 on 2026-07-06 (same day) when 3 brand-new NY guides shipped (`ny-inhalers`,
 * `ny-menopause`, `ny-diabetes`; 5 payers each, 13 classes total) -- each payer's own formulary
 * names its own long tail of inhaler/HT/diabetes brand and generic-form variants with no
 * cash-link rule yet (this mirrors the exact same "new guide surfaces a new drug-name long tail"
 * pattern as every prior raise above, just at 3x the guides in one merge). Adding real GoodRx/
 * Cost Plus rules for these is a logged backlog item alongside the existing md-menopause (59),
 * ny-nsaids (66), va-diabetes (76, still zero priced), and il-nsaids (12) gaps.
 * Raised 401 → 681 on 2026-07-07 when 4 brand-new MD guides shipped (`md-inhalers`, `md-ace`,
 * `md-diabetes`, `md-nsaids`; 8 payers each). Most of the increase (~150 names) came from a
 * `validate()`-driven fix, not new coverage: several cost-tier-only items were reclassified from
 * `paRequired` to `alternatives` (see issues.md) -- `coveredDrugNames()` only counts
 * `preferredAgent`/`alternatives`, never `paRequired`, so correctly reclassifying a drug as
 * "still covered, just pricier" makes it newly count toward this gap. That's the honest, expected
 * outcome of the fix, not a regression to paper over.
 * Raised 681 → 684 on 2026-07-07 (same day) when 3 brand-new VA guides shipped (`va-inhalers`,
 * `va-menopause`, `va-nsaids`; 8 payers each, reusing VA's known roster). Only 3 new names this
 * time (not ~150 like MD) because VA reuses the same inhaler/menopause/NSAID drug-name universe
 * already priced or logged as a gap for MA/NY/MD -- the marginal new names are payer-specific
 * brand variants (e.g. DUAVEE moved to alternatives, a few uhc-community brand-tier duplicates). */
export const KNOWN_UNPRICED_GAP = 684

/** A snapshot cash price. Not live — see pricesCapturedAt. Deep-link (goodRxUrl/costPlusUrl) stays
 * the primary, current source; this is "as of" context only (CLAUDE.md: capture dates, don't bake
 * volatile numbers as fact). */
export interface PricePoint {
  price: number
  /** What the price is for, e.g. "1 inhaler", "30 tablets" — vendors quote different pack sizes. */
  quantity: string
}

interface CashLinkRule {
  matches: RegExp
  goodRxSlug: string
  /** Query string (no leading ?) that pins the GoodRx page to this rule's exact dosage, when the
   * plain slug page defaults to a different strength/form. Keeps the link and goodRxPrice consistent. */
  goodRxParams?: string
  costPlusPath?: string
  /** Standard (no-membership) GoodRx coupon price. Omitted when the vendor's page defaults to a
   * different strength/form than this rule and no exact-match page could be found. */
  goodRxPrice?: PricePoint
  /** Cost Plus Drugs "price with us". Omitted when out of stock or unavailable at capture time. */
  costPlusPrice?: PricePoint
  /** ISO date both prices above were read directly off the vendor page (real browser session,
   * not a secondary aggregator). */
  pricesCapturedAt?: string
}

const CASH_LINK_RULES: CashLinkRule[] = [
  {
    matches: /\balbuterol sulfate solution|albuterol.*nebul/i,
    goodRxSlug: 'albuterol',
    goodRxParams: 'label_override=albuterol&form=vial&dosage=3ml-of-0.63mg-3ml&quantity=25',
    costPlusPath: 'albuterol-sulfate-0_63mg-3ml-nebulization-solution-3-accuneb',
    goodRxPrice: { price: 34.43, quantity: '25 vials, 0.63mg/3mL' },
    costPlusPrice: { price: 14.64, quantity: 'box of 25 vials, 0.63mg/3mL' },
    pricesCapturedAt: '2026-07-01',
  },
  {
    matches: /albuterol|proair|ventolin|proventil/i,
    goodRxSlug: 'albuterol',
    costPlusPath: 'albuterol-90mcg-inhaler18g',
    goodRxPrice: { price: 41.45, quantity: '1 HFA inhaler, 90mcg' },
    costPlusPrice: { price: 46.38, quantity: '1 HFA inhaler, 90mcg' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /budesonide.*formoterol|symbicort/i,
    goodRxSlug: 'budesonide-formoterol',
    costPlusPath: 'budesonide-formoterol-fumarate-160-4_5mcg-act-aerosol-inhaler-10_2-symbicort',
    goodRxPrice: { price: 97.09, quantity: '1 inhaler, 160/4.5mcg, 120 doses' },
    costPlusPrice: { price: 204.61, quantity: '1 inhaler, 160/4.5mcg' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /budesonide|pulmicort/i,
    goodRxSlug: 'budesonide',
    costPlusPath: 'budesonide-0_5mg_2ml-inhalation-suspension-60ml',
    goodRxPrice: { price: 48.30, quantity: '30 ampules, 0.5mg/2mL' },
    costPlusPrice: { price: 25.06, quantity: '0.5mg/2mL' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /fluticasone.*salmeterol|advair|wixela|airduo/i,
    goodRxSlug: 'fluticasone-salmeterol',
    costPlusPath: 'Fluticasone-Salmeterol-250mcg50mcg-Tablet',
    goodRxPrice: { price: 65.46, quantity: '1 diskus inhaler, 250/50mcg' },
    costPlusPrice: { price: 47.55, quantity: '250/50mcg, 60 doses' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /fluticasone furoate.*vilanterol|breo/i,
    goodRxSlug: 'breo-ellipta',
    costPlusPath: 'fluticasone-furoate-vilanterol-100-25-mcg_act-aerosol-powder-breath-activated-60',
    goodRxPrice: { price: 228.01, quantity: '1 inhaler, 100/25mcg, 60 blisters' },
    costPlusPrice: { price: 287.04, quantity: '100/25mcg, 60 blisters' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /fluticasone propionate|flovent/i,
    goodRxSlug: 'fluticasone',
    costPlusPath: 'fluticasone-propionate-hfa-110-mcg_act-inhaler-12',
    goodRxPrice: { price: 181.48, quantity: '1 HFA inhaler, 110mcg' },
    costPlusPrice: { price: 185.03, quantity: '1 HFA inhaler, 110mcg, 12g' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /levalbuterol|xopenex/i,
    goodRxSlug: 'levalbuterol',
    costPlusPath: 'levalbuterol-tartrate-45mcg_act-aerosol-inhaler-15',
    goodRxPrice: { price: 64.02, quantity: '1 inhaler, 45mcg, 15g' },
    costPlusPrice: { price: 54.78, quantity: '1 inhaler, 45mcg, 15g' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /tiotropium|spiriva/i,
    goodRxSlug: 'tiotropium',
    costPlusPath: 'tiotropium-bromide-inhalation-powder-18mcg-30-capsules',
    goodRxPrice: { price: 76.57, quantity: '30 capsules, 18mcg' },
    costPlusPrice: { price: 411.28, quantity: '30 capsules, 18mcg' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /estradiol.*norethindrone|activella|mimvey|amabelz/i,
    goodRxSlug: 'activella',
    goodRxParams: 'label_override=estradiol-norethindrone&form=package&dosage=28-tablets-of-0.5mg-0.1mg&quantity=3',
    costPlusPath: 'estradiolnorethrindroneacetate-0_5mg0_1mg-blisterpack28pack',
    goodRxPrice: { price: 57.30, quantity: '28 tablets (3 packages), 0.5mg/0.1mg' },
    costPlusPrice: { price: 23.40, quantity: '28 tablets, 0.5mg/0.1mg' },
    pricesCapturedAt: '2026-07-01',
  },
  {
    matches: /ethinyl estradiol.*norethindrone|norethindrone.*ethinyl estradiol|jinteli|fyavolv|femhrt/i,
    goodRxSlug: 'jinteli',
    costPlusPath: 'norethindrone-acetate-ethinyl-estradiol-1mg-5mcg-pack-of-tablets-90-fyavolv',
    goodRxPrice: { price: 61.49, quantity: '28 tablets, 1mg/5mcg' },
    costPlusPrice: { price: 30.63, quantity: '90 tablets, 1mg/5mcg' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /estradiol vaginal (tablet|insert)|vagifem|yuvafem/i,
    goodRxSlug: 'vagifem',
    costPlusPath: 'estradiol-10mcg-vaginaltablet8pack',
    goodRxPrice: { price: 90.88, quantity: '24 inserts, 10mcg' },
    costPlusPrice: { price: 87.42, quantity: '30 count, 10mcg' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /estradiol vaginal cream|estrace cream/i,
    goodRxSlug: 'estradiol',
    costPlusPath: 'estradiol-0_01-tubeofcream42_5g',
    costPlusPrice: { price: 14.19, quantity: '42.5g tube, 0.01%' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /estradiol.*(gel|divigel|estrogel|elestrin)/i,
    goodRxSlug: 'divigel',
    goodRxParams: 'label_override=estradiol&form=carton&dosage=30-packets-of-1mg-gel&quantity=1',
    costPlusPath: 'estradiol-1mg-g-gel-packet-divigel',
    goodRxPrice: { price: 42.11, quantity: '30 packets, 1mg gel' },
    costPlusPrice: { price: 26.85, quantity: '30 packets, 1mg/gm' },
    pricesCapturedAt: '2026-07-01',
  },
  {
    matches: /estradiol.*twice.weekly|dotti|lyllana|vivelle|minivelle/i,
    goodRxSlug: 'estradiol',
    costPlusPath: 'estradiol-(twice-weekly)-0_05-mg_24hr-patch-8-lyllana',
    goodRxPrice: { price: 54.82, quantity: '8 twice-weekly patches, 0.05mg/day' },
    costPlusPrice: { price: 47.83, quantity: '8 patches, 0.05mg/24hr' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /estradiol.*(weekly|patch|transdermal)|climara/i,
    goodRxSlug: 'estradiol',
    costPlusPath: 'estradiol-0_05mg-carton-of-weekly-patches-4-climara',
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /estradiol oral|estrace|^estradiol$/i,
    goodRxSlug: 'estradiol',
    costPlusPath: 'estradiol-1mg-tablet',
    goodRxPrice: { price: 34.18, quantity: '90 tablets, 1mg' },
    costPlusPrice: { price: 6.77, quantity: '30 tablets, 1mg' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /medroxyprogesterone|provera/i,
    goodRxSlug: 'medroxyprogesterone',
    costPlusPath: 'medroxyprogesteroneacetate-10mg-tablet',
    goodRxPrice: { price: 29.39, quantity: '10 tablets, 10mg' },
    costPlusPrice: { price: 7.64, quantity: '30 tablets, 10mg' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /micronized progesterone|progesterone.*micronized|prometrium/i,
    goodRxSlug: 'progesterone',
    costPlusPath: 'progesterone-100mg-capsule',
    goodRxPrice: { price: 31.54, quantity: '30 capsules, 100mg' },
    costPlusPrice: { price: 9.45, quantity: '30 capsules, 100mg' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /norethindrone acetate/i,
    goodRxSlug: 'norethindrone',
    costPlusPath: 'norethindroneacetate-5mg-tablet',
    goodRxPrice: { price: 33.50, quantity: '30 tablets, 5mg' },
    costPlusPrice: { price: 8.48, quantity: '30 tablets, 5mg' },
    pricesCapturedAt: '2026-06-30',
  },
  {
    matches: /^(?!.*oral solution).*(?:lisinopril|zestril|prinivil)/i,
    goodRxSlug: 'lisinopril',
    goodRxParams: 'label_override=lisinopril&form=tablet&dosage=10mg&quantity=30',
    costPlusPath: 'lisinopril-10mg-tablet',
    goodRxPrice: { price: 14.56, quantity: '30 tablets, 10mg' },
    costPlusPrice: { price: 5.39, quantity: '30 tablets, 10mg' },
    pricesCapturedAt: '2026-07-01',
  },
  {
    matches: /^(?!.*oral solution).*(?:benazepril|lotensin)/i,
    goodRxSlug: 'benazepril',
    goodRxParams: 'label_override=benazepril&form=tablet&dosage=10mg&quantity=30',
    costPlusPath: 'benazeprilhcl-10mg-tablet',
    goodRxPrice: { price: 30.00, quantity: '30 tablets, 10mg' },
    costPlusPrice: { price: 5.79, quantity: '30 tablets, 10mg' },
    pricesCapturedAt: '2026-07-01',
  },
  {
    matches: /^(?!.*oral solution).*(?:enalapril|vasotec)/i,
    goodRxSlug: 'enalapril',
    goodRxParams: 'label_override=enalapril&form=tablet&dosage=10mg&quantity=30',
    costPlusPath: 'enalaprilmaleate-10mg-tablet',
    goodRxPrice: { price: 27.65, quantity: '30 tablets, 10mg' },
    costPlusPrice: { price: 5.69, quantity: '30 tablets, 10mg' },
    pricesCapturedAt: '2026-07-01',
  },
  {
    matches: /^(?!.*oral solution).*(?:ramipril|altace)/i,
    goodRxSlug: 'ramipril',
    goodRxParams: 'label_override=ramipril&form=capsule&dosage=10mg&quantity=30',
    costPlusPath: 'ramipril-10mg-capsule',
    goodRxPrice: { price: 28.00, quantity: '30 capsules, 10mg' },
    costPlusPrice: { price: 6.04, quantity: '30 capsules, 10mg' },
    pricesCapturedAt: '2026-07-01',
  },
  {
    // No Cost Plus match: not carried (searched "mometasone", "mometasone formoterol" -- only
    // topical/nasal mometasone forms exist there, no inhaler).
    matches: /dulera|mometasone.*formoterol/i,
    goodRxSlug: 'dulera',
    goodRxPrice: { price: 199.0, quantity: '1 inhaler, 200mcg/5mcg, 120 doses' },
    pricesCapturedAt: '2026-07-06',
  },
  {
    // No Cost Plus match: searched "umeclidinium" -- only the umeclidinium/vilanterol (Anoro)
    // combo is carried, not standalone umeclidinium (Incruse Ellipta).
    matches: /incruse|umeclidinium/i,
    goodRxSlug: 'incruse-ellipta',
    goodRxPrice: { price: 211.22, quantity: '1 inhaler, 62.5mcg, 30 blisters' },
    pricesCapturedAt: '2026-07-06',
  },
  {
    // No Cost Plus match: searched "fluticasone furoate" -- only the furoate/vilanterol (Breo)
    // combo and fluticasone propionate forms are carried, not standalone furoate (Arnuity Ellipta).
    // Order matters: must sit after the Breo rule above so a real Breo match (which also contains
    // "fluticasone furoate") is caught by that more specific vilanterol-qualified rule first.
    matches: /arnuity|fluticasone furoate/i,
    goodRxSlug: 'arnuity-ellipta',
    goodRxPrice: { price: 137.1, quantity: '1 inhaler, 100mcg, 30 blisters' },
    pricesCapturedAt: '2026-07-06',
  },
  {
    // No Cost Plus match: searched "revefenacin" -- no medications found.
    matches: /yupelri|revefenacin/i,
    goodRxSlug: 'yupelri',
    goodRxPrice: { price: 1654, quantity: '1 carton, 175mcg/3mL, 30 vials' },
    pricesCapturedAt: '2026-07-06',
  },
  {
    // No Cost Plus match: searched "aclidinium" -- no real aclidinium product (only an unrelated
    // umeclidinium/vilanterol fuzzy hit).
    matches: /tudorza/i,
    goodRxSlug: 'tudorza-pressair',
    goodRxPrice: { price: 322.15, quantity: '1 inhaler, 400mcg, 60 doses' },
    pricesCapturedAt: '2026-07-06',
  },
  {
    // No Cost Plus match: searched "mometasone" -- only topical/nasal forms carried, not the
    // Twisthaler. Doesn't collide with the Dulera rule above (that one requires "...formoterol").
    matches: /asmanex|mometasone furoate/i,
    goodRxSlug: 'asmanex',
    goodRxPrice: { price: 143.06, quantity: '1 inhaler, 220mcg, 60 doses' },
    pricesCapturedAt: '2026-07-06',
  },
  {
    // No Cost Plus match: searched "ciclesonide" -- no medications found.
    matches: /alvesco|ciclesonide/i,
    goodRxSlug: 'alvesco',
    goodRxPrice: { price: 176.38, quantity: '1 inhaler, 160mcg' },
    pricesCapturedAt: '2026-07-06',
  },
  {
    // No Cost Plus match: searched "beclomethasone" -- only unrelated topical steroid fuzzy hits.
    matches: /qvar|beclomethasone/i,
    goodRxSlug: 'qvar',
    goodRxPrice: { price: 324.95, quantity: '1 redihaler, 80mcg, 10.6g' },
    pricesCapturedAt: '2026-07-06',
  },
]

function fallbackSlug(name: string): string {
  return name.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function cashLinkRule(name: string): CashLinkRule | undefined {
  return CASH_LINK_RULES.find((rule) => rule.matches.test(name))
}

export function goodRxUrl(name: string): string {
  const rule = cashLinkRule(name)
  const base = `https://www.goodrx.com/${rule?.goodRxSlug ?? fallbackSlug(name)}`
  return rule?.goodRxParams ? `${base}?${rule.goodRxParams}` : base
}

export function costPlusUrl(name: string): string | null {
  const path = cashLinkRule(name)?.costPlusPath
  return path ? `https://www.costplusdrugs.com/medications/${path}/` : null
}

/** Snapshot GoodRx price for this drug, or null if no exact strength/form match was captured. */
export function goodRxPrice(name: string): PricePoint | null {
  return cashLinkRule(name)?.goodRxPrice ?? null
}

/** Snapshot Cost Plus Drugs price for this drug, or null if unavailable/out of stock at capture time. */
export function costPlusPrice(name: string): PricePoint | null {
  return cashLinkRule(name)?.costPlusPrice ?? null
}

/** ISO date the prices above were captured, or null if this drug has no explicit cash-link rule. */
export function pricesCapturedAt(name: string): string | null {
  return cashLinkRule(name)?.pricesCapturedAt ?? null
}

/** Whether this drug resolves to an explicit rule, vs. the generic fallback-slug guesser. */
export function hasCashLinkRule(name: string): boolean {
  return cashLinkRule(name) !== undefined
}
