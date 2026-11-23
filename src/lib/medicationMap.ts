import type { FormularyRecord, PayerMeta, Reference } from '../types/formulary'
import type { GuideSummary, GuideView } from './formulary'
import aliases from '../data/generated/medication-aliases.json'
import { productKey } from './medicationEntries.mjs'
import { productFindings } from './medicationLookup'

/**
 * One medication across every state and plan we cover. Statuses, best first:
 *  - preferred:    the plan's first-pass pick, no PA or step (a quantity limit may apply)
 *  - alternative:  covered, listed in the class's alternatives
 *  - pa:           needs PA, step therapy or another plan review
 *  - nonformulary: the plan's list says it is not covered
 *  - notListed:    the plan's record in this class does not name it. Absence is not exclusion.
 *  - unknown:      we hold no confirmed answer (illustrative record, or the document itself says
 *                  coverage is not confirmed)
 */
export type MedStatus = 'preferred' | 'alternative' | 'pa' | 'nonformulary' | 'notListed' | 'unknown'

export const STATUS_ORDER: readonly MedStatus[] = ['preferred', 'alternative', 'pa', 'nonformulary', 'notListed', 'unknown']

export const STATUS_LABEL: Record<MedStatus, string> = {
  preferred: 'Preferred, no PA',
  alternative: 'Covered alternative',
  pa: 'PA or step',
  nonformulary: 'Not covered',
  notListed: 'Not listed in our data',
  unknown: 'Unknown',
}

export type PayerType = 'medicaid' | 'commercial' | 'medicare'

export const PAYER_TYPE_LABEL: Record<PayerType, string> = {
  medicaid: 'Medicaid',
  commercial: 'Commercial',
  medicare: 'Medicare',
}

export function payerType(segment: PayerMeta['marketSegment']): PayerType {
  if (segment.startsWith('medicaid')) return 'medicaid'
  if (segment.startsWith('medicare')) return 'medicare'
  return 'commercial'
}

/** One plan's answer for one class. */
export interface MedCell {
  guideId: string
  classId: string
  status: MedStatus
  /** The plan's own wording for the product. Empty when notListed/unknown. */
  labels: string[]
  /** Tier text, alternative note, or barrier reason, as the source states it. */
  tier: string | null
  restriction: string | null
  verification: FormularyRecord['verification'] | null
  sources: Reference[]
  /** The guide's capture date and the record's own review date. */
  capturedAt: string
  lastReviewed: string | null
}

export interface MedPlan {
  stateCode: string
  payer: PayerMeta
  type: PayerType
  /** Best status across this plan's cells (a drug can sit in more than one class). */
  status: MedStatus
  cells: MedCell[]
}

export interface MedState {
  stateCode: string
  region: string
  plans: MedPlan[]
  /** Best plan status in the state; drives the tile color. */
  best: MedStatus
  /** Every plan is preferred with no PA. Needs at least one plan. */
  allPreferred: boolean
  counts: Record<MedStatus, number>
}

