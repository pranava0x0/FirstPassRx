import { describe, it, expect } from 'vitest'
import { buildAppealLetter } from './appealLetter'
import type { ClassMeta, FormularyRecord, PaItem, PayerMeta } from '../types/formulary'

function record(over: Partial<FormularyRecord> = {}): FormularyRecord {
  return {
    payerId: 'masshealth',
    classId: 'icslaba',
    preferredAgent: {
      inn: 'Budesonide/formoterol',
      brand: 'Symbicort',
      genericAvailable: true,
      strength: '160/4.5 mcg',
      sig: '2 puffs twice daily',
      sigShort: '2 puffs BID',
      plainSig: 'Two puffs, morning and night.',
    },
    boglActive: false,
    boglNote: null,
    paRequired: [],
    stepTherapy: null,
    verification: 'verified',
    verificationNote: 'test',
    sourceIds: ['x'],
    coverageSourceIds: ['x'],
    restrictionSourceIds: ['x'],
    lastReviewed: '2026-06-22',
    ...over,
  }
}

const item: PaItem = {
  drug: 'AirDuo RespiClick',
  sourceIds: ['x'],
  outcome: 'pa',
  reason: 'PA required',
}

const payer: PayerMeta = {
  id: 'masshealth',
  name: 'MassHealth',
  shortName: 'MassHealth',
  pbm: 'Conduent',
  productName: 'MassHealth Standard PDL',
  marketSegment: 'medicaid-ffs',
  formularyId: 'PDL-2026',
  formularyUrl: 'https://example.com/pdl',
  paPolicyUrl: 'https://example.com/pa-policy',
  sourceIds: ['x'],
}

const drugClass: ClassMeta = {
  id: 'icslaba',
  name: 'ICS/LABA (Combo)',
  shortName: 'ICS/LABA',
  plainName: 'Daily combo controller',
  description: 'Inhaled corticosteroid / long-acting beta agonist combination.',
  plainDescription: 'A daily inhaler that combines a steroid and a long-acting reliever.',
  sourceIds: ['x'],
}

describe('buildAppealLetter', () => {
  it('includes the drug, plan, PBM, and reject reason', () => {
    const letter = buildAppealLetter(record(), item, payer, drugClass)
    expect(letter).toContain('AirDuo RespiClick')
    expect(letter).toContain('MassHealth')
    expect(letter).toContain('Conduent')
    expect(letter).toContain('PA required')
    expect(letter).toContain('prior authorization')
    expect(letter).toContain('daily combo controller')
  })

  it('includes the plan PA policy URL when present', () => {
    const letter = buildAppealLetter(record(), item, payer, drugClass)
    expect(letter).toContain('https://example.com/pa-policy')
  })

  it('omits the PA policy line when the payer has none', () => {
    const letter = buildAppealLetter(record(), item, { ...payer, paPolicyUrl: undefined }, drugClass)
    expect(letter).not.toContain('Plan PA policy')
  })

  it('includes step-therapy text when the item outcome is step', () => {
    const letter = buildAppealLetter(
      record({ stepTherapy: 'Try albuterol HFA first.' }),
      { ...item, outcome: 'step' },
      payer,
      drugClass,
    )
    expect(letter).toContain('Step therapy on file with the plan for this drug class: Try albuterol HFA first.')
  })

  it('omits the step-therapy line when the cell has none', () => {
    const letter = buildAppealLetter(record(), { ...item, outcome: 'step' }, payer, drugClass)
    expect(letter).not.toContain('Step therapy on file')
  })

  it('omits step-therapy text for a non-step outcome even when the record has one (avoids misattributing another drug\'s requirement)', () => {
    const letter = buildAppealLetter(record({ stepTherapy: 'Try albuterol HFA first.' }), item, payer, drugClass)
    expect(letter).not.toContain('Step therapy on file')
  })

  it('labels a step-therapy outcome distinctly from a PA outcome', () => {
    const letter = buildAppealLetter(record(), { ...item, outcome: 'step' }, payer, drugClass)
    expect(letter).toContain('appeal the step therapy denial')
  })

  it('labels a non-formulary outcome distinctly', () => {
    const letter = buildAppealLetter(record(), { ...item, outcome: 'nonformulary' }, payer, drugClass)
    expect(letter).toContain('appeal the non-formulary status denial')
  })

  it('references the RE: block, addressee, and enclosures modeled on published appeal templates', () => {
    const letter = buildAppealLetter(record(), item, payer, drugClass)
    expect(letter).toContain('Appeals and Grievances Department')
    expect(letter).toContain('[Reference # on Denial Letter]')
    expect(letter).toContain(`To Whom It May Concern at ${payer.name}:`)
    expect(letter).toContain('Letter of Medical Necessity')
    expect(letter).toContain('Enclosures:')
    expect(letter).toContain('CC: [Prescriber Name]')
  })
})
