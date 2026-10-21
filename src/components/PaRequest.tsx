import { useMemo, useState } from 'react'
import type { ClassMeta, FormularyRecord, PaItem, PayerMeta } from '../types/formulary'
import { useGuide } from '../lib/formulary'
import {
  STEP_OUTCOME_LABEL,
  buildPaRequest,
  emptyPaRequest,
  paChecklist,
  responseClock,
  type PaRequestInput,
  type StepOutcome,
} from '../lib/paRequest'
import { downloadLetterPdf } from '../lib/letterPdf'
import { useCopyToClipboard } from '../lib/clipboard'

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
  const { stateCode } = useGuide()
  const [input, setInput] = useState<PaRequestInput>(() => emptyPaRequest(record, item))
  const [pdfError, setPdfError] = useState(false)
  const { copied, copy } = useCopyToClipboard()
  const checklist = paChecklist(input)
  const doneCount = checklist.filter((c) => c.done).length
  const letter = useMemo(
    () => buildPaRequest(record, item, payer, drugClass, input),
    [record, item, payer, drugClass, input],
  )
  const set = (patch: Partial<PaRequestInput>) => setInput((cur) => ({ ...cur, ...patch }))
  const setStep = (i: number, patch: { outcome?: StepOutcome; detail?: string }) =>
    setInput((cur) => ({
      ...cur,
      steps: cur.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    }))

  return (
    <div className="pa-builder">
      <p className="pa-builder__clock">{responseClock(payer, stateCode)}</p>

      <div className="pa-builder__check" aria-live="polite">
        <p className="pa-builder__score">
          <b>
            {doneCount} of {checklist.length}
          </b>{' '}
          things a reviewer checks first
        </p>
        <ul>
          {checklist.map((c) => (
            <li key={c.id} className={c.done ? 'is-done' : undefined}>
              <span aria-hidden="true">{c.done ? '✓' : '○'}</span> {c.label}
              <span className="sr-only">{c.done ? ' (done)' : ' (missing)'}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="pa-builder__grid">
        <label className="pa-field pa-field--wide">
          <span>Diagnosis (ICD-10)</span>
          <input
            value={input.diagnosis}
            onChange={(e) => set({ diagnosis: e.target.value })}
            placeholder="e.g. E11.9 Type 2 diabetes"
            autoComplete="off"
          />
        </label>
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
          <legend>The plan prefers these. Answer each one.</legend>
          {input.steps.map((s, i) => (
            <div key={s.drug} className="pa-step">
              <p className="pa-step__drug">{s.drug}</p>
              <select
                aria-label={`Outcome for ${s.drug}`}
                value={s.outcome}
                onChange={(e) => setStep(i, { outcome: e.target.value as StepOutcome })}
              >
                <option value="">Choose…</option>
                {Object.entries(STEP_OUTCOME_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {s.outcome !== 'not-tried' ? (
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

      <div className="appeal-panel__actions">
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
          Download PDF
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
