import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import catalogUrl from '../data/generated/medications.json?url'
import { guideOptions, loadGuideView, type GuideView } from '../lib/formulary'
import {
  PAYER_TYPE_LABEL,
  STATUS_LABEL,
  STATUS_ORDER,
  buildMedMap,
  guidesToLoad,
  resolveMed,
  type MedMap,
  type MedState,
  type MedStatus,
  type PayerType,
} from '../lib/medicationMap'
import { cashNote, costPlusPrice, costPlusUrl, goodRxPrice, goodRxUrl, hasCashLinkRule, pricesCapturedAt } from '../lib/cash'
import { copayProgramFor } from '../lib/copayPrograms'
import { US_TILES } from '../lib/usTiles'
import { MedicationPicker } from './MedicationLookup'

type Catalog = Record<string, string[]>

/** Glyph + word, never hue alone (DESIGN.md). */
export const STATUS_GLYPH: Record<MedStatus, string> = {
  preferred: '✓',
  alternative: '+',
  pa: '!',
  nonformulary: '✕',
  notListed: '–',
  unknown: '?',
}

const QUICK_PICKS = ['Dovato', 'Biktarvy', 'Jardiance', 'Eliquis']

function readParam(name: string): string {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get(name) ?? ''
}

function writeParams(med: string, state: string) {
  const url = new URL(window.location.href)
  if (med) url.searchParams.set('med', med)
  else url.searchParams.delete('med')
  if (med && state) url.searchParams.set('state', state)
  else url.searchParams.delete('state')
  if (url.toString() !== window.location.href) window.history.replaceState({}, '', url.toString())
}

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const money = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })

/** "Covered, no PA on 8 of 8 · not the preferred pick" — the line a state tile and row read. */
export function stateLine(s: MedState): string {
  const n = s.plans.length
  const clean = s.counts.preferred + s.counts.alternative
  const pick = s.counts.preferred === n ? 'preferred pick on every plan' : s.counts.preferred ? `preferred pick on ${s.counts.preferred}` : 'not the preferred pick'
  return `Covered, no PA on ${clean} of ${n} · ${pick}`
}

function StatusWord({ status }: { status: MedStatus }) {
  return (
    <span className={`med-status med-status--${status}`}>
      <span aria-hidden="true">{STATUS_GLYPH[status]}</span> {STATUS_LABEL[status]}
    </span>
  )
}

function Confetti() {
  // 18 bits flung out radially; pure CSS, 300ms (DESIGN.md motion cap). Never rendered under
  // prefers-reduced-motion (and the CSS hides it there too).
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 18 }, (_, i) => (
        <i key={i} style={{ '--a': `${i * 20}deg`, '--d': `${48 + (i % 3) * 22}px` } as CSSProperties} />
      ))}
    </div>
  )
}

function StatStrip({ map }: { map: MedMap }) {
  const n = map.plans
  const parts = STATUS_ORDER.filter((s) => s !== 'preferred' && s !== 'alternative' && map.totals[s] > 0)
  return (
    <div className="med-stats" aria-live="polite">
      <p className="med-stats__lead">
        <strong>
          {map.label}: covered without PA on {map.totals.preferred + map.totals.alternative} of {n} plans
        </strong>{' '}
        in {map.states.length} states · preferred pick on {map.totals.preferred}
        {parts.map((s) => (
          <span key={s}>
            {' '}
            · {STATUS_LABEL[s]} on {map.totals[s]}
          </span>
        ))}
      </p>
      <p className="med-note">A plan is one insurer product in one state. Not listed means our record for that plan doesn't name it; it is not the same as excluded.</p>
      <ul className="med-types">
        {(Object.keys(map.byType) as PayerType[])
          .filter((t) => map.byType[t].plans > 0)
          .map((t) => {
            const { plans, counts } = map.byType[t]
            const words = STATUS_ORDER.filter((s) => counts[s] > 0)
              .map((s) => `${counts[s]} ${STATUS_LABEL[s].toLowerCase()}`)
              .join(', ')
            return (
              <li key={t}>
                <span className="med-types__name">
                  {PAYER_TYPE_LABEL[t]} · {plans} plans
                </span>
                <span className="med-bar" role="img" aria-label={`${PAYER_TYPE_LABEL[t]}: ${words}`}>
                  {STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => (
                    <span key={s} className={`med-bar__seg med-fill--${s}`} style={{ flexGrow: counts[s] }} />
                  ))}
                </span>
                <span className="med-types__words">
                  {Math.round((counts.preferred / plans) * 100)}% preferred · {Math.round((counts.pa / plans) * 100)}% PA or step ·{' '}
                  {Math.round((counts.nonformulary / plans) * 100)}% not covered
                </span>
              </li>
            )
          })}
      </ul>
    </div>
  )
}

