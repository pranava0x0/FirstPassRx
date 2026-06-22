import type { ClassMeta, FormularyRecord, PayerMeta } from '../types/formulary'
import { meta, resolveSources } from '../lib/formulary'
import { RxSig } from './RxSig'
import { BoglBanner } from './BoglBanner'
import { Alternatives } from './Alternatives'
import { RejectList } from './RejectList'
import { Citations } from './Citations'
import { GlossaryTerm } from './GlossaryTerm'

interface Props {
  record: FormularyRecord
  payer: PayerMeta
  drugClass: ClassMeta
  panelId: string
  labelId: string
}

function readableGenericName(name: string): string {
  return name.replace(/\s+HFA\b/g, ' inhaler')
}

export function ResultCard({ record, payer, drugClass, panelId, labelId }: Props) {
  const agent = record.preferredAgent
  const sources = resolveSources(record.sourceIds)
  const displayName = agent.brand ?? agent.inn

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
        <div className="highlights">
          <span className="recommendation-label">
            <span className="dot" aria-hidden="true" />
            Recommended for {payer.shortName}
          </span>
          <h2 className="agent">{displayName}</h2>
          {agent.brand ? (
            <p className="agent__generic">Also called: {readableGenericName(agent.inn)}</p>
          ) : null}
          <p className="agent__directions">
            <b>Usual use:</b> {agent.plainSig}
          </p>
          <p className="agent__why">
            This is the first {drugClass.plainName.toLowerCase()} option to discuss for this plan
            because it is likely to be covered without an insurance delay.
          </p>
        </div>

        <div className="patient-summary" aria-label="What to do next">
          <h3>What to do next</h3>
          <ol>
            {record.boglActive ? (
              <>
                <li>
                  <b>Patient:</b> ask your doctor if <strong>{displayName}</strong> is the right
                  inhaler for you.
                </li>
                <li>
                  <b>Doctor:</b> write <strong>{displayName}</strong> on the prescription, not
                  generic albuterol.
                </li>
                <li>
                  <b>Pharmacy:</b> switching this to generic albuterol may trigger extra insurance
                  approval.
                </li>
              </>
            ) : (
              <>
                <li>
                  <b>Patient:</b> ask your doctor if <strong>{displayName}</strong> is the right
                  inhaler for you.
                </li>
                <li>
                  <b>Doctor:</b> this plan is likely to cover <strong>{displayName}</strong> without
                  prior authorization.
                </li>
                <li>
                  <b>Pharmacy:</b>{' '}
                  {agent.genericAvailable
                    ? 'a generic version is okay for this plan.'
                    : 'a generic version is not listed for this product.'}
                </li>
              </>
            )}
          </ol>
        </div>

        {record.boglActive && record.boglNote ? (
          <div>
            <BoglBanner brand={agent.brand ?? displayName} />
          </div>
        ) : null}

        <div className="coverage-panels" aria-label="Coverage details">
          <div className="coverage-panel coverage-panel--covered">
            <Alternatives items={record.alternatives ?? []} payer={payer} />
          </div>
          <div className="coverage-panel coverage-panel--reject">
            <RejectList items={record.paRequired} />
          </div>
        </div>

        <div className="detail-stack">
          <details className="detail-block">
            <summary>Prescription text for clinician</summary>
            <div className="detail-block__body">
              <RxSig record={record} />
            </div>
          </details>

          <details className="detail-block">
            <summary>Policy note</summary>
            <div className="detail-block__body">
              <p className="eyebrow">
                <GlossaryTerm match="Step therapy">Step therapy</GlossaryTerm>
              </p>
              {record.stepTherapy ? (
                <p className="step__body">{record.stepTherapy}</p>
              ) : (
                <p className="step__body step__body--none">None required for the preferred agent.</p>
              )}
            </div>
          </details>

          <details className="detail-block">
            <summary>Sources and verification</summary>
            <div className="detail-block__body">
              <Citations
                sources={sources}
                capturedAt={meta.capturedAt}
                verificationNote={record.verificationNote}
              />
            </div>
          </details>
        </div>
      </div>
    </section>
  )
}
