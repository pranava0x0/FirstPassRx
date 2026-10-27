import { useMemo, useState, useId } from 'react'
import type { ClassMeta, FormularyRecord, PaItem, PayerMeta } from '../types/formulary'
import { useGuide } from '../lib/formulary'
import {
  buildPaRequest,
  emptyPaRequest,
  paChecklist,
  responseClock,
  submissionLine,
  type CriterionStatus,
  type PaRequestInput,
  type StepOutcome,
} from '../lib/paRequest'
import { ICD10_RELEASE, icd10For } from '../lib/icd10'
import { downloadLetterPdf } from '../lib/letterPdf'
import { useCopyToClipboard } from '../lib/clipboard'

/** One tap each; a native select needs two on a phone. The letter keeps the long wording. */
const CRITERION_CHOICES: [Exclude<CriterionStatus, ''>, string][] = [
  ['met', 'Met'],
  ['not-met', 'Not met'],
]
const STEP_CHIP_LABEL: Record<Exclude<StepOutcome, ''>, string> = {
  inadequate: 'Inadequate response',
  adverse: 'Side effects',
  contraindicated: 'Contraindicated',
  'not-appropriate': 'Not appropriate',
  'not-tried': 'Not tried',
}

/**
 * Prescriber-side PA request builder: a short structured form whose answers fill a letter of
 * medical necessity in the order a reviewer scores it. Nothing is stored or sent.
 */
