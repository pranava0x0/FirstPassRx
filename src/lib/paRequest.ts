import type { ClassMeta, FormularyRecord, PaItem, PayerMeta } from '../types/formulary'

/**
 * Prescriber-side prior authorization REQUEST (before any denial), as opposed to
 * appealLetter.ts, which is the patient's appeal after one.
 *
 * Ordered the way a PBM/plan reviewer scores a request: what exactly is being asked for, the
 * diagnosis, the plan's own preferred agents answered one by one, then the clinical rationale.
 * A story-first letter makes the reviewer hunt; missing documentation of tried alternatives and
 * missing diagnosis codes are the commonest reasons a request is pended or denied (see
 * docs/pa-drafting/notes and backlog.md, 2026-10-21 PA research).
 *
 * Nothing here is stored or sent anywhere: the builder holds input in component state only.
 */

export type StepOutcome =
  | ''
  | 'inadequate'
  | 'adverse'
  | 'contraindicated'
  | 'not-appropriate'
  | 'not-tried'

export const STEP_OUTCOME_LABEL: Record<Exclude<StepOutcome, ''>, string> = {
  inadequate: 'Tried: inadequate response',
  adverse: 'Tried: adverse effect / intolerance',
  contraindicated: 'Contraindicated',
  'not-appropriate': 'Not clinically appropriate',
  'not-tried': 'Not tried yet',
}

export interface StepEntry {
  drug: string
  outcome: StepOutcome
  /** Free text: dates/duration and what happened, e.g. "Jan–Apr 2026, 1000 mg BID; GI intolerance". */
  detail: string
}

export type CriterionStatus = '' | 'met' | 'not-met'

export interface CriterionEntry {
  /** The plan's criterion, verbatim from the data. */
  text: string
  status: CriterionStatus
  /** Where the chart shows it: dates, values, note references. */
  evidence: string
}

export interface PaRequestInput {
  /** The plan's own approval criteria for this drug, when the policy has been read. */
  criteria: CriterionEntry[]
  diagnosis: string
  /** Strength, form, directions. */
  regimen: string
  quantity: string
  daysSupply: string
  expedited: boolean
  steps: StepEntry[]
  rationale: string
}

const SAYS_PREFERRED = /\bpreferred\b/i
const SAYS_NOT_PREFERRED = /\bnon-?\s?preferred\b|\bnot preferred\b/i

/**
 * The plan's own preferred agents for this cell, in the order the reviewer will check them:
 * the first-pass pick, then only those alternatives whose coverage note itself says
 * "preferred". `alternatives` also holds higher-tier and non-preferred covered drugs, and
 * presenting those as plan-preferred steps would misstate the plan.
 */
export function preferredAlternatives(record: FormularyRecord, item: PaItem): string[] {
  const names = [
    record.preferredAgent.brand ?? record.preferredAgent.inn,
    ...(record.alternatives ?? [])
      .filter((a) => SAYS_PREFERRED.test(a.note ?? '') && !SAYS_NOT_PREFERRED.test(a.note ?? ''))
      .map((a) => a.drug),
  ]
  const blocked = item.drug.toLowerCase()
  return names.filter(
    (name, i) =>
      name.toLowerCase() !== blocked &&
      names.findIndex((n) => n.toLowerCase() === name.toLowerCase()) === i,
  )
}

export function emptyPaRequest(record: FormularyRecord, item: PaItem): PaRequestInput {
  return {
    criteria: (item.criteria ?? []).map((text) => ({ text, status: '' as CriterionStatus, evidence: '' })),
    diagnosis: '',
    regimen: '',
    quantity: '',
    daysSupply: '',
    expedited: false,
    // The reviewer checks the first few preferred agents; more rows than that is noise.
    steps: preferredAlternatives(record, item)
      .slice(0, 4)
      .map((drug) => ({ drug, outcome: '' as StepOutcome, detail: '' })),
    rationale: '',
  }
}

export interface ChecklistItem {
  id: string
  label: string
  done: boolean
}

const ICD10 = /\b[A-TV-Z]\d{2}(?:\.[0-9A-Z]{1,4})?\b/i

