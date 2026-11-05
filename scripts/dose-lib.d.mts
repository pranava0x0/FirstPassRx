export interface Amount { n: number; unit: string }
export function amounts(text: string): Amount[]
export function deliverable(dose: Amount, strengths: Amount[]): boolean
export function mg(a: Amount): number
export function startDose(sig: string | null | undefined): Amount | null
export function fitsSig(strength: string, sig: string | null | undefined): boolean
export interface StrengthRule { inn: RegExp; strength: string; ctx: RegExp | null; notCtx: RegExp | null }
export function compileStrengthRules(rows: [string, string, string?, string?][]): StrengthRule[]
export function labelStrength(rules: StrengthRule[], pick: { classId: string; inn: string; strength?: string | null }): string | null
