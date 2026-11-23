import { describe, expect, it } from 'vitest'
import { copayProgramFor } from './copayPrograms'

describe('copay programs', () => {
  it('names the ViiVConnect cap for Dovato, commercial only', () => {
    const p = copayProgramFor('Dolutegravir-lamivudine (Dovato)')!
    expect(p.terms).toMatch(/\$6,250/)
    expect(p.payerTypes).toEqual(['commercial'])
    expect(p.sourceUrl).toMatch(/^https:\/\/www\.viivconnect\.com\//)
  })
  it('does not hand Dovato terms to Triumeq or Juluca', () => {
    expect(copayProgramFor('Triumeq (dolutegravir/abacavir/lamivudine)')).toBeUndefined()
    expect(copayProgramFor('Juluca (dolutegravir-rilpivirine)')).toBeUndefined()
  })
  it('never uses "VA" for Veterans Affairs (VA means Virginia in this app)', () => {
    expect(copayProgramFor('Dovato')!.terms).not.toMatch(/\bVA\b/)
  })
})
