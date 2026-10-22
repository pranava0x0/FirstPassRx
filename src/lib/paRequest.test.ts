import { describe, it, expect } from 'vitest'
import type { ClassMeta, FormularyRecord, PaItem, PayerMeta } from '../types/formulary'
import { preferredNeedsPa, preferredOutcome, buildPaRequest, emptyPaRequest, paChecklist, preferredAlternatives, responseClock, submissionLine } from './paRequest'
import { ICD10_BY_CLASS, ICD10_RELEASE, icd10For } from './icd10'
import data from '../data/formulary.json'

const record: FormularyRecord = {
  payerId: 'p',
  classId: 'sglt2',
  preferredAgent: { inn: 'empagliflozin', brand: 'Jardiance', genericAvailable: false },
  alternatives: [
    { drug: 'Farxiga', note: 'Preferred · no PA', sourceIds: ['x'] },
    { drug: 'jardiance', note: 'preferred', sourceIds: ['x'] },
    { drug: 'Steglatro', note: 'preferred', sourceIds: ['x'] },
    { drug: 'Invokana', note: 'Tier 3', sourceIds: ['x'] },
    { drug: 'Inpefa', note: 'Non-preferred, covered', sourceIds: ['x'] },
    { drug: 'Brenzavvy', sourceIds: ['x'] },
  ],
  boglActive: false,
  boglNote: null,
  paRequired: [],
  stepTherapy: 'Metformin trial first.',
  verification: 'verified',
  verificationNote: 'test',
  sourceIds: ['x'],
  coverageSourceIds: ['x'],
  restrictionSourceIds: ['x'],
  lastReviewed: '2026-10-21',
} as unknown as FormularyRecord

const item: PaItem = { drug: 'Steglatro', sourceIds: ['x'], outcome: 'step', reason: 'Step therapy required' }
const payer = (segment: PayerMeta['marketSegment']): PayerMeta => ({
  id: 'p',
  name: 'Plan',
  shortName: 'Plan',
  productName: 'Plan PDL',
  marketSegment: segment,
  formularyId: 'PDL-1',
  formularyUrl: 'https://example.com',
  sourceIds: ['x'],
})
const drugClass = { id: 'sglt2', name: 'SGLT2 inhibitor' } as ClassMeta

describe('preferredAlternatives', () => {
  it('lists the plan preferred agents once each, never the blocked drug itself', () => {
    expect(preferredAlternatives(record, item)).toEqual(['Jardiance', 'Farxiga'])
  })

  // Codex review on PR 19: alternatives also hold higher-tier / non-preferred covered drugs.
  it('never promotes a tiered, non-preferred, or unlabeled alternative to "plan preferred"', () => {
    const names = preferredAlternatives(record, item)
    expect(names).not.toContain('Invokana')
    expect(names).not.toContain('Inpefa')
    expect(names).not.toContain('Brenzavvy')
  })
})

describe('preferredAlternatives on a no-covered-option record', () => {
  // Codex review, PR 22: the reference drug was listed as a plan-preferred prerequisite.
  it('omits the reference-only agent', () => {
    const r = { ...record, noCoveredAgent: true, preferredRestriction: 'none listed' } as FormularyRecord
    expect(preferredAlternatives(r, item)).not.toContain('Jardiance')
  })
})

