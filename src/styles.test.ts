import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Vitest stubs CSS imports (even ?raw) to empty, so read the file itself.
const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))
  if (!m) throw new Error(`no CSS rule for ${selector}`)
  return m[1]!
}

// jsdom has no layout, so these guard the declarations that keep the PA request builder inside a
// 375px phone screen. Regression: 2026-11-22, the builder was 519px wide on an iPhone because its
// grid track sized to the nowrap action buttons.
describe('PA request builder fits a phone screen', () => {
  it('uses a shrinkable grid track', () => {
    expect(rule('.pa-builder')).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/)
    expect(rule('.pa-builder')).toMatch(/min-width:\s*0/)
  })

  it('lets the sticky action bar wrap', () => {
    expect(rule('.pa-builder__actions')).toMatch(/flex-wrap:\s*wrap/)
  })
})

// The per-medication tile map must fit a 375px phone: 11 shrinkable columns, never a fixed width.
describe('medication tile map fits a phone screen', () => {
  it('uses shrinkable grid tracks and square tiles with no min-height', () => {
    expect(rule('.us-map')).toMatch(/grid-template-columns:\s*repeat\(11,\s*minmax\(0,\s*1fr\)\)/)
    expect(rule('.med-map .us-tile')).toMatch(/min-height:\s*0/)
    expect(rule('.med-map .us-tile')).toMatch(/aspect-ratio:\s*1/)
  })
  it('hides the confetti under reduced motion', () => {
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce\)\s*\{\s*\.confetti\s*\{\s*display:\s*none/)
  })
})
