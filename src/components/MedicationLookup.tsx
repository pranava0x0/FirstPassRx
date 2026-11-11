import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { GuideProvider, guideOptions, loadGuideView, type GuideView } from '../lib/formulary'
import { findings } from '../lib/medicationLookup'
import catalogUrl from '../data/generated/medications.json?url'
import { PaRequest } from './PaRequest'

type Catalog = Record<string, string[]>
export type CompareStart = { drug: string; guideId: string; classId: string; payerId: string }

function useGuideLoad(id: string) {
  const [load, setLoad] = useState<{ id: string; guide?: GuideView; failed?: boolean }>()
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let current = true
    setLoad(undefined)
    if (id)
      loadGuideView(id).then(
        (guide) => {
          if (current) setLoad({ id, guide })
        },
        () => {
          if (current) setLoad({ id, failed: true })
        },
      )
    return () => {
      current = false
    }
  }, [id, attempt])
  return { ...(load?.id === id ? load : {}), retry: () => setAttempt((n) => n + 1) }
}

function MedicationPicker({
  names,
  selected,
  onPick,
}: {
  names: string[]
  selected: string
  onPick: (label: string) => void
}) {
  const id = useId()
  const [query, setQuery] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [limit, setLimit] = useState(50)
  const needle = (query ?? '').trim().toLowerCase()
  const matches = useMemo(
    () => (needle ? names.filter((n) => n.toLowerCase().includes(needle)) : names),
    [names, needle],
  )
  const close = () => {
    setOpen(false)
    setQuery(null)
    setActive(-1)
    setLimit(50)
  }
  const choose = (name: string) => {
    close()
    onPick(name)
  }
  useEffect(() => {
    if (open && active >= 0) document.getElementById(id + active)?.scrollIntoView?.({ block: 'nearest' })
  }, [open, active, id])
  return (
    <div
      className="med-picker"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) close()
      }}
    >
      <label htmlFor={id}>Medication</label>
      <div className="med-input">
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={id + '-list'}
          aria-activedescendant={open && active >= 0 ? id + active : undefined}
          autoComplete="off"
          placeholder="Type or select a medication"
          value={query ?? selected}
          onClick={(e) => {
            e.currentTarget.select()
            setOpen(true)
          }}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            setQuery(e.target.value)
            setLimit(50)
            setOpen(true)
            setActive(-1)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              setOpen(true)
              if (!matches.length) return
              const next = Math.max(0, Math.min(matches.length - 1, active + (e.key === 'ArrowUp' ? -1 : 1)))
              setLimit((n) => Math.max(n, next + 1))
              setActive(next)
            }
            if (e.key === 'Enter' && open) {
              e.preventDefault()
              const hit = matches[active] ?? (matches.length === 1 ? matches[0] : undefined)
              if (hit) choose(hit)
            }
          }}
        />
        <button
          type="button"
          aria-label="Browse medications"
          aria-expanded={open}
          onClick={() => {
            document.getElementById(id)?.focus()
            if (open) close()
            else {
              setQuery(null)
              setOpen(true)
            }
          }}
        >
          ⌄
        </button>
      </div>
      <div className="med-menu" hidden={!open}>
        <div role="listbox" id={id + '-list'} aria-label="Medication options">
          {matches.slice(0, limit).map((name, i) => (
            <div
              key={name}
              role="option"
              id={id + i}
              aria-selected={selected === name}
              className={i === active ? 'active' : ''}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(name)}
            >
              {name}
            </div>
          ))}
        </div>
        {!matches.length && <p role="status">No matching entry. Try a brand or generic name.</p>}
        {matches.length > limit && (
          <button type="button" onClick={() => setLimit((n) => n + 50)}>
            Show more medications
          </button>
        )}
      </div>
    </div>
  )
}

function Coverage({
  guide,
  classId,
  payerId,
  drug,
  actions = false,
}: {
  guide: GuideView
  classId: string
  payerId: string
  drug: string
  actions?: boolean
}) {
  const payer = guide.getPayer(payerId),
    record = guide.getRecord(payerId, classId),
    drugClass = guide.getClass(classId)
  const [opened, setOpened] = useState<number | null>(null)
  if (!record || !payer || !drugClass) return <p>No record for this plan and class.</p>
  if (record.verification === 'example') return <p>This guide has an illustrative record only. Coverage is unknown.</p>
  const rows = findings(record, drug)
  if (!rows.length) return <p>No exact listing in this guide. Coverage is unknown.</p>
  return (
    <GuideProvider value={guide}>
      {rows.map((row, i) => (
        <div className="med-finding" key={i}>
          <p>
            <strong>{row.label}</strong>
            {row.detail && <> · {row.detail}</>}
          </p>
          <p>
            {record.verification === 'verified' ? 'Verified' : 'Partially verified'}{' '}
            · Reviewed {record.lastReviewed}
          </p>
          {record.verification !== 'verified' && <p>{record.verificationNote}</p>}
          <p>
            {guide.resolveSources(row.sources).map((s) => (
              <a key={s.id} href={s.url} target="_blank" rel="noreferrer">
                {s.label} ↗{' '}
              </a>
            ))}
          </p>
          {actions && row.item && (
            <>
              <button type="button" onClick={() => setOpened(opened === i ? null : i)}>
                {opened === i ? 'Hide worksheet' : 'Prepare request'}
              </button>
              {opened === i && (
                <PaRequest record={record} item={row.item} payer={payer} drugClass={drugClass} />
              )}
            </>
          )}
        </div>
      ))}
    </GuideProvider>
  )
}

