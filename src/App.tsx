import { useEffect, useRef, useState } from 'react'
import type { ClassId, PayerId } from './types/formulary'
import {
  GuideProvider,
  defaultGuideId,
  getDefaultGuideView,
  guideOptions,
  loadGuideView,
  meta,
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

  useEffect(() => {
    const initialGuideId = getInitialGuideId()
    if (initialGuideId !== defaultGuideId) void switchGuide(initialGuideId, false)
  }, [])

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
            <div
              className="guide-switch"
              role="group"
              aria-label="Choose a guide"
              aria-busy={loadingGuideId !== null}
            >
              {guideOptions.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="guide-switch__btn"
                  aria-pressed={g.id === guide.id}
                  disabled={loadingGuideId !== null}
                  onClick={() => void switchGuide(g.id)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          {guideLoadError ? (
            <p className="guide-load-error" role="alert">
              This guide could not load. Check your connection and try again.
            </p>
          ) : null}

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
          />

          <hr className="section-divider" />

          {record && payer && drugClass ? (
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
