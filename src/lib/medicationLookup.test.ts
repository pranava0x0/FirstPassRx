import { describe, expect, it } from 'vitest'
import { getDefaultGuideView, guideOptions } from './formulary'
import { preferredLabel, productKey } from './medicationEntries.mjs'
import { findings, productFindings } from './medicationLookup'
import catalogData from '../data/generated/medications.json'
import aliasData from '../data/generated/medication-aliases.json'
import rawData from '../data/formulary.json'
import type { Formulary } from '../types/formulary'

const guide = getDefaultGuideView()
const record = guide.getRecord('masshealth', 'saba')!
const brand = preferredLabel(record.preferredAgent)

describe('exact medication findings', () => {
  it('keeps the preferred Ventolin strength separate from generic albuterol requiring PA', () => {
    expect(findings(record, brand)[0]).toMatchObject({
      label: 'First-pass option',
      sources: expect.arrayContaining(['mh-mhdl-t23']),
    })
    expect(findings(record, 'Albuterol HFA inhaler (generic)')[0]).toMatchObject({
      label: 'PA required',
      item: { criteriaMode: 'all' },
    })
    expect(findings(record, 'Ventolin HFA')).toEqual([])
    expect(findings(record, brand.replace('90 mcg', '180 mcg'))).toEqual([])
  })

  it('omits a reference-only pick while retaining separately sourced barriers', () => {
    expect(findings({ ...record, verification: 'example' }, brand)).toEqual([])
    const ref = { ...record, noCoveredAgent: true }
    expect(findings(ref, brand)).toEqual([])
    expect(findings(ref, record.paRequired[0]!.drug)[0]?.sources).toEqual(record.paRequired[0]!.sourceIds)
  })

  it('keeps the restriction and both findings when a label appears in two roles', () => {
    const restricted = {
      ...record,
      preferredRestriction: 'Prior authorization required',
      paRequired: [{ ...record.paRequired[0]!, drug: brand }],
    }
    const rows = findings(restricted, brand)
    expect(rows.map((row) => row.label)).toEqual(['Plan review required', 'PA required'])
    expect(rows[0]?.detail).toContain('Prior authorization required')
    expect(rows[1]?.sources).toEqual(record.paRequired[0]!.sourceIds)
  })
})

describe('one product across spellings (Dovato showed only Texas, 2026-11-22)', () => {
  it('gives every spelling of a product the same key, and keeps different products apart', () => {
    const dovato = [
      'DOVATO (dolutegravir/lamivudine)',
      'Dolutegravir-lamivudine (Dovato) 50-300 mg',
      'Dovato (dolutegravir/lamivudine) 50 mg/300 mg tablet',
      'Dolutegravir and lamivudine (Dovato)',
      'Dovato (dolutegravir-lamivudine), brand (QL 1 tab per day)',
    ].map((l) => productKey(l))
    expect(new Set(dovato).size).toBe(1)
    // a salt-only spelling (Washington) and a bare brand (TennCare, Highmark) land on the same product
    expect(productKey('Dolutegravir sodium/lamivudine (Dovato)')).toBe(dovato[0])
    expect(productKey('Dovato® tabs', aliasData)).toBe(dovato[0])
    expect(productKey('Dovato Oral Tablet', aliasData)).toBe(dovato[0])
    expect(productKey('E.E.S. (tablet)')).toBeTruthy()
    expect(productKey('E.E.S. (tablet)')).not.toBe(productKey('Ery-Tab (tablet)'))
    // salts that name different products stay apart
    expect(productKey('Fluticasone furoate')).not.toBe(productKey('Fluticasone propionate'))
    // a brand never merges with its generic, a form with another form, or one combination with another
    expect(productKey('Dolutegravir/lamivudine')).not.toBe(dovato[0])
    expect(productKey('Triumeq PD (dolutegravir-abacavir-lamivudine) tablet for suspension')).not.toBe(
      productKey('Triumeq (dolutegravir-abacavir-lamivudine) tablet'),
    )
    expect(productKey('Juluca (dolutegravir-rilpivirine)')).not.toBe(dovato[0])
  })

  it('lists Dovato once, in every state that has an HIV guide', () => {
    const catalog = catalogData as Record<string, string[]>
    expect(Object.keys(catalog).filter((k) => /dovato/i.test(k))).toHaveLength(1)
    const name = Object.keys(catalog).find((k) => /^dovato \(dolutegravir.lamivudine\)$/i.test(k))
    expect(name).toBeTruthy()
    const states = new Set(catalog[name!]!.map((s) => s.slice(0, 2)))
    for (const g of guideOptions.filter((x) => x.topicId === 'hiv')) expect(states.has(g.id.slice(0, 2)), g.id).toBe(true)
  })

  it('finds a plan\'s own spelling and reports it', () => {
    const tx = (rawData as Formulary).guides.find((g) => g.id === 'tx-hiv')!
    const rec = tx.records.find((r) => JSON.stringify(r).includes('DOVATO (dolutegravir/lamivudine)'))!
    const hits = productFindings(rec, 'Dovato (dolutegravir-lamivudine)')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.some((h) => h.matched === 'DOVATO (dolutegravir/lamivudine)')).toBe(true)
    const tn = (rawData as Formulary).guides.find((g) => g.id === 'tn-hiv')!
    const tnRec = tn.records.find((r) => r.payerId === 'tn-medicaid' && r.classId === 'hiv-art')!
    expect(productFindings(tnRec, 'Dovato (dolutegravir-lamivudine)').map((h) => h.matched)).toContain('Dovato® tabs')
  })
})
