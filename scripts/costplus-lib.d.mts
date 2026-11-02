export interface CostPlusEntry {
  url: string
  medication_name: string
  form: string
  strength: string
  unit: string
  pack_size: number
  quantity: number
  cpd_channel: { price_per_unit: number; cash_dispensing_fee?: number; in_stock?: boolean } | null
}
export function slugOf(url: string): string
export function cashPrice(entry: CostPlusEntry, count: number): number | null
export function unitsFor(label: string, entry: CostPlusEntry): number | null
export function words(s: string): string[]
export function formOf(text: string): { form: string | null; extended: boolean }
export function sameForm(want: { form: string | null; extended: boolean }, entry: CostPlusEntry): boolean
export function sameMolecule(want: string[], entry: CostPlusEntry): boolean
export function strengthNum(s: string): string | undefined
