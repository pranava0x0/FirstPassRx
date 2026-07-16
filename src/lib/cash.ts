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
 * brand variants (e.g. DUAVEE moved to alternatives, a few uhc-community brand-tier duplicates).
 * Raised 684 → 808 on 2026-07-07 (same day) when 4 brand-new MA guides shipped (`ma-ace`,
 * `ma-diabetes`, `ma-menopause`, `ma-nsaids`; 5 payers each). Unlike the VA raise above, this is a
 * large jump (+124) because it's MA's *first* diabetes and full menopause-HT coverage -- each of
 * MassHealth/BCBSMA/Tufts/Harvard Pilgrim/MGB names its own long tail of insulin/GLP-1/SGLT2 and
 * estrogen-product brand variants the existing ruleset has no entry for, the same "new drug-class
 * long tail" pattern as the original NY/MD raises above, not a `validate()`-fix artifact this time
 * (only ~16 items were reclassified `paRequired` -> `alternatives` here, most of the increase is
 * genuinely new covered-drug names).
 * Raised 808 → 1088 on 2026-07-07 (same day) when 4 brand-new IL guides shipped (`il-inhalers`,
 * `il-ace`, `il-diabetes`, `il-menopause`; 8 payers each) plus `il-nsaids` expanded from 1 payer
 * to 8. This is IL's first depth beyond a single FFS payer for every topic, so 5 brand-new
 * Medicaid MCOs (Aetna Better Health of Illinois, Blue Cross Community Health Plans, CountyCare,
 * Meridian, Molina) each name their own long tail of inhaler/ACE/diabetes/HRT/NSAID brand and
 * generic-form variants the existing ruleset has no entry for -- the same "new payer roster
 * surfaces a new drug-name long tail" pattern as every prior raise above, now at IL's full
 * 8-payer depth in one merge.
 * Lowered 1088 → 633 on 2026-07-09: added real GoodRx/Cost Plus rules for every diabetes
 * (metformin, dapagliflozin, empagliflozin, insulin glargine/lispro/degludec, dulaglutide,
 * liraglutide, semaglutide oral + injectable) and NSAID (naproxen, ibuprofen, meloxicam) preferred
 * agent -- the 177-cell preferred-agent gap the validation run surfaced, which also swept up ~278
 * of these same drugs' alternative-list names across all 5 states. Prices captured off a real
 * browser session (see the rule block below). Remaining 633 is the long tail of brand/generic-form
 * variants in alternatives lists (HRT products, ACE/inhaler brand variants) -- a logged backlog
 * item, not a preferred-agent gap.
 * Lowered 633 → 537 on 2026-07-09 (same session): priced the last 7 non-diabetes/NSAID
 * preferred-agent stragglers (vaginal estradiol, ipratropium, oral conjugated estrogens), so
 * EVERY one of the 510 state×class preferred-agent cells now carries a captured price. The
 * remaining long tail is purely alternatives-list HRT/ACE/inhaler brand & generic-form variants
 * -- logged in backlog.md, not a headline-recommendation gap.
 * Lowered 537 → 509 on 2026-07-09 (same session): broadened the existing micronized-progesterone
 * rule's matcher to catch the bare "progesterone" inn (3 progestogen cells the UI resolves by inn
 * alone showed link-only), which also swept up progesterone brand variants in alternatives. Every
 * preferred-agent cell now prices by inn-only lookup -- the exact path ResultCard/PrescribeOptions
 * use.
 * Raised 509 → 541 on 2026-07-09 (code-review fix, same session): the metformin rule was catching
 * ~32 multi-ingredient combo names (Synjardy/Xigduo/Trijardy/glipizide-metformin/...) and pricing
 * them as cheap plain metformin ($29.63) -- badly wrong for $300-600 brand combos. Added a combo
 * negative-lookahead so those fall through to the SGLT2 rules (reasonable proxy) or the no-price
 * fallback instead. Every combo dropped here was an *alternatives*-list name, never a preferred
 * agent, so all 510 preferred-agent cells still price. Correctness raise (we stopped mispricing),
 * not a coverage regression -- same category as the MD paRequired→alternatives raises above.
 * Raised 541 → 575 on 2026-07-09 (Codex PR review, same session): same combo/form-mismatch class
 * caught in two more matchers -- (1) the broadened progesterone rule was pricing non-oral forms
 * (Crinone vaginal gel, vaginal suppository, Endometrin insert, injection oil) and the Bijuva
 * estradiol/progesterone combo as the 100mg oral capsule; (2) the glargine rule matched the Soliqua
 * glargine-lixisenatide fixed-dose combo and priced it as Lantus $35. Both now excluded via negative
 * lookahead so they fall through instead of showing a confident wrong price. Again all
 * preferred-agent cells still price; the raise is dropped alternatives-list mispricings.
 * Lowered 575 → 362 on 2026-07-16: added rules for the ~19 "second-tier" oral NSAID molecules
 * (celecoxib, diclofenac potassium/sodium-ER/topical/misoprostol-combo, etodolac, flurbiprofen,
 * indomethacin, ketoprofen/ketoprofen-ER, ketorolac, meclofenamate, mefenamic acid, nabumetone,
 * oxaprozin, piroxicam, sulindac, diflunisal, tolmetin, salsalate, aspirin) that had zero
 * cash-link rule at all -- referenced under ~200 different verbatim phrasings across the 5 NSAID
 * guides (one per source PDF's own wording for the same drug), the same "new guide surfaces a new
 * long tail" pattern as every raise above, just discovered via a user UAT screenshot instead of a
 * new-guide merge. Cost Plus prices are real (captured 2026-07-16); GoodRx prices are mostly
 * still missing -- GoodRx served a real "Press & Hold" bot-check CAPTCHA to this session after one
 * successful lookup, a harder block than the usual plain-fetch 403 this project has seen before.
 * Revisit to fill in GoodRx once accessible; meclofenamate/salsalate/immediate-release-ketoprofen
 * are confirmed not carried by Cost Plus (not a research gap). */
export const KNOWN_UNPRICED_GAP = 362

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
    // Bare "progesterone" (the progestogen-cell inn) means ORAL micronized progesterone here.
    // Broadened 2026-07-09 to catch the bare inn, then narrowed same-day (code review) to exclude
    // non-oral forms (Crinone gel, vaginal suppository, Endometrin insert, injection oil) and combos
    // (Bijuva estradiol/progesterone) that would otherwise be mispriced as the 100mg oral capsule.
    // medroxyprogesterone has its own rule earlier, so first-match-wins keeps it unaffected.
    matches: /^(?!.*(vaginal|suppositor|\bgel\b|\binsert\b|crinone|endometrin|prochieve|intramuscular|injection|\boil\b|estradiol|bijuva)).*(progesterone|prometrium)/i,
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

  // ---- Diabetes + NSAID preferred agents (added 2026-07-09) ----
  // Every diabetes (metformin/GLP-1/SGLT2/insulin) and NSAID preferred agent across all 5 states
  // shipped link-only (no captured price) -- the 177-cell preferred-agent gap the 2026-07-09
  // validation run surfaced. Prices read off a real browser session (both vendors bot-block plain
  // fetch), ZIP 20009, on the capture date. GoodRx figure is the "Standard GoodRx price" unless a
  // manufacturer cash program is what the page surfaces (Jardiance/Lantus/Ozempic), matching the
  // existing inhaler rules' convention. Cost Plus omitted where the catalog genuinely doesn't carry
  // the drug (brand GLP-1s, brand SGLT2s, all insulins, OTC-strength ibuprofen) -- confirmed by
  // search, a documented outcome, not a research gap.
  {
    // Standalone metformin only. The negative lookahead excludes multi-ingredient combos
    // (Synjardy/Xigduo/Trijardy/Janumet/glipizide-metformin/pioglitazone-metformin/...) so they are
    // NOT priced as cheap plain metformin -- those fall through to the SGLT2 rules below (a
    // reasonable proxy, the SGLT2 is the costly component) or, for DPP4/SU/TZD combos, to the
    // no-price fallback (their pre-2026-07-09 behavior). Without this, ~50 covered combo names
    // showed $29.63, badly understating $300-600 brand combos.
    matches: /^(?!.*\b(?:dapagliflozin|empagliflozin|canagliflozin|ertugliflozin|sitagliptin|saxagliptin|linagliptin|alogliptin|glipizide|glyburide|glimepiride|pioglitazone|rosiglitazone|repaglinide|nateglinide|synjardy|xigduo|trijardy|glyxambi|janumet|jentadueto|kazano|oseni|metaglip|glucovance|actoplus|kombiglyze|prandimet|invokamet|segluromet|qternmet|steglujan|soliqua)\b).*\bmetformin\b/i,
    goodRxSlug: 'metformin',
    goodRxParams: 'label_override=metformin&form=tablet&dosage=500mg&quantity=60',
    costPlusPath: 'metformin-500mg-tablet',
    goodRxPrice: { price: 29.63, quantity: '60 tablets, 500mg' },
    costPlusPrice: { price: 5.31, quantity: '30 tablets, 500mg' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    matches: /naproxen|naprosyn|anaprox/i,
    goodRxSlug: 'naproxen',
    goodRxParams: 'label_override=naproxen&form=tablet&dosage=500mg&quantity=60',
    costPlusPath: 'naproxen-500mg-tablet',
    goodRxPrice: { price: 30.71, quantity: '60 tablets, 500mg' },
    costPlusPrice: { price: 6.38, quantity: '30 tablets, 500mg' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    // No Cost Plus match: ibuprofen 600mg and 800mg both 404 -- Cost Plus doesn't carry the
    // OTC-adjacent Rx strengths. GoodRx-only by design.
    matches: /ibuprofen/i,
    goodRxSlug: 'ibuprofen',
    goodRxParams: 'label_override=ibuprofen&form=tablet&dosage=600mg&quantity=30',
    goodRxPrice: { price: 29.65, quantity: '30 tablets, 600mg' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    matches: /meloxicam|mobic/i,
    goodRxSlug: 'meloxicam',
    goodRxParams: 'label_override=meloxicam&form=tablet&dosage=15mg&quantity=30',
    costPlusPath: 'meloxicam-15mg-tablet',
    goodRxPrice: { price: 19.61, quantity: '30 tablets, 15mg' },
    costPlusPrice: { price: 5.38, quantity: '30 tablets, 15mg' },
    pricesCapturedAt: '2026-07-09',
  },
  // ---- Remaining oral NSAID alternatives (added 2026-07-16) ----
  // The 2026-07-16 UAT found ~19 real NSAID molecules (celecoxib + the "second-tier" oral NSAIDs)
  // with zero cash-link rule at all, referenced under ~200 different verbatim phrasings across the
  // 5 NSAID guides' alternatives lists (one per source PDF's own wording). Cost Plus prices below
  // are real, captured 2026-07-16 off a real browser session. GoodRx prices are OMITTED, not
  // confirmed-unavailable -- GoodRx's bot-check (a real "Press & Hold" CAPTCHA, not the usual
  // plain-fetch 403) blocked this session's attempts after one successful lookup (celecoxib:
  // $21.41, 30x200mg, standard price). Revisit to fill these in; do not treat the omission as
  // "Cost Plus only by design" the way the ibuprofen rule above is.
  {
    // Combo product -- must precede the plain diclofenac rule below (its name always contains
    // "diclofenac").
    matches: /diclofenac.*misoprostol|arthrotec/i,
    goodRxSlug: 'arthrotec',
    costPlusPath: 'diclofenac-misoprostol-50-0_2mg-tablet-delayed-release-arthrotec',
    costPlusPrice: { price: 16.83, quantity: '50-0.2mg tablets, delayed release' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Topical/gel forms (Voltaren Gel, Pennsaid) are a distinct product from the oral tablet --
    // must precede the plain diclofenac rule below.
    matches: /diclofenac.*(gel|topical|patch|solution)|voltaren gel|pennsaid/i,
    goodRxSlug: 'diclofenac',
    costPlusPath: 'diclofenac-sodium-0_10-solution-dropper-5-voltaren',
    costPlusPrice: { price: 9.02, quantity: '5mL dropper, 0.10% solution' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Diclofenac potassium (immediate-release, Cataflam/Zipsor/Lofena family) -- must precede the
    // plain diclofenac rule below since "potassium" is more specific.
    matches: /diclofenac potassium/i,
    goodRxSlug: 'diclofenac-potassium',
    costPlusPath: 'diclofenacpotassium-50mg-tablet',
    costPlusPrice: { price: 7.14, quantity: '30 tablets, 50mg' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Catch-all diclofenac (sodium DR/ER/unspecified salt) -- must stay after the three diclofenac
    // rules above so combo/topical/potassium forms don't fall through to this ER sodium price.
    matches: /diclofenac/i,
    goodRxSlug: 'diclofenac-sodium',
    costPlusPath: 'diclofenacsodiumer-100mg-tablet',
    costPlusPrice: { price: 20.25, quantity: '100mg extended-release tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /celecoxib|celebrex/i,
    goodRxSlug: 'celecoxib',
    goodRxParams: 'label_override=celecoxib&form=capsule&dosage=200mg&quantity=30',
    costPlusPath: 'celecoxib-100mg-capsule',
    goodRxPrice: { price: 21.41, quantity: '30 capsules, 200mg' },
    costPlusPrice: { price: 5.83, quantity: '30 capsules, 100mg' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /etodolac|lodine/i,
    goodRxSlug: 'etodolac',
    costPlusPath: 'etodolac-200mg-capsule',
    costPlusPrice: { price: 10.14, quantity: '200mg capsule' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /flurbiprofen|ansaid|lurbiro/i,
    goodRxSlug: 'flurbiprofen',
    costPlusPath: 'flurbiprofen-100mg-tablet-ansaid',
    costPlusPrice: { price: 14.80, quantity: '100mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Immediate-release only -- Cost Plus's indomethacin ER (75mg) is a separate, unpriced product.
    matches: /indomethacin|indocin/i,
    goodRxSlug: 'indomethacin',
    costPlusPath: 'indomethacin-25mg-capsule',
    costPlusPrice: { price: 7.79, quantity: '25mg capsule' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Extended-release only -- must precede the plain ketoprofen rule below. Cost Plus doesn't
    // carry the immediate-release 50/75mg capsule at all (confirmed by search), only this ER form,
    // which is priced much higher -- do not let the bare "ketoprofen" rule below inherit this price.
    matches: /ketoprofen.*(er|extended)/i,
    goodRxSlug: 'ketoprofen',
    costPlusPath: 'ketoprofen-200-mg-capsule-extended-release-24-hour',
    costPlusPrice: { price: 170.98, quantity: '200mg extended-release capsule' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Immediate-release: Cost Plus doesn't carry it (confirmed by search) -- GoodRx-link-only for
    // now (see the block comment above; this is a tool-outage gap, not a confirmed unavailability).
    matches: /ketoprofen/i,
    goodRxSlug: 'ketoprofen',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /ketorolac|toradol/i,
    goodRxSlug: 'ketorolac',
    costPlusPath: 'KetorolacTromethamine-10mg-Tablet',
    costPlusPrice: { price: 6.72, quantity: '10mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /nabumetone|relafen/i,
    goodRxSlug: 'nabumetone',
    costPlusPath: 'nabumetone-500mg-tablet',
    costPlusPrice: { price: 7.14, quantity: '500mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /oxaprozin|daypro|coxanto/i,
    goodRxSlug: 'oxaprozin',
    costPlusPath: 'oxaprozin-600mg-tablet-daypro',
    costPlusPrice: { price: 12.07, quantity: '600mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /piroxicam|feldene/i,
    goodRxSlug: 'piroxicam',
    costPlusPath: 'piroxicam-10mg-capsule-feldene',
    costPlusPrice: { price: 7.76, quantity: '10mg capsule' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /sulindac|clinoril/i,
    goodRxSlug: 'sulindac',
    costPlusPath: 'sulindac-150mg-tablet-clinoril',
    costPlusPrice: { price: 9.97, quantity: '150mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /mefenamic acid|ponstel/i,
    goodRxSlug: 'mefenamic-acid',
    costPlusPath: 'mefenamic-acid-250mg-capsule-ponstel',
    costPlusPrice: { price: 21.56, quantity: '250mg capsule' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /diflunisal|dolobid/i,
    goodRxSlug: 'diflunisal',
    costPlusPath: 'diflunisal-500mg-tablet-dolobid',
    costPlusPrice: { price: 27.94, quantity: '500mg tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /tolmetin|tolectin/i,
    goodRxSlug: 'tolmetin',
    costPlusPath: 'tolmetin-sodium-400mg-capsule-tolectin-ds',
    costPlusPrice: { price: 114.19, quantity: '400mg capsule' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Not carried by Cost Plus (confirmed by search -- returns only an unrelated fuzzy match).
    // GoodRx-link-only for now; see the block comment above.
    matches: /meclofenamate|meclomen/i,
    goodRxSlug: 'meclofenamate',
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Not carried by Cost Plus (confirmed by search -- returns only an unrelated fuzzy match).
    // GoodRx-link-only for now; see the block comment above.
    matches: /salsalate/i,
    goodRxSlug: 'salsalate',
    pricesCapturedAt: '2026-07-16',
  },
  {
    matches: /\baspirin\b/i,
    goodRxSlug: 'aspirin',
    costPlusPath: 'aspirin-low-dose-81mg-tablet-delayed-release-aspirin-low-dose',
    costPlusPrice: { price: 5.21, quantity: '81mg delayed-release tablet' },
    pricesCapturedAt: '2026-07-16',
  },
  {
    // Cost Plus slug carries the salt + brand suffix (dapagliflozin-propanediol-...-farxiga), not
    // the plain generic-name pattern -- see CLAUDE.md's Cost Plus slug scar tissue.
    matches: /dapagliflozin|farxiga/i,
    goodRxSlug: 'dapagliflozin',
    goodRxParams: 'label_override=dapagliflozin&form=tablet&dosage=10mg&quantity=30',
    costPlusPath: 'dapagliflozin-propanediol-10mg-tablet-farxiga',
    goodRxPrice: { price: 20.15, quantity: '30 tablets, 10mg' },
    costPlusPrice: { price: 8.35, quantity: '30 tablets, 10mg' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    // Brand only (no generic empagliflozin in the US at capture time); Cost Plus doesn't carry it.
    // GoodRx surfaces the manufacturer cash price ($249) vs. $759.99 retail.
    matches: /empagliflozin|jardiance/i,
    goodRxSlug: 'jardiance',
    goodRxParams: 'label_override=jardiance&form=tablet&dosage=10mg&quantity=30',
    goodRxPrice: { price: 249.0, quantity: '30 tablets, 10mg (manufacturer cash price)' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    // Covers brand Lantus, biosimilar/interchangeable glargine (Basaglar, Semglee, glargine-yfgn,
    // "GLARGIN YFGN") and Toujeo (glargine U-300, same molecule + $35 program). Cost Plus doesn't
    // carry insulins. $35 is the Sanofi Insulins $35/30-day cap surfaced via GoodRx, which the
    // biosimilars match or beat. Negative lookahead excludes the Soliqua glargine-lixisenatide
    // fixed-dose combo (a GLP-1/insulin combo ~$600+, a different product) per code review.
    matches: /^(?!.*(lixisenatide|soliqua)).*(insulin glargine|glargin|lantus|basaglar|semglee)/i,
    goodRxSlug: 'lantus',
    goodRxPrice: { price: 35.0, quantity: '30-day supply, 100 units/mL (Sanofi $35 program / GoodRx)' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    matches: /insulin lispro|humalog|lispro/i,
    goodRxSlug: 'humalog',
    goodRxPrice: { price: 51.24, quantity: '1 vial, 10mL, 100 units/mL' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    matches: /insulin degludec|degludec|tresiba/i,
    goodRxSlug: 'tresiba',
    goodRxPrice: { price: 141.54, quantity: '1 vial, 10mL, 100 units/mL' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    // Brand only; Cost Plus doesn't carry it. Standard GoodRx price, 1-carton (1-month) supply.
    matches: /dulaglutide|trulicity/i,
    goodRxSlug: 'trulicity',
    goodRxPrice: { price: 1052, quantity: '1 carton (4 pens), 0.75mg/0.5mL' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    matches: /liraglutide|victoza/i,
    goodRxSlug: 'victoza',
    goodRxPrice: { price: 154.2, quantity: '1 carton (3 pens), 18mg/3mL' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    // Oral semaglutide -- MUST precede the injectable Ozempic rule below so oral cells don't route
    // to the pen. Cost Plus doesn't carry it.
    matches: /rybelsus|semaglutide.*oral|oral.*semaglutide/i,
    goodRxSlug: 'rybelsus',
    goodRxPrice: { price: 1065, quantity: '30 tablets, 3mg' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    // Injectable semaglutide. GoodRx migrated its Ozempic page to the new oral tablet and gates the
    // pen behind a form switch; $199 is the NovoCare 1-month pen cash price the page surfaces (vs.
    // ~$950 standard). Cost Plus doesn't carry it.
    matches: /semaglutide|ozempic/i,
    goodRxSlug: 'ozempic',
    goodRxPrice: { price: 199, quantity: '1 pen, 1-month supply (NovoCare cash price via GoodRx)' },
    pricesCapturedAt: '2026-07-09',
  },

  // ---- Non-diabetes/NSAID straggler preferred agents (added 2026-07-09) ----
  // The last 7 preferred-agent cells with no captured price after the diabetes/NSAID sweep above:
  // vaginal estradiol (4), ipratropium (2), oral conjugated estrogens (1). Same real browser
  // session, same capture date.
  {
    // Vaginal estradiol insert/tablet/cream (generic Vagifem/Yuvafem/Estrace Vaginal). Placed after
    // the transdermal/patch estradiol rules above so it only catches the vaginal phrasing.
    matches: /estradiol vaginal|vaginal.*estradiol|vagifem|yuvafem|imvexxy/i,
    goodRxSlug: 'estradiol',
    goodRxParams: 'form=insert&label_override=estradiol',
    goodRxPrice: { price: 159.35, quantity: '24 inserts, 10mcg (generic Vagifem/Yuvafem)' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    // Both ipratropium cells resolve by the bare name "ipratropium bromide" (coveredDrugNames keys
    // off inn/brand, not strength) so one rule serves both. Priced as the generic nebulizer solution
    // (0.02%, 25 vials, $33.96) -- the common multisource form. The brand Atrovent HFA aerosol
    // (17mcg inhaler) runs ~$233.92 standard; the name-based rule can't distinguish the two forms
    // (the logged "strength/form as a first-class field" limitation).
    matches: /ipratropium|atrovent/i,
    goodRxSlug: 'ipratropium',
    goodRxParams: 'form=vial&dosage=0.02%25&label_override=ipratropium-bromide',
    goodRxPrice: { price: 33.96, quantity: '25 vials, 0.02% (2.5mL nebulizer solution)' },
    pricesCapturedAt: '2026-07-09',
  },
  {
    // Brand only (no generic conjugated estrogens); Cost Plus doesn't carry it.
    matches: /conjugated estrogen|premarin/i,
    goodRxSlug: 'premarin',
    goodRxParams: 'form=tablet&dosage=0.625mg&quantity=30&label_override=premarin',
    goodRxPrice: { price: 99.0, quantity: '30 tablets, 0.625mg (GoodRx coupon)' },
    pricesCapturedAt: '2026-07-09',
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
