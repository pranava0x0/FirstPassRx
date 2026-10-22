// Byte-exact secret redaction for archived source files (used by archive-sources.mjs).
const mask = (s) => '*'.repeat(s.length)
export const SECRET_PATTERNS = [
  { name: 'Mapbox token', re: /\b(?:pk|sk)\.eyJ[A-Za-z0-9._-]{20,}/g, replacer: (match) => mask(match) },
  { name: 'Google API key', re: /\bAIzaSy[A-Za-z0-9_-]{33}\b/g, replacer: (match) => mask(match) },
  { name: 'AWS access key ID', re: /\bAKIA[0-9A-Z]{16}\b/g, replacer: (match) => mask(match) },
  { name: 'Slack token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g, replacer: (match) => mask(match) },
  {
    name: 'PEM private key',
    re: /-----BEGIN[ A-Z]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z]*PRIVATE KEY-----/g,
    replacer: (match) => mask(match),
  },
  {
    // Keeps the key name (e.g. "apiKey") and surrounding quotes/separators, masks only the value
    // itself -- character-for-character, so the assignment still looks parseable and no byte
    // length changes. Matches bare credential names (password/pass/pwd) as well as compound
    // "prefix + key/secret/token" names, and tolerates a quoted key (JSON: "apiKey": "...").
    name: 'generic key/secret/token assignment',
    re: /(["']?(?:api[_-]?key|client[_-]?secret|secret[_-]?key|access[_-]?token|password|pass|pwd)["']?)(\s*[:=]\s*["'])([A-Za-z0-9_\-.]{16,})(["'])/gi,
    replacer: (_match, keyName, sep, value, quote) => `${keyName}${sep}${mask(value)}${quote}`,
  },
  {
    // Box embedded-preview pages (IL HFS criteria are served through Box) carry a short-lived read
    // token in preview_prefetch_token_map ("read":"1!...") -- flagged by Codex review on PR 23.
    name: 'Box preview read token',
    re: /("read"\s*:\s*")(1![A-Za-z0-9_\-.!]{16,})(")/g,
    replacer: (_m, a, value, b) => `${a}${mask(value)}${b}`,
  },
  {
    // Any "...token" / "...Token" key (requestToken, csrf_token, accessToken) holding a long value.
    name: 'token-named assignment',
    re: /(["']?(?:[a-z]+[_-]?)?token["']?)(\s*[:=]\s*["'])([A-Za-z0-9_\-.!~+/=]{16,})(["'])/gi,
    replacer: (_m, keyName, sep, value, quote) => `${keyName}${sep}${mask(value)}${quote}`,
  },
  {
    // Box avatar image URLs carry a signed storage-auth value (pic_storage_auth&pic=...).
    name: 'Box pic storage auth',
    re: /(pic_storage_auth&(?:amp;)?pic=)([A-Za-z0-9_\-.!]{16,})/g,
    replacer: (_m, a, value) => `${a}${mask(value)}`,
  },
]

/** Scans+redacts in a byte-exact way (latin1 round-trips 1:1, and every replacement preserves the
 * original matched length) so binary formats like PDF aren't corrupted. Returns the redacted
 * buffer and a list of {name, count} for anything found. */
export function redactSecrets(buf) {
  let text = buf.toString('binary')
  const found = []
  for (const { name, re, replacer } of SECRET_PATTERNS) {
    let count = 0
    text = text.replace(re, (...args) => {
      count++
      return replacer(...args)
    })
    if (count > 0) found.push({ name, count })
  }
  return { buf: found.length ? Buffer.from(text, 'binary') : buf, found }
}

