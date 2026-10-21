import { describe, it, expect } from 'vitest'
import type { ClassMeta, FormularyRecord, PaItem, PayerMeta } from '../types/formulary'
import { buildPaRequest, emptyPaRequest, paChecklist, preferredAlternatives, responseClock, submissionLine } from './paRequest'
import { ICD10_BY_CLASS, icd10For } from './icd10'
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
  })
})
