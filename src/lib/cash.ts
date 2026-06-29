// Vendor URLs must use canonical medication names, not the clinical labels shown in the UI.
interface CashLinkRule {
  matches: RegExp
  goodRxSlug: string
  costPlusPath?: string
}

const CASH_LINK_RULES: CashLinkRule[] = [
  { matches: /albuterol sulfate solution|albuterol.*nebul/i, goodRxSlug: 'albuterol', costPlusPath: 'albuterol-sulfate-0_63mg-3ml-nebulization-solution-3-accuneb' },
  { matches: /albuterol|proair|ventolin|proventil/i, goodRxSlug: 'albuterol', costPlusPath: 'albuterol-90mcg-inhaler18g' },
  { matches: /budesonide.*formoterol|symbicort/i, goodRxSlug: 'budesonide-formoterol', costPlusPath: 'budesonide-formoterol-fumarate-160-4_5mcg-act-aerosol-inhaler-10_2-symbicort' },
  { matches: /budesonide|pulmicort/i, goodRxSlug: 'budesonide', costPlusPath: 'budesonide-0_5mg_2ml-inhalation-suspension-60ml' },
  { matches: /fluticasone.*salmeterol|advair|wixela|airduo/i, goodRxSlug: 'fluticasone-salmeterol', costPlusPath: 'Fluticasone-Salmeterol-250mcg50mcg-Tablet' },
  { matches: /fluticasone furoate.*vilanterol|breo/i, goodRxSlug: 'breo-ellipta', costPlusPath: 'fluticasone-furoate-vilanterol-100-25-mcg_act-aerosol-powder-breath-activated-60' },
  { matches: /fluticasone propionate|flovent/i, goodRxSlug: 'fluticasone', costPlusPath: 'fluticasone-propionate-hfa-110-mcg_act-inhaler-12' },
  { matches: /levalbuterol|xopenex/i, goodRxSlug: 'levalbuterol', costPlusPath: 'levalbuterol-tartrate-45mcg_act-aerosol-inhaler-15' },
  { matches: /tiotropium|spiriva/i, goodRxSlug: 'tiotropium', costPlusPath: 'tiotropium-bromide-inhalation-powder-18mcg-30-capsules' },
  { matches: /estradiol.*norethindrone|activella|mimvey|amabelz/i, goodRxSlug: 'activella', costPlusPath: 'estradiolnorethrindroneacetate-0_5mg0_1mg-blisterpack28pack' },
  { matches: /ethinyl estradiol.*norethindrone|norethindrone.*ethinyl estradiol|jinteli|fyavolv|femhrt/i, goodRxSlug: 'jinteli', costPlusPath: 'norethindrone-acetate-ethinyl-estradiol-1mg-5mcg-pack-of-tablets-90-fyavolv' },
  { matches: /estradiol vaginal (tablet|insert)|vagifem|yuvafem/i, goodRxSlug: 'vagifem', costPlusPath: 'estradiol-10mcg-vaginaltablet8pack' },
  { matches: /estradiol vaginal cream|estrace cream/i, goodRxSlug: 'estradiol', costPlusPath: 'estradiol-0_01-tubeofcream42_5g' },
  { matches: /estradiol.*(gel|divigel|estrogel|elestrin)/i, goodRxSlug: 'estradiol', costPlusPath: 'estradiol-1mg-g-gel-packet-divigel' },
  { matches: /estradiol.*(twice.weekly|dotti|lyllana|vivelle|minivelle)/i, goodRxSlug: 'estradiol', costPlusPath: 'estradiol-(twice-weekly)-0_05-mg_24hr-patch-8-lyllana' },
  { matches: /estradiol.*(weekly|patch|transdermal)|climara/i, goodRxSlug: 'estradiol', costPlusPath: 'estradiol-0_05mg-carton-of-weekly-patches-4-climara' },
  { matches: /estradiol oral|estrace|^estradiol$/i, goodRxSlug: 'estradiol', costPlusPath: 'estradiol-1mg-tablet' },
  { matches: /medroxyprogesterone|provera/i, goodRxSlug: 'medroxyprogesterone', costPlusPath: 'medroxyprogesteroneacetate-10mg-tablet' },
  { matches: /micronized progesterone|progesterone.*micronized|prometrium/i, goodRxSlug: 'progesterone', costPlusPath: 'progesterone-100mg-capsule' },
  { matches: /norethindrone acetate/i, goodRxSlug: 'norethindrone', costPlusPath: 'norethindroneacetate-5mg-tablet' },
]

function fallbackSlug(name: string): string {
  return name.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function cashLinkRule(name: string): CashLinkRule | undefined {
  return CASH_LINK_RULES.find((rule) => rule.matches.test(name))
}

export function goodRxUrl(name: string): string {
  return `https://www.goodrx.com/${cashLinkRule(name)?.goodRxSlug ?? fallbackSlug(name)}`
}

export function costPlusUrl(name: string): string | null {
  const path = cashLinkRule(name)?.costPlusPath
  return path ? `https://www.costplusdrugs.com/medications/${path}/` : null
}
