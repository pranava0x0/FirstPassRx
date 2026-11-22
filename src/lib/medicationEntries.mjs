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

// One product under its many spellings across plans ("DOVATO (dolutegravir/lamivudine)", "Dolutegravir-
// lamivudine (Dovato) 50-300 mg", "Dovato® tabs"...). Drops strengths, quantity-limit notes and the
// words "tablet", "oral", "brand"; keeps every other word, so a brand never merges with its generic,
// salts and forms stay apart (Triumeq PD is not Triumeq), and combinations keep each molecule.
const KEY_STRIP = new Set(['tablet', 'tablets', 'tab', 'tabs', 'oral', 'brand', 'name', 'mg', 'mcg', 'ml', 'unit', 'units', 'and'])
export function productKey(label) {
  const s = String(label)
    .toLowerCase()
    .replace(/[®™]/g, ' ')
    .replace(/\((?:ql|quantity|limit|max)[^)]*\)/g, ' ')
    .replace(/\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|%|units?)?(?:\s*\/\s*\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|%)?)*/g, ' ')
  const words = s.split(/[^a-z]+/).filter((w) => w.length > 1 && !KEY_STRIP.has(w))
  return [...new Set(words)].sort().join(' ')
}