function TileMap({ map, selected, onSelect }: { map: MedMap; selected: string; onSelect: (code: string) => void }) {
  const byCode = new Map(map.states.map((s) => [s.stateCode, s]))
  return (
    <div className="us-map" role="group" aria-label="Map of states. Covered states are buttons.">
      {US_TILES.map(([code, name, col, row]) => {
        const state = byCode.get(code)
        const style = { gridColumn: col + 1, gridRow: row + 1 }
        if (!state)
          return (
            <div key={code} className="us-tile us-tile--off" style={style} title={`${name}: not covered yet`} aria-hidden="true">
              <span className="us-tile__code">{code}</span>
            </div>
          )
        const label = `${name}: ${stateLine(state)}`
        return (
          <button
            key={code}
            type="button"
            className={`us-tile med-fill--${state.best}${selected === code ? ' is-selected' : ''}`}
            style={style}
            title={label}
            aria-label={label}
            aria-pressed={selected === code}
            onClick={() => onSelect(code)}
          >
            <span className="us-tile__code" aria-hidden="true">
              {code}
              {state.allPreferred && <b className="us-tile__star">★</b>}
            </span>
            <span className="us-tile__dots" aria-hidden="true">
              {state.plans.map((p) => (
                <i key={p.payer.id} className={`med-dot med-fill--${p.status}`} />
              ))}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function CashBlock({ labels }: { labels: string[] }) {
  // Cash prices key on the drug name; different labels can resolve to the same rule, so
  // de-duplicate by what is shown.
  const rows = new Map<string, { vendor: string; price: string; quantity: string; date: string | null; url: string; note?: string | null }>()
  for (const label of labels) {
    if (!hasCashLinkRule(label)) continue
    const g = goodRxPrice(label)
    const c = costPlusPrice(label)
    const captured = pricesCapturedAt(label)
    if (g) rows.set(`g${g.price}${g.quantity}`, { vendor: 'GoodRx', price: money(g.price), quantity: g.quantity, date: g.capturedAt ?? captured, url: goodRxUrl(label), note: cashNote(label) })
    const cpUrl = costPlusUrl(label)
    if (c && cpUrl) rows.set(`c${c.price}${c.quantity}`, { vendor: 'Cost Plus Drugs', price: money(c.price), quantity: c.quantity, date: c.capturedAt ?? captured, url: cpUrl })
  }
  return (
    <div className="med-cash">
      <h4>Cash price, without insurance</h4>
      {rows.size ? (
        <ul>
          {[...rows.values()].map((r) => (
            <li key={r.vendor + r.price + r.quantity}>
              <a href={r.url} target="_blank" rel="noopener noreferrer">
                {r.vendor}: <span className="mono">{r.price}</span> for {r.quantity} ↗
              </a>{' '}
              <span className="med-note">as of {r.date ?? 'unknown date'}; live price may differ.{r.note && ' ' + r.note}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="med-note">No captured cash price for these listings.</p>
      )}
    </div>
  )
}

function StatePanel({ state, label, celebrate }: { state: MedState; label: string; celebrate: number }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    heading.current?.scrollIntoView?.({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' })
  }, [state.stateCode])
  const listed = [...new Set(state.plans.flatMap((p) => p.cells.flatMap((c) => c.labels)))]
  const copay = copayProgramFor(label)
  const hasCommercial = state.plans.some((p) => p.type === 'commercial')
  return (
    <section className="med-state" aria-labelledby="med-state-h">
      {celebrate > 0 && !reducedMotion() && <Confetti key={celebrate} />}
      <h3 id="med-state-h" ref={heading} tabIndex={-1}>
        {state.region} ({state.stateCode})
      </h3>
      <p>
        {stateLine(state)}
        {state.allPreferred && <strong className="med-party"> ★</strong>}
      </p>
      <ul className="med-plans">
        {state.plans.map((plan) => (
          <li key={plan.payer.id} className="med-plan">
            <p className="med-plan__name">
              <strong>{plan.payer.name}</strong> · {PAYER_TYPE_LABEL[plan.type]}
            </p>
            <p className="med-note">{plan.payer.productName}</p>
            {plan.cells.map((cell, i) => (
              <div key={i} className="med-cell">
                <p>
                  <StatusWord status={cell.status} />
                </p>
                {cell.labels.length > 0 && <p className="med-note">Listed as: {cell.labels.join('; ')}</p>}
                <dl className="med-kv">
                  <dt>Tier</dt>
                  <dd>{cell.tier ?? '—'}</dd>
                  <dt>Restriction</dt>
                  <dd>{cell.restriction ?? '—'}</dd>
                  <dt>Checked</dt>
                  <dd>
                    {cell.verification === 'verified'
                      ? 'Verified'
                      : cell.verification === 'partial'
                        ? 'Partially verified'
                        : cell.verification === 'example'
                          ? 'Illustrative only'
                          : 'No record'}
                    {cell.lastReviewed && <> · reviewed {cell.lastReviewed}</>} · captured {cell.capturedAt}
                  </dd>
                </dl>
                {cell.sources.length > 0 ? (
                  <p className="med-sources">
                    {cell.sources.map((s) => (
                      <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer">
                        {s.label} ↗
                      </a>
                    ))}
                  </p>
                ) : (
                  <p className="med-note">No source on file for this plan.</p>
                )}
              </div>
            ))}
          </li>
        ))}
      </ul>
      <CashBlock labels={[label, ...listed]} />
      {copay && (
        <div className="med-cash">
          <h4>Manufacturer copay card</h4>
          <p>
            <a href={copay.url} target="_blank" rel="noopener noreferrer">
              {copay.name} ↗
            </a>
            {hasCommercial ? '' : ' (no commercial plan in this state in our data)'}
          </p>
          <p className="med-note">
            {copay.terms} Per{' '}
            <a href={copay.sourceUrl} target="_blank" rel="noopener noreferrer">
              {copay.sourceLabel} ↗
            </a>
            , read {copay.capturedAt}.
          </p>
        </div>
      )}
    </section>
  )
}

export function MedicationMap() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [catalogFailed, setCatalogFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [query] = useState(() => readParam('med'))
  const [picked, setPicked] = useState<string | null>(null)
  const [stateCode, setStateCode] = useState(() => readParam('state').toUpperCase())
  const [guides, setGuides] = useState<{ key: string; views?: GuideView[]; failed?: boolean }>({ key: '' })
  const [celebrate, setCelebrate] = useState({ code: '', n: 0 })

  useEffect(() => {
    const ctrl = new AbortController()
    setCatalogFailed(false)
    fetch(catalogUrl, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw Error(`catalog ${r.status}`)
        return r.json()
      })
      .then((c: Catalog) => setCatalog(c))
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) {
          console.error(e)
          setCatalogFailed(true)
        }
      })
    return () => ctrl.abort()
  }, [attempt])

  const names = useMemo(() => Object.keys(catalog ?? {}), [catalog])
  // A shared ?med= link may use any spelling; it resolves to one catalog product or to nothing.
  const med = picked ?? (catalog ? (resolveMed(names, query) ?? '') : '')
  const scopes = useMemo(() => (catalog && med ? (catalog[med] ?? []) : []), [catalog, med])
  const toLoad = useMemo(() => guidesToLoad(scopes, guideOptions), [scopes])
  const loadKey = toLoad.join(',')

  useEffect(() => {
    if (!loadKey) return
    let live = true
    setGuides({ key: loadKey })
    Promise.all(toLoad.map(loadGuideView)).then(
      (views) => live && setGuides({ key: loadKey, views }),
      (e: unknown) => {
        console.error(e)
        if (live) setGuides({ key: loadKey, failed: true })
      },
    )
    return () => {
      live = false
    }
  }, [loadKey, attempt])

  const map = useMemo(
    () => (med && guides.key === loadKey && guides.views ? buildMedMap(med, scopes, guides.views) : null),
    [guides, loadKey, med, scopes],
  )
  const selected = map?.states.find((s) => s.stateCode === stateCode)

  useEffect(() => {
    if (catalog) writeParams(med, stateCode)
  }, [catalog, med, stateCode])

  function choose(label: string) {
    setPicked(label)
    setStateCode('')
  }
  function pickState(code: string) {
    setStateCode(code)
    const s = map?.states.find((x) => x.stateCode === code)
    if (s?.allPreferred) setCelebrate((c) => ({ code, n: c.n + 1 }))
  }
  const quick = QUICK_PICKS.map((q) => resolveMed(names, q)).filter((q): q is string => !!q)

  return (
    <section className="med-workspace med-map" aria-label="Medication across states">
      <h2>One medication, every state</h2>
      {catalogFailed ? (
        <p role="alert">
          Medication list could not load. <button onClick={() => setAttempt((n) => n + 1)}>Retry</button>
        </p>
      ) : !catalog ? (
        <p role="status">Loading medications…</p>
      ) : (
        <>
          <MedicationPicker names={names} selected={med} onPick={choose} />
          <p className="med-quick">
            Try:{' '}
            {quick.map((q) => (
              <button key={q} type="button" aria-pressed={med === q} onClick={() => choose(q)}>
                {q.replace(/\s*\(.*$/, '')}
              </button>
            ))}
          </p>
          {!med ? (
            query && !picked ? (
              <p role="status">No single medication matches “{query}”. Pick one from the list.</p>
            ) : (
              <p className="med-note">Pick a medication to see how every plan we cover treats it.</p>
            )
          ) : guides.failed ? (
            <p role="alert">
              Some state guides could not load. <button onClick={() => setAttempt((n) => n + 1)}>Retry</button>
            </p>
          ) : !map ? (
            <p role="status">Loading {toLoad.length} state guides…</p>
          ) : (
            <>
              <StatStrip map={map} />
              <TileMap map={map} selected={stateCode} onSelect={pickState} />
              <ul className="med-legend" aria-label="Legend">
                {STATUS_ORDER.map((s) => (
                  <li key={s}>
                    <i className={`med-dot med-fill--${s}`} aria-hidden="true" /> <span aria-hidden="true">{STATUS_GLYPH[s]}</span> {STATUS_LABEL[s]}
                  </li>
                ))}
                <li>
                  <i className="med-dot med-dot--off" aria-hidden="true" /> Not covered yet
                </li>
                <li>★ Preferred pick, no PA, on every plan</li>
              </ul>
              <h3 className="med-map__list-h">States we cover</h3>
              <ul className="med-state-list">
                {map.states.map((s) => (
                  <li key={s.stateCode}>
                    <button type="button" aria-pressed={stateCode === s.stateCode} onClick={() => pickState(s.stateCode)}>
                      <span>
                        {s.region} ({s.stateCode}){s.allPreferred && ' ★'}
                      </span>
                      <span className="med-state-list__count">{stateLine(s)}</span>
                      <span className="med-state-list__dots" aria-hidden="true">
                        {s.plans.map((p) => (
                          <i key={p.payer.id} className={`med-dot med-fill--${p.status}`} />
                        ))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {selected && (
                <StatePanel
                  state={selected}
                  label={med}
                  celebrate={celebrate.code === selected.stateCode ? celebrate.n : 0}
                />
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
