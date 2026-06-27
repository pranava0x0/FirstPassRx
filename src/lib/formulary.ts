import { createContext, useContext } from 'react'
import rawData from '../data/formulary.json'
import type {
  ClassId,
  ClassMeta,
  Formulary,
  FormularyRecord,
  Guide,
  GlossaryTerm,
  PayerId,
  PayerMeta,
  Reference,
} from '../types/formulary'

const formulary = rawData as Formulary

const key = (payerId: string, classId: string) => `${payerId}::${classId}`

const VERIFICATIONS = new Set(['verified', 'partial', 'example'])

/**
 * Validate the bundled data at module load. Runs in dev, build (via the test suite),
 * and at runtime import — a malformed PR fails loud here instead of rendering a blank
 * card. Throws with a list of every problem found. Each guide is validated in isolation:
 * sourceIds resolve within the guide, and the payer × active-class grid must be full.
 */
function validate(data: Formulary): void {
  const problems: string[] = []

  if (!data.meta?.title) problems.push('meta.title is missing')
  if (!data.meta?.disclaimer) problems.push('meta.disclaimer is missing')
  if (!data.meta?.version) problems.push('meta.version is missing')
  if (!Array.isArray(data.guides) || data.guides.length === 0) {
    problems.push('guides is empty')
    throw new Error(`Invalid formulary.json:\n - ${problems.join('\n - ')}`)
  }
  const guideIds = new Set(data.guides.map((g) => g.id))
  if (!guideIds.has(data.meta.defaultGuideId))
    problems.push(`meta.defaultGuideId "${data.meta.defaultGuideId}" matches no guide`)

  data.guides.forEach((guide, gi) => {
    const G = `guide ${guide.id || `#${gi}`}`
    if (!guide.id) problems.push(`${G}: missing id`)
    for (const field of ['label', 'region', 'topic', 'classNoun', 'unitNoun', 'tagline'] as const) {
      if (!guide[field]) problems.push(`${G}: missing ${field}`)
    }
    if (!guide.capturedAt) problems.push(`${G}: missing capturedAt`)
    if (!['sample', 'mixed', 'verified'].includes(guide.dataStatus))
      problems.push(`${G}: invalid dataStatus "${guide.dataStatus}"`)

    const payerIds = new Set(guide.payers.map((p) => p.id))
    const classIds = new Set(guide.classes.map((c) => c.id))
    const refIds = new Set(guide.references.map((r) => r.id))
    const comingSoon = new Set(guide.classes.filter((c) => c.comingSoon).map((c) => c.id))

    if (guide.payers.length === 0) problems.push(`${G}: payers is empty`)
    if (guide.classes.length === 0) problems.push(`${G}: classes is empty`)
    if (guide.references.length === 0) problems.push(`${G}: references is empty`)

    guide.references.forEach((r) => {
      if (!r.id || !r.label || !r.url || !r.publisher || !r.accessed)
        problems.push(`${G} reference "${r.id || '?'}" missing id/label/url/publisher/accessed`)
    })

    const checkSources = (ids: string[], at: string) =>
      ids.forEach((id) => {
        if (!refIds.has(id)) problems.push(`${G} ${at}: unknown sourceId "${id}"`)
      })

    guide.payers.forEach((p) => checkSources(p.sourceIds, `payer ${p.id}`))
    guide.classes.forEach((c) => {
      checkSources(c.sourceIds, `class ${c.id}`)
      if (!c.plainName) problems.push(`${G} class ${c.id}: missing plainName`)
    })
    guide.glossary.forEach((gl) => {
      if (!gl.term || !gl.definition)
        problems.push(`${G} glossary "${gl.term || '?'}" missing term/definition`)
      if (gl.sourceIds) checkSources(gl.sourceIds, `glossary ${gl.term}`)
    })

    const seen = new Set<string>()
    guide.records.forEach((r, i) => {
      const at = `records[${i}] (${r.payerId}/${r.classId})`
      if (!payerIds.has(r.payerId)) problems.push(`${G} ${at}: unknown payerId`)
      if (!classIds.has(r.classId)) problems.push(`${G} ${at}: unknown classId`)
      if (comingSoon.has(r.classId)) problems.push(`${G} ${at}: references a coming-soon class`)

      const k = key(r.payerId, r.classId)
      if (seen.has(k)) problems.push(`${G} ${at}: duplicate payer/class cell`)
      seen.add(k)

      const a = r.preferredAgent
      if (!a || !a.inn || !a.strength || !a.sig || !a.sigShort || !a.plainSig)
        problems.push(`${G} ${at}: preferredAgent missing inn/strength/sig/sigShort/plainSig`)
      if (!Array.isArray(r.paRequired)) problems.push(`${G} ${at}: paRequired is not an array`)
      else
        r.paRequired.forEach((p, j) => {
          if (!p || !p.drug || !p.reason)
            problems.push(`${G} ${at}: paRequired[${j}] missing drug/reason`)
        })
      if (r.alternatives !== undefined) {
        if (!Array.isArray(r.alternatives)) problems.push(`${G} ${at}: alternatives is not an array`)
        else
          r.alternatives.forEach((alt, j) => {
            if (!alt || !alt.drug) problems.push(`${G} ${at}: alternatives[${j}] missing drug`)
          })
      }
      if (r.boglActive && !a?.brand) problems.push(`${G} ${at}: boglActive is true but no brand is set`)
      if (r.boglActive && !r.boglNote) problems.push(`${G} ${at}: boglActive is true but boglNote is empty`)
      if (!VERIFICATIONS.has(r.verification)) problems.push(`${G} ${at}: invalid verification "${r.verification}"`)
      if (!r.verificationNote) problems.push(`${G} ${at}: missing verificationNote`)
      if (!r.sourceIds || r.sourceIds.length === 0)
        problems.push(`${G} ${at}: no sourceIds (every cell must cite a source)`)
      checkSources(r.sourceIds || [], at)
    })

    // Count floor: every payer × active class must be covered within the guide.
    guide.payers.forEach((p) =>
      guide.classes
        .filter((c) => !c.comingSoon)
        .forEach((c) => {
          if (!seen.has(key(p.id, c.id))) problems.push(`${G}: missing cell ${p.id}/${c.id}`)
        }),
    )
  })

  if (problems.length > 0) {
    throw new Error(`Invalid formulary.json:\n - ${problems.join('\n - ')}`)
  }
}

