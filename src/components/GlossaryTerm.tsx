import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useGuide } from '../lib/formulary'

/**
 * A clinical term with a dotted-underline affordance. Tap/focus opens a plain-language
 * definition popover — serves the confused patient without cluttering the expert's scan.
 * Keyboard-reachable, Esc-dismissable, wired with aria for screen readers.
 * Resolves the term against the active guide's glossary.
 */
export function GlossaryTerm({ match, children }: { match: string; children: ReactNode }) {
  const { lookupGlossary } = useGuide()
  const term = lookupGlossary(match)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const popId = useId()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  if (!term) return <>{children}</>

  return (
    <span className="gloss-wrap" ref={wrapRef}>
      <button
        type="button"
        className="gloss"
        aria-expanded={open}
        aria-describedby={open ? popId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {children}
      </button>
      {open && (
        <span className="gloss-pop" role="tooltip" id={popId}>
          <span className="gloss-pop__term">{term.term}</span>
          <span className="gloss-pop__def">{term.definition}</span>
        </span>
      )}
    </span>
  )
}
