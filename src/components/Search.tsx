import { useState } from 'react'
import type { ClassId, PayerId } from '../types/formulary'
import { getClass, getPayer, searchFormulary } from '../lib/formulary'

/** Omni-search: type a drug ("Symbicort") and jump to where it's preferred or rejects. */
export function Search({ onPick }: { onPick: (payerId: PayerId, classId: ClassId) => void }) {
  const [q, setQ] = useState('')
  const query = q.trim()
  const hits = searchFormulary(q)

  return (
    <section className="search" aria-label="Search drugs and classes">
      <div className="search__field">
        <svg className="search__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M11 11l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          className="search__input"
          type="search"
          inputMode="search"
          placeholder="Search a drug or class…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search a drug or class"
          aria-describedby="search-status"
        />
        {q && (
          <button className="search__clear" type="button" aria-label="Clear search" onClick={() => setQ('')}>
            &times;
          </button>
        )}
      </div>

      <span id="search-status" className="sr-only" aria-live="polite">
        {query.length >= 2 ? `${hits.length} result${hits.length === 1 ? '' : 's'}` : ''}
      </span>

      {query.length >= 2 &&
        (hits.length > 0 ? (
          <ul className="search__results">
            {hits.map((h, i) => {
              const payer = getPayer(h.payerId)
              const cls = getClass(h.classId)
              return (
                <li key={`${h.payerId}-${h.classId}-${h.drug}-${i}`}>
                  <button
                    type="button"
                    className="search__row"
                    onClick={() => {
                      onPick(h.payerId, h.classId)
                      setQ('')
                    }}
                  >
                    <span className={`search__kind search__kind--${h.kind}`}>
                      {h.kind === 'preferred' ? 'Preferred' : 'Rejects'}
                    </span>
                    <span className="search__drug">{h.drug}</span>
                    <span className="search__where">
                      {payer?.shortName} · {cls?.shortName}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="search__empty">
            No formulary entry matches &ldquo;{query}&rdquo;. Check spelling or browse by class below.
          </p>
        ))}
    </section>
  )
}
