// Pure dose-text helpers for scripts/check-dose-strength.mjs (tested in src/lib/dose-lib.test.ts).

// Amounts with their unit; a list shares its trailing unit ("0.5 / 1 / 2 mg", "25, 50, 100 mg").
// Combination strengths ("400 mg/100 mg") and concentrations ("6 mg/mL", "1%") are skipped.
const DOSE = /((?:\d+(?:\.\d+)?\s*(?:,|\/|or|and|to)\s*)*)(\d+(?:\.\d+)?)\s*(mg|mcg)\b(?!\s*\/)/gi
export function amounts(text) {
  if (!text || /\d\s*-\s*\d+(\.\d+)?\s*(mg|mcg)/i.test(text) || /\d\s*(mg|mcg)\s*\/\s*(\d|m?l\b|ml|act|hr|24)/i.test(text)) return []
  return [...text.matchAll(DOSE)].flatMap((m) =>
    [...(m[1].match(/\d+(?:\.\d+)?/g) ?? []), m[2]].map((n) => ({ n: Number(n), unit: m[3].toLowerCase() })),
  )
}
export const mg = (a) => (a.unit === 'mcg' ? a.n / 1000 : a.n)
export function deliverable(dose, strengths) {
  return strengths.some((s) => [1, 2, 3, 4].some((k) => Math.abs(mg(s) * k - mg(dose)) < 1e-9))
}

