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
 * The two questions a prescriber actually asks, in one scannable table: what to prescribe on this
 * plan (recommended + the also-covered alternatives/biosimilars), what it costs through insurance
 * (the formulary tier), and what it costs cash (GoodRx / Cost Plus Drugs). Every claim is cited.
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
      role: 'Recommended',
      cost: record.tier ?? 'see plan tier',
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
    <section className="rx-options" aria-labelledby="rx-options-head">
      <p className="eyebrow" id="rx-options-head">
        What to prescribe on {payer.shortName}
        <SourceLink source={source} />
      </p>
      <div className="rx-table-wrap">
        <table className="rx-table">
          <thead>
            <tr>
              <th scope="col">Option</th>
              <th scope="col">Cost in plan</th>
              <th scope="col">Cash price</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.drug} className={row.recommended ? 'rx-table__rec' : undefined}>
                <th scope="row" className="rx-opt">
                  <span className="rx-drug">{row.drug}</span>
                  <span className={`rx-tag rx-tag--${row.recommended ? 'rec' : 'alt'}`}>{row.role}</span>
                </th>
                <td className="rx-cost">{row.cost}</td>
                <td className="rx-cash">
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
      <p className="rx-options__note">
        Cash can beat a copay on generics and skips prior authorization; prices change daily.
      </p>
    </section>
  )
}
