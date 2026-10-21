// Hosts whose live pages a plain Node fetch can't judge. Shared by trace-sources.mjs so a
// fetch failure or an empty JS shell from these hosts is reported as "verify in a browser"
// instead of DEAD/DRIFT noise that would hide a real drift elsewhere (issues.md, 2026-08-03).

/** Plain fetch times out, 403s, or fails TLS, while a real browser session loads the page fine. */
export const BROWSER_ONLY_HOSTS = [
  'mhdl.pharmacy.services.conduent.com',
  'massgeneralbrighamhealthplan.org',
  'medicaid.alabama.gov',
  'txvendordrug.com',
]

/** The page body is rendered client-side, so fetched HTML never contains the cited drug names. */
export const JS_RENDERED_HOSTS = ['client.formularynavigator.com', 'mhdl.pharmacy.services.conduent.com']

const matches = (host, list) => list.some((h) => host === h || host.endsWith(`.${h}`))

/** @returns {{ browserOnly: boolean, jsRendered: boolean }} */
export function hostPolicy(url) {
  let host = ''
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return { browserOnly: false, jsRendered: false }
  }
  return { browserOnly: matches(host, BROWSER_ONLY_HOSTS), jsRendered: matches(host, JS_RENDERED_HOSTS) }
}
