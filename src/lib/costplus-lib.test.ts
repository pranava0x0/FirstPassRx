import { describe, expect, it } from 'vitest'
import { cashPrice, formOf, sameForm, sameMolecule, slugOf, unitsFor, words } from '../../scripts/costplus-lib.mjs'
import type { CostPlusEntry } from '../../scripts/costplus-lib.mjs'

const entry = (over: Partial<CostPlusEntry>): CostPlusEntry => ({
  url: 'https://www.costplusdrugs.com/medications/x-1mg-tablet/?utm_source=api',
  medication_name: 'X',
  form: 'Tablet',
  strength: '1mg',
  unit: 'ea',
  pack_size: 100,
  quantity: 1,
  cpd_channel: { price_per_unit: 0.05405, cash_dispensing_fee: 5, in_stock: true },
  ...over,
})

describe('Cost Plus price-list helpers', () => {
  it('reads the product path from the API url', () => {
    expect(slugOf('https://www.costplusdrugs.com/medications/Warfarin-10mg-Tablet/?utm_source=api')).toBe('warfarin-10mg-tablet')
  })

  it('prices N units plus the dispensing fee, as the product page does (warfarin 30 = $6.62)', () => {
    expect(cashPrice(entry({}), 30)).toBe(6.62)
    expect(cashPrice(entry({ cpd_channel: null }), 30)).toBeNull()
  })

  it('reads a count only when the label states one, in the entry billing unit', () => {
    expect(unitsFor('30 tablets, 5mg', entry({}))).toBe(30)
    expect(unitsFor('20mg tablet', entry({}))).toBeNull() // a strength, not a count
    expect(unitsFor('1 HFA inhaler, 90mcg', entry({ unit: 'g', pack_size: 18 }))).toBe(18)
    expect(unitsFor('45 g, 1.2%/5% gel', entry({ unit: 'g', pack_size: 45 }))).toBe(45)
    expect(unitsFor('30 tablets', entry({ unit: 'mL' }))).toBeNull()
    expect(unitsFor('1 carton (3 pens), 18mg/3mL', entry({ unit: 'mL', pack_size: 9 }))).toBe(9)
  })

  it('never matches a single agent to a combination product', () => {
    expect(sameMolecule(words('Atenolol'), entry({ medication_name: 'Atenolol-Chlorthalidone' }))).toBe(false)
    expect(sameMolecule(words('Atenolol tablets'), entry({ medication_name: 'Atenolol' }))).toBe(true)
    expect(sameMolecule(words('Clindamycin phosphate'), entry({ medication_name: 'Clindamycin Phosphate-Benzoyl Peroxide' }))).toBe(false)
    expect(sameMolecule(words('fluticasone furoate'), entry({ medication_name: 'Fluticasone Propionate' }))).toBe(false)
  })

  it('keeps release and dosage form apart', () => {
    const er = entry({ medication_name: 'Guanfacine HCl Extended Release (ER)', form: 'Extended Release Tablet' })
    const ir = entry({ medication_name: 'Guanfacine HCl' })
    expect(sameForm(formOf('Guanfacine ER 1 mg'), er)).toBe(true)
    expect(sameForm(formOf('Guanfacine ER 1 mg'), ir)).toBe(false)
    expect(sameForm(formOf('Olanzapine 5 mg'), entry({ form: 'Tablet, Orally Disintegrating', url: '/medications/olanzapine-5mg-odt/' }))).toBe(false)
    expect(sameForm(formOf('Clindamycin 1% gel'), entry({ form: 'Can of Foam' }))).toBe(false)
  })
})
