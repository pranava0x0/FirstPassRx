import { describe, expect, it } from 'vitest'
import { getDefaultGuideView } from './formulary'
import { preferredLabel } from './medicationEntries.mjs'
import { findings } from './medicationLookup'

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
