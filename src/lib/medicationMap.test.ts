import { describe, expect, it } from 'vitest'
import catalog from '../data/generated/medications.json'
import tnHiv from '../data/generated/guides/tn-hiv.json'
import type { Guide } from '../types/formulary'
import { buildGuideView, guideOptions, loadGuideView } from './formulary'
import { buildMedMap, guidesToLoad, payerType, resolveMed } from './medicationMap'

const names = Object.keys(catalog)

const DOVATO = 'Dovato (dolutegravir-lamivudine)'
async function mapFor(label: string) {
  const scopes = (catalog as Record<string, string[]>)[label]!
  const guides = await Promise.all(guidesToLoad(scopes, guideOptions).map(loadGuideView))
  return buildMedMap(label, scopes, guides)
}

describe('resolveMed', () => {
  it('keeps an exact catalog entry', () => {
    expect(resolveMed(names, DOVATO)).toBe(DOVATO)
  })
  it('resolves another spelling of the same product, or a bare brand', () => {
    expect(resolveMed(names, 'DOVATO (dolutegravir/lamivudine)')).toBe(DOVATO)
    expect(resolveMed(names, 'dovato')).toBe(DOVATO)
    expect(resolveMed(names, 'Dovato')).toBe(DOVATO)
  })
  it('never guesses: unknown, too short or regex-ish text resolves to nothing', () => {
    expect(resolveMed(names, '')).toBeUndefined()
    expect(resolveMed(names, 'do')).toBeUndefined()
    expect(resolveMed(names, 'dov(')).toBeUndefined()
    expect(resolveMed(names, 'not a drug at all')).toBeUndefined()
  })
})

describe('payerType', () => {
  it('groups market segments', () => {
    expect(payerType('medicaid-mco')).toBe('medicaid')
    expect(payerType('medicaid-ffs')).toBe('medicaid')
    expect(payerType('medicare-part-d')).toBe('medicare')
    expect(payerType('commercial-exchange')).toBe('commercial')
  })
})

