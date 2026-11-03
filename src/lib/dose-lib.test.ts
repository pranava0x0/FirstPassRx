import { describe, expect, it } from 'vitest'
import { amounts, deliverable } from '../../scripts/dose-lib.mjs'

describe('dose text helpers', () => {
  it('reads single amounts and lists that share a trailing unit', () => {
    expect(amounts('60 mg delayed-release capsule')).toEqual([{ n: 60, unit: 'mg' }])
    expect(amounts('0.5 / 1 / 2 mg tablet').map((a) => a.n)).toEqual([0.5, 1, 2])
    expect(amounts('25, 50 or 100 mg').map((a) => a.n)).toEqual([25, 50, 100])
  })

  it('skips combination strengths and concentrations', () => {
    expect(amounts('400 mg/100 mg tablet')).toEqual([])
    expect(amounts('5-325 mg tablet')).toEqual([])
    expect(amounts('6 mg/mL pen')).toEqual([])
  })

  it('accepts 1 to 4 whole units, across mg and mcg', () => {
    expect(deliverable({ n: 300, unit: 'mg' }, [{ n: 600, unit: 'mg' }])).toBe(false)
    expect(deliverable({ n: 20, unit: 'mg' }, [{ n: 10, unit: 'mg' }])).toBe(true)
    expect(deliverable({ n: 500, unit: 'mcg' }, [{ n: 0.5, unit: 'mg' }])).toBe(true)
  })
})
