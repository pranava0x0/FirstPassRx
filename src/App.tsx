import { useEffect, useRef, useState } from 'react'
import type { ClassId, PayerId } from './types/formulary'
import {
  GuideProvider,
  defaultGuideId,
  findGuideId,
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
const tabId = (c: ClassId) => `tab-${c}`

export default function App() {
  function getInitialGuideId(): string {
    if (typeof window === 'undefined') return defaultGuideId
    const params = new URLSearchParams(window.location.search)
    const gId = params.get('guide')
    if (gId && guideOptions.some((g) => g.id === gId)) {
      return gId
    }
    return defaultGuideId
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
  // loaded — most (state, topic) pairs don't have a guide yet (see backlog.md).
  const initialSummary = guideOptions.find((g) => g.id === getInitialGuideId()) ?? guideOptions[0]!
  const [stateCode, setStateCode] = useState(initialSummary.stateCode)
  const [topicId, setTopicId] = useState(initialSummary.topicId)
  const activeGuideId = findGuideId(stateCode, topicId)
  const isInitialGuideLoad = useRef(true)

  useEffect(() => {
    if (!activeGuideId) {
      setGuideLoadError(false)
      return
    }
    // The first resolution reflects whatever ?guide= was already in the URL, so don't
    // re-push the same URL onto history; later switches (from picking a new state/topic)
    // do update it.
    void switchGuide(activeGuideId, !isInitialGuideLoad.current)
    isInitialGuideLoad.current = false
  }, [activeGuideId])

  // Switching guide swaps the whole dataset (payers + classes differ), so reset the
  // selection to the new guide's defaults rather than carry a now-invalid payer/class.
  async function switchGuide(id: string, updateUrl = true): Promise<void> {
    if (id === guide.id || loadingGuideId === id) return
    const request = ++guideRequest.current
    setLoadingGuideId(id)
    setGuideLoadError(false)
    try {
      const nextGuide = await loadGuideView(id)
      if (request !== guideRequest.current) return
      setSelection({
        guide: nextGuide,
        payerId: nextGuide.payers[0]!.id,
        classId: nextGuide.activeClasses[0]!.id,
      })

      if (updateUrl) {
        const url = new URL(window.location.href)
        url.searchParams.set('guide', id)
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
            onState={setStateCode}
            onTopic={setTopicId}
            loadingGuideId={loadingGuideId}
            guideLoadError={guideLoadError}
            hasGuide={activeGuideId !== undefined}
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