describe('paChecklist', () => {
  it('starts with nothing done and fills in as the reviewer items are answered', () => {
    const input = emptyPaRequest(record, item)
    expect(paChecklist(input).filter((c) => c.done)).toHaveLength(0)
    const filled = {
      ...input,
      diagnosis: 'E11.65 type 2 diabetes with hyperglycemia',
      regimen: '15 mg tablet daily',
      quantity: '30',
      daysSupply: '30',
      steps: input.steps.map((s) => ({ ...s, outcome: 'adverse' as const, detail: 'Jan–Mar 2026, genital mycotic infections' })),
      rationale: 'A1c 9.1% on metformin; recurrent infections on both preferred SGLT2s.',
    }
    expect(paChecklist(filled).every((c) => c.done)).toBe(true)
  })

  it('does not count a free-text diagnosis without an ICD-10 code', () => {
    const input = { ...emptyPaRequest(record, item), diagnosis: 'diabetes' }
    expect(paChecklist(input).find((c) => c.id === 'diagnosis')?.done).toBe(false)
  })

  it('requires dates/detail for a tried alternative but not for "not tried"', () => {
    const base = emptyPaRequest(record, item)
    const tried = { ...base, steps: base.steps.map((s) => ({ ...s, outcome: 'inadequate' as const, detail: '' })) }
    expect(paChecklist(tried).find((c) => c.id === 'steps')?.done).toBe(false)
    const notTried = { ...base, steps: base.steps.map((s) => ({ ...s, outcome: 'not-tried' as const })) }
    expect(paChecklist(notTried).find((c) => c.id === 'steps')?.done).toBe(true)
  })
})

describe('responseClock', () => {
  it('cites the Medicaid 24-hour / 72-hour emergency supply rule for Medicaid plans', () => {
    expect(responseClock(payer('medicaid-mco'), 'NY')).toMatch(/24 hours.*72-hour/)
  })
  it('cites Part D 72h standard / 24h expedited', () => {
    expect(responseClock(payer('medicare-part-d'), 'NY')).toMatch(/72 hours.*24 hours/)
  })
  it('names the Massachusetts deemed-approval law only for MA commercial plans', () => {
    expect(responseClock(payer('commercial-employer'), 'MA')).toMatch(/176O/)
    expect(responseClock(payer('commercial-employer'), 'VA')).not.toMatch(/176O/)
  })
  it('never cites CMS-0057-F, whose PA timeframes exclude drugs', () => {
    for (const seg of ['medicaid-ffs', 'medicaid-mco', 'commercial-exchange', 'commercial-employer', 'medicare-part-d'] as const) {
      expect(responseClock(payer(seg), 'MA')).not.toMatch(/0057/)
    }
  })
})

describe('buildPaRequest', () => {
  it('puts the request and diagnosis before the step log and rationale (reviewer order)', () => {
    const letter = buildPaRequest(record, item, payer('commercial-employer'), drugClass, emptyPaRequest(record, item))
    const order = ['REQUEST:', 'DIAGNOSIS:', "PLAN'S PREFERRED ALTERNATIVES", 'CLINICAL RATIONALE:'].map((h) => letter.indexOf(h))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(letter).toMatch(/a step-therapy exception for Steglatro/)
    expect(letter).toMatch(/1\. Jardiance: \[tried\? outcome\]/)
    expect(letter).toMatch(/Plan step-therapy note for this class: Metformin trial first\./)
  })

  it('fills typed answers and flags expedited review at the top', () => {
    const input = {
      ...emptyPaRequest(record, item),
      expedited: true,
      diagnosis: 'E11.65',
      steps: [{ drug: 'Jardiance', outcome: 'not-tried' as const, detail: 'ignored' }],
    }
    const letter = buildPaRequest(record, item, payer('commercial-employer'), drugClass, input)
    expect(letter.startsWith('EXPEDITED REVIEW REQUESTED')).toBe(true)
    expect(letter).toMatch(/DIAGNOSIS: E11\.65/)
    expect(letter).toMatch(/1\. Jardiance: Not tried yet\n/)
    expect(letter).not.toMatch(/ignored/)
  })
})

const criteriaItem: PaItem = {
  ...item,
  criteria: ['New to plan in last 90 days and on the drug', 'Asthma AND failed both preferred ICS'],
  criteriaMode: 'any',
  criteriaSourceIds: ['x'],
}

