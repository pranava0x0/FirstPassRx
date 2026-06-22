/** Persistent reference-only notice. This is content, not chrome — it never dismisses. */
export function Disclaimer() {
  return (
    <aside className="disclaimer" role="note" aria-label="Data disclaimer">
      <span className="disclaimer__label">Reference only</span>
      <span>
        Confirm with the plan before prescribing.{' '}
        <a
          href="https://github.com/pranava0x0/FirstPassRx/blob/main/data-sources.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          Sources
        </a>
        .
      </span>
    </aside>
  )
}
