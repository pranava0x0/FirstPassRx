import type { Reference } from '../types/formulary'

/** The source byline that closes every result — the trust mechanism (UpToDate/ProPublica model). */
export function Citations({
  sources,
  capturedAt,
  verificationNote,
}: {
  sources: Reference[]
  capturedAt: string
  verificationNote: string
}) {
  return (
    <section className="cites" aria-labelledby="cites-head">
      <p className="eyebrow" id="cites-head">
        Sources
      </p>
      <ol className="cites__list">
        {sources.map((s, i) => (
          <li key={s.id} className="cites__item">
            <span className="cites__num">[{i + 1}]</span>
            <span>
              <a className="cites__link" href={s.url} target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>{' '}
              <span className="cites__pub">
                · {s.publisher}
                {s.effectiveDate ? ` · rev. ${s.effectiveDate}` : ''}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className="cites__foot">
        {verificationNote} · captured {capturedAt} · verify at point of care.
      </p>
    </section>
  )
}
