export const SECRET_PATTERNS: { name: string; re: RegExp; replacer: (...args: string[]) => string }[]
export function redactSecrets(buf: Buffer): { buf: Buffer; found: { name: string; count: number }[] }
