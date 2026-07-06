import { createContext, useContext } from 'react'
import formularyIndexRaw from '../data/generated/index.json'
import defaultGuideRaw from '../data/generated/guides/ma-inhalers.json'
import type {
  AppMeta,
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

export interface GuideSummary {
  id: string
  label: string
  stateCode: string
  region: string
  topicId: string
  topic: string
}

const formularyIndex = formularyIndexRaw as { meta: AppMeta; guides: GuideSummary[] }
const defaultGuideData = defaultGuideRaw as Guide

const key = (payerId: string, classId: string) => `${payerId}::${classId}`

const VERIFICATIONS = new Set(['verified', 'partial', 'example'])
const BARRIER_OUTCOMES = new Set(['pa', 'step', 'nonformulary'])

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
    for (const field of ['label', 'stateCode', 'region', 'topicId', 'topic', 'classNoun', 'unitNoun'] as const) {
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

    guide.payers.forEach((p) => {
      checkSources(p.sourceIds, `payer ${p.id}`)
      if (!p.productName || !p.marketSegment || !p.formularyId)
        problems.push(`${G} payer ${p.id}: missing exact productName/marketSegment/formularyId`)
    })
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
          else if (!BARRIER_OUTCOMES.has(p.outcome))
            problems.push(`${G} ${at}: paRequired[${j}] invalid barrier outcome "${p.outcome}"`)
          else if (/higher tier|non-preferred/i.test(p.reason))
            problems.push(`${G} ${at}: paRequired[${j}] is covered/cost-sharing, not a barrier`)
          checkSources(p.sourceIds || [], `${at} paRequired[${j}]`)
          if (!p.sourceIds?.length) problems.push(`${G} ${at}: paRequired[${j}] has no sourceIds`)
        })
      if (r.alternatives !== undefined) {
        if (!Array.isArray(r.alternatives)) problems.push(`${G} ${at}: alternatives is not an array`)
        else
          r.alternatives.forEach((alt, j) => {
            if (!alt || !alt.drug) problems.push(`${G} ${at}: alternatives[${j}] missing drug`)
            if (!alt.sourceIds?.length) problems.push(`${G} ${at}: alternatives[${j}] has no sourceIds`)
            checkSources(alt.sourceIds || [], `${at} alternatives[${j}]`)
          })
      }
      if (r.boglActive && !a?.brand) problems.push(`${G} ${at}: boglActive is true but no brand is set`)
      if (r.boglActive && !a?.genericAvailable)
        problems.push(`${G} ${at}: boglActive is true but the preferred agent has no generic/biosimilar counterpart`)
      if (r.boglActive && !r.boglNote) problems.push(`${G} ${at}: boglActive is true but boglNote is empty`)
      if (!VERIFICATIONS.has(r.verification)) problems.push(`${G} ${at}: invalid verification "${r.verification}"`)
      if (!r.verificationNote) problems.push(`${G} ${at}: missing verificationNote`)
      if (!r.sourceIds || r.sourceIds.length === 0)
        problems.push(`${G} ${at}: no sourceIds (every cell must cite a source)`)
      checkSources(r.sourceIds || [], at)
      if (!r.coverageSourceIds?.length) problems.push(`${G} ${at}: no coverageSourceIds`)
      if (!r.restrictionSourceIds?.length) problems.push(`${G} ${at}: no restrictionSourceIds`)
      checkSources(r.coverageSourceIds || [], `${at} coverage`)
      checkSources(r.restrictionSourceIds || [], `${at} restrictions`)
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

export function buildGuideView(guide: Guide): GuideView {
  validate({ meta: { ...formularyIndex.meta, defaultGuideId: guide.id }, guides: [guide] })
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
export const meta = formularyIndex.meta

export const defaultGuideId = formularyIndex.meta.defaultGuideId

/** Small guide manifest used by the top-level toggle; full guide data loads on selection. */
export const guideOptions: GuideSummary[] = formularyIndex.guides

export interface StateOption {
  code: string
  region: string
}

export interface TopicOption {
  id: string
  label: string
}

function uniqueBy<T, K>(items: T[], key: (item: T) => K): T[] {
  const seen = new Set<K>()
  const out: T[] = []
  for (const item of items) {
    const k = key(item)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(item)
  }
  return out
}

/** Every state that has at least one guide, in first-seen order — feeds the state selector. */
export const stateOptions: StateOption[] = uniqueBy(
  guideOptions.map((g) => ({ code: g.stateCode, region: g.region })),
  (s) => s.code,
)

/** Every prescription type that has at least one guide, in first-seen order — feeds the topic selector. */
export const topicOptions: TopicOption[] = uniqueBy(
  guideOptions.map((g) => ({ id: g.topicId, label: g.topic })),
  (t) => t.id,
)

/** Resolves a (state, topic) pair to a guide id, or undefined if that combination isn't covered yet. */
export function findGuideId(stateCode: string, topicId: string): string | undefined {
  return guideOptions.find((g) => g.stateCode === stateCode && g.topicId === topicId)?.id
}

if (defaultGuideData.id !== defaultGuideId) {
  throw new Error(
    `Generated default guide mismatch: expected ${defaultGuideId}, received ${defaultGuideData.id}`,
  )
}

const defaultGuideView = buildGuideView(defaultGuideData)
const guideModules = import.meta.glob<{ default: Guide }>([
  '../data/generated/guides/*.json',
  '!../data/generated/guides/ma-inhalers.json',
])
const guideCache = new Map<string, Promise<GuideView>>([
  [defaultGuideId, Promise.resolve(defaultGuideView)],
])

export function getDefaultGuideView(): GuideView {
  return defaultGuideView
}

/** Load one guide chunk by id and cache its indexed view. */
export function loadGuideView(id: string): Promise<GuideView> {
  const requestedId = guideOptions.some((guide) => guide.id === id) ? id : defaultGuideId
  const cached = guideCache.get(requestedId)
  if (cached) return cached

  const path = `../data/generated/guides/${requestedId}.json`
  const load = guideModules[path]
  if (!load) return Promise.reject(new Error(`No generated guide chunk for ${requestedId}`))
  const pending = load().then((module) => buildGuideView(module.default))
  guideCache.set(requestedId, pending)
  return pending
}

// ---- Active-guide context ----
// The active guide is ambient for deep components (GlossaryTerm sits inside BoglBanner inside
// ResultCard), so it rides a context rather than threading a lookup through every layer.

const GuideContext = createContext<GuideView>(defaultGuideView)

export const GuideProvider = GuideContext.Provider

export function useGuide(): GuideView {
  return useContext(GuideContext)
}
