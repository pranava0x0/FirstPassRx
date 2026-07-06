import type { KeyboardEvent } from 'react'
import type { ClassId, PayerId } from '../types/formulary'
import type { StateOption, TopicOption } from '../lib/formulary'
import { useGuide } from '../lib/formulary'

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

  const stateTabId = (code: string) => `state-tab-${code}`
  const topicTabId = (id: string) => `topic-tab-${id}`

  // Same roving-tabindex pattern as the class tabs above, over the state list instead.
  function onStateKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const idx = stateOptions.findIndex((s) => s.code === stateCode)
    if (idx === -1) return
    const dir = e.key === 'ArrowRight' ? 1 : -1
    const next = stateOptions[(idx + dir + stateOptions.length) % stateOptions.length]
    if (!next) return
    onState(next.code)
    document.getElementById(stateTabId(next.code))?.focus()
  }

  // Same roving-tabindex pattern as the class tabs above, over the topic list instead.
  function onTopicKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const idx = topicOptions.findIndex((t) => t.id === topicId)
    if (idx === -1) return
    const dir = e.key === 'ArrowRight' ? 1 : -1
    const next = topicOptions[(idx + dir + topicOptions.length) % topicOptions.length]
    if (!next) return
    onTopic(next.id)
    document.getElementById(topicTabId(next.id))?.focus()
  }

  return (
    <div className="controls">
      <section className="controls__group" aria-labelledby="sec-location-title">
        <h2 id="sec-location-title" className="controls__legend eyebrow">1. State &amp; therapeutic area</h2>
        <div className="seg" role="tablist" aria-label="State" aria-busy={loadingGuideId !== null}>
          {stateOptions.map((s) => {
            const selected = s.code === stateCode
            return (
              <button
                key={s.code}
                id={stateTabId(s.code)}
                type="button"
                className="seg__btn"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                disabled={loadingGuideId !== null}
                onClick={() => onState(s.code)}
                onKeyDown={onStateKeyDown}
              >
                <span className="seg__abbr">{s.region}</span>
              </button>
            )
          })}
        </div>
        <div className="seg seg--spaced" role="tablist" aria-label="Therapeutic area" aria-busy={loadingGuideId !== null}>
          {topicOptions.map((t) => {
            const selected = t.id === topicId
            return (
              <button
                key={t.id}
                id={topicTabId(t.id)}
                type="button"
                className="seg__btn"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                disabled={loadingGuideId !== null}
                onClick={() => onTopic(t.id)}
                onKeyDown={onTopicKeyDown}
              >
                <span className="seg__abbr">{t.label}</span>
              </button>
            )
          })}
        </div>
        {guideLoadError ? (
          <p className="guide-load-error" role="alert">
            This guide could not load. Check your connection and try again.
          </p>
        ) : null}
      </section>

      {hasGuide && (
        <>
          <hr className="section-divider" />

          <section className="controls__group" aria-labelledby="sec-plan-title">
            <h2 id="sec-plan-title" className="controls__legend eyebrow">2. Insurance plan</h2>
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
            <h2 id="sec-class-title" className="controls__legend eyebrow">3. {classNoun}</h2>
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
        </>
      )}
    </div>
  )
}