describe('plan criteria crosswalk', () => {
  it('adds a criteria checklist item only when the plan criteria are known', () => {
    expect(paChecklist(emptyPaRequest(record, item)).some((c) => c.id === 'criteria')).toBe(false)
    expect(paChecklist(emptyPaRequest(record, criteriaItem)).some((c) => c.id === 'criteria')).toBe(true)
  })

  it('"any" needs one criterion met WITH evidence; "all" needs every one', () => {
    const base = emptyPaRequest(record, criteriaItem)
    const oneNoEvidence = { ...base, criteria: base.criteria.map((c, i) => (i === 1 ? { ...c, status: 'met' as const } : c)) }
    expect(paChecklist(oneNoEvidence, 'any').find((c) => c.id === 'criteria')?.done).toBe(false)
    const one = { ...base, criteria: base.criteria.map((c, i) => (i === 1 ? { ...c, status: 'met' as const, evidence: 'QVAR 2025, Arnuity 2026' } : c)) }
    expect(paChecklist(one, 'any').find((c) => c.id === 'criteria')?.done).toBe(true)
    expect(paChecklist(one, 'all').find((c) => c.id === 'criteria')?.done).toBe(false)
  })

  it('puts the plan criteria right after the diagnosis, before the step log', () => {
    const letter = buildPaRequest(record, criteriaItem, payer('commercial-employer'), drugClass, emptyPaRequest(record, criteriaItem))
    const dx = letter.indexOf('DIAGNOSIS:')
    const crit = letter.indexOf("PLAN'S APPROVAL CRITERIA (any one qualifies)")
    const steps = letter.indexOf("PLAN'S PREFERRED ALTERNATIVES")
    expect(dx).toBeGreaterThan(-1)
    expect(crit).toBeGreaterThan(dx)
    expect(steps).toBeGreaterThan(crit)
    expect(letter).toMatch(/1\. New to plan in last 90 days and on the drug: \[met \/ not met\]/)
  })
})

describe('submission channel', () => {
  it('names every published channel and goes in the letter header', () => {
    const p = { ...payer('medicaid-ffs'), paSubmission: { fax: '877-208-7428', phone: '800-745-7318', portal: 'example.org', sourceIds: ['x'] } }
    expect(submissionLine(p)).toBe('fax 877-208-7428 · portal example.org · phone 800-745-7318')
    expect(buildPaRequest(record, item, p, drugClass, emptyPaRequest(record, item))).toMatch(/^Send to: fax 877-208-7428/m)
  })
  it('keeps the source URLs for routing and criteria in the letter', () => {
    const p = { ...payer('medicaid-ffs'), paSubmission: { fax: '877-208-7428', sourceIds: ['x'] } }
    const letter = buildPaRequest(record, criteriaItem, p, drugClass, emptyPaRequest(record, criteriaItem), {
      submission: ['https://example.org/form.pdf'],
      criteria: ['https://example.org/policy.pdf'],
    })
    expect(letter).toMatch(/Send to: fax 877-208-7428 \(source: https:\/\/example\.org\/form\.pdf\)/)
    expect(letter).toMatch(/Criteria source: https:\/\/example\.org\/policy\.pdf/)
  })
  it('omits the line when the plan has no published channel', () => {
    expect(buildPaRequest(record, item, payer('medicaid-ffs'), drugClass, emptyPaRequest(record, item))).not.toMatch(/Send to:/)
  })
})

