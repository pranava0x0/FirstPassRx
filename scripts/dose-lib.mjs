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


// The sig's starting dose: the first amount in its first sentence, else the first anywhere.
// Parentheticals list what the plan covers ("plan lists 25, 50, 100 mg"), not a dose.
export function startDose(sig) {
  const text = (sig ?? '').replace(/\([^)]*\)/g, ' ')
  const first = amounts(text.split(/[.;]\s/)[0])
  return (first.length ? first : amounts(text))[0] ?? null
}

// A strength fits a sig when a whole number of units delivers the starting dose, or the sig names
// the strength as a labeled dose ("25, 50 or 100 mg", "may increase to 15 mg"). Strengths or sigs
// with no single-agent amount (combinations, concentrations, "1 tablet") can't be checked: true.
export function fitsSig(strength, sig) {
  const strengths = amounts(strength)
  const dose = startDose(sig)
  if (!strengths.length || !dose || deliverable(dose, strengths)) return true
  const named = amounts((sig ?? '').replace(/(\d)\s*-\s*(\d)/g, '$1 to $2'))
  return strengths.some((st) => named.some((n) => mg(n) === mg(st)))
}

// scripts/data/label-strengths.json rows: [innRegex, strength, contextRegex?, notContextRegex?],
// first match wins. Context is "<classId> :: <inn> :: <current strength>", lowercased, so a row can
// require the form the plan list names ("cream", "patch") and refuse an ambiguous one.
export function compileStrengthRules(rows) {
  const re = (s) => (s ? new RegExp(s, 'i') : null)
  return rows.map(([inn, strength, ctx, notCtx]) => ({ inn: re(inn), strength, ctx: re(ctx), notCtx: re(notCtx) }))
}
export function labelStrength(rules, { classId, inn, strength }) {
  const context = `${classId} :: ${inn} :: ${strength ?? ''}`.toLowerCase()
  const rule = rules.find((r) => r.inn.test(inn) && (!r.ctx || r.ctx.test(context)) && !(r.notCtx && r.notCtx.test(context)))
  return rule?.strength ?? null
}
