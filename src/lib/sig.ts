import type { FormularyRecord } from '../types/formulary'

/**
 * The exact name to write on the prescription.
 *
 * When BOGL is active the plan forces the brand, so we paste the brand — that is the
 * whole point of the warning. Otherwise we default to the generic (INN), which is what
 * the example "Budesonide/formoterol 160/4.5 mcg - 2 puffs BID" shows. Brand-only agents
 * (no generic on the market) still read cleanly by INN, which the pharmacy maps to the
 * single available product.
 */
export function rxName(record: FormularyRecord): string {
  const { preferredAgent, boglActive } = record
  if (boglActive && preferredAgent.brand) return preferredAgent.brand
  return preferredAgent.inn
}

function readableStrength(strength: string): string {
  return strength.replace(/\bmcg\b/g, 'micrograms')
}

/**
 * EHR-ready prescription string for Epic/Cerner paste, e.g.
 * "Budesonide/formoterol 160/4.5 micrograms - 2 puffs twice daily".
 */
export function buildSig(record: FormularyRecord): string {
  const { strength, sig } = record.preferredAgent
  return `${rxName(record)} ${readableStrength(strength)} - ${sig}`
}
