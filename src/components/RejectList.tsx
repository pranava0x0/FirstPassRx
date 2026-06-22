import type { PaItem } from '../types/formulary'
import { GlossaryTerm } from './GlossaryTerm'

/**
 * Drugs that won't ship clean for this payer/class, as a ledger: one row per drug with a
 * deny rail, a ✕ glyph, and a right-flushed reason tag. The strike meaning is carried in
 * screen-reader text so the lossy visual doesn't drop information.
 */
export function RejectList({ items }: { items: PaItem[] }) {
  return (
    <section aria-labelledby="reject-head">
      <div className="reject__head">
        <p className="eyebrow" id="reject-head">
          Will reject — <GlossaryTerm match="Prior authorization">prior auth</GlossaryTerm> / step
        </p>
        <button
          type="button"
          className="appeal-btn"
          disabled
          aria-disabled="true"
          title="Coming soon — auto-draft the PA appeal from this cell"
        >
          Automate appeal · soon
        </button>
      </div>

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
              <span className="reject__reason">{it.reason}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="reject__none">No rejections flagged for this class.</p>
      )}
    </section>
  )
}
