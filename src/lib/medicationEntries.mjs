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
// Salts that never tell two products apart here ("dolutegravir sodium"). Salts that do (furoate vs
// propionate, succinate vs tartrate, hyclate vs monohydrate) stay in the key.
const KEY_STRIP = new Set(['tablet', 'tablets', 'tab', 'tabs', 'oral', 'brand', 'name', 'mg', 'mcg', 'ml', 'unit', 'units', 'and', 'sodium', 'potassium', 'hcl', 'hydrochloride'])
export function productKey(label, aliases) {
  const s = String(label)
    .toLowerCase()
    .replace(/[®™]/g, ' ')
    .replace(/\((?:ql|quantity|limit|max)[^)]*\)/g, ' ')
    .replace(/\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|%|units?)?(?:\s*\/\s*\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|%)?)*/g, ' ')
  const words = s.split(/[^a-z]+/).filter((w) => w.length > 1 && !KEY_STRIP.has(w))
  const key = [...new Set(words)].sort().join(' ')
  return (aliases && aliases[key]) || key
}

// A bare brand ("Dovato® tabs") maps to the product the plans name with that brand
// (preferredAgent.brand + inn), when every such pick agrees. Built at split time.
export function brandAliases(records) {
  const seen = new Map()
  for (const r of records) {
    const a = r.preferredAgent
    if (!a?.brand || a.brand === a.inn) continue
    const bare = productKey(a.brand)
    if (!bare || bare.includes(' ')) continue
    const full = productKey(`${a.brand} (${a.inn})`)
    if (full === bare) continue
    if (!seen.has(bare)) seen.set(bare, new Set())
    seen.get(bare).add(full)
  }
  const out = {}
  for (const [bare, fulls] of [...seen].sort()) if (fulls.size === 1) out[bare] = [...fulls][0]
  return out
}
