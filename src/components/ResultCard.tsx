import type { FormularyRecord, PayerMeta, Verification } from '../types/formulary'
import { useGuide } from '../lib/formulary'
import { BoglBanner } from './BoglBanner'
import { PrescribeOptions } from './PrescribeOptions'
import { RejectList } from './RejectList'
import { Citations } from './Citations'
import { GlossaryTerm } from './GlossaryTerm'

/** Confidence word for the provenance line; the full note lives in the appendix citations. */
const VERIFY_WORD: Record<Verification, string> = {
  verified: 'Verified',
  partial: 'Partial — confirm in source',
  example: 'Example — unconfirmed',
}

interface Props {
  record: FormularyRecord
  payer: PayerMeta
  panelId: string
  labelId: string
}

function readableGenericName(name: string): string {
  return name.replace(/\s+HFA\b/g, ' inhaler')
}

export function ResultCard({ record, payer, panelId, labelId }: Props) {
  const { resolveSources, capturedAt, unitNoun } = useGuide()
  const agent = record.preferredAgent
  const sources = resolveSources(record.sourceIds)
  const coverageSources = resolveSources(record.coverageSourceIds)
  const primarySource = coverageSources[0]
  const displayName = agent.brand ?? agent.inn

  // Clean lowercase generic name without salt/device suffixes, for the BOGL "write brand, not
  // generic X" copy (e.g. "Albuterol sulfate HFA" -> "albuterol").
  const genericBase = agent.inn
    .replace(/\s+(sulfate|propionate|furoate|inhalation|HFA)\b/gi, '')
    .toLowerCase()

  return (
    <section
      id={panelId}
      className="result"
      role="tabpanel"
      aria-labelledby={labelId}
      aria-live="polite"
      tabIndex={-1}
    >
      <div className="doc">
        {/* The answer — minimal. */}
        <div className="highlights">
          <span className="recommendation-label">
            <span className="dot" aria-hidden="true" />
            Formulary first-pass for {payer.productName}
          </span>
          <h2 className="agent">{displayName}</h2>
          {agent.brand ? (
            <p className="agent__generic">Also called: {readableGenericName(agent.inn)}</p>
          ) : null}
          {/* Verification describes coverage evidence only; it is not clinical guidance. */}
          <p className={`result__provenance is-${record.verification}`}>
            <span aria-hidden="true">{record.verification === 'verified' ? '✓' : '⚠'}</span>{' '}
            <span className="sr-only">Source confidence: </span>
            {VERIFY_WORD[record.verification]}
            {primarySource ? (
              <>
                {' · per '}
                <a href={primarySource.url} target="_blank" rel="noopener noreferrer">
                  {primarySource.label}
                </a>
                {primarySource.effectiveDate ? ` (rev. ${primarySource.effectiveDate})` : ''}
              </>
            ) : null}
          </p>
        </div>

        {/* Q1 + Q2: what to prescribe + alternatives, with cost in plan vs cash. */}
        <PrescribeOptions record={record} payer={payer} source={primarySource} />

        {/* What to avoid. */}
        <div className="coverage-panel coverage-panel--reject">
          <RejectList items={record.paRequired} />
        </div>

        {/* Load-bearing prescriber warning — stays visible when the plan forces the brand. */}
        {record.boglActive && record.boglNote ? (
          <BoglBanner
            brand={agent.brand ?? displayName}
            payerName={payer.shortName}
            genericBase={genericBase}
            unitNoun={unitNoun}
          />
        ) : null}

        {/* Policy detail and provenance. Clinical selection and dosing stay outside this tool. */}
        <details className="appendix">
          <summary>Coverage detail &amp; full sources</summary>
          <div className="appendix__body">
            <div className="patient-summary" aria-label="What to do next">
              <p className="eyebrow">What to do next</p>
              <ol>
                <li>
                  <b>Patient:</b> ask the pharmacy to confirm this exact benefit product before the
                  prescription is sent.
                </li>
                {record.boglActive ? (
                  <li>
                    <b>Doctor:</b> write <strong>{displayName}</strong> on the prescription, not
                    generic {genericBase} (the generic may need approval).
                  </li>
                ) : (
                  <li>
                    <b>Doctor:</b> this plan is likely to cover <strong>{displayName}</strong> without
                    prior authorization
                    {agent.genericAvailable ? '; a generic is fine.' : '.'}
                  </li>
                )}
              </ol>
            </div>

            <div className="appendix__block">
              <p className="eyebrow">
                <GlossaryTerm match="Step therapy">Step therapy</GlossaryTerm>
              </p>
              {record.stepTherapy ? (
                <p className="step__body">{record.stepTherapy}</p>
              ) : (
                <p className="step__body step__body--none">None required for the preferred agent.</p>
              )}
            </div>

            <div className="appendix__block">
              <Citations
                sources={sources}
                capturedAt={capturedAt}
                verificationNote={record.verificationNote}
              />
            </div>
          </div>
        </details>
      </div>
    </section>
  )
}