describe('ICD-10 suggestions', () => {
  it('has suggestions for every active drug class in the dataset', () => {
    const missing = new Set<string>()
    for (const g of (data as { guides: { classes: { id: string; comingSoon?: boolean }[] }[] }).guides)
      for (const c of g.classes) if (!c.comingSoon && icd10For(c.id).length === 0) missing.add(c.id)
    expect([...missing]).toEqual([])
  })
  it('lists only well-formed, complete-looking codes', () => {
    for (const opts of Object.values(ICD10_BY_CLASS))
      for (const o of opts) expect(o.code).toMatch(/^[A-TV-Z]\d{2}(\.[0-9A-Z]{1,4})?$/)
    // N18.3 is a non-billable category since FY2021 (Sonnet review); stage-specific codes only.
    expect(Object.values(ICD10_BY_CLASS).flat().some((o) => o.code === 'N18.3')).toBe(false)
    // E78.01 is a non-billable header in FY2027 (split into E78.010/.011/.019).
    expect(Object.values(ICD10_BY_CLASS).flat().some((o) => o.code === 'E78.01')).toBe(false)
  })
  it('suggests only diagnoses the requested drug is labeled for (Codex review, PR 23)', () => {
    const codes = (cls: string, drug: string) => icd10For(cls, drug).map((o) => o.code)
    expect(codes('antipsychotic-oral', 'Paliperidone ER (Invega)')).not.toContain('F33.1')
    expect(codes('antipsychotic-oral', 'Iloperidone (Fanapt)')).toEqual(['F20.9'])
    expect(codes('il17-il23', 'Ixekizumab (Taltz)')).not.toContain('K50.90')
    expect(codes('il17-il23', 'Ustekinumab-kfce')).toContain('K50.90')
    expect(codes('jak-inhibitor', 'Tofacitinib')).not.toContain('L40.0')
  })
  it('records which official release the list was checked against', () => {
    expect(ICD10_RELEASE.version).toMatch(/FY20\d\d/)
    expect(ICD10_RELEASE.source).toMatch(/^https:\/\/www\.cms\.gov\//)
  })
})

// Codex review, PR 22: a quantity limit or "no PA" note must not trigger a PA request.
describe('preferredNeedsPa', () => {
  const r = (preferredRestriction: string | undefined, extra = {}) => ({ ...record, preferredRestriction, ...extra }) as FormularyRecord
  it.each([
    ['PA required (Table 13)', true],
    ['Step therapy: metformin first', true],
    ['Not on the CDL: TAR required', true],
    ['Quantity limit 60 per 30 days; no PA', false],
    ['No PA, no quantity limit stated.', false],
    ['Age 6-18 only', false],
    ['PA required for members age 25 and older; no PA under 25', true],
    ['Quantity limit (QL) applies; no PA or step therapy required for the plain naproxen tablet.', false],
    ['Clinical criteria apply to all drugs in this class (PDL red note, page 19).', true],
    ['Covered with clinical criteria (DUR table, page 75): BMI of 40 kg/m2 or greater', true],
    ['QL (quantity limit)', false],
    [undefined, false],
  ])('%s -> %s', (note, want) => expect(preferredNeedsPa(r(note))).toBe(want))
  it('dataset: picks whose note says the drug itself has no PA are flagged false', async () => {
    const { default: raw } = await import('../data/formulary.json')
    const find = (g: string, p: string, c: string) =>
      (raw as unknown as { guides: { id: string; records: FormularyRecord[] }[] }).guides
        .find((x) => x.id === g)!.records.find((x) => x.payerId === p && x.classId === c)!
    // Codex review, PR 22: QL-only teriparatide and a step policy for other lines of business.
    expect(preferredNeedsPa(find('md-osteoporosis', 'kpmidatlantic', 'anabolic'))).toBe(false)
    expect(preferredNeedsPa(find('ny-osteoporosis', 'ny-excellus-bcbs', 'rankl-inhibitor'))).toBe(false)
  })
  it('follows an explicit preferredPaRequired over the restriction text', () => {
    const brandOnly = 'The brand-name product carries "#" (brand requires PA); the generic tablet is covered without PA.'
    expect(preferredNeedsPa(r(brandOnly))).toBe(true)
    expect(preferredNeedsPa(r(brandOnly, { preferredPaRequired: false }))).toBe(false)
    expect(preferredNeedsPa(r('QL only', { preferredPaRequired: true }))).toBe(true)
  })
  it('is false for a no-covered-option record', () => {
    expect(preferredNeedsPa(r('PA required', { noCoveredAgent: true }))).toBe(false)
  })
})

describe('preferredOutcome', () => {
  const r = (preferredRestriction: string) => ({ ...record, preferredRestriction }) as FormularyRecord
  it.each([
    ['PA required (Table 13)', 'pa'],
    ['Step therapy: metformin first', 'step'],
    ['Non-formulary: exception required', 'nonformulary'],
    ['Not on the CDL: TAR required', 'nonformulary'],
    ['Step therapy and PA required', 'pa'],
  ])('%s -> %s', (note, want) => expect(preferredOutcome(r(note))).toBe(want))
})