export function PaRequest({
  record,
  item,
  payer,
  drugClass,
}: {
  record: FormularyRecord
  item: PaItem
  payer: PayerMeta
  drugClass: ClassMeta
}) {
  const { stateCode, resolveSources } = useGuide()
  const submissionSources = resolveSources(payer.paSubmission?.sourceIds ?? [])
  const criteriaSources = resolveSources(item.criteriaSourceIds ?? [])
  const [input, setInput] = useState<PaRequestInput>(() => emptyPaRequest(record, item))
  const [pdfError, setPdfError] = useState(false)
  const { copied, copy } = useCopyToClipboard()
  const checklist = paChecklist(input, item.criteriaMode ?? 'any')
  const icdOptions = icd10For(record.classId, item.drug)
  // Unique per PA item: suggestions differ by drug, and several PaRequests render per record.
  const listId = `icd10-${useId()}`.replace(/\W+/g, '-')
  const doneCount = checklist.filter((c) => c.done).length
  const letter = useMemo(
    () =>
      buildPaRequest(record, item, payer, drugClass, input, {
        submission: submissionSources.map((x) => x.url),
        criteria: criteriaSources.map((x) => x.url),
      }),
    [record, item, payer, drugClass, input, submissionSources, criteriaSources],
  )
  const set = (patch: Partial<PaRequestInput>) => setInput((cur) => ({ ...cur, ...patch }))
  const setCriterion = (i: number, patch: { status?: CriterionStatus; evidence?: string }) =>
    setInput((cur) => ({
      ...cur,
      criteria: cur.criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    }))
  const setStep = (i: number, patch: { outcome?: StepOutcome; detail?: string }) =>
    setInput((cur) => ({
      ...cur,
      steps: cur.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    }))

  return (
    <div className="pa-builder">
      <header className="pa-builder__head">
        <p className="pa-builder__eyebrow">Prior authorization request</p>
        <p className="pa-builder__title">
          {item.drug} <span className="pa-builder__for">for {payer.shortName}</span>
        </p>
      </header>
      {payer.paSubmission ? (
        <div className="pa-builder__send">
          <p className="pa-builder__send-label">Send to</p>
          <p className="pa-builder__send-line">
            {submissionLine(payer)
              .split(' · ')
              .map((part, i) => (
                <span key={part}>
                  {i > 0 ? ' · ' : null}
                  <span className="pa-builder__channel">{part}</span>
                </span>
              ))}
          </p>
          {payer.paSubmission.note ? <p className="pa-builder__send-note">{payer.paSubmission.note}</p> : null}
          <SourceLine sources={submissionSources} />
        </div>
      ) : null}
      <p className="pa-builder__clock">{responseClock(payer, stateCode)}</p>

      <div className="pa-builder__check" aria-live="polite">
        <p className="pa-builder__score">
          <b>
            {doneCount} of {checklist.length}
          </b>{' '}
          things a reviewer checks first
        </p>
        <div className="pa-meter" aria-hidden="true">
          {checklist.map((c) => (
            <span key={c.id} className={c.done ? 'is-done' : undefined} />
          ))}
        </div>
        <ul>
          {checklist.map((c) => (
            <li key={c.id} className={c.done ? 'is-done' : undefined}>
              <span aria-hidden="true">{c.done ? '✓' : '○'}</span> {c.label}
              <span className="sr-only">{c.done ? ' (done)' : ' (missing)'}</span>
            </li>
          ))}
        </ul>
      </div>

      {input.criteria.length > 0 ? (
        <fieldset className="pa-steps pa-criteria">
          <legend className="pa-section">
            {item.criteriaMode === 'all'
              ? 'This plan approves when ALL of these are met'
              : 'This plan approves when ANY ONE of these is met'}
          </legend>
          <SourceLine sources={criteriaSources} />
          {input.criteria.map((c, i) => (
            <div key={c.text} className="pa-step">
              <p className="pa-step__drug pa-criteria__text">{c.text}</p>
              <div className="pa-chips" role="radiogroup" aria-label={`Criterion ${i + 1}: met or not`}>
                {CRITERION_CHOICES.map(([value, label]) => (
                  <label key={value} className={`pa-chip${c.status === value ? ' is-on' : ''}`}>
                    <input
                      type="radio"
                      name={`${listId}-criterion-${i}`}
                      value={value}
                      checked={c.status === value}
                      onChange={() => setCriterion(i, { status: value })}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {c.status === 'met' ? (
                <input
                  aria-label={`Chart evidence for criterion ${i + 1}`}
                  value={c.evidence}
                  onChange={(e) => setCriterion(i, { evidence: e.target.value })}
                  placeholder="Where the chart shows it: dates, values"
                  autoComplete="off"
                />
              ) : null}
            </div>
          ))}
        </fieldset>
      ) : null}

      <p className="pa-section">Diagnosis and prescription</p>
      <div className="pa-builder__grid">
        <label className="pa-field pa-field--wide">
          <span>Diagnosis (ICD-10)</span>
          <input
            value={input.diagnosis}
            onChange={(e) => set({ diagnosis: e.target.value })}
            placeholder={icdOptions[0] ? `e.g. ${icdOptions[0].code} ${icdOptions[0].label}` : 'ICD-10 code and description'}
            autoComplete="off"
            list={icdOptions.length ? listId : undefined}
          />
          {icdOptions.length ? (
            <datalist id={listId}>
              {icdOptions.map((o) => (
                <option key={o.code} value={`${o.code} ${o.label}`} />
              ))}
            </datalist>
          ) : null}
        </label>
        {icdOptions.length ? (
          <p className="pa-field__hint pa-field--wide">
            Suggestions: {ICD10_RELEASE.version} ·{' '}
            <a href={ICD10_RELEASE.source} target="_blank" rel="noopener noreferrer">
              CMS code file &#8599;
            </a>
          </p>
        ) : null}
        <label className="pa-field pa-field--wide">
          <span>Strength, form, directions</span>
          <input
            value={input.regimen}
            onChange={(e) => set({ regimen: e.target.value })}
            placeholder={`${item.drug}, dose, how often`}
            autoComplete="off"
          />
        </label>
        <label className="pa-field">
          <span>Quantity</span>
          <input value={input.quantity} onChange={(e) => set({ quantity: e.target.value })} inputMode="text" autoComplete="off" />
        </label>
        <label className="pa-field">
          <span>Days supply</span>
          <input value={input.daysSupply} onChange={(e) => set({ daysSupply: e.target.value })} inputMode="numeric" autoComplete="off" />
        </label>
      </div>

      {input.steps.length > 0 ? (
        <fieldset className="pa-steps">
          <legend className="pa-section">The plan prefers these. Answer each one.</legend>
          {input.steps.map((s, i) => (
            <div key={s.drug} className="pa-step">
              <p className="pa-step__drug">{s.drug}</p>
              <div className="pa-chips pa-chips--wrap" role="radiogroup" aria-label={`Outcome for ${s.drug}`}>
                {(Object.keys(STEP_CHIP_LABEL) as Exclude<StepOutcome, ''>[]).map((value) => (
                  <label key={value} className={`pa-chip${s.outcome === value ? ' is-on' : ''}`}>
                    <input
                      type="radio"
                      name={`${listId}-step-${i}`}
                      value={value}
                      checked={s.outcome === value}
                      onChange={() => setStep(i, { outcome: value })}
                    />
                    {STEP_CHIP_LABEL[value]}
                  </label>
                ))}
              </div>
              {s.outcome !== '' && s.outcome !== 'not-tried' ? (
                <input
                  aria-label={`Dates and details for ${s.drug}`}
                  value={s.detail}
                  onChange={(e) => setStep(i, { detail: e.target.value })}
                  placeholder="Dates, dose, what happened"
                  autoComplete="off"
                />
              ) : null}
            </div>
          ))}
        </fieldset>
      ) : null}

      <label className="pa-field pa-field--wide">
        <span>Why this drug for this patient</span>
        <textarea
          rows={3}
          value={input.rationale}
          onChange={(e) => set({ rationale: e.target.value })}
          placeholder="Severity, relevant history or labs, guideline or label support"
        />
      </label>

      <label className="pa-toggle">
        <input type="checkbox" checked={input.expedited} onChange={(e) => set({ expedited: e.target.checked })} />
        <span>Expedited: waiting could seriously harm the patient’s health</span>
      </label>

      <details className="pa-builder__preview">
        <summary>Preview the letter</summary>
        <pre className="pa-builder__letter">{letter}</pre>
      </details>

      <div className="pa-builder__actions">
        <p className="pa-builder__actions-score" aria-hidden="true">
          {doneCount}/{checklist.length} ready
        </p>
        <button
          type="button"
          className={`copy-btn${copied ? ' copy-btn--done' : ''}`}
          onClick={() => copy(letter)}
          aria-label={`Copy PA request for ${item.drug}`}
        >
          <span aria-hidden="true">{copied ? '✓ Copied' : 'Copy request'}</span>
          <span className="sr-only" aria-live="polite">
            {copied ? 'Copied to clipboard' : ''}
          </span>
        </button>
        <button
          type="button"
          className="copy-btn"
          onClick={() => {
            setPdfError(false)
            downloadLetterPdf(letter, `PA request — ${item.drug}`).catch(() => setPdfError(true))
          }}
          aria-label={`Download PA request for ${item.drug} as PDF`}
        >
          PDF
        </button>
      </div>
      {pdfError ? (
        <p className="appeal-panel__error" role="alert">
          PDF download failed. Check your connection, or use Copy request instead.
        </p>
      ) : null}
      <p className="pa-builder__privacy">Nothing you type is saved or sent. It stays on this page.</p>
    </div>
  )
}

/** Compact "Source: <label> ↗" line so routing numbers and criteria trace to the plan's document. */
function SourceLine({ sources }: { sources: { id: string; url: string; label: string }[] }) {
  if (sources.length === 0) return null
  return (
    <p className="pa-builder__source">
      Source:{' '}
      {sources.map((src, i) => (
        <span key={src.id}>
          {i > 0 ? ' · ' : null}
          <a href={src.url} target="_blank" rel="noopener noreferrer">
            {src.label} &#8599;
          </a>
        </span>
      ))}
    </p>
  )
}
