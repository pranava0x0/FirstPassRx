import type { FormularyRecord, PaItem } from '../types/formulary'
import { medicationEntries, productKey } from './medicationEntries.mjs'
import aliases from '../data/generated/medication-aliases.json'
import { preferredPaItem } from './paRequest'

export interface Finding {
  label: string
  detail: string
  sources: string[]
  item?: PaItem
}
export function findings(record: FormularyRecord, label: string): Finding[] {
  const result: Finding[] = []
  for (const entry of medicationEntries(record)) {
    if (entry.label !== label) continue
    if (entry.kind === 'barrier') {
      const item = record.paRequired[entry.index]!
      result.push({
        label: { pa: 'PA required', step: 'Step therapy', nonformulary: 'Nonformulary' }[item.outcome],
        detail: item.reason,
        sources: item.sourceIds,
        item,
      })
    } else if (entry.kind === 'alternative') {
      const alt = record.alternatives![entry.index]!
      result.push({ label: 'Alternative', detail: alt.note ?? 'Listed alternative', sources: alt.sourceIds })
    } else {
      const item = preferredPaItem(record)
      result.push({
        label: item
          ? 'Plan review required'
          : record.preferredRestriction
            ? 'Plan restriction'
            : 'First-pass option',
        detail: [record.tier, record.preferredRestriction, record.boglActive && record.boglNote]
          .filter(Boolean)
          .join(' · '),
        sources: [...new Set([...record.coverageSourceIds, ...record.restrictionSourceIds])],
        item,
      })
    }
  }
  return result
}

/** Findings for every listing of the same product in this record, whatever the plan calls it. Each
 *  carries the plan's own wording (`matched`) so a different strength or spelling stays visible. */
export function productFindings(record: FormularyRecord, label: string): (Finding & { matched: string })[] {
  const key = productKey(label, aliases)
  if (!key) return []
  const labels = [...new Set(medicationEntries(record).map((e) => e.label))].filter((l) => productKey(l, aliases) === key)
  return labels.flatMap((matched) => findings(record, matched).map((f) => ({ ...f, matched })))
}
