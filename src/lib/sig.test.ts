import { describe, it, expect } from 'vitest'
import { buildSig, rxName } from './sig'
import type { FormularyRecord } from '../types/formulary'

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
    lastReviewed: '2026-06-22',
    ...over,
  }
}

describe('buildSig', () => {
  it('formats the example string for EHR paste', () => {
    expect(buildSig(record())).toBe(
      'Budesonide/formoterol 160/4.5 micrograms - 2 puffs twice daily',
    )
  })

  it('uses the generic (INN) name when BOGL is off', () => {
    expect(rxName(record())).toBe('Budesonide/formoterol')
  })

  it('uses the BRAND name when BOGL forces it', () => {
    const r = record({
      boglActive: true,
      boglNote: 'Brand forced',
      preferredAgent: {
        inn: 'Albuterol sulfate HFA',
        brand: 'Ventolin HFA',
        genericAvailable: true,
        strength: '90 mcg',
        sig: '2 puffs every 4 to 6 hours as needed',
        sigShort: '2 puffs Q4-6H PRN',
        plainSig: 'Two puffs when you need it.',
      },
    })
    expect(rxName(r)).toBe('Ventolin HFA')
    expect(buildSig(r)).toBe('Ventolin HFA 90 micrograms - 2 puffs every 4 to 6 hours as needed')
  })

  it('falls back to the INN if a BOGL cell somehow lacks a brand', () => {
    const r = record({ boglActive: true, preferredAgent: { ...record().preferredAgent, brand: null } })
    expect(rxName(r)).toBe('Budesonide/formoterol')
  })
})
