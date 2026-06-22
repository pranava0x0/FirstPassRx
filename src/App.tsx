import { useState } from 'react'
import type { ClassId, PayerId } from './types/formulary'
import { getClass, getPayer, getRecord, meta } from './lib/formulary'
import { Disclaimer } from './components/Disclaimer'
import { Search } from './components/Search'
import { Controls } from './components/Controls'
import { ResultCard } from './components/ResultCard'

const PANEL_ID = 'result-panel'
const tabId = (c: ClassId) => `tab-${c}`

export default function App() {
  const [payerId, setPayerId] = useState<PayerId>('masshealth')
  const [classId, setClassId] = useState<ClassId>('saba')

  function pick(p: PayerId, c: ClassId) {
    setPayerId(p)
    setClassId(c)
  }

  const payer = getPayer(payerId)
  const drugClass = getClass(classId)
  const record = getRecord(payerId, classId)

  return (
    <>
      <a className="skip-link" href={`#${PANEL_ID}`}>
        Skip to result
      </a>

      <div className="shell">
        <header className="masthead" role="banner">
          <div className="masthead__row">
            <h1 className="masthead__mark">
              First<span className="rx">Pass</span>Rx
            </h1>
            <span className="masthead__stamp">Monograph · MA · as of {meta.lastUpdated}</span>
          </div>
          <p className="masthead__sub">
            Pick a plan and inhaler class. Start with the green answer.
          </p>
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
          <Search onPick={pick} />
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
              drugClass={drugClass}
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
            {meta.capturedAt}; confirm before prescribing.
          </p>
          <p>
            Correct a cell or add a payer:{' '}
            <a
              href="https://github.com/pranava0x0/FirstPassRx/blob/main/src/data/formulary.json"
              target="_blank"
              rel="noopener noreferrer"
            >
              edit formulary.json on GitHub &rarr;
            </a>
          </p>
        </footer>
      </div>
    </>
  )
}
