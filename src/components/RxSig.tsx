import { useEffect, useState } from 'react'
import type { FormularyRecord } from '../types/formulary'
import { buildSig } from '../lib/sig'
import { useCopyToClipboard } from '../lib/clipboard'

/**
 * The Rx sig as an editable starting point (doses vary by patient), with a copy button and a
 * plain-language reading. Editable because an expert tweaks the dose before pasting into Epic.
 */
export function RxSig({ record }: { record: FormularyRecord }) {
  const initial = buildSig(record)
  const [value, setValue] = useState(initial)
  const { copied, copy, reset } = useCopyToClipboard()

  // Reset to the new default whenever the selected record changes.
  useEffect(() => {
    setValue(initial)
    reset()
  }, [initial])

  return (
    <div>
      <p className="sig__patient">Clinician copy text. Edit before prescribing.</p>
      <div className="sig__row">
        <textarea
          className="sig__field"
          rows={2}
          value={value}
          spellCheck={false}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Editable prescription text"
        />
        <button
          type="button"
          className={`copy-btn${copied ? ' copy-btn--done' : ''}`}
          onClick={() => copy(value)}
          aria-label={`Copy sig: ${value}`}
        >
          <span aria-hidden="true">{copied ? '✓ Copied' : 'Copy'}</span>
          <span className="sr-only" aria-live="polite">
            {copied ? 'Copied to clipboard' : ''}
          </span>
        </button>
      </div>
      <p className="sig__note">
        This is starter text for a clinician to adjust. Follow the final prescription label.
      </p>
    </div>
  )
}
