import type { FormularyRecord, Reference } from '../types/formulary'
import { useGuide } from '../lib/formulary'
import { goodRxUrl, costPlusUrl } from '../lib/cash'
import { SourceLink } from './SourceLink'

/** Tag an option by what it is, read from the drug text / coverage note. */
function roleOf(text: string): string {
  const t = text.toLowerCase()
  if (t.includes('biosimilar')) return 'Biosimilar'
  if (t.includes('generic')) return 'Generic'
  if (t.includes('combo') || t.includes('combination')) return 'Combination'
  return 'Alternative'
}

interface Row {
  drug: string
  role: string
  cost: string
  cashName: string
  type: 'alternative' | 'barrier'
  sourceIds: string[]
}

/**
 * Renders all other options besides the first-pass recommendation.
 * Shows covered alternatives and coverage barriers in a stack of styled cards.
 */
export function PrescribeOptions({
  record,
  source,
}: {
  record: FormularyRecord
  source?: Reference
}) {
  const guide = useGuide()
  
  const alternates: Row[] = (record.alternatives ?? []).map((alt) => ({
    drug: alt.drug,
    role: roleOf(`${alt.drug} ${alt.note ?? ''}`),
    cost: alt.note ?? 'covered',
    cashName: alt.drug,
    type: 'alternative',
    sourceIds: alt.sourceIds,
  }))

  const barriers: Row[] = (record.paRequired ?? []).map((rej) => ({
    drug: rej.drug,
    role: rej.outcome === 'pa' ? 'PA Required' : rej.outcome === 'step' ? 'Step Therapy' : 'Excluded',
    cost: rej.reason,
    cashName: rej.drug,
    type: 'barrier',
    sourceIds: rej.sourceIds,
  }))

  const rows = [...alternates, ...barriers]

  if (rows.length === 0) {
    return null
  }

  return (
    <section className="rx-options-stack" aria-label="Prescribing options">
      <div className="rx-options-stack__header">
        <h4 className="rx-options-stack__title">
          Alternatives
          {source ? (
            <>
              {' · '}
              <SourceLink source={source} />
            </>
          ) : null}
        </h4>
      </div>
      
      <div className="rx-cards-list">
        {rows.map((row) => (
          <div key={row.drug} className={`rx-option-card is-${row.type}`}>
            <div className="rx-option-card__header">
              <h5 className="rx-option-card__name">{row.drug}</h5>
              <span className={`rx-tag rx-tag--${row.type}`}>{row.role}</span>
            </div>
            <p className="rx-option-card__cost">{row.cost}</p>
            <div className="rx-option-card__footer">
              <span className="rx-option-card__label">Cash / Details:</span>
              <span className="rx-option-card__links">
                {row.type === 'alternative' ? (
                  <>
                    <a href={goodRxUrl(row.cashName)} target="_blank" rel="noopener noreferrer">
                      GoodRx &#8599;
                    </a>
                    <a href={costPlusUrl(row.cashName)} target="_blank" rel="noopener noreferrer">
                      Cost+ &#8599;
                    </a>
                  </>
                ) : (
                  guide.resolveSources(row.sourceIds).map((src) => (
                    <a
                      key={src.id}
                      className="panel-cite"
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={src.label}
                    >
                      source &#8599;
                    </a>
                  ))
                )}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
