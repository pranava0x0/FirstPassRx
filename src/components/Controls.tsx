import type { KeyboardEvent } from 'react'
import type { ClassId, PayerId } from '../types/formulary'
import { activeClasses, allClasses, getClass, getPayer, payers } from '../lib/formulary'

interface Props {
  payerId: PayerId
  classId: ClassId
  onPayer: (p: PayerId) => void
  onClass: (c: ClassId) => void
  panelId: string
  tabId: (c: ClassId) => string
}

export function Controls({ payerId, classId, onPayer, onClass, panelId, tabId }: Props) {
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
      <fieldset className="controls__group">
        <legend className="controls__legend eyebrow">Insurance plan</legend>
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
              {p.name}
            </option>
          ))}
        </select>
        {payer && (payer.aka || payer.pbm) && (
          <p className="plan-note">
            {payer.aka ? payer.aka : ''}
            {payer.aka && payer.pbm ? ' · ' : ''}
            {payer.pbm ? `PBM: ${payer.pbm}` : ''}
          </p>
        )}
      </fieldset>

      <fieldset className="controls__group">
        <legend className="controls__legend eyebrow">Inhaler type</legend>
        <div className="seg" role="tablist" aria-label="Inhaler type">
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
                  title="Coming soon — biologics and non-inhaler agents are out of scope for now"
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
      </fieldset>
    </div>
  )
}
