import type { ClassMeta, FormularyRecord, PayerMeta, Verification } from '../types/formulary'
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

const VERIFY_LABEL: Record<Verification, string> = {
  verified: 'Verified',
  partial: 'Partial',
  example: 'Example',
}

export function ResultCard({ record, payer, drugClass, panelId, labelId }: Props) {
  const agent = record.preferredAgent
  const sources = resolveSources(record.sourceIds)

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
          <span className="eyebrow highlights__eyebrow">
            <span className="dot" aria-hidden="true" />
            First choice · {payer.shortName}
          </span>
          <h2 className="agent">
            {agent.inn}
            {agent.brand ? <span className="agent__brand"> ({agent.brand})</span> : null}
          </h2>
          <p className="agent__dose">
            {agent.strength}
            <span className="sep" aria-hidden="true">
              ·
            </span>
            {agent.sigShort}
            <span className="sep" aria-hidden="true">
              ·
            </span>
            {agent.genericAvailable ? 'generic OK' : 'brand-only'}
          </p>
          <p className="agent__why">
            Start here for this {drugClass.plainName.toLowerCase()}. It is the option most likely to
            go through without prior authorization.
          </p>
          <p className="agent__plain">{drugClass.plainDescription}</p>
        </div>

        <div className="quick-read" aria-label="Quick answer">
          <div className="quick-read__item">
            <span>Ask about</span>
            <strong>{agent.brand ?? agent.inn}</strong>
          </div>
          <div className="quick-read__item">
            <span>Why</span>
            <strong>No PA expected</strong>
          </div>
          <div className="quick-read__item">
            <span>Check</span>
            <strong>{record.boglActive ? 'Brand required' : VERIFY_LABEL[record.verification]}</strong>
          </div>
        </div>

        <div className="stamps">
          <span className="stamp stamp--go">● GO · preferred</span>
          {record.boglActive ? <span className="stamp stamp--warn">⚠ BOGL · brand req</span> : null}
          <span
            className={`stamp stamp--verify is-${record.verification}`}
            title={record.verificationNote}
          >
            {VERIFY_LABEL[record.verification]} data
          </span>
        </div>

        {record.boglActive && record.boglNote ? (
          <div>
            <BoglBanner note={record.boglNote} />
          </div>
        ) : null}

        <div>
          <RxSig record={record} />
        </div>

        <div className="detail-stack">
          <details className="detail-block">
            <summary>
              Other covered choices
              <span className="detail-count">{record.alternatives?.length ?? 0}</span>
            </summary>
            <div className="detail-block__body">
              <Alternatives items={record.alternatives ?? []} payer={payer} />
            </div>
          </details>

          <details className="detail-block">
            <summary>
              Drugs that may reject
              <span className="detail-count">{record.paRequired.length}</span>
            </summary>
            <div className="detail-block__body">
              <RejectList items={record.paRequired} />
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
