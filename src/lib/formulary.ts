import rawData from '../data/formulary.json'
import type {
  ClassId,
  ClassMeta,
  Formulary,
  FormularyRecord,
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
 * card. Throws with a list of every problem found.
 */
function validate(data: Formulary): void {
  const problems: string[] = []
  const payerIds = new Set(data.meta.payers.map((p) => p.id))
  const classIds = new Set(data.meta.classes.map((c) => c.id))
  const refIds = new Set(data.meta.references.map((r) => r.id))
  const comingSoon = new Set(
    data.meta.classes.filter((c) => c.comingSoon).map((c) => c.id),
  )

  if (data.meta.payers.length === 0) problems.push('meta.payers is empty')
  if (data.meta.classes.length === 0) problems.push('meta.classes is empty')
  if (data.meta.references.length === 0) problems.push('meta.references is empty')

  data.meta.references.forEach((r) => {
    if (!r.id || !r.label || !r.url || !r.publisher || !r.accessed)
      problems.push(`reference "${r.id || '?'}" missing id/label/url/publisher/accessed`)
  })

  const checkSources = (ids: string[], at: string) =>
    ids.forEach((id) => {
      if (!refIds.has(id)) problems.push(`${at}: unknown sourceId "${id}"`)
    })

  data.meta.payers.forEach((p) => checkSources(p.sourceIds, `payer ${p.id}`))
  data.meta.classes.forEach((c) => {
    checkSources(c.sourceIds, `class ${c.id}`)
    if (!c.plainName) problems.push(`class ${c.id}: missing plainName`)
  })
  data.meta.glossary.forEach((g) => {
    if (!g.term || !g.definition) problems.push(`glossary "${g.term || '?'}" missing term/definition`)
    if (g.sourceIds) checkSources(g.sourceIds, `glossary ${g.term}`)
  })

  const seen = new Set<string>()
  data.records.forEach((r, i) => {
    const at = `records[${i}] (${r.payerId}/${r.classId})`
    if (!payerIds.has(r.payerId)) problems.push(`${at}: unknown payerId`)
    if (!classIds.has(r.classId)) problems.push(`${at}: unknown classId`)
    if (comingSoon.has(r.classId)) problems.push(`${at}: references a coming-soon class`)

    const k = key(r.payerId, r.classId)
    if (seen.has(k)) problems.push(`${at}: duplicate payer/class cell`)
    seen.add(k)

    const a = r.preferredAgent
    if (!a || !a.inn || !a.strength || !a.sig || !a.sigShort || !a.plainSig)
      problems.push(`${at}: preferredAgent missing inn/strength/sig/sigShort/plainSig`)
    if (!Array.isArray(r.paRequired)) problems.push(`${at}: paRequired is not an array`)
    else
      r.paRequired.forEach((p, j) => {
        if (!p || !p.drug || !p.reason) problems.push(`${at}: paRequired[${j}] missing drug/reason`)
      })
    if (r.alternatives !== undefined) {
      if (!Array.isArray(r.alternatives)) problems.push(`${at}: alternatives is not an array`)
      else
        r.alternatives.forEach((alt, j) => {
          if (!alt || !alt.drug) problems.push(`${at}: alternatives[${j}] missing drug`)
        })
    }
    if (r.boglActive && !a?.brand) problems.push(`${at}: boglActive is true but no brand is set`)
    if (r.boglActive && !r.boglNote) problems.push(`${at}: boglActive is true but boglNote is empty`)
    if (!VERIFICATIONS.has(r.verification)) problems.push(`${at}: invalid verification "${r.verification}"`)
    if (!r.verificationNote) problems.push(`${at}: missing verificationNote`)
    if (!r.sourceIds || r.sourceIds.length === 0) problems.push(`${at}: no sourceIds (every cell must cite a source)`)
    checkSources(r.sourceIds || [], at)
  })

  if (problems.length > 0) {
    throw new Error(`Invalid formulary.json:\n - ${problems.join('\n - ')}`)
  }
}

validate(formulary)

export const meta = formulary.meta

/** Payers in declaration order — the single source of truth for the payer selector. */
export const payers: PayerMeta[] = formulary.meta.payers

/** Every class, including coming-soon ones (rendered disabled). */
export const allClasses: ClassMeta[] = formulary.meta.classes

/** Only classes with data, for default selection and iteration. */
export const activeClasses: ClassMeta[] = formulary.meta.classes.filter((c) => !c.comingSoon)

export const glossary: GlossaryTerm[] = formulary.meta.glossary

/** Find a glossary entry by a substring of its term (e.g. "BOGL", "step therapy"). */
export function lookupGlossary(q: string): GlossaryTerm | undefined {
  const s = q.toLowerCase()
  return glossary.find((g) => g.term.toLowerCase().includes(s))
}

export const records = formulary.records

const recordsByKey = new Map<string, FormularyRecord>(
  formulary.records.map((r) => [key(r.payerId, r.classId), r]),
)
const payersById = new Map<PayerId, PayerMeta>(formulary.meta.payers.map((p) => [p.id, p]))
const classesById = new Map<ClassId, ClassMeta>(formulary.meta.classes.map((c) => [c.id, c]))
const refsById = new Map<string, Reference>(formulary.meta.references.map((r) => [r.id, r]))

export function getRecord(payerId: PayerId, classId: ClassId): FormularyRecord | undefined {
  return recordsByKey.get(key(payerId, classId))
}
export function getPayer(payerId: PayerId): PayerMeta | undefined {
  return payersById.get(payerId)
}
export function getClass(classId: ClassId): ClassMeta | undefined {
  return classesById.get(classId)
}

/** Resolve a record/payer/class's sourceIds to full Reference objects, in order, deduped. */
export function resolveSources(ids: string[]): Reference[] {
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

// ---- Search index (precomputed once at load, not per keystroke) ----

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

const searchIndex: IndexEntry[] = formulary.records.flatMap((r) => {
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

/** Substring search over preferred + reject drug names across every payer/class. */
export function searchFormulary(query: string, limit = 12): SearchHit[] {
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
