export interface Amount { n: number; unit: string }
export function amounts(text: string): Amount[]
export function deliverable(dose: Amount, strengths: Amount[]): boolean
export function mg(a: Amount): number
