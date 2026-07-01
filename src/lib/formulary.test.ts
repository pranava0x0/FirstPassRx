import { describe, it, expect } from 'vitest'
import { guides, getGuideView, meta } from './formulary'

describe('guides + global meta', () => {
  it('ships the MA inhaler, MD menopause, and NY ACE inhibitor guides, in order', () => {
    expect(guides.map((g) => g.id)).toEqual(['ma-inhalers', 'md-menopause', 'ny-ace'])
  })

  it('defaults to a guide that exists', () => {
    expect(guides.some((g) => g.id === meta.defaultGuideId)).toBe(true)
    expect(meta.title).toBeTruthy()
    expect(meta.version).toBeTruthy()
  })

  it('gives every guide the copy the masthead/labels need', () => {
    for (const g of guides) {
      for (const field of ['label', 'region', 'topic', 'classNoun', 'unitNoun'] as const) {
        expect(g[field], `${g.id} ${field}`).toBeTruthy()
      }
      expect(['sample', 'mixed', 'verified']).toContain(g.dataStatus)
      expect(g.references.length, `${g.id} references`).toBeGreaterThan(0)
      expect(g.capturedAt, `${g.id} capturedAt`).toBeTruthy()
    }
  })
})

// Universal invariants — must hold for every cell in every guide.
describe.each(guides.map((g) => [g.id, g] as const))('guide invariants: %s', (_id, guide) => {
  it('covers every payer × active class (count floor)', () => {
    const active = guide.activeClasses
    expect(guide.records.length).toBeGreaterThanOrEqual(guide.payers.length * active.length)
    for (const p of guide.payers) {
      for (const c of active) {
        expect(guide.getRecord(p.id, c.id), `missing ${guide.id} ${p.id}/${c.id}`).toBeDefined()
      }
    }
  })

  it('never references a coming-soon class', () => {
    const comingSoon = new Set(guide.allClasses.filter((c) => c.comingSoon).map((c) => c.id))
    for (const r of guide.records) {
      expect(comingSoon.has(r.classId), `${guide.id} ${r.payerId}/${r.classId}`).toBe(false)
    }
  })

  it('every BOGL cell names a brand and explains itself', () => {
    for (const r of guide.records.filter((r) => r.boglActive)) {
      expect(r.preferredAgent.brand, `${r.payerId}/${r.classId} brand`).toBeTruthy()
      expect(r.boglNote, `${r.payerId}/${r.classId} note`).toBeTruthy()
    }
  })

  it('every preferred agent has the fields the sig + plain-language layers need', () => {
    for (const r of guide.records) {
      const a = r.preferredAgent
      const at = `${guide.id} ${r.payerId}/${r.classId}`
      expect(a.inn, `${at} inn`).toBeTruthy()
      expect(a.strength, `${at} strength`).toBeTruthy()
      expect(a.sigShort, `${at} sigShort`).toBeTruthy()
      expect(a.plainSig, `${at} plainSig`).toBeTruthy()
    }
  })

  it('every PA item carries a drug and a reason', () => {
    for (const r of guide.records) {
      for (const pa of r.paRequired) {
        expect(pa.drug, `${r.payerId}/${r.classId} pa.drug`).toBeTruthy()
        expect(pa.reason, `${r.payerId}/${r.classId} pa.reason`).toBeTruthy()
        expect(['pa', 'step', 'nonformulary']).toContain(pa.outcome)
        expect(pa.reason).not.toMatch(/higher tier|non-preferred/i)
        expect(guide.resolveSources(pa.sourceIds)).toHaveLength(pa.sourceIds.length)
      }
    }
  })

  it('identifies exact products and claim-specific source lanes', () => {
    for (const p of guide.payers) {
      expect(p.productName, `${p.id} productName`).toBeTruthy()
      expect(p.marketSegment, `${p.id} marketSegment`).toBeTruthy()
      expect(p.formularyId, `${p.id} formularyId`).toBeTruthy()
    }
    for (const r of guide.records) {
      expect(r.coverageSourceIds.length).toBeGreaterThan(0)
      expect(r.restrictionSourceIds.length).toBeGreaterThan(0)
      expect(guide.resolveSources(r.coverageSourceIds)).toHaveLength(r.coverageSourceIds.length)
      expect(guide.resolveSources(r.restrictionSourceIds)).toHaveLength(r.restrictionSourceIds.length)
      for (const alt of r.alternatives || []) {
        expect(alt.sourceIds.length).toBeGreaterThan(0)
        expect(guide.resolveSources(alt.sourceIds)).toHaveLength(alt.sourceIds.length)
      }
    }
  })

  it('every cell cites at least one source, and every sourceId resolves within the guide', () => {
    for (const r of guide.records) {
      const at = `${guide.id} ${r.payerId}/${r.classId}`
      expect(r.sourceIds.length, `${at} sourceIds`).toBeGreaterThan(0)
      const resolved = guide.resolveSources(r.sourceIds)
      expect(resolved.length, `${at} unresolved sourceId`).toBe(r.sourceIds.length)
      for (const s of resolved) {
        expect(s.url.startsWith('http'), `${at} ${s.id} url`).toBe(true)
      }
    }
  })

  it('every cell declares a verification state with a note', () => {
    const allowed = new Set(['verified', 'partial', 'example'])
    for (const r of guide.records) {
      expect(allowed.has(r.verification), `${guide.id} ${r.payerId}/${r.classId}`).toBe(true)
      expect(r.verificationNote, `${r.payerId}/${r.classId} note`).toBeTruthy()
    }
  })
})

