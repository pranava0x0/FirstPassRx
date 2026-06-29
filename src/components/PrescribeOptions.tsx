import type { FormularyRecord, PayerMeta, Reference } from '../types/formulary'
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
 * Shows covered alternatives and coverage barriers in a single, unified table.
 */
export function PrescribeOptions({
  record,
  payer,
  source,
}: {
  record: FormularyRecord
  payer: PayerMeta
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

  const pref = record.preferredAgent
  const isCovered = !record.stepTherapy && !record.paRequired.some(
    (p) => p.drug === pref.brand || p.drug === pref.inn
  )

  return (
    <section className={`rx-options ${isCovered ? 'is-covered' : 'is-barrier'}`} aria-label="Prescribing options">
      <div className="rx-table-wrap">
        <table className="rx-table">
          <caption className="rx-cap">
            Alternatives &amp; Barriers on {payer.productName}{' · '}
            <SourceLink source={source} />
          </caption>
          <thead>
            <tr>
              <th scope="col">Option</th>
              <th scope="col">In plan</th>
              <th scope="col">Cash / Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.drug} className={`rx-row--${row.type}`}>
                <th scope="row" className="rx-opt">
                  <span className="rx-drug">{row.drug}</span>
                  <span className={`rx-tag rx-tag--${row.type}`}>{row.role}</span>
                </th>
                <td className="rx-cost" data-label="In plan">
                  {row.cost}
                </td>
                <td className="rx-cash" data-label="Cash / Details">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
