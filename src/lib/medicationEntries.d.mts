import type { FormularyRecord, PreferredAgent } from '../types/formulary'
export function preferredLabel(agent: PreferredAgent): string
export function medicationEntries(record: FormularyRecord): (
  { label: string; kind: 'pick' } | { label: string; kind: 'alternative' | 'barrier'; index: number }
)[]
export function productKey(label: string, aliases?: Record<string, string>): string
export function brandAliases(records: FormularyRecord[]): Record<string, string>
