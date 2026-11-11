// Shared by catalog generation and lookup. Only names explicitly present on the
// record are indexed. An INN is searchable, but does not stand in for a brand.
export function preferredLabel({ inn, brand, strength }) {
  return [brand && brand !== inn ? `${brand} (${inn})` : inn, strength].filter(Boolean).join(' · ')
}
export function medicationEntries(record) {
  if (record.verification === 'example') return []
  return [
    ...(record.noCoveredAgent ? [] : [{ label: preferredLabel(record.preferredAgent), kind: 'pick' }]),
    ...(record.alternatives || []).map((a, index) => ({ label: a.drug, kind: 'alternative', index })),
    ...record.paRequired.map((a, index) => ({ label: a.drug, kind: 'barrier', index })),
  ]
}