/** What a reviewer needs on first pass; each item is something we can see in the input. */
/** Met-with-evidence count needed: one criterion for "any", every one for "all". */
function criteriaDone(input: PaRequestInput, mode: 'any' | 'all'): boolean {
  const met = input.criteria.filter((c) => c.status === 'met' && c.evidence.trim() !== '')
  return mode === 'all' ? met.length === input.criteria.length : met.length >= 1
}

export function paChecklist(input: PaRequestInput, criteriaMode: 'any' | 'all' = 'any'): ChecklistItem[] {
  const stepsAnswered =
    input.steps.length > 0 &&
    input.steps.every((s) => s.outcome !== '' && (s.outcome === 'not-tried' || s.detail.trim() !== ''))
  const planCriteria: ChecklistItem[] =
    input.criteria.length > 0
      ? [
          {
            id: 'criteria',
            label:
              criteriaMode === 'all'
                ? "Every one of this plan's criteria shown as met, with chart evidence"
                : "At least one of this plan's approval paths shown as met, with chart evidence",
            done: criteriaDone(input, criteriaMode),
          },
        ]
      : []
  return [
    ...planCriteria,
    {
      id: 'diagnosis',
      label: 'Diagnosis with an ICD-10 code',
      done: ICD10.test(input.diagnosis),
    },
    {
      id: 'request',
      label: 'Exact request: strength, directions, quantity, days supply',
      done:
        input.regimen.trim() !== '' && input.quantity.trim() !== '' && input.daysSupply.trim() !== '',
    },
    {
      id: 'steps',
      label:
        input.steps.length > 0
          ? "Each of the plan's preferred drugs answered, with dates and outcome"
          : 'Prior treatments listed with dates and outcome',
      done: input.steps.length > 0 ? stepsAnswered : input.rationale.trim() !== '',
    },
    {
      id: 'rationale',
      label: 'Why this drug for this patient (severity, history, guideline)',
      done: input.rationale.trim().length >= 40,
    },
  ]
}

/**
 * How long the plan has to answer, by benefit type. Only cites rules that apply to PHARMACY
 * prior authorization — CMS-0057-F's 72h/7-day timeframes exclude drugs, so they are not used.
 */
export function responseClock(payer: PayerMeta, stateCode: string): string {
  switch (payer.marketSegment) {
    case 'medicaid-ffs':
    case 'medicaid-mco':
      return 'Medicaid must answer a drug PA within 24 hours, and the pharmacy can dispense at least a 72-hour emergency supply while it is pending (42 U.S.C. §1396r-8(d)(5)).'
    case 'medicare-part-d':
      return 'Part D plans must decide within 72 hours (standard) or 24 hours (expedited), counted from receipt of the prescriber’s supporting statement for exception requests (42 CFR 423.568, 423.572).'
    default:
      return stateCode === 'MA'
        ? 'Massachusetts: a fully insured plan that does not answer the standard PA form within 2 business days is deemed to approve it (M.G.L. c. 176O §25). Self-funded employer plans are not covered by state law.'
        : 'Commercial deadlines depend on state law and whether the plan is fully insured or self-funded. Check the plan’s PA page; ask for expedited review only when delay risks the patient’s health.'
  }
}

const BARRIER: Record<PaItem['outcome'], string> = {
  pa: 'prior authorization',
  step: 'a step-therapy exception',
  nonformulary: 'a formulary exception',
}

