import { GlossaryTerm } from './GlossaryTerm'

interface Props {
  brand: string
  payerName: string
  genericBase: string
  /** Singular product noun for this guide, e.g. "inhaler" / "medication". */
  unitNoun: string
}

/** Brand-Over-Generic caution. Rendered only when the plan forces the brand. */
export function BoglBanner({ brand, payerName, genericBase, unitNoun }: Props) {
  return (
    <div className="bogl">
      <span className="bogl__glyph" aria-hidden="true">
        &#9888;
      </span>
      <div>
        <p className="bogl__eyebrow">Ask for the brand name</p>
        <p className="bogl__body">
          For {payerName}, ask for <b>{brand}</b>. The generic {genericBase} {unitNoun} may need
          extra insurance approval first.
        </p>
        <details className="mini-detail">
          <summary>Why this matters</summary>
          <p>
            {payerName} has a <GlossaryTerm match="BOGL">brand-over-generic rule</GlossaryTerm> for
            this {unitNoun}: the brand is the easier path, even though a generic exists.
          </p>
        </details>
      </div>
    </div>
  )
}