describe('MA inhaler guide specifics', () => {
  const ma = getGuideView('ma-inhalers')

  it('ships the five required MA payers', () => {
    expect(ma.payers.map((p) => p.id)).toEqual([
      'masshealth',
      'bcbsma',
      'tufts',
      'harvardpilgrim',
      'mgb',
    ])
  })

  it('ships the four MVP classes plus a coming-soon biologics tab', () => {
    expect(ma.activeClasses.map((c) => c.id)).toEqual(['saba', 'ics', 'icslaba', 'lama'])
    expect(ma.allClasses.find((c) => c.id === 'biologics')?.comingSoon).toBe(true)
  })

  it('keeps the verified MassHealth Ventolin BOGL finding', () => {
    const cell = ma.getRecord('masshealth', 'saba')
    expect(cell?.boglActive).toBe(true)
    expect(cell?.preferredAgent.brand).toBe('Ventolin HFA')
    expect(cell?.verification).toBe('verified')
  })

  it('finds a preferred agent by brand and ranks preferred before rejects', () => {
    const hits = ma.searchFormulary('symbicort')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((h) => h.drug.toLowerCase().includes('symbicort'))).toBe(true)
    expect(hits[0]?.kind).toBe('preferred')
  })

  it('finds a drug that appears on a reject list', () => {
    const hits = ma.searchFormulary('levalbuterol')
    expect(hits.some((h) => h.kind === 'reject')).toBe(true)
  })

  it('returns nothing for queries under 2 chars', () => {
    expect(ma.searchFormulary('')).toEqual([])
    expect(ma.searchFormulary('a')).toEqual([])
  })

  it('has a glossary looked up by substring', () => {
    expect(ma.lookupGlossary('BOGL')?.definition).toMatch(/brand/i)
    expect(ma.lookupGlossary('step therapy')).toBeDefined()
  })
})

