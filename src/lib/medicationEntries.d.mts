import type { FormularyRecord, PreferredAgent } from '../types/formulary'
export function preferredLabel(agent: PreferredAgent): string
export function medicationEntries(record: FormularyRecord): (
  { label: string; kind: 'pick' } | { label: string; kind: 'alternative' | 'barrier'; index: number }
)[]
