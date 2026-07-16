import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PrescribeOptions } from './PrescribeOptions'
import type { FormularyRecord, PayerMeta } from '../types/formulary'

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

describe('PrescribeOptions role badges', () => {
  it('does not tag an alternative "Generic" when its note says no generic exists', () => {
    render(
      <PrescribeOptions
        record={record({
          alternatives: [
            {
              drug: 'PREMARIN oral (conjugated estrogens; no generic exists)',
              note: 'On formulary (no generic exists), no restriction',
              sourceIds: ['x'],
            },
          ],
        })}
        payer={payer}
      />,
    )

    const card = screen.getByText('PREMARIN oral (conjugated estrogens; no generic exists)').closest('.rx-option-card')
    expect(card).not.toBeNull()
    expect(card).not.toHaveTextContent('Generic')
    expect(card).toHaveTextContent('Alternative')
  })

  it('still tags a genuinely generic alternative "Generic"', () => {
    render(
      <PrescribeOptions
        record={record({
          alternatives: [
            {
              drug: 'Budesonide/formoterol (generic)',
              note: 'Covered generic, no PA',
              sourceIds: ['x'],
            },
          ],
        })}
        payer={payer}
      />,
    )

    const card = screen.getByText('Budesonide/formoterol (generic)').closest('.rx-option-card')
    expect(card).toHaveTextContent('Generic')
  })
})
