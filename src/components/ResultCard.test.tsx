import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultCard } from './ResultCard'
import type { FormularyRecord, PayerMeta } from '../types/formulary'

function record(over: Partial<FormularyRecord> = {}): FormularyRecord {
  return {
    payerId: 'kaiser-permanente-ca',
    classId: 'rankl-inhibitor',
    preferredAgent: {
      inn: 'denosumab',
      brand: 'Prolia',
      genericAvailable: false,
      strength: '60 mg/mL prefilled syringe',
      sig: 'Inject 60 mg subcutaneously once every 6 months',
      sigShort: '60 mg SC every 6 months',
      plainSig: 'One shot under the skin, once every six months.',
    },
    boglActive: false,
    boglNote: null,
    paRequired: [],
    stepTherapy: null,
    verification: 'partial',
    verificationNote: 'test',
    sourceIds: ['x'],
    coverageSourceIds: ['x'],
    restrictionSourceIds: ['x'],
    lastReviewed: '2026-08-05',
    ...over,
  }
}

const payer: PayerMeta = {
  id: 'kaiser-permanente-ca',
  name: 'Kaiser Permanente',
  shortName: 'Kaiser Permanente',
  pbm: 'Internal',
  productName: 'Kaiser Permanente 2026 California Commercial HMO Formulary',
  marketSegment: 'commercial-employer',
  formularyId: 'Kaiser 2026',
  formularyUrl: 'https://example.com/formulary',
  sourceIds: ['x'],
}

describe('ResultCard "In plan" badge', () => {
  it('does not claim "covered" when the preferred agent has no tier but does have a restriction', () => {
    // Regression: a record can have tier: null (the source never stated one) while
    // preferredRestriction explains the drug isn't actually covered cleanly (e.g. "not found
    // anywhere on this formulary"). The badge used to fall back to the bare literal "covered"
    // whenever tier was null, silently ignoring preferredRestriction -- caught during the
    // 2026-08-05 CA osteoporosis merge (kaiser-permanente-ca/rankl-inhibitor: denosumab/Prolia
    // has no line item anywhere on Kaiser's pharmacy formulary at all).
    render(
      <ResultCard
        record={record({
          tier: undefined,
          preferredRestriction: 'Not found anywhere on this outpatient pharmacy formulary.',
        })}
        payer={payer}
        panelId="panel"
        labelId="label"
      />,
    )
    expect(screen.queryByText('covered')).not.toBeInTheDocument()
    expect(screen.getByText(/restricted/i)).toBeInTheDocument()
  })

  it('still shows "covered" when there is no tier and no restriction', () => {
    render(
      <ResultCard record={record({ tier: undefined, preferredRestriction: undefined })} payer={payer} panelId="panel" labelId="label" />,
    )
    expect(screen.getByText('covered')).toBeInTheDocument()
  })

  it('shows the source tier verbatim when one is stated, regardless of restriction', () => {
    render(
      <ResultCard
        record={record({ tier: 'Tier 1 - preferred', preferredRestriction: 'QL applies' })}
        payer={payer}
        panelId="panel"
        labelId="label"
      />,
    )
    expect(screen.getByText('Tier 1 - preferred')).toBeInTheDocument()
  })
})
