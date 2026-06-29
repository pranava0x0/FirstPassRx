import type { KeyboardEvent } from 'react'
import type { ClassId, PayerId } from '../types/formulary'
import { useGuide } from '../lib/formulary'

interface Props {
  payerId: PayerId
  classId: ClassId
  onPayer: (p: PayerId) => void
  onClass: (c: ClassId) => void
  panelId: string
  tabId: (c: ClassId) => string
}

export function Controls({ payerId, classId, onPayer, onClass, panelId, tabId }: Props) {
  const { payers, allClasses, activeClasses, classNoun, getClass, getPayer } = useGuide()
  const activeClass = getClass(classId)
  const payer = getPayer(payerId)

  // Roving-tabindex arrow navigation across the selectable class tabs (WAI-ARIA tabs pattern).
  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const idx = activeClasses.findIndex((c) => c.id === classId)
    if (idx === -1) return
    const dir = e.key === 'ArrowRight' ? 1 : -1
    const next = activeClasses[(idx + dir + activeClasses.length) % activeClasses.length]
    if (!next) return
    onClass(next.id)
    document.getElementById(tabId(next.id))?.focus()
  }

  return (
    <div className="controls">
      <section className="controls__group" aria-labelledby="sec-plan-title">
        <h2 id="sec-plan-title" className="controls__legend eyebrow">1. Insurance plan</h2>
        <label htmlFor="plan-select" className="sr-only">
          Select insurance plan
        </label>
        <select
          id="plan-select"
          className="plan-select"
          value={payerId}
          onChange={(e) => onPayer(e.target.value as PayerId)}
        >
          {payers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.productName}
            </option>
          ))}
        </select>
        {payer && (
          <p className="plan-note">
            {payer.productName} · {payer.formularyId}
            {payer.aka || payer.pbm ? ' · ' : ''}
            {payer.aka ? payer.aka : ''}
            {payer.aka && payer.pbm ? ' · ' : ''}
            {payer.pbm ? `PBM: ${payer.pbm}` : ''}
            {payer.formularyUrl ? (
              <>
                {' · '}
                <a
                  className="panel-cite"
                  href={payer.formularyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Official plan formulary page"
                >
                  source plan &#8599;
                </a>
              </>
            ) : null}
          </p>
        )}
      </section>

      <hr className="section-divider" />

      <section className="controls__group" aria-labelledby="sec-class-title">
        <h2 id="sec-class-title" className="controls__legend eyebrow">2. {classNoun}</h2>
        <div className="seg" role="tablist" aria-label={classNoun}>
          {allClasses.map((c) => {
            if (c.comingSoon) {
              return (
                <button
                  key={c.id}
                  type="button"
                  className="seg__btn"
                  role="tab"
                  aria-disabled="true"
                  aria-selected="false"
                  tabIndex={-1}
                  title="Coming soon — out of scope for now"
                  onClick={(e) => e.preventDefault()}
                >
                  <span className="seg__abbr">{c.shortName}</span>
                  <span className="seg__soon">soon</span>
                </button>
              )
            }
            const selected = c.id === classId
            return (
              <button
                key={c.id}
                id={tabId(c.id)}
                type="button"
                className="seg__btn"
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => onClass(c.id)}
                onKeyDown={onTabKeyDown}
              >
                <span className="seg__abbr">{c.plainName}</span>
                <span className="seg__plain">{c.shortName}</span>
              </button>
            )
          })}
        </div>
        {activeClass && (
          <p className="seg__desc">
            <span className="indication">{activeClass.plainName}</span>{' '}
            {activeClass.plainDescription}
          </p>
        )}
      </section>
    </div>
  )
}
