import type { AltItem, PayerMeta } from '../types/formulary'

function readableNote(note: string): string {
  return note.replace(/\bPA\b/g, 'prior authorization').replace(/·/g, '+')
}

function readableDrug(drug: string): string {
  return drug.replace(/\bDPI\b/g, 'dry-powder inhaler')
}

/**
 * The middle of the coverage ladder: other in-class agents this plan ALSO covers, so the
 * prescriber sees the real range of choices — not just the single first-pass pick.
 */
export function Alternatives({ items, payer }: { items: AltItem[]; payer: PayerMeta }) {
  return (
    <section aria-labelledby="alts-head">
      <p className="eyebrow" id="alts-head">
        Also covered by this plan
      </p>
      {items.length > 0 ? (
        <ul className="alts__list">
          {items.map((it) => (
            <li key={it.drug} className="alts__row">
              <span className="alts__glyph" aria-hidden="true">
                &#10003;
              </span>
              <span className="alts__drug">
                <span className="sr-only">Also covered: </span>
                {readableDrug(it.drug)}
              </span>
              {it.note ? <span className="alts__note">{readableNote(it.note)}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="alts__none">
          Other in-class agents aren&rsquo;t catalogued here yet — check the{' '}
          <a href={payer.formularyUrl} target="_blank" rel="noopener noreferrer">
            {payer.shortName} formulary
          </a>{' '}
          for the full list.
        </p>
      )}
    </section>
  )
}
