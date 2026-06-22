import { GlossaryTerm } from './GlossaryTerm'

/** Brand-Over-Generic caution. Rendered only when the plan forces the brand. */
export function BoglBanner({ brand }: { brand: string }) {
  return (
    <div className="bogl">
      <span className="bogl__glyph" aria-hidden="true">
        &#9888;
      </span>
      <div>
        <p className="bogl__eyebrow">Ask for the brand name</p>
        <p className="bogl__body">
          For MassHealth, ask for <b>{brand}</b>. The generic albuterol inhaler may need extra
          insurance approval first.
        </p>
        <details className="mini-detail">
          <summary>Why this matters</summary>
          <p>
            MassHealth has a <GlossaryTerm match="BOGL">brand-over-generic rule</GlossaryTerm> for
            this inhaler: the brand is the easier path, even though a generic exists.
          </p>
        </details>
      </div>
    </div>
  )
}
