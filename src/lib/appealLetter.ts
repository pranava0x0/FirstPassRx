import type { ClassMeta, FormularyRecord, PaItem, PayerMeta } from '../types/formulary'

const BARRIER_LABEL: Record<PaItem['outcome'], string> = {
  pa: 'prior authorization',
  step: 'step therapy',
  nonformulary: 'non-formulary status',
}

/**
 * A pre-filled PA appeal letter for one blocked drug, built from data already on the cell
 * (reject reason, step-therapy text, the plan's own preferred alternatives, payer/PBM) plus
 * placeholders the patient/prescriber fill in (member ID, denial reference, codes, clinical
 * history) — the app holds no patient data.
 *
 * Structure follows published patient-advocacy and regulator templates and checklists:
 * Patient Advocate Foundation's "Sample Appeal Letter for Pre-Authorization Denial"
 * (patientadvocate.org), the Washington OIC appeals guide (insurance.wa.gov), and the
 * ACA internal-appeal / external-review framework (healthcare.gov). Beyond the original
 * template this adds: expedited-appeal language, the tried-and-failed alternatives list
 * (pre-filled with this plan's own preferred agents), denial-code and ICD-10 placeholders,
 * a pointer at the plan's own coverage criteria, decision-timeframe language, and the
 * external-review reservation. The patient's letter stays separate from — but references —
 * the prescriber's attached Letter of Medical Necessity.
 *
 * Deadlines vary by plan type (ACA commercial vs. Medicaid vs. Medicare Part D), so the
 * letter carries placeholders and points at the denial letter rather than baking one number.
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
    '[Appeals address — from your denial letter or member handbook]',
    '',
    `RE: Internal appeal — coverage denial of ${item.drug}`,
    '[Patient Name]',
    '[Member ID]',
    '[Reference # on Denial Letter]',
    '[Patient Date of Birth]',
    'Denial code(s): [code(s) listed on the denial letter, if any]',
    'Diagnosis: [ICD-10 code and name, e.g. J45.40 — moderate persistent asthma]',
    '',
    `To Whom It May Concern at ${payer.name}:`,
    '',
    `My name is [Patient Name] and I am a member of ${payer.name}${payer.pbm ? ` (pharmacy benefits administered by ${payer.pbm})` : ''}. ` +
      `I am writing to appeal the ${barrierLabel} denial of coverage for ${item.drug}, prescribed for ${drugClass.plainName.toLowerCase()}. ` +
      `I received a denial letter dated [date] stating: "${item.reason}." Please treat this letter as a formal internal appeal of that decision.`,
    '',
    '[Keep this paragraph only if a delay would put your health at risk — otherwise delete it:]',
    'I request an EXPEDITED appeal. My prescriber has determined that waiting for the standard ' +
      'review timeframe could seriously jeopardize my health, and a supporting statement is enclosed. ' +
      'Expedited appeals are typically decided within 72 hours.',
    '',
  ]
  // record.stepTherapy is a class-wide note (it can describe more than one drug's requirement --
  // e.g. one blurb covering both Tudorza's and Yupelri's distinct step rules), so it's only safe
  // to surface for a "step" outcome, and framed as class-wide rather than asserted as this drug's.
  if (item.outcome === 'step' && record.stepTherapy) {
    lines.push(`Step therapy on file with the plan for this drug class: ${record.stepTherapy}`, '')
  }
  // The tried-and-failed list is the strongest medical-necessity argument. Pre-fill it with the
  // plan's own preferred alternatives for this class so the reviewer sees their formulary's
  // agents addressed one by one; the patient/prescriber fills in dates and outcomes.
  const altNames = (record.alternatives ?? []).map((a) => a.drug)
  lines.push(
    "The plan's preferred alternatives for this drug class, and why each was not effective or " +
      'not clinically appropriate for me (dates and outcomes below; clinical detail is in the ' +
      "enclosed Letter of Medical Necessity):",
    ...(altNames.length > 0
      ? altNames.map(
          (name, i) =>
            `${i + 1}. ${name} — [dates tried and outcome, or reason it is not clinically appropriate]`,
        )
      : ['1. [Formulary alternative — dates tried and outcome, or reason it is not clinically appropriate]']),
    '',
    'I am currently under the care of [Prescriber Name] at [Practice/Facility Name]. ' +
      'My prescriber has attached a Letter of Medical Necessity explaining why this medication ' +
      'is clinically appropriate for me — including any prior treatments tried, why they were not ' +
      'suitable, and any diagnosis or clinical history supporting this request. Please refer to ' +
      'that letter for the full clinical rationale.',
    '',
    "Please review this appeal against the plan's own written coverage criteria for this " +
      `medication: [medical policy / criteria name and number, if listed on the denial letter]` +
      `${payer.paPolicyUrl ? ` (plan PA policy: ${payer.paPolicyUrl})` : ''}. ` +
      'If the denial relied on any criterion outside that policy, please identify it in your response.',
    '',
    'Please issue a written decision within the timeframe my plan is required to meet for ' +
      'pre-service appeals [see your denial letter for the deadline that applies to this plan; ' +
      '72 hours if expedited]. If this internal appeal is denied, I intend to exercise my right ' +
      'to an independent external review, and I request that your decision letter include ' +
      'instructions and deadlines for requesting it.',
    '',
    `Please contact me at [Patient Phone] or my prescriber at [Prescriber Phone] if you need any ` +
      'additional information to complete this review. Thank you for your time and attention to this matter.',
    '',
    'Respectfully,',
    '[Patient Name]',
    '[Patient Address]',
    '',
    'Enclosures:',
    '1. Denial letter from plan',
    "2. Prescriber's Letter of Medical Necessity",
    '3. Relevant medical records (including records of the alternatives tried)',
  )
  if (payer.paPolicyUrl) {
    lines.push(`4. Plan PA policy: ${payer.paPolicyUrl}`)
  }
  lines.push('', 'CC: [Prescriber Name]')
  return lines.join('\n')
}
