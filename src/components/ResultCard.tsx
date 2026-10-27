import { useState } from 'react'
import type { FormularyRecord, PayerMeta } from '../types/formulary'
import { useGuide } from '../lib/formulary'
import { goodRxUrl, costPlusUrl, goodRxPrice, costPlusPrice, pricesCapturedAt } from '../lib/cash'
import { BoglBanner } from './BoglBanner'
import { AppealAction, PrescribeOptions } from './PrescribeOptions'
import { preferredNeedsPa, preferredOutcome } from '../lib/paRequest'
import { Citations } from './Citations'
import { GlossaryTerm } from './GlossaryTerm'
import { CashPriceBoxes } from './CashPriceBoxes'


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
  const { resolveSources, capturedAt, unitNoun, getClass } = useGuide()
  const drugClass = getClass(record.classId)
  const agent = record.preferredAgent
  const sources = resolveSources(record.sourceIds)
  const coverageSources = resolveSources(record.coverageSourceIds)
  const primarySource = coverageSources[0]
  const displayName = agent.brand ?? agent.inn
  const costPlusHref = costPlusUrl(agent.inn)
  const goodRxPoint = goodRxPrice(agent.inn)
  const costPlusPoint = costPlusPrice(agent.inn)
  const pricesAsOf = pricesCapturedAt(agent.inn)
  const blocked = (record.paRequired ?? []).map((r) => r.drug)
  // "Request PA" in the header opens the first blocked drug's request in place. Scoped to this
  // record so switching plan or class never auto-opens a request on the next one.
  const [paOpen, setPaOpen] = useState<{ record: FormularyRecord; n: number } | null>(null)
  if (paOpen && paOpen.record !== record) setPaOpen(null)
  const paSignal = paOpen?.record === record ? paOpen.n : 0

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
          <h2 className="recommendation-label">
            {record.noCoveredAgent ? '4. Coverage' : '4. Preferred option'}
          </h2>
          {/* Verification describes coverage evidence only; it is not clinical guidance. */}
          <p className={`result__provenance is-${record.verification}`}>
            <span aria-hidden="true">{record.verification === 'verified' ? '✓' : '⚠'}</span>{' '}
            {record.verification === 'verified' && (
              <>
                Verified against the official{' '}
                {primarySource ? (
                  <a href={primarySource.url} target="_blank" rel="noopener noreferrer">
                    {primarySource.label}
                  </a>
                ) : (
                  'plan formulary'
                )}
                {primarySource?.effectiveDate ? ` (effective ${primarySource.effectiveDate})` : ''}
              </>
            )}
            {record.verification === 'partial' && (
              <>
                Partially verified; confirm in the official{' '}
                {primarySource ? (
                  <a href={primarySource.url} target="_blank" rel="noopener noreferrer">
                    {primarySource.label}
                  </a>
                ) : (
                  'plan formulary'
                )}
                {primarySource?.effectiveDate ? ` (effective ${primarySource.effectiveDate})` : ''}
              </>
            )}
            {record.verification === 'example' && (
              <>Unconfirmed example data; verify details with the plan before prescribing</>
            )}
          </p>
        </div>

        {record.noCoveredAgent ? (
          <div className="recommendation-hero recommendation-hero--none">
            <div className="recommendation-hero__label">NO COVERED OPTION</div>
            <h3 className="recommendation-hero__name">No drug in this class is covered on this plan's list</h3>
            <p className="recommendation-hero__generic">{record.preferredRestriction}</p>
          </div>
        ) : (
        <div className="recommendation-hero">
          <div className="recommendation-hero__label">FIRST-PASS RECOMMENDED</div>
          <h3 className="recommendation-hero__name">{displayName}</h3>
          {agent.brand && !agent.inn.toLowerCase().startsWith(agent.brand.toLowerCase()) ? (
            <p className="recommendation-hero__generic">Also called: {readableGenericName(agent.inn)}</p>
          ) : null}
          <div className="recommendation-hero__meta">
            <span className="recommendation-hero__cost">
              In plan:{' '}
              <b>
                {record.tier ?? (record.preferredRestriction ? 'restricted — see coverage detail' : 'covered')}
              </b>
            </span>
          </div>
          {blocked.length > 0 ? (
            <p className="pa-summary">
              <b>Needs plan approval:</b> {blocked.slice(0, 3).join(', ')}
              {blocked.length > 3 ? ` +${blocked.length - 3} more` : ''}{' '}
              <button
                type="button"
                className="pa-summary__open"
                aria-label={`Start a PA request for ${blocked[0]}`}
                onClick={() => setPaOpen((cur) => ({ record, n: (cur?.record === record ? cur.n : 0) + 1 }))}
              >
                Start PA request <span aria-hidden="true">↓</span>
              </button>
            </p>
          ) : null}
          <CashPriceBoxes
            goodRxHref={goodRxUrl(agent.inn)}
            goodRx={goodRxPoint}
            costPlusHref={costPlusHref}
            costPlus={costPlusPoint}
            capturedAt={pricesAsOf}
          />
          {/* Even the first-pass pick needs plan sign-off here: offer the PA request on it too. */}
          {preferredNeedsPa(record) && drugClass ? (
            <AppealAction
              record={record}
              payer={payer}
              drugClass={drugClass}
              item={{
                drug: displayName,
                outcome: preferredOutcome(record),
                // preferredPaRequired can flag a PA the restriction text doesn't spell out.
                reason: record.preferredRestriction ?? (preferredOutcome(record) === 'step' ? 'Step therapy required' : 'PA required'),
                sourceIds: record.restrictionSourceIds,
                criteria: record.preferredCriteria,
                criteriaMode: record.preferredCriteriaMode,
                criteriaSourceIds: record.preferredCriteriaSourceIds,
              }}
            />
          ) : null}
        </div>
        )}

        {/* Q1 + Q2: what to prescribe + alternatives, with cost in plan vs cash. */}
        <PrescribeOptions record={record} source={primarySource} payer={payer} openFirstRequest={paSignal} />

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
                {record.noCoveredAgent ? (
                  <li>
                    <b>Doctor:</b> no drug in this class is covered on this plan's list: it is either
                    listed as excluded or not listed at all; the note above says which. Confirm
                    with the plan before requesting a formulary exception or using a cash price.
                  </li>
                ) : record.boglActive ? (
                  <li>
                    <b>Doctor:</b> write <strong>{displayName}</strong> on the prescription, not
                    generic {genericBase} (the generic may need approval).
                  </li>
                ) : record.preferredRestriction && preferredNeedsPa(record) ? (
                  <li>
                    <b>Doctor:</b> even this first-pass pick needs plan sign-off here:{' '}
                    {record.preferredRestriction}
                  </li>
                ) : record.preferredRestriction ? (
                  <li>
                    <b>Doctor:</b> this plan is likely to cover <strong>{displayName}</strong> without
                    approval. Plan note: {record.preferredRestriction}
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
              {record.noCoveredAgent ? (
                <p className="step__body step__body--none">
                  Not applicable: no drug in this class is covered on this plan's list.
                </p>
              ) : record.stepTherapy ? (
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
