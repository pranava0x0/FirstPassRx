import type { FormularyRecord, PayerMeta, Reference } from '../types/formulary'
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
  /** Name to price as cash — the generic for the recommended row, else the drug itself. */
  cashName: string
  recommended: boolean
}

/**
 * The two questions a prescriber asks, in one scannable table: what to prescribe on this plan
 * (recommended + the also-covered alternatives/biosimilars), what it costs through insurance (the
 * formulary tier), and what it costs cash (GoodRx / Cost Plus Drugs). Every claim is cited.
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
  const a = record.preferredAgent
  const rows: Row[] = [
    {
      drug: a.brand ?? a.inn,
      role: 'First-pass',
      cost: record.tier ?? 'see plan',
      cashName: a.inn,
      recommended: true,
    },
    ...(record.alternatives ?? []).map((alt) => ({
      drug: alt.drug,
      role: roleOf(`${alt.drug} ${alt.note ?? ''}`),
      cost: alt.note ?? '—',
      cashName: alt.drug,
      recommended: false,
    })),
  ]

  return (
    <section className="rx-options" aria-label="Prescribing options">
      <div className="rx-table-wrap">
        <table className="rx-table">
          <caption className="rx-cap">
            Options on {payer.productName}
            <SourceLink source={source} />
          </caption>
          <thead>
            <tr>
              <th scope="col">Option</th>
              <th scope="col">In plan</th>
              <th scope="col">Cash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.drug} className={row.recommended ? 'rx-table__rec' : undefined}>
                <th scope="row" className="rx-opt">
                  <span className="rx-drug">{row.drug}</span>
                  <span className={`rx-tag rx-tag--${row.recommended ? 'rec' : 'alt'}`}>{row.role}</span>
                </th>
                <td className="rx-cost" data-label="In plan">
                  {row.cost}
                </td>
                <td className="rx-cash" data-label="Cash">
                  <a href={goodRxUrl(row.cashName)} target="_blank" rel="noopener noreferrer">
                    GoodRx &#8599;
                  </a>
                  <a href={costPlusUrl(row.cashName)} target="_blank" rel="noopener noreferrer">
                    Cost+ &#8599;
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