validate(formulary)

// ---- Search index (precomputed once per guide at load, not per keystroke) ----

export interface SearchHit {
  payerId: PayerId
  classId: ClassId
  /** The drug text that matched. */
  drug: string
  /** Whether this drug is the preferred agent here, or a reject. */
  kind: 'preferred' | 'reject'
}

interface IndexEntry extends SearchHit {
  haystack: string
}

/**
 * A guide with its data pre-indexed and its lookups bound to its own payers/classes/refs.
 * Components receive the active GuideView and never reach across guides.
 */
export interface GuideView extends Guide {
  allClasses: ClassMeta[]
  activeClasses: ClassMeta[]
  getRecord(payerId: PayerId, classId: ClassId): FormularyRecord | undefined
  getPayer(payerId: PayerId): PayerMeta | undefined
  getClass(classId: ClassId): ClassMeta | undefined
  resolveSources(ids: string[]): Reference[]
  lookupGlossary(q: string): GlossaryTerm | undefined
  searchFormulary(query: string, limit?: number): SearchHit[]
}

function buildGuideView(guide: Guide): GuideView {
  const recordsByKey = new Map<string, FormularyRecord>(
    guide.records.map((r) => [key(r.payerId, r.classId), r]),
  )
  const payersById = new Map<string, PayerMeta>(guide.payers.map((p) => [p.id, p]))
  const classesById = new Map<string, ClassMeta>(guide.classes.map((c) => [c.id, c]))
  const refsById = new Map<string, Reference>(guide.references.map((r) => [r.id, r]))

  const searchIndex: IndexEntry[] = guide.records.flatMap((r) => {
    const a = r.preferredAgent
    const entries: IndexEntry[] = [
      {
        payerId: r.payerId,
        classId: r.classId,
        drug: a.brand ? `${a.inn} (${a.brand})` : a.inn,
        kind: 'preferred',
        haystack: `${a.inn} ${a.brand ?? ''}`.toLowerCase(),
      },
    ]
    for (const pa of r.paRequired) {
      entries.push({
        payerId: r.payerId,
        classId: r.classId,
        drug: pa.drug,
        kind: 'reject',
        haystack: pa.drug.toLowerCase(),
      })
    }
    return entries
  })

  function resolveSources(ids: string[]): Reference[] {
    const out: Reference[] = []
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) continue
      const ref = refsById.get(id)
      if (ref) {
        out.push(ref)
        seen.add(id)
      }
    }
    return out
  }

  function searchFormulary(query: string, limit = 12): SearchHit[] {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    const hits: SearchHit[] = []
    for (const e of searchIndex) {
      if (e.haystack.includes(q)) {
        hits.push({ payerId: e.payerId, classId: e.classId, drug: e.drug, kind: e.kind })
        if (hits.length >= limit) break
      }
    }
    // Preferred matches first, then rejects.
    return hits.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'preferred' ? -1 : 1))
  }

  return {
    ...guide,
    allClasses: guide.classes,
    activeClasses: guide.classes.filter((c) => !c.comingSoon),
    getRecord: (payerId, classId) => recordsByKey.get(key(payerId, classId)),
    getPayer: (payerId) => payersById.get(payerId),
    getClass: (classId) => classesById.get(classId),
    resolveSources,
    lookupGlossary(q: string) {
      const s = q.toLowerCase()
      return guide.glossary.find((g) => g.term.toLowerCase().includes(s))
    },
    searchFormulary,
  }
}

/** Global, guide-independent app meta (title, disclaimer, version, default guide). */
export const meta = formulary.meta

export const defaultGuideId = formulary.meta.defaultGuideId

/** Every guide, pre-indexed, in declaration order — the source of truth for the top-level toggle. */
export const guides: GuideView[] = formulary.guides.map(buildGuideView)

const guidesById = new Map<string, GuideView>(guides.map((g) => [g.id, g]))

/** Resolve a guide by id, falling back to the first guide if the id is unknown. */
export function getGuideView(id: string): GuideView {
  return guidesById.get(id) ?? guides[0]!
}

// ---- Active-guide context ----
// The active guide is ambient for deep components (GlossaryTerm sits inside BoglBanner inside
// ResultCard), so it rides a context rather than threading a lookup through every layer.

const GuideContext = createContext<GuideView>(getGuideView(defaultGuideId))

export const GuideProvider = GuideContext.Provider

export function useGuide(): GuideView {
  return useContext(GuideContext)
}
