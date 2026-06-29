import type { Reference } from '../types/formulary'

/**
 * A compact "↗ source" link that ties a coverage claim back to the cited formulary/policy.
 * Rendered next to a section header; renders nothing when no source is available.
 */
export function SourceLink({ source }: { source?: Reference }) {
  if (!source) return null
  return (
    <a
      className="panel-cite"
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      title={source.label}
    >
      source &#8599;
    </a>
  )
}
