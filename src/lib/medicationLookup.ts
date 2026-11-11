import type { FormularyRecord, PaItem } from '../types/formulary'
import { medicationEntries } from './medicationEntries.mjs'
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
