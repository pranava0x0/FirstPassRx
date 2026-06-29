export function Disclaimer() {
  return (
    <aside className="disclaimer" role="note" aria-label="Data disclaimer">
      <span className="disclaimer__label">Reference only</span>
      <span>
        <b>Formulary first-pass</b> is the option most likely to go through under the exact insurance plan shown; it is not a clinical recommendation. Confirm coverage with the plan and clinical choices before prescribing.{' '}
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
