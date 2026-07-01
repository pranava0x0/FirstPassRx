import { useEffect, useRef, useState } from 'react'
import type { ClassMeta, FormularyRecord, PaItem, PayerMeta, Reference } from '../types/formulary'
import { useGuide } from '../lib/formulary'
import { goodRxUrl, costPlusUrl, goodRxPrice, costPlusPrice, pricesCapturedAt } from '../lib/cash'
import { buildAppealLetter } from '../lib/appealLetter'
import { copyToClipboard } from '../lib/clipboard'
import { SourceLink } from './SourceLink'
import { CashPriceBoxes } from './CashPriceBoxes'

/** Tag an option by what it is, read from the drug text / coverage note. */
function roleOf(text: string): string {
  const t = text.toLowerCase()
  if (t.includes('biosimilar')) return 'Biosimilar'
  if (t.includes('generic')) return 'Generic'
  if (t.includes('combo') || t.includes('combination')) return 'Combination'
  return 'Alternative'
}

interface Row {
  drug: string
  role: string
  cost: string
  cashName: string
  type: 'alternative' | 'barrier'
  sourceIds: string[]
  paItem?: PaItem
}

/**
 * Renders all other options besides the first-pass recommendation.
 * Shows covered alternatives and coverage barriers in a stack of styled cards.
 */
function cleanNote(note: string): string {
  return note
    .replace(/\bno PDL PA\b/gi, 'no prior authorization required')
    .replace(/\bno PA\b/gi, 'no prior authorization required')
}

export function PrescribeOptions({
  record,
  source,
  payer,
}: {
  record: FormularyRecord
  source?: Reference
  payer: PayerMeta
}) {
  const guide = useGuide()
  const drugClass = guide.getClass(record.classId)

  const alternates: Row[] = (record.alternatives ?? []).map((alt) => ({
    drug: alt.drug,
    role: roleOf(`${alt.drug} ${alt.note ?? ''}`),
    cost: alt.note ?? 'covered',
    cashName: alt.drug,
    type: 'alternative',
    sourceIds: alt.sourceIds,
  }))

  const barriers: Row[] = (record.paRequired ?? []).map((rej) => ({
    drug: rej.drug,
    role: rej.outcome === 'pa' ? 'PA Required' : rej.outcome === 'step' ? 'Step Therapy' : 'Excluded',
    cost: rej.reason,
    cashName: rej.drug,
    type: 'barrier',
    sourceIds: rej.sourceIds,
    paItem: rej,
  }))

  const rows = [...alternates, ...barriers]

  if (rows.length === 0) {
    return null
  }

  return (
    <section className="rx-options-stack" aria-label="Prescribing options">
      <div className="rx-options-stack__header">
        <h4 className="rx-options-stack__title">
          Alternatives
          {source ? (
            <>
              {' · '}
              <SourceLink source={source} />
            </>
          ) : null}
        </h4>
      </div>
      
      <div className="rx-cards-list">
        {rows.map((row) => {
          const costPlusHref = costPlusUrl(row.cashName)
          const goodRxPoint = row.type === 'alternative' ? goodRxPrice(row.cashName) : null
          const costPlusPoint = row.type === 'alternative' ? costPlusPrice(row.cashName) : null
          const capturedAt = pricesCapturedAt(row.cashName)
          return (
            <div key={row.drug} className={`rx-option-card is-${row.type}`}>
            <div className="rx-option-card__header">
              <h5 className="rx-option-card__name">{row.drug}</h5>
              <span className={`rx-tag rx-tag--${row.type}`}>{row.role}</span>
            </div>
            <p className="rx-option-card__cost">
              <strong>Coverage:</strong> {cleanNote(row.cost)}
            </p>
            {row.type === 'alternative' ? (
              <CashPriceBoxes
                goodRxHref={goodRxUrl(row.cashName)}
                goodRx={goodRxPoint}
                costPlusHref={costPlusHref}
                costPlus={costPlusPoint}
                capturedAt={capturedAt}
              />
            ) : (
              <div className="rx-option-card__footer">
                <span className="rx-option-card__label">Details:</span>
                <span className="rx-option-card__links">
                  {guide.resolveSources(row.sourceIds).map((src) => (
                    <a
                      key={src.id}
                      className="panel-cite"
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={src.label}
                    >
                      source &#8599;
                    </a>
                  ))}
                </span>
              </div>
            )}
            {row.type === 'barrier' && row.paItem && drugClass ? (
              <AppealAction record={record} item={row.paItem} payer={payer} drugClass={drugClass} />
            ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Toggle that reveals a pre-filled, editable, copyable PA appeal letter for one blocked drug. */
function AppealAction({
  record,
  item,
  payer,
  drugClass,
}: {
  record: FormularyRecord
  item: PaItem
  payer: PayerMeta
  drugClass: ClassMeta
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(() => buildAppealLetter(record, item, payer, drugClass))
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy() {
    const ok = await copyToClipboard(value)
    if (!ok) return
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="appeal">
      <button
        type="button"
        className="appeal-btn"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide appeal letter' : 'Draft appeal letter'}
        <span className="appeal-btn__chevron" aria-hidden="true">
          &#9662;
        </span>
      </button>
      {open ? (
        <div className="appeal-panel">
          <p className="appeal-panel__note">
            Pre-filled from this cell's coverage data. Patient and prescriber fields are blank —
            fill those in before sending.
          </p>
          <textarea
            className="appeal-panel__field"
            rows={14}
            value={value}
            spellCheck={false}
            onChange={(e) => setValue(e.target.value)}
            aria-label={`Editable PA appeal letter for ${item.drug}`}
          />
          <button
            type="button"
            className={`copy-btn${copied ? ' copy-btn--done' : ''}`}
            onClick={copy}
            aria-label={`Copy appeal letter for ${item.drug}`}
          >
            <span aria-hidden="true">{copied ? '✓ Copied' : 'Copy letter'}</span>
            <span className="sr-only" aria-live="polite">
              {copied ? 'Copied to clipboard' : ''}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