function ComparePlan({ start, second }: { start: CompareStart; second: boolean }) {
  const source = guideOptions.find((g) => g.id === start.guideId)!
  const [id, setId] = useState(start.guideId)
  const [pick, setPick] = useState('')
  const { guide, failed, retry } = useGuideLoad(id)
  const fallback = guide?.payers.find(
    (p) => id === start.guideId && (second ? p.id !== start.payerId : p.id === start.payerId),
  )
  const payer = guide?.getPayer(pick) ?? fallback ?? guide?.payers[0]
  const num = second ? 'Second' : 'First'
  return (
    <section className="med-card">
      <label>
        {num} state
        <select
          aria-label={num + ' state'}
          value={id}
          onChange={(e) => {
            setId(e.target.value)
            setPick('')
          }}
        >
          {guideOptions
            .filter((g) => g.topicId === source.topicId)
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.region}
              </option>
            ))}
        </select>
      </label>
      {failed ? (
        <p role="alert">
          Guide could not load. <button onClick={retry}>Retry</button>
        </p>
      ) : !guide ? (
        <p role="status">Loading guide…</p>
      ) : (
        payer && (
          <>
            <label>
              {num} plan
              <select aria-label={num + ' plan'} value={payer.id} onChange={(e) => setPick(e.target.value)}>
                {guide.payers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <p>{payer.productName}</p>
            <Coverage guide={guide} classId={start.classId} payerId={payer.id} drug={start.drug} />
          </>
        )
      )}
    </section>
  )
}
export function PlanComparison({ start, back }: { start: CompareStart; back: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  return (
    <section className="med-workspace" aria-label="Plan comparison">
      <h2 ref={heading} tabIndex={-1}>
        Compare plans
      </h2>
      <p>{start.drug}</p>
      <p>
        {guideOptions.find((g) => g.id === start.guideId)?.topic} · {start.classId} · Matches use the listed
        name and strength when available. Unlisted or differently worded entries have unknown coverage.
      </p>
      <div className="med-columns">
        <ComparePlan start={start} second={false} />
        <ComparePlan start={start} second />
      </div>
      <button onClick={back}>Back to lookup</button>
    </section>
  )
}

export function MedicationLookup({ compare }: { compare: (start: CompareStart) => void }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0)
  const [drug, setDrug] = useState(''),
    [scope, setScope] = useState(''),
    [plan, setPlan] = useState('')
  useEffect(() => {
    const ctrl = new AbortController()
    setFailed(false)
    fetch(catalogUrl, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw Error()
        return r.json()
      })
      .then((c: Catalog) => {
        if (!ctrl.signal.aborted) setCatalog(c)
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setFailed(true)
      })
    return () => ctrl.abort()
  }, [attempt])
  const names = useMemo(() => Object.keys(catalog ?? {}), [catalog])
  const scopes = catalog?.[drug] ?? []
  const selected = scopes.includes(scope) ? scope : (scopes[0] ?? '')
  const [id = '', classId = ''] = selected.split('/')
  const { guide, failed: guideFailed, retry } = useGuideLoad(id)
  const matched =
    guide?.payers.filter((p) => {
      const r = guide.getRecord(p.id, classId)
      return r && findings(r, drug).length > 0
    }) ?? []
  const scopeLabel = (s: string) => {
    const [g, c] = s.split('/')
    const summary = guideOptions.find((x) => x.id === g)
    return summary ? `${summary.region} · ${summary.topic} · ${c}` : s
  }
  return (
    <section className="med-workspace" aria-label="Medication lookup">
      <h2>Find a medication</h2>
      {failed ? (
        <p role="alert">
          Medication list could not load. <button onClick={() => setAttempt((n) => n + 1)}>Retry</button>
        </p>
      ) : !catalog ? (
        <p role="status">Loading medications…</p>
      ) : (
        <MedicationPicker
          names={names}
          selected={drug}
          onPick={(v) => {
            setDrug(v)
            setScope('')
            setPlan('')
          }}
        />
      )}
      {drug && (
        <>
          <label>
            State and prescribing topic
            <select
              aria-label="State and prescribing topic"
              value={selected}
              onChange={(e) => {
                setScope(e.target.value)
                setPlan('')
              }}
            >
              {scopes.map((s) => (
                <option key={s} value={s}>
                  {scopeLabel(s)}
                </option>
              ))}
            </select>
          </label>
          {guideFailed ? (
            <p role="alert">
              Guide could not load. <button onClick={retry}>Retry</button>
            </p>
          ) : !guide ? (
            <p role="status">Loading guide…</p>
          ) : (
            <>
              <label>
                Insurance plan
                <select aria-label="Insurance plan" value={plan} onChange={(e) => setPlan(e.target.value)}>
                  <option value="">All listed plans</option>
                  {guide.payers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={() => compare({ drug, guideId: id, classId, payerId: plan || matched[0]!.id })}
                disabled={!matched.length && !plan}
              >
                Compare plans
              </button>
              {(plan ? guide.payers.filter((p) => p.id === plan) : matched).map((p) => (
                <article className="med-card" key={[selected, drug, p.id].join('|')}>
                  <h3>{p.productName || p.name}</h3>
                  <Coverage guide={guide} classId={classId} payerId={p.id} drug={drug} actions />
                </article>
              ))}
            </>
          )}
        </>
      )}
    </section>
  )
}