export interface MedMap {
  label: string
  states: MedState[]
  totals: Record<MedStatus, number>
  plans: number
  byType: Record<PayerType, { plans: number; counts: Record<MedStatus, number> }>
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * The catalog product a `?med=` link names: the exact entry, else the entry for the same product
 * under another spelling ("DOVATO (dolutegravir/lamivudine)"), else the only entry naming it as a
 * whole word ("dovato"). Ambiguous or unknown → undefined; never a guess between two products.
 */
export function resolveMed(names: readonly string[], query: string): string | undefined {
  const q = query.trim()
  if (!q) return undefined
  if (names.includes(q)) return q
  const key = productKey(q, aliases)
  const same = names.filter((n) => productKey(n, aliases) === key)
  if (same.length === 1) return same[0]
  if (q.length < 3) return undefined
  const re = new RegExp(`(^|[^a-z0-9])${escape(q)}($|[^a-z0-9])`, 'i')
  const words = names.filter((n) => re.test(n))
  // "dovato" names one product; a bare brand never stands in for a combination it appears in.
  const lead = words.filter((n) => new RegExp(`^${escape(q)}\\b`, 'i').test(n))
  return words.length === 1 ? words[0] : lead.length === 1 ? lead[0] : undefined
}

/**
 * Every guide that must load to answer the question: all guides on the matched topics, so a
 * state whose plans never list the drug shows "not listed" instead of silently vanishing.
 */
export function guidesToLoad(scopes: readonly string[], options: readonly GuideSummary[]): string[] {
  const matched = new Set(scopes.map((s) => s.split('/')[0]))
  const topics = new Set(options.filter((g) => matched.has(g.id)).map((g) => g.topicId))
  return options.filter((g) => topics.has(g.topicId)).map((g) => g.id)
}

const UNCONFIRMED = /coverage is not confirmed|does not confirm coverage|coverage not confirmed/i

function cellFor(guide: GuideView, record: FormularyRecord | undefined, classId: string, label: string): MedCell {
  const base = { guideId: guide.id, classId, capturedAt: guide.capturedAt }
  if (!record || record.verification === 'example')
    return {
      ...base,
      status: 'unknown',
      labels: [],
      tier: null,
      restriction: null,
      verification: record?.verification ?? null,
      sources: [],
      lastReviewed: record?.lastReviewed ?? null,
    }
  const hits = productFindings(record, label).map((f) => ({ label: f.matched, f }))
  const common = { verification: record.verification, lastReviewed: record.lastReviewed }
  if (!hits.length)
    return {
      ...base,
      ...common,
      status: 'notListed',
      labels: [],
      tier: null,
      restriction: null,
      sources: guide.resolveSources(record.coverageSourceIds),
    }
  const reads = hits.map(({ f }) => {
    // Alternative: its note is the tier text. Barrier: the reason is the restriction. The
    // preferred pick (with or without its own PA): the record's tier and restriction.
    if (f.label === 'Alternative') return { status: 'alternative' as MedStatus, tier: f.detail, restriction: null }
    if (f.label !== 'Plan review required' && f.item)
      return { status: (f.item.outcome === 'nonformulary' ? 'nonformulary' : 'pa') as MedStatus, tier: null, restriction: f.item.reason }
    const status: MedStatus = f.item ? 'pa' : UNCONFIRMED.test(record.preferredRestriction ?? '') ? 'unknown' : 'preferred'
    return { status, tier: record.tier ?? null, restriction: record.preferredRestriction ?? null }
  })
  const top = reads.reduce((a, b) => (STATUS_ORDER.indexOf(b.status) < STATUS_ORDER.indexOf(a.status) ? b : a))
  return {
    ...base,
    ...common,
    ...top,
    labels: [...new Set(hits.map((h) => h.label))],
    sources: guide.resolveSources([...new Set(hits.flatMap((h) => h.f.sources))]),
  }
}

const best = (statuses: MedStatus[]): MedStatus =>
  statuses.reduce<MedStatus>((a, b) => (STATUS_ORDER.indexOf(b) < STATUS_ORDER.indexOf(a) ? b : a), 'unknown')

const zero = (): Record<MedStatus, number> => ({ preferred: 0, alternative: 0, pa: 0, nonformulary: 0, notListed: 0, unknown: 0 })

/**
 * Pure: the drug's status on every plan of every loaded guide. A plan is one payer in one state;
 * a payer that appears in two guides (two topics) is still one plan, at its best status.
 */
export function buildMedMap(label: string, scopes: readonly string[], guides: readonly GuideView[]): MedMap {
  const classesByTopic = new Map<string, Set<string>>()
  for (const s of scopes) {
    const [gid, cid] = s.split('/')
    const g = guides.find((x) => x.id === gid)
    if (!g || !cid) continue
    classesByTopic.set(g.topicId, (classesByTopic.get(g.topicId) ?? new Set()).add(cid))
  }
  const planMap = new Map<string, MedPlan>()
  const regions = new Map<string, string>()
  for (const guide of guides) {
    const classIds = [...(classesByTopic.get(guide.topicId) ?? [])]
    if (!classIds.length) continue
    regions.set(guide.stateCode, guide.region)
    for (const payer of guide.payers) {
      const key = `${guide.stateCode}|${payer.id}`
      const plan = planMap.get(key) ?? { stateCode: guide.stateCode, payer, type: payerType(payer.marketSegment), status: 'unknown' as MedStatus, cells: [] }
      for (const classId of classIds) plan.cells.push(cellFor(guide, guide.getRecord(payer.id, classId), classId, label))
      plan.status = best(plan.cells.map((c) => c.status))
      planMap.set(key, plan)
    }
  }
  const totals = zero()
  const byType: MedMap['byType'] = {
    medicaid: { plans: 0, counts: zero() },
    commercial: { plans: 0, counts: zero() },
    medicare: { plans: 0, counts: zero() },
  }
  const byState = new Map<string, MedPlan[]>()
  for (const plan of planMap.values()) {
    totals[plan.status]++
    byType[plan.type].plans++
    byType[plan.type].counts[plan.status]++
    byState.set(plan.stateCode, [...(byState.get(plan.stateCode) ?? []), plan])
  }
  const states: MedState[] = [...byState.entries()]
    .map(([stateCode, plans]) => {
      const counts = zero()
      plans.forEach((p) => counts[p.status]++)
      const sorted = [...plans].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.payer.name.localeCompare(b.payer.name))
      return {
        stateCode,
        region: regions.get(stateCode) ?? stateCode,
        plans: sorted,
        best: best(plans.map((p) => p.status)),
        allPreferred: plans.length > 0 && plans.every((p) => p.status === 'preferred'),
        counts,
      }
    })
    .sort((a, b) => a.region.localeCompare(b.region))
  return { label, states, totals, plans: planMap.size, byType }
}
