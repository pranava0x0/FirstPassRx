import { describe, expect, it } from 'vitest'
import strengthRows from '../../scripts/data/label-strengths.json'
import { amounts, compileStrengthRules, deliverable, fitsSig, labelStrength, startDose } from '../../scripts/dose-lib.mjs'

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

describe('label starting-dose strengths', () => {
  const rows = strengthRows as [string, string, string?, string?][]
  const rules = compileStrengthRules(rows)
  const pick = (classId: string, inn: string, strength = 'standard label dosing') => labelStrength(rules, { classId, inn, strength })

  it('every row names a numeric strength', () => {
    for (const [, strength] of rows) expect(strength).toMatch(/\d/)
  })
  it('matches combinations before their single components', () => {
    expect(pick('combo', 'Estradiol and norethindrone acetate')).toBe('1 mg/0.5 mg tablet')
    expect(pick('icslaba', 'budesonide-formoterol fumarate')).toMatch(/160\/4\.5/)
    expect(pick('antipsychotic-lai', 'Risperidone microspheres ER')).toMatch(/injectable/)
    expect(pick('antipsychotic-oral', 'Risperidone')).toBe('1 mg tablet')
  })
  it('requires the form the list names and refuses an ambiguous one', () => {
    expect(pick('est-td', 'estradiol', 'Transdermal patch, weekly')).toMatch(/patch/)
    expect(pick('est-td', 'estradiol', 'transdermal (patch/gel/spray; form not stated)')).toBeNull()
    expect(pick('vaginal', 'estradiol vaginal', 'vaginal cream or tablet')).toBeNull()
    expect(pick('ics', 'fluticasone propionate', 'nasal suspension')).toBeNull()
    expect(pick('adhd-nonstimulant', 'Guanfacine hydrochloride (ADHD)', 'formulation not specified')).toBeNull()
    expect(pick('stimulant-amph', 'Amphetamine-dextroamphetamine XR')).toBeNull()
    expect(pick('icslaba', 'Fluticasone propionate-salmeterol HFA', 'HFA inhaler')).toBeNull()
  })
  it('reads the starting dose and checks a strength against it', () => {
    expect(startDose('15 mg once daily at bedtime; may increase to 45 mg')).toEqual({ n: 15, unit: 'mg' })
    expect(fitsSig('15 mg tablet', '15 mg once daily at bedtime')).toBe(true)
    expect(fitsSig('600 mg tablet', 'Start 300 mg at bedtime.')).toBe(false)
    expect(fitsSig('40 mg tablet', 'Start 10 or 20 mg once daily (40 mg if LDL-C must fall more than 45%).')).toBe(true)
  })
})
