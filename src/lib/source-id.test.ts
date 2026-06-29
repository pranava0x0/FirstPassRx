import { describe, expect, it } from 'vitest'
// @ts-expect-error Node-only archive helper intentionally has no browser TypeScript declaration.
import { stateSourceId } from '../../scripts/source-id.mjs'

describe('state source archive ids', () => {
  it('does not collide when URLs share the same trailing path', () => {
    const employer = stateSourceId('VA', 'https://example.com/employer/prescription-drug-lists')
    const marketplace = stateSourceId('VA', 'https://example.com/marketplace/prescription-drug-lists')
    expect(employer).not.toBe(marketplace)
  })

  it('is stable for repeat archival runs', () => {
    const url = 'https://example.com/formulary.pdf'
    expect(stateSourceId('MD', url)).toBe(stateSourceId('MD', url))
  })
})
