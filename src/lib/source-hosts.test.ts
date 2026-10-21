import { describe, expect, it } from 'vitest'
// @ts-expect-error Node-only trace helper intentionally has no browser TypeScript declaration.
import { hostPolicy, isInconclusive } from '../../scripts/source-hosts.mjs'

// Regression for issues.md 2026-08-03: trace:live reported real, unchanged pages on these hosts
// as DEAD/DRIFT because a plain fetch can't load them, burying any real drift in noise.
describe('trace-sources host policy', () => {
  it('marks the hosts a plain fetch cannot judge as browser-only', () => {
    expect(hostPolicy('https://mhdl.pharmacy.services.conduent.com/MHDL/pubtheradetail.do?id=23').browserOnly).toBe(true)
    expect(hostPolicy('https://www.massgeneralbrighamhealthplan.org/providers/pharmacy-guidelines/commercial').browserOnly).toBe(true)
    expect(hostPolicy('https://medicaid.alabama.gov/x.pdf').browserOnly).toBe(true)
  })

  it('skips content tracing on client-rendered search pages', () => {
    expect(hostPolicy('https://client.formularynavigator.com/Search.aspx?siteCode=1').jsRendered).toBe(true)
  })

  it('leaves ordinary hosts fully checked, including look-alike domains', () => {
    expect(hostPolicy('https://www.mass.gov/doc/x')).toEqual({ browserOnly: false, jsRendered: false })
    expect(hostPolicy('https://notconduent.com/x').browserOnly).toBe(false)
    expect(hostPolicy('not a url')).toEqual({ browserOnly: false, jsRendered: false })
  })

  // Codex review on PR 19: a deleted source on a browser-only host must still read as DEAD.
  it('treats only blocks, timeouts, and server errors as inconclusive, never a 404', () => {
    expect(isInconclusive(0, 'timeout')).toBe(true)
    expect(isInconclusive(403)).toBe(true)
    expect(isInconclusive(503)).toBe(true)
    expect(isInconclusive(404)).toBe(false)
    expect(isInconclusive(410)).toBe(false)
  })
})