describe('MD menopause guide specifics', () => {
  const md = getGuideView('md-menopause')

  it('ships the Maryland payer roster and the menopause hormone classes', () => {
    expect(md.payers.map((p) => p.id)).toEqual([
      'mdmedicaid',
      'carefirst',
      'kpmidatlantic',
      'priority-partners',
      'uhc-md',
      'cigna',
      'aetna',
      'medicare-partd',
    ])
    expect(md.activeClasses.map((c) => c.id)).toEqual([
      'est-td',
      'est-oral',
      'progestogen',
      'vaginal',
      'combo',
    ])
  })

  it('oral combo class: generic estradiol/norethindrone first-pass across the carriers', () => {
    const combo = md.records.filter((r) => r.classId === 'combo')
    expect(combo.length).toBe(md.payers.length) // every carrier covered
    expect(md.getRecord('carefirst', 'combo')?.preferredAgent.inn).toMatch(/norethindrone/i)
    // Brand single-pill combos may be true barriers or covered higher-cost alternatives.
    const allCoverageItems = combo.flatMap((r) => [
      ...r.paRequired.map((p) => p.drug.toLowerCase()),
      ...(r.alternatives || []).map((a) => a.drug.toLowerCase()),
    ])
    expect(allCoverageItems.some((d) => /bijuva|angeliq|prempro|activella/.test(d))).toBe(true)
  })

  it('oral estrogen is generic estradiol first-pass, with Premarin/conjugated as the brand tail', () => {
    const cell = md.getRecord('carefirst', 'est-oral')
    expect(cell?.preferredAgent.inn).toMatch(/estradiol/i)
    // CareFirst's age-70+ High Risk Medication PA reaches oral estradiol too.
    expect(cell?.paRequired.some((p) => /age 70/i.test(p.drug) && /PA/i.test(p.reason))).toBe(true)
    // Every plan covers the oral class (count floor across 8 payers).
    expect(md.records.filter((r) => r.classId === 'est-oral').length).toBe(md.payers.length)
  })

  it('contrasts plans on micronized progesterone: clean on Priority Partners, PA on Kaiser', () => {
    // Same drug, opposite first-pass logic — the whole point of a per-plan tool.
    const pp = md.getRecord('priority-partners', 'progestogen')
    expect(pp?.preferredAgent.inn).toMatch(/progesterone/i)
    expect(pp?.paRequired.length).toBe(0)
    const kp = md.getRecord('kpmidatlantic', 'progestogen')
    expect(kp?.paRequired.some((p) => /micronized progesterone/i.test(p.drug))).toBe(true)
  })

  it('first-pass transdermal pick is generic estradiol, searchable by name', () => {
    const cell = md.getRecord('mdmedicaid', 'est-td')
    expect(cell?.preferredAgent.inn).toMatch(/estradiol/i)
    const hits = md.searchFormulary('estradiol')
    expect(hits.length).toBeGreaterThan(0)
  })

  it('is sourced data — verified/partial cells, no leftover example scaffold', () => {
    expect(md.dataStatus).toBe('mixed')
    for (const r of md.records) {
      expect(['verified', 'partial'], `${r.payerId}/${r.classId}`).toContain(r.verification)
    }
    // CareFirst + Kaiser were read off real formulary PDFs.
    expect(md.getRecord('carefirst', 'est-td')?.verification).toBe('verified')
    expect(md.getRecord('kpmidatlantic', 'progestogen')?.verification).toBe('verified')
  })

  it('captures the Kaiser quirk: medroxyprogesterone is first-pass because micronized progesterone needs PA', () => {
    const cell = md.getRecord('kpmidatlantic', 'progestogen')
    expect(cell?.preferredAgent.inn).toMatch(/medroxyprogesterone/i)
    expect(cell?.paRequired.some((p) => /micronized progesterone/i.test(p.drug))).toBe(true)
  })

  it('cites Maryland government + payer sources that resolve', () => {
    const cell = md.getRecord('mdmedicaid', 'est-td')
    const srcs = md.resolveSources(cell!.sourceIds)
    expect(srcs.length).toBe(cell!.sourceIds.length)
    expect(srcs.some((s) => s.url.includes('health.maryland.gov'))).toBe(true)
  })

  it('carries menopause-specific glossary terms', () => {
    expect(md.lookupGlossary('GSM')).toBeDefined()
    expect(md.lookupGlossary('MHT')?.definition).toMatch(/estrogen/i)
  })
})
