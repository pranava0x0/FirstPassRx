import type { KeyboardEvent } from 'react'
import type { ClassId, PayerId } from '../types/formulary'
import type { StateOption, TopicOption } from '../lib/formulary'
import { findGuideId, useGuide } from '../lib/formulary'

interface Props {
  payerId: PayerId
  classId: ClassId
  onPayer: (p: PayerId) => void
  onClass: (c: ClassId) => void
  panelId: string
  tabId: (c: ClassId) => string
  stateOptions: StateOption[]
  topicOptions: TopicOption[]
  stateCode: string
  topicId: string
  onState: (code: string) => void
  onTopic: (id: string) => void
  loadingGuideId: string | null
  guideLoadError: boolean
  /** Whether a guide exists for the current state/topic pick — false hides the plan + class steps. */
  hasGuide: boolean
}

export function Controls({
  payerId,
  classId,
  onPayer,
  onClass,
  panelId,
  tabId,
  stateOptions,
  topicOptions,
  stateCode,
  topicId,
  onState,
  onTopic,
  loadingGuideId,
  guideLoadError,
  hasGuide,
}: Props) {
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

  const topicAvailable = (id: string) => findGuideId(stateCode, id) !== undefined
  const loading = loadingGuideId !== null

  return (
    <div className="controls">
      <section className="controls__group picker" aria-label="State and condition" aria-busy={loading}>
        <div className="picker__field">
          <label htmlFor="state-select" className="picker__label">
            State
          </label>
          <select
            id="state-select"
            className="plan-select"
            value={stateCode}
            disabled={loading}
            onChange={(e) => onState(e.target.value)}
          >
            {stateOptions.map((s) => (
              <option key={s.code} value={s.code}>
                {s.region}
              </option>
            ))}
          </select>
        </div>
        <div className="picker__field">
          <label htmlFor="topic-select" className="picker__label">
            Condition
          </label>
          <select
            id="topic-select"
            className="plan-select"
            value={topicId}
            disabled={loading}
            onChange={(e) => onTopic(e.target.value)}
          >
            {topicOptions.map((t) => {
              const available = topicAvailable(t.id)
              return (
                <option key={t.id} value={t.id} disabled={!available}>
                  {available ? t.label : `${t.label} (not yet)`}
                </option>
              )
            })}
          </select>
        </div>
        {guideLoadError ? (
          <p className="guide-load-error picker__wide" role="alert">
            This guide could not load. Check your connection and try again.
          </p>
        ) : null}
      </section>

      {hasGuide && (
        <>
          <section className="controls__group controls__group--plan">
            <label htmlFor="plan-select" className="picker__label">
              Insurance plan
            </label>
            <select
              id="plan-select"
              aria-label="Select insurance plan"
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
                {payer.formularyId}
                {payer.pbm ? ` · PBM: ${payer.pbm}` : ''}
                {payer.formularyUrl ? (
                  <>
                    {' · '}
                    <a
                      className="panel-cite"
                      href={payer.formularyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Official plan formulary"
                    >
                      source plan &#8599;
                    </a>
                  </>
                ) : null}
                {/* Who the plan also covers (e.g. every Medicaid MCO under a statewide PDL) must
                    stay visible: a tooltip never shows on a phone. */}
                {payer.aka ? <span className="plan-note__aka">{payer.aka}</span> : null}
              </p>
            )}
          </section>

          <section className="controls__group controls__group--class" aria-labelledby="sec-class-title">
            <h2 id="sec-class-title" className="picker__label">{classNoun}</h2>
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
              <p className="seg__desc">{activeClass.plainDescription}</p>
            )}
          </section>
        </>
      )}
    </div>
  )
}
