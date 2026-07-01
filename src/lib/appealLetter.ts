import type { ClassMeta, FormularyRecord, PaItem, PayerMeta } from '../types/formulary'

const BARRIER_LABEL: Record<PaItem['outcome'], string> = {
  pa: 'prior authorization',
  step: 'step therapy',
  nonformulary: 'non-formulary status',
}

/**
 * A pre-filled PA appeal letter for one blocked drug, built from data already on the cell
 * (reject reason, step-therapy text, payer/PBM) plus placeholders the patient/prescriber fill
 * in (member ID, denial letter reference, clinical history) — the app holds no patient data.
 *
 * Structure follows published patient-advocacy and state-insurance-commissioner templates:
 * Patient Advocate Foundation's "Sample Appeal Letter for Pre-Authorization Denial"
 * (patientadvocate.org/migrainematters) and the appeal-letter structure summarized by the
 * Washington state Office of the Insurance Commissioner (insurance.wa.gov). Both keep the
 * patient's own appeal letter separate from — but referencing — the prescriber's attached
 * Letter of Medical Necessity, rather than merging both voices into one document.
 */
export function buildAppealLetter(
  record: FormularyRecord,
  item: PaItem,
  payer: PayerMeta,
  drugClass: ClassMeta,
): string {
  const barrierLabel = BARRIER_LABEL[item.outcome]
  const lines = [
    '[Date]',
    '',
    payer.name,
    'Appeals and Grievances Department',
    '',
    'RE:',
    '[Patient Name]',
    '[Member ID]',
    '[Reference # on Denial Letter]',
    '[Patient Date of Birth]',
    '',
    `To Whom It May Concern at ${payer.name}:`,
    '',
    `My name is [Patient Name] and I am a member of ${payer.name}${payer.pbm ? ` (pharmacy benefits administered by ${payer.pbm})` : ''}. ` +
      `I am writing to appeal the ${barrierLabel} denial of coverage for ${item.drug}, prescribed for ${drugClass.plainName.toLowerCase()}. ` +
      `I received a denial letter dated [date] stating: "${item.reason}."`,
    '',
  ]
  // record.stepTherapy is a class-wide note (it can describe more than one drug's requirement --
  // e.g. one blurb covering both Tudorza's and Yupelri's distinct step rules), so it's only safe
  // to surface for a "step" outcome, and framed as class-wide rather than asserted as this drug's.
  if (item.outcome === 'step' && record.stepTherapy) {
    lines.push(`Step therapy on file with the plan for this drug class: ${record.stepTherapy}`, '')
  }
  lines.push(
    'I am currently under the care of [Prescriber Name] at [Practice/Facility Name]. ' +
      'My prescriber has attached a Letter of Medical Necessity explaining why this medication ' +
      'is clinically appropriate for me — including any prior treatments tried, why they were not ' +
      'suitable, and any diagnosis or clinical history supporting this request. Please refer to ' +
      'that letter for the full clinical rationale.',
    '',
    `Please reconsider this decision and approve coverage for ${item.drug} without further delay. ` +
      'Please contact me at [Patient Phone] or my prescriber at [Prescriber Phone] if you need any ' +
      'additional information to complete this review. Thank you for your time and attention to this matter.',
    '',
    'Respectfully,',
    '[Patient Name]',
    '[Patient Address]',
    '',
    'Enclosures:',
    '1. Denial letter from plan',
    "2. Prescriber's Letter of Medical Necessity",
    '3. Relevant medical records',
  )
  if (payer.paPolicyUrl) {
    lines.push(`4. Plan PA policy: ${payer.paPolicyUrl}`)
  }
  lines.push('', 'CC: [Prescriber Name]')
  return lines.join('\n')
}