/** One line naming every intake channel the plan publishes, e.g. "fax 877-208-7428 · phone …". */
export function submissionLine(payer: PayerMeta): string {
  const sub = payer.paSubmission
  if (!sub) return ''
  return [
    sub.fax ? `fax ${sub.fax}` : '',
    sub.portal ? `portal ${sub.portal}` : '',
    sub.epa ? `ePA ${sub.epa}` : '',
    sub.phone ? `phone ${sub.phone}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

const fill = (value: string, placeholder: string) => (value.trim() !== '' ? value.trim() : placeholder)

/** Letter of medical necessity in reviewer order. Blank inputs stay as [bracketed] placeholders. */
export function buildPaRequest(
  record: FormularyRecord,
  item: PaItem,
  payer: PayerMeta,
  drugClass: ClassMeta,
  input: PaRequestInput,
  /** Source URLs for the routing and criteria lines, so the copied letter keeps provenance. */
  sourceUrls: { submission?: string[]; criteria?: string[] } = {},
): string {
  const lines: string[] = [
    input.expedited ? 'EXPEDITED REVIEW REQUESTED' : 'Standard review',
    `To: ${payer.name}${payer.pbm ? ` (pharmacy benefit: ${payer.pbm})` : ''} — Pharmacy Prior Authorization`,
    `Plan: ${payer.productName} (${payer.formularyId})`,
    ...(payer.paSubmission
      ? [`Send to: ${submissionLine(payer)}${sourceUrls.submission?.length ? ` (source: ${sourceUrls.submission.join(', ')})` : ''}`]
      : []),
    'Date: [Date]',
    '',
    'Patient: [Patient name] · DOB: [DOB] · Member ID: [Member ID]',
    'Prescriber: [Name, credentials] · NPI: [NPI] · Phone: [Phone] · Fax: [Fax]',
    '',
    `REQUEST: ${BARRIER[item.outcome]} for ${item.drug}`,
    `Regimen: ${fill(input.regimen, '[strength, form, directions]')}`,
    `Quantity: ${fill(input.quantity, '[quantity]')} · Days supply: ${fill(input.daysSupply, '[days]')}`,
    `Plan status for this drug: ${item.reason}`,
    '',
    `DIAGNOSIS: ${fill(input.diagnosis, '[ICD-10 code and description]')}`,
    `Drug class: ${drugClass.name}`,
    '',
  ]

  if (input.criteria.length > 0) {
    lines.push(
      item.criteriaMode === 'all'
        ? "PLAN'S APPROVAL CRITERIA (all required) — addressed:"
        : "PLAN'S APPROVAL CRITERIA (any one qualifies) — addressed:",
    )
    input.criteria.forEach((c, i) => {
      const status = c.status === 'met' ? 'MET' : c.status === 'not-met' ? 'Not met' : '[met / not met]'
      const evidence = c.status === 'met' ? ` — ${fill(c.evidence, '[chart evidence: dates, values]')}` : ''
      lines.push(`${i + 1}. ${c.text}: ${status}${evidence}`)
    })
    if (sourceUrls.criteria?.length) lines.push(`Criteria source: ${sourceUrls.criteria.join(', ')}`)
    lines.push('')
  }

  if (input.steps.length > 0) {
    lines.push("PLAN'S PREFERRED ALTERNATIVES — each addressed:")
    input.steps.forEach((s, i) => {
      const outcome = s.outcome === '' ? '[tried? outcome]' : STEP_OUTCOME_LABEL[s.outcome]
      const detail = s.outcome === 'not-tried' ? '' : ` — ${fill(s.detail, '[dates, dose, what happened]')}`
      lines.push(`${i + 1}. ${s.drug}: ${outcome}${detail}`)
    })
    lines.push('')
  }
  if (item.outcome === 'step' && record.stepTherapy) {
    lines.push(`Plan step-therapy note for this class: ${record.stepTherapy}`, '')
  }

  lines.push(
    'CLINICAL RATIONALE:',
    fill(input.rationale, '[Why this drug for this patient: severity, relevant history, labs, guideline or label support.]'),
    '',
  )
  if (input.expedited) {
    lines.push(
      'Expedited review is requested because applying the standard timeframe could seriously jeopardize the patient’s life, health, or ability to regain maximum function.',
      '',
    )
  }
  lines.push(
    'Enclosures: [chart notes showing the trials above] · [relevant labs]',
    '',
    'I attest that the information above is accurate and supported by the medical record.',
    '[Prescriber signature] · [Date]',
  )
  if (payer.paPolicyUrl) lines.push('', `Plan PA criteria: ${payer.paPolicyUrl}`)
  return lines.join('\n')
}