describe('Dovato across states', () => {
  it('covers every HIV guide and keeps the counts consistent', async () => {
    const map = await mapFor(DOVATO)
    const hivStates = new Set(guideOptions.filter((g) => g.topicId === 'hiv').map((g) => g.stateCode))
    expect(new Set(map.states.map((s) => s.stateCode))).toEqual(hivStates)
    const sum = Object.values(map.totals).reduce((a, b) => a + b, 0)
    expect(sum).toBe(map.plans)
    expect(map.states.reduce((n, s) => n + s.plans.length, 0)).toBe(map.plans)
    const typed = Object.values(map.byType).reduce((n, t) => n + t.plans, 0)
    expect(typed).toBe(map.plans)
  })

  it('reads Virginia plans off their own records, with sources and dates', async () => {
    const map = await mapFor(DOVATO)
    const va = map.states.find((s) => s.stateCode === 'VA')!
    expect(va.region).toBe('Virginia')
    expect(va.plans.length).toBeGreaterThanOrEqual(8)
    // Acceptance (2026-11-22): Dovato is a covered alternative with no PA on every Virginia plan;
    // Biktarvy is the pick, so the state is not "preferred everywhere" and gets no confetti.
    expect(va.counts.notListed).toBe(0)
    expect(va.counts.pa + va.counts.nonformulary).toBe(0)
    expect(va.allPreferred).toBe(false)
    const ffs = va.plans.find((p) => p.payer.id === 'va-medicaid-ffs')!
    expect(ffs).toMatchObject({ status: 'alternative', type: 'medicaid' })
    // The Aetna PPO question: Advanced Control Plan lists Dovato as PB, QL 30/30, no PA (p.37).
    const aetna = va.plans.find((p) => p.payer.id === 'aetna-commercial')!
    expect(aetna).toMatchObject({ status: 'alternative', type: 'commercial' })
    expect(aetna.cells[0]!.tier).toMatch(/PB \(preferred brand\), QL 30 tablets\/30 days, no PA \(p\.37\)/)
    expect(aetna.cells[0]!.sources.map((s) => s.id)).toContain('aetna-acp-2026')
    for (const plan of va.plans) {
      for (const cell of plan.cells) {
        expect(cell.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        if (cell.status !== 'unknown') expect(cell.sources.length).toBeGreaterThan(0)
        if (cell.status === 'notListed') expect(cell.labels).toEqual([])
      }
    }
  })
})

// One TN HIV guide with each uhc-tn hiv-art shape swapped in, so every status path is exercised
// on a record that passes validate().
type Rec = Guide['records'][number]
// Make Biktarvy the pick so a Dovato barrier is the only Dovato listing on the record.
const biktarvyPick = (r: Rec) => {
  r.preferredAgent = { ...r.preferredAgent, inn: 'Bictegravir-emtricitabine-tenofovir alafenamide', brand: 'Biktarvy' }
  r.alternatives = []
}
function tnWith(patch: (r: Rec) => void) {
  const guide = structuredClone(tnHiv) as Guide
  guide.id = 'tn-hiv-test'
  patch(guide.records.find((r) => r.payerId === 'uhc-tn' && r.classId === 'hiv-art')!)
  return buildGuideView(guide)
}
const PICK = 'Dovato (Dolutegravir-lamivudine) · 50 mg/300 mg tablet'
const uhc = (g: ReturnType<typeof tnWith>, label = PICK) =>
  buildMedMap(label, ['tn-hiv-test/hiv-art'], [g]).states[0]!.plans.find((p) => p.payer.id === 'uhc-tn')!

describe('status of one plan', () => {
  it('preferred pick with only a quantity limit is preferred, with tier and restriction', () => {
    const plan = uhc(tnWith(() => {}))
    expect(plan.status).toBe('preferred')
    expect(plan.cells[0]).toMatchObject({ tier: 'Tier 2', restriction: expect.stringMatching(/QL/), verification: expect.any(String) })
  })
  it('a pick that needs PA is pa, not preferred', () => {
    expect(uhc(tnWith((r) => { r.preferredRestriction = 'PA required (p.4)' })).status).toBe('pa')
  })
  it('a pick the document does not confirm is unknown, not preferred', () => {
    const g = tnWith((r) => { r.preferredRestriction = 'Not listed in this document; coverage is not confirmed. Confirm with the plan before prescribing.' })
    expect(uhc(g).status).toBe('unknown')
  })
  it('an illustrative record is unknown', () => {
    expect(uhc(tnWith((r) => { r.verification = 'example' })).status).toBe('unknown')
  })
  it('a nonformulary barrier is nonformulary; a PA barrier is pa with its reason', () => {
    const g = tnWith((r) => {
      biktarvyPick(r)
      r.paRequired = [
        { drug: DOVATO, outcome: 'nonformulary', reason: 'Non-formulary', sourceIds: r.restrictionSourceIds },
      ]
    })
    expect(uhc(g, DOVATO).status).toBe('nonformulary')
    const h = tnWith((r) => {
      biktarvyPick(r)
      r.paRequired = [{ drug: DOVATO, outcome: 'step', reason: 'Step: Biktarvy first', sourceIds: r.restrictionSourceIds }]
    })
    expect(uhc(h, DOVATO)).toMatchObject({ status: 'pa', cells: [{ restriction: 'Step: Biktarvy first' }] })
  })
  it('a record that never names the drug is notListed, never nonformulary', () => {
    expect(uhc(tnWith(() => {}), 'Nothing by this name').status).toBe('notListed')
  })
  it('a state is allPreferred only when every plan is preferred', () => {
    const g = tnWith(() => {})
    const others = g.records.filter((r) => r.classId === 'hiv-art' && r.payerId !== 'uhc-tn')
    others.forEach((r) => { r.preferredAgent = { ...g.getRecord('uhc-tn', 'hiv-art')!.preferredAgent }; r.preferredRestriction = undefined; r.verification = 'verified' })
    const state = buildMedMap(PICK, ['tn-hiv-test/hiv-art'], [g]).states[0]!
    expect(state.allPreferred).toBe(true)
    expect(buildMedMap(PICK, ['tn-hiv-test/hiv-art'], [tnWith(() => {})]).states[0]!.allPreferred).toBe(false)
  })
})
