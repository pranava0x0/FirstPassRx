import { describe, it, expect } from 'vitest'
import { jsPDF } from 'jspdf'
import { buildLetterPdf, pdfFilename, toWinAnsi } from './letterPdf'

function build(text: string): jsPDF {
  return buildLetterPdf(new jsPDF({ unit: 'pt', format: 'letter' }), text)
}

describe('pdfFilename', () => {
  it('slugifies the title into a safe filename', () => {
    expect(pdfFilename('Appeal letter — AirDuo RespiClick')).toBe('appeal-letter-airduo-respiclick.pdf')
  })

  it('falls back when the title has no usable characters', () => {
    expect(pdfFilename('—·—')).toBe('appeal-letter.pdf')
  })
})

describe('buildLetterPdf', () => {
  it('produces a valid single-page PDF for a short letter', () => {
    const doc = build('Dear reviewer,\n\nOne paragraph.')
    expect(doc.getNumberOfPages()).toBe(1)
    const bytes = doc.output('arraybuffer')
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  })

  it('breaks onto a second page when the letter overflows the bottom margin', () => {
    const doc = build(Array.from({ length: 60 }, (_, i) => `Paragraph ${i + 1}.`).join('\n\n'))
    expect(doc.getNumberOfPages()).toBeGreaterThan(1)
  })

  it('embeds the letter text in the document content', () => {
    // jsPDF writes uncompressed content streams by default, so page text is greppable.
    const doc = build('UNIQUE-MARKER-TOKEN appears here.')
    expect(doc.output()).toContain('UNIQUE-MARKER-TOKEN')
  })

  it('wraps long lines instead of overflowing the 1in margins', () => {
    const doc = build('word '.repeat(120).trim())
    const out = doc.output()
    // Wrapped output shows as multiple text-showing operations, one per rendered line.
    const textOps = out.match(/Tj/g) ?? []
    expect(textOps.length).toBeGreaterThan(3)
  })

  it('handles empty letter text without throwing', () => {
    const doc = build('')
    expect(doc.getNumberOfPages()).toBe(1)
  })

  it('character-breaks a single unbroken long word rather than overflowing', () => {
    const doc = build('x'.repeat(600))
    const textOps = doc.output().match(/Tj/g) ?? []
    expect(textOps.length).toBeGreaterThan(3)
  })

  it('replaces non-WinAnsi characters instead of mangling the PDF, keeping the template chars', () => {
    // Template punctuation survives; symbols outside cp1252 become '?'.
    expect(toWinAnsi('em—dash ·dot “curly” ✓check 漢字')).toBe('em—dash ·dot “curly” ?check ??')
    const doc = build('before ✓ after')
    expect(doc.output()).toContain('before ? after')
  })
})
