import { GlossaryTerm } from './GlossaryTerm'

/** Brand-Over-Generic caution. Rendered only when the plan forces the brand. */
export function BoglBanner({ note }: { note: string }) {
  return (
    <div className="bogl">
      <span className="bogl__glyph" aria-hidden="true">
        &#9888;
      </span>
      <div>
        <p className="bogl__eyebrow">
          Brand required · <GlossaryTerm match="BOGL">BOGL</GlossaryTerm>
        </p>
        <p className="bogl__body">Use the brand name here; the generic may trigger a prior auth.</p>
        <details className="mini-detail">
          <summary>Why</summary>
          <p>{note}</p>
        </details>
      </div>
    </div>
  )
}
