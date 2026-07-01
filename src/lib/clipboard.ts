import { useEffect, useRef, useState } from 'react'

/** Copy text to the clipboard, falling back to the legacy execCommand path when the async API is unavailable (older Safari, non-HTTPS). */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return legacyCopy(text)
  }
}

function legacyCopy(text: string): boolean {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(ta)
  return ok
}

/** Copy-with-timed-confirmation state, shared by every copy button (Rx sig, appeal letter). */
export function useCopyToClipboard(resetDelayMs = 2000) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function reset() {
    window.clearTimeout(timer.current)
    setCopied(false)
  }

  async function copy(text: string) {
    const ok = await copyToClipboard(text)
    if (!ok) return
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), resetDelayMs)
  }

  return { copied, copy, reset }
}
