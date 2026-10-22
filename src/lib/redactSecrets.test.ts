import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { redactSecrets } from '../../scripts/redact-secrets.mjs'

// Security regression (Codex review, PR 23): Box preview pages embed a read token and a request
// token; archived copies must never keep them.
describe('redactSecrets', () => {
  it('masks Box preview read tokens and token-named values, keeping byte length', () => {
    const page = '{"preview_prefetch_token_map":{"2493105166851":{"read":"1!AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"}},"requestToken":"deadbeefdeadbeefdeadbeef"}'
    const { buf, found } = redactSecrets(Buffer.from(page))
    const out = buf.toString()
    expect(out).not.toMatch(/1!AbCd|deadbeef/)
    expect(out.length).toBe(page.length)
    expect(found.map((f) => f.name)).toEqual(['Box preview read token', 'token-named assignment'])
  })
  it('leaves no unredacted secrets in committed source archives', () => {
    const dir = join(process.cwd(), 'sources')
    const leaks = readdirSync(dir)
      .filter((f) => /\.(html?|json|txt)$/.test(f) && f !== 'manifest.json')
      .filter((f) => redactSecrets(readFileSync(join(dir, f))).found.length > 0)
    expect(leaks).toEqual([])
  })
})
