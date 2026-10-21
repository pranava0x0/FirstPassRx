import { useEffect, useRef, useState } from 'react'
import type { ClassId, PayerId } from './types/formulary'
import {
  GuideProvider,
  defaultGuideId,
  findGuideId,
  firstTopicFor,
  getDefaultGuideView,
  guideOptions,
  loadGuideView,
  meta,
  stateOptions,
  topicOptions,
} from './lib/formulary'
import { Disclaimer } from './components/Disclaimer'
import { Controls } from './components/Controls'
import { ResultCard } from './components/ResultCard'
// Note: the omni-search bar (src/components/Search.tsx) is parked pending a redesign — see backlog.md.

const PANEL_ID = 'result-panel'
const LAST_PICK_KEY = 'fprx:last-pick'

interface Pick {
  guideId: string
  payerId?: string
  classId?: string
}

// Browser storage can be missing or throw (private mode, blocked site data) — a lost
// "remember my plan" must never break the page.
function readLastPick(): Pick | null {
  try {
    const raw = window.localStorage.getItem(LAST_PICK_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Pick>
    return typeof parsed.guideId === 'string' ? (parsed as Pick) : null
  } catch {
    return null
  }
}

function writeLastPick(pick: Pick): void {
  try {
    window.localStorage.setItem(LAST_PICK_KEY, JSON.stringify(pick))
  } catch {
    // Storage unavailable: the URL still carries the pick.
  }
}
const tabId = (c: ClassId) => `tab-${c}`

export default function App() {
  // Where a returning prescriber left off: the URL wins (a shared link), then the last pick on
  // this device (most prescribers repeat the same one or two plans all day), then the default.
  function getInitialPick(): Pick {
    if (typeof window === 'undefined') return { guideId: defaultGuideId }
    const params = new URLSearchParams(window.location.search)
    const gId = params.get('guide')
    if (gId && guideOptions.some((g) => g.id === gId)) {
      return { guideId: gId, payerId: params.get('plan') ?? undefined, classId: params.get('class') ?? undefined }
    }
    const saved = readLastPick()
    if (saved && guideOptions.some((g) => g.id === saved.guideId)) return saved
    return { guideId: defaultGuideId }
  }

  const [selection, setSelection] = useState(() => {
    const guide = getDefaultGuideView()
    return {
      guide,
      payerId: guide.payers[0]!.id as PayerId,
      classId: guide.activeClasses[0]!.id as ClassId,
    }
  })
  const { guide, payerId, classId } = selection
  const [loadingGuideId, setLoadingGuideId] = useState<string | null>(null)
  const [guideLoadError, setGuideLoadError] = useState(false)
  const guideRequest = useRef(0)

  // State and prescription type are picked independently of which guide is actually
  // loaded — most (state, topic) pairs don't have a guide yet (see backlog.md). Seeded from
  // the same default guide as `selection` above (not a URL-targeted guide) so the tabs and
  // the rendered content always describe the same guide on first paint; switchGuide moves
  // them together once a non-default guide actually finishes loading, instead of the tabs
  // jumping ahead of content that hasn't arrived yet.
  const defaultSummary = guideOptions.find((g) => g.id === defaultGuideId) ?? guideOptions[0]!
  const [stateCode, setStateCode] = useState(defaultSummary.stateCode)
  const [topicId, setTopicId] = useState(defaultSummary.topicId)
  const activeGuideId = findGuideId(stateCode, topicId)

  useEffect(() => {
    const initial = getInitialPick()
    if (initial.guideId !== defaultGuideId) void switchGuide(initial.guideId, false, initial)
    else applyPick(guide, initial)
  }, [])

  // Keep the plan + class in the URL (shareable, survives reload) and remember the pick on
  // this device. Only once the loaded guide matches the picker, so a half-switched state
  // never gets written.
  useEffect(() => {
    if (activeGuideId === undefined || activeGuideId !== guide.id) return
    const url = new URL(window.location.href)
    url.searchParams.set('guide', guide.id)
    url.searchParams.set('plan', payerId)
    url.searchParams.set('class', classId)
    if (url.toString() !== window.location.href) window.history.replaceState({}, '', url.toString())
    writeLastPick({ guideId: guide.id, payerId, classId })
  }, [guide.id, payerId, classId, activeGuideId])

  /** Apply a remembered plan/class to an already-loaded guide, ignoring ids it doesn't have. */
  function applyPick(view: typeof guide, pick: Pick) {
    const payerOk = pick.payerId && view.payers.some((p) => p.id === pick.payerId)
    const classOk = pick.classId && view.activeClasses.some((c) => c.id === pick.classId)
    if (!payerOk && !classOk) return
    setSelection((current) => ({
      ...current,
      payerId: payerOk ? (pick.payerId as PayerId) : current.payerId,
      classId: classOk ? (pick.classId as ClassId) : current.classId,
    }))
  }

  // Changing state keeps the condition when that state has it; otherwise jump to the state's
  // first available condition instead of landing on an empty "not covered" page.
  function onState(code: string) {
    setStateCode(code)
    if (!findGuideId(code, topicId)) {
      const fallback = firstTopicFor(code)
      if (fallback) setTopicId(fallback)
    }
  }

  useEffect(() => {
    if (!activeGuideId) {
      setGuideLoadError(false)
      setLoadingGuideId(null)
      // Clear a stale ?guide= param so a reload lands on the default guide instead of
      // silently reverting to whatever unrelated guide it used to name. This doesn't
      // reproduce the exact gap selection itself (state/topic aren't persisted in the
      // URL at all yet — see backlog.md), only prevents the wrong-guide revert.
      if (new URLSearchParams(window.location.search).has('guide')) {
        const url = new URL(window.location.href)
        url.searchParams.delete('guide')
        url.searchParams.delete('plan')
        url.searchParams.delete('class')
        window.history.replaceState({}, '', url.toString())
      }
      return
    }
    void switchGuide(activeGuideId)
  }, [activeGuideId])

  // Switching guide swaps the whole dataset (payers + classes differ), so reset the
  // selection to the new guide's defaults rather than carry a now-invalid payer/class.
  async function switchGuide(id: string, updateUrl = true, pick?: Pick): Promise<void> {
    if (id === guide.id || loadingGuideId === id) return
    const request = ++guideRequest.current
    setLoadingGuideId(id)
    setGuideLoadError(false)
    try {
      const nextGuide = await loadGuideView(id)
      if (request !== guideRequest.current) return
      const payerOk = pick?.payerId && nextGuide.payers.some((p) => p.id === pick.payerId)
      const classOk = pick?.classId && nextGuide.activeClasses.some((c) => c.id === pick.classId)
      setSelection({
        guide: nextGuide,
        payerId: payerOk ? (pick!.payerId as PayerId) : nextGuide.payers[0]!.id,
        classId: classOk ? (pick!.classId as ClassId) : nextGuide.activeClasses[0]!.id,
      })
      // Move the tabs together with the content, never ahead of it (a no-op when this came
      // from the user picking these exact tabs; keeps them in sync on the initial URL load).
      setStateCode(nextGuide.stateCode)
      setTopicId(nextGuide.topicId)

      if (updateUrl) {
        const url = new URL(window.location.href)
        url.searchParams.set('guide', id)
        url.searchParams.delete('plan')
        url.searchParams.delete('class')
        window.history.pushState({}, '', url.toString())
      }
    } catch {
      if (request === guideRequest.current) setGuideLoadError(true)
    } finally {
      if (request === guideRequest.current) setLoadingGuideId(null)
    }
  }

  const payer = guide.getPayer(payerId)
  const drugClass = guide.getClass(classId)
  const record = guide.getRecord(payerId, classId)
  // The loaded guide can briefly lag the current state/topic pick while a chunk fetches (or
  // fail to catch up at all, on error) — gate on the two actually matching so stale
  // Controls/ResultCard content never renders under tabs that have already moved on.
  const guideReady = activeGuideId !== undefined && activeGuideId === guide.id

  return (
    <GuideProvider value={guide}>
      <a className="skip-link" href={`#${PANEL_ID}`}>
        Skip to result
      </a>

      <div className="shell">
        <header className="masthead" role="banner">
          <div className="masthead__row">
            <h1 className="masthead__mark">
              First<span className="rx">Pass</span>Rx
            </h1>
          </div>
        </header>

        <main role="main">
          <Controls
            payerId={payerId}
            classId={classId}
            onPayer={(nextPayerId) =>
              setSelection((current) => ({ ...current, payerId: nextPayerId }))
            }
            onClass={(nextClassId) =>
              setSelection((current) => ({ ...current, classId: nextClassId }))
            }
            panelId={PANEL_ID}
            tabId={tabId}
            stateOptions={stateOptions}
            topicOptions={topicOptions}
            stateCode={stateCode}
            topicId={topicId}
            onState={onState}
            onTopic={setTopicId}
            loadingGuideId={loadingGuideId}
            guideLoadError={guideLoadError}
            hasGuide={guideReady}
          />

          <hr className="section-divider" />

          {!activeGuideId ? (
            <section id={PANEL_ID} className="result" aria-live="polite">
              <div className="doc">
                <div className="highlights">
                  <span className="eyebrow">Not covered yet</span>
                  <p className="agent__plain">
                    No formulary guide covers this state and prescription type yet.
                    Pick a different combination above.
                  </p>
                </div>
              </div>
            </section>
          ) : !guideReady ? (
            <section id={PANEL_ID} className="result" aria-live="polite" aria-busy={loadingGuideId !== null}>
              <div className="doc">
                <div className="highlights">
                  <span className="eyebrow">{guideLoadError ? 'Could not load' : 'Loading'}</span>
                  <p className="agent__plain">
                    {guideLoadError
                      ? 'This guide could not load. Check your connection and try again.'
                      : 'Loading this state and prescription type…'}
                  </p>
                </div>
              </div>
            </section>
          ) : record && payer && drugClass ? (
            <ResultCard
              record={record}
              payer={payer}
              panelId={PANEL_ID}
              labelId={tabId(classId)}
            />
          ) : (
            <section id={PANEL_ID} className="result" aria-live="polite">
              <div className="doc">
                <div className="highlights">
                  <span className="eyebrow">No data</span>
                  <p className="agent__plain">
                    No record exists for this plan and class yet. Add one in{' '}
                    <code>src/data/formulary.json</code>.
                  </p>
                </div>
              </div>
            </section>
          )}
        </main>

        <section className="disclaimer-group">
          <Disclaimer />
        </section>

        <footer className="footer" role="contentinfo">
          <p>
            <strong>FirstPassRx</strong> is reference only. Data v{meta.version}, captured{' '}
            {guide.capturedAt}; confirm before prescribing.
          </p>
          <p>
            Open source ·{' '}
            <a
              href="https://github.com/pranava0x0/FirstPassRx"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/pranava0x0/FirstPassRx
            </a>{' '}
            ·{' '}
            <a
              href="https://github.com/pranava0x0/FirstPassRx/blob/main/src/data/formulary.json"
              target="_blank"
              rel="noopener noreferrer"
            >
              correct a cell &rarr;
            </a>
          </p>
          <p>
            Built by{' '}
            <a href="https://www.pranavaraparla.com" target="_blank" rel="noopener noreferrer">
              Pranava Raparla
            </a>
          </p>
        </footer>
      </div>
    </GuideProvider>
  )
}
