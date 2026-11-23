/**
 * Manufacturer copay programs. These lower what a commercially insured patient pays at the
 * counter; they are not insurance coverage and not a cash price, so the UI shows them apart from
 * both. Every number here was read off the manufacturer's own terms document on `capturedAt`.
 */
export interface CopayProgram {
  matches: RegExp
  name: string
  /** Where a patient enrolls. */
  url: string
  /** Who qualifies and what it pays, in the program's own terms. */
  terms: string
  /** The manufacturer's terms document the terms were read from. */
  sourceUrl: string
  sourceLabel: string
  capturedAt: string
  /** Only plans of these types can use it. */
  payerTypes: readonly ('commercial' | 'medicaid' | 'medicare')[]
}

export const COPAY_PROGRAMS: readonly CopayProgram[] = [
  {
    // Same exclusions as the Dovato cash rule: Triumeq and Juluca have their own ViiV limits.
    matches: /^(?!.*\b(abacavir|triumeq|rilpivirine|juluca)\b).*(dovato|dolutegravir\W+(sodium\W+)?(and\W+)?lamivudine)/i,
    name: 'ViiVConnect Copay Program',
    url: 'https://www.viivconnect.com/patient/get-savings-information/',
    terms:
      'Commercial insurance that covers Dovato only; not Medicare, Medicaid, TRICARE, Veterans Affairs or other government plans, and not for cash payers. As little as $0 per fill, up to $6,250 a year for Dovato.',
    sourceUrl:
      'https://www.viivconnect.com/content/dam/cf-viiv/viivconnect-v4/master/pdf/Copay_Program_Eligibility_Requirements_and_Restrictions.pdf',
    sourceLabel: 'ViiVConnect eligibility requirements (March 2026)',
    capturedAt: '2026-11-22',
    payerTypes: ['commercial'],
  },
]

export function copayProgramFor(name: string): CopayProgram | undefined {
  return COPAY_PROGRAMS.find((p) => p.matches.test(name))
}
