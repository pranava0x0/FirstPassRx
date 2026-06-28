import { useState } from 'react'
import type { ClassId, PayerId } from './types/formulary'
import { GuideProvider, defaultGuideId, getGuideView, guides, meta } from './lib/formulary'
import { Disclaimer } from './components/Disclaimer'
import { Controls } from './components/Controls'
import { ResultCard } from './components/ResultCard'
// Note: the omni-search bar (src/components/Search.tsx) is parked pending a redesign — see backlog.md.

const PANEL_ID = 'result-panel'
const tabId = (c: ClassId) => `tab-${c}`

export default function App() {
  const [guideId, setGuideId] = useState<string>(defaultGuideId)
  const guide = getGuideView(guideId)
  const [payerId, setPayerId] = useState<PayerId>(guide.payers[0]!.id)
  const [classId, setClassId] = useState<ClassId>(guide.activeClasses[0]!.id)

  // Switching guide swaps the whole dataset (payers + classes differ), so reset the
  // selection to the new guide's defaults rather than carry a now-invalid payer/class.
  function switchGuide(id: string) {
    if (id === guideId) return
    const g = getGuideView(id)
    setGuideId(id)
    setPayerId(g.payers[0]!.id)
    setClassId(g.activeClasses[0]!.id)
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
          <div className="guide-switch" role="group" aria-label="Choose a guide">
            {guides.map((g) => (
              <button
                key={g.id}
                type="button"
                className="guide-switch__btn"
                aria-pressed={g.id === guideId}
                onClick={() => switchGuide(g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="masthead__row">
            <h1 className="masthead__mark">
              First<span className="rx">Pass</span>Rx
            </h1>
            <span className="masthead__stamp">
              {guide.region} {guide.topic} · updated {guide.lastUpdated}
            </span>
          </div>
          <p className="masthead__sub">{guide.tagline}</p>
          <p className="masthead__audience">
            Patients can bring this to a visit. Prescribers should confirm against the linked
            formulary.
          </p>
          <details className="how">
            <summary>How this works</summary>
            <p className="how__body">
              <b>First-pass pick</b> means the option most likely to go through without prior
              authorization. Open the sections below it for backup choices, drugs that may reject,
              and sources.
            </p>
          </details>
          <Disclaimer />
        </header>

        <main role="main">
          <Controls
            payerId={payerId}
            classId={classId}
            onPayer={setPayerId}
            onClass={setClassId}
            panelId={PANEL_ID}
            tabId={tabId}
          />

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
        </footer>
      </div>
    </GuideProvider>
  )
}
