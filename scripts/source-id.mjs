import { createHash } from 'node:crypto'

/** Stable, collision-resistant id for state-index sources that lack their own source id. */
export function stateSourceId(stateCode, url) {
  const digest = createHash('sha256').update(url).digest('hex').slice(0, 16)
  return `state-${stateCode.toLowerCase()}-${digest}`
}
