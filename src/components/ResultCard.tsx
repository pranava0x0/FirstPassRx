import type { ClassMeta, FormularyRecord, PayerMeta, Verification } from '../types/formulary'
import { useGuide } from '../lib/formulary'
import { RxSig } from './RxSig'
import { BoglBanner } from './BoglBanner'
import { Alternatives } from './Alternatives'
import { RejectList } from './RejectList'
import { Citations } from './Citations'
import { GlossaryTerm } from './GlossaryTerm'
import { SourceLink } from './SourceLink'

/** How confident the cell is in its source — surfaced as a visible stamp, not buried in prose. */
const VERIFY_LABEL: Record<Verification, string> = {
  verified: 'Verified — read off the cited source',
  partial: 'Partial — confirm in the source',
  example: 'Example — unconfirmed',
}

/**
 * Cash-price lookups for an agent. Paying cash can beat an insurance copay on cheap generics —
 * and it sidesteps prior authorization entirely. GoodRx aggregates pharmacy-coupon prices;
 * Cost Plus Drugs (Mark Cuban) sells generics at cost + a flat markup. We link to live pricing
 * rather than bake a number (prices change daily; CLAUDE.md: don't manufacture certainty).
 */
function cashQuery(name: string): string {
  return name.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim()
}
function goodRxUrl(name: string): string {
  return `https://www.goodrx.com/search?query=${encodeURIComponent(cashQuery(name))}`
}
function costPlusUrl(name: string): string {
  return `https://costplusdrugs.com/medications/?search=${encodeURIComponent(cashQuery(name))}`
}

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
  const { resolveSources, capturedAt, unitNoun } = useGuide()
  const agent = record.preferredAgent
  const sources = resolveSources(record.sourceIds)
  const primarySource = sources[0]
  const displayName = agent.brand ?? agent.inn

  // Clinician & Patient UX: Extract a clean, lowercase generic name without salt/device suffixes
  // (e.g. "Albuterol sulfate HFA" -> "albuterol", "Budesonide inhalation" -> "budesonide").
  // This prevents hardcoding "generic albuterol" in BOGL (Brand Over Generic) instructions,
  // making the component robust and correct for any other drug classes that prefer brands.
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
          <p className={`stamp stamp--verify is-${record.verification}`}>
            <span aria-hidden="true">{record.verification === 'verified' ? '✓' : '⚠'}</span>
            <span className="sr-only">Source confidence: </span>
            {VERIFY_LABEL[record.verification]}
          </p>
          {primarySource ? (
            <p className="result__cite">
              Coverage per{' '}
              <a
                className="result__cite-link"
                href={primarySource.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {primarySource.label}
              </a>
              {primarySource.effectiveDate ? ` (rev. ${primarySource.effectiveDate})` : ''}.
            </p>
          ) : null}
        </div>

        <div className="patient-summary" aria-label="What to do next">
          <h3>What to do next</h3>
          <ol>
            {/* Patient Action: Keep this clean, consistent, and identical for all records */}
            <li>
              <b>Patient:</b> ask your doctor if <strong>{displayName}</strong> is the right{' '}
              {unitNoun} for you.
            </li>
            {record.boglActive ? (
              <>
                <li>
                  <b>Doctor:</b> write <strong>{displayName}</strong> on the prescription, not
                  generic {genericBase}.
                </li>
                <li>
                  <b>Pharmacy:</b> switching this to generic {genericBase} may trigger extra insurance
                  approval.
                </li>
              </>
            ) : (
              <>
                <li>
                  <b>Doctor:</b> this plan is likely to cover <strong>{displayName}</strong> without
                  prior authorization.
                </li>
                <li>
                  <b>Pharmacy:</b>{' '}
                  {agent.genericAvailable
                    ? `a generic version is okay for this plan.`
                    : 'a generic version is not listed for this product.'}
                </li>
              </>
            )}
          </ol>
        </div>

        {record.boglActive && record.boglNote ? (
          <div>
            <BoglBanner
              brand={agent.brand ?? displayName}
              payerName={payer.shortName}
              genericBase={genericBase}
              unitNoun={unitNoun}
            />
          </div>
        ) : null}

        <div className="coverage-panels" aria-label="Coverage details">
          <div className="coverage-panel coverage-panel--covered">
            <Alternatives items={record.alternatives ?? []} payer={payer} source={primarySource} />
          </div>
          <div className="coverage-panel coverage-panel--reject">
            <RejectList items={record.paRequired} source={primarySource} />
          </div>
        </div>

        <div className="cost-note">
          <p className="eyebrow">What it costs</p>
          <ul className="cost-note__list">
            <li>
              <b>With insurance:</b>{' '}
              {record.tier ?? 'depends on your plan tier — check the formulary'}
              <SourceLink source={primarySource} />
            </li>
            <li>
              <b>Paying cash:</b>{' '}
              {agent.genericAvailable
                ? 'a generic is often a few dollars — sometimes less than a copay, and cash skips prior authorization. '
                : 'no generic is listed, so usually higher — still worth comparing. '}
              Compare{' '}
              <a href={goodRxUrl(agent.inn)} target="_blank" rel="noopener noreferrer">
                GoodRx &#8599;
              </a>{' '}
              and{' '}
              <a href={costPlusUrl(agent.inn)} target="_blank" rel="noopener noreferrer">
                Cost Plus Drugs &#8599;
              </a>
              .
            </li>
          </ul>
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
                capturedAt={capturedAt}
                verificationNote={record.verificationNote}
              />
            </div>
          </details>
        </div>
      </div>
    </section>
  )
}
