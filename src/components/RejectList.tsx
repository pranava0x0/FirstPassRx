import type { PaItem } from '../types/formulary'
import { GlossaryTerm } from './GlossaryTerm'

function readableReason(reason: string): string {
  const lower = reason.toLowerCase()
  if (lower.includes('pa')) return 'prior authorization needed'
  if (lower.includes('step')) return 'try another inhaler first'
  if (lower.includes('non-formulary')) return 'not on the covered list'
  if (lower.includes('non-preferred')) return 'not preferred'
  if (lower.includes('higher tier')) return 'higher cost tier'
  return reason
}

/**
 * Drugs that won't ship clean for this payer/class, as a ledger: one row per drug with a
 * deny rail, a ✕ glyph, and a right-flushed reason tag. The strike meaning is carried in
 * screen-reader text so the lossy visual doesn't drop information.
 */
export function RejectList({ items }: { items: PaItem[] }) {
  return (
    <section aria-labelledby="reject-head">
      <p className="eyebrow" id="reject-head">
        May need extra insurance approval
      </p>
      <p className="reject__intro">
        These may get delayed unless your clinician is planning a{' '}
        <GlossaryTerm match="Prior authorization">prior authorization</GlossaryTerm> or step-therapy
        request.
      </p>

      {items.length > 0 ? (
        <ul className="reject__list">
          {items.map((it) => (
            <li key={it.drug} className="reject__row">
              <span className="reject__glyph" aria-hidden="true">
                &#10005;
              </span>
              <span className="reject__drug">
                <span className="sr-only">Will reject: </span>
                {it.drug}
              </span>
              <span className="reject__reason">{readableReason(it.reason)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="reject__none">No rejections flagged for this class.</p>
      )}
    </section>
  )
}
