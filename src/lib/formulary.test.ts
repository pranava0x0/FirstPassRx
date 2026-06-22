import { describe, it, expect } from 'vitest'
import {
  activeClasses,
  allClasses,
  getRecord,
  glossary,
  lookupGlossary,
  meta,
  payers,
  records,
  resolveSources,
  searchFormulary,
} from './formulary'

describe('formulary data integrity', () => {
  it('ships the five required MA payers', () => {
    expect(payers.map((p) => p.id)).toEqual([
      'masshealth',
      'bcbsma',
      'tufts',
      'harvardpilgrim',
      'mgb',
    ])
  })

  it('ships the four MVP classes plus a coming-soon biologics tab', () => {
    expect(activeClasses.map((c) => c.id)).toEqual(['saba', 'ics', 'icslaba', 'lama'])
    expect(allClasses.find((c) => c.id === 'biologics')?.comingSoon).toBe(true)
  })

  // Count floor: every payer × active class must be covered.
  it('covers every payer × active class', () => {
    expect(records.length).toBeGreaterThanOrEqual(payers.length * activeClasses.length)
    for (const p of payers) {
      for (const c of activeClasses) {
        expect(getRecord(p.id, c.id), `missing ${p.id}/${c.id}`).toBeDefined()
      }
    }
  })

  it('never references a coming-soon class', () => {
    const comingSoon = new Set(allClasses.filter((c) => c.comingSoon).map((c) => c.id))
    for (const r of records) {
      expect(comingSoon.has(r.classId), `${r.payerId}/${r.classId}`).toBe(false)
    }
  })

  it('every BOGL cell names a brand and explains itself', () => {
    for (const r of records.filter((r) => r.boglActive)) {
      expect(r.preferredAgent.brand, `${r.payerId}/${r.classId} brand`).toBeTruthy()
      expect(r.boglNote, `${r.payerId}/${r.classId} note`).toBeTruthy()
    }
  })

  it('every preferred agent has the fields the sig + plain-language layers need', () => {
    for (const r of records) {
      const a = r.preferredAgent
      const at = `${r.payerId}/${r.classId}`
      expect(a.inn, `${at} inn`).toBeTruthy()
      expect(a.strength, `${at} strength`).toBeTruthy()
      expect(a.sigShort, `${at} sigShort`).toBeTruthy()
      expect(a.plainSig, `${at} plainSig`).toBeTruthy()
    }
  })

  it('every PA item carries a drug and a reason', () => {
    for (const r of records) {
      for (const pa of r.paRequired) {
        expect(pa.drug, `${r.payerId}/${r.classId} pa.drug`).toBeTruthy()
        expect(pa.reason, `${r.payerId}/${r.classId} pa.reason`).toBeTruthy()
      }
    }
  })

  it('every cell cites at least one source, and every sourceId resolves', () => {
    for (const r of records) {
      const at = `${r.payerId}/${r.classId}`
      expect(r.sourceIds.length, `${at} sourceIds`).toBeGreaterThan(0)
      const resolved = resolveSources(r.sourceIds)
      expect(resolved.length, `${at} unresolved sourceId`).toBe(r.sourceIds.length)
      for (const s of resolved) {
        expect(s.url.startsWith('http'), `${at} ${s.id} url`).toBe(true)
      }
    }
  })

  it('every cell declares a verification state', () => {
    const allowed = new Set(['verified', 'partial', 'example'])
    for (const r of records) {
      expect(allowed.has(r.verification), `${r.payerId}/${r.classId}`).toBe(true)
      expect(r.verificationNote, `${r.payerId}/${r.classId} note`).toBeTruthy()
    }
  })

  it('keeps the verified MassHealth Ventolin BOGL finding', () => {
    const cell = getRecord('masshealth', 'saba')
    expect(cell?.boglActive).toBe(true)
    expect(cell?.preferredAgent.brand).toBe('Ventolin HFA')
    expect(cell?.verification).toBe('verified')
  })
})

describe('search index', () => {
  it('returns nothing for queries under 2 chars', () => {
    expect(searchFormulary('')).toEqual([])
    expect(searchFormulary('a')).toEqual([])
  })

  it('finds a preferred agent by brand and ranks preferred before rejects', () => {
    const hits = searchFormulary('symbicort')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((h) => h.drug.toLowerCase().includes('symbicort'))).toBe(true)
    expect(hits[0]?.kind).toBe('preferred')
  })

  it('finds a drug that appears on a reject list', () => {
    const hits = searchFormulary('levalbuterol')
    expect(hits.some((h) => h.kind === 'reject')).toBe(true)
  })
})

describe('glossary', () => {
  it('has plain-language entries and is looked up by substring', () => {
    expect(glossary.length).toBeGreaterThan(0)
    expect(lookupGlossary('BOGL')?.definition).toMatch(/brand/i)
    expect(lookupGlossary('step therapy')).toBeDefined()
  })
})

describe('meta', () => {
  it('flags data status and captures references + dates', () => {
    expect(['sample', 'mixed', 'verified']).toContain(meta.dataStatus)
    expect(meta.references.length).toBeGreaterThan(0)
    expect(meta.capturedAt).toBeTruthy()
  })
})
