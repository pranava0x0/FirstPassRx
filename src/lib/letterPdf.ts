// PDF download for the appeal letter. Builds a formal serif letter document with jsPDF
// and saves it straight to disk — no print dialog. jsPDF is loaded via dynamic import()
// only when the user clicks Export PDF, so it stays out of the main bundle.
import type { jsPDF } from 'jspdf'

const MARGIN = 72 // 1in in points
const FONT_SIZE = 12
const LINE_HEIGHT = FONT_SIZE * 1.45
const PARAGRAPH_GAP = FONT_SIZE * 0.9

/**
 * jsPDF's standard fonts encode WinAnsi (cp1252) — anything outside it (✓, CJK, emoji) is
 * silently mangled into garbage bytes in the PDF. The letter is free-form user-editable text,
 * so replace unsupported code points with '?' rather than ship a corrupted document.
 * Covers ASCII plus the cp1252 extras the template itself uses (em dash, curly quotes, ·, °).
 */
const WIN_ANSI_EXTRAS = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ')

export function toWinAnsi(text: string): string {
  return [...text].map((ch) => (ch.charCodeAt(0) < 0x80 || WIN_ANSI_EXTRAS.has(ch) ? ch : '?')).join('')
}

/** Sanitize a letter title into a safe download filename (no extension). */
export function pdfFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'appeal-letter'}.pdf`
}

/**
 * Lay the letter text into a jsPDF document: blank lines separate paragraphs, single
 * newlines inside a paragraph stay as line breaks (address/RE blocks), long lines wrap
 * at the content width, and pages break at the bottom margin. Exported separately from
 * downloadLetterPdf so tests can assert on the generated document.
 */
export function buildLetterPdf(doc: jsPDF, letterText: string): jsPDF {
  doc.setFont('times', 'normal')
  doc.setFontSize(FONT_SIZE)
  // The caller's format decides the page box — derive, don't duplicate.
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - 2 * MARGIN
  // doc.text's y is the baseline, so start one font-size below the margin or ascenders
  // poke into it.
  const top = MARGIN + FONT_SIZE
  let y = top

  for (const paragraph of toWinAnsi(letterText).split(/\n{2,}/)) {
    for (const sourceLine of paragraph.split('\n')) {
      const wrapped: string[] = sourceLine === '' ? [''] : doc.splitTextToSize(sourceLine, contentWidth)
      for (const line of wrapped) {
        if (y > pageHeight - MARGIN) {
          doc.addPage()
          y = top
        }
        doc.text(line, MARGIN, y)
        y += LINE_HEIGHT
      }
    }
    y += PARAGRAPH_GAP
  }
  return doc
}

/** Generate the letter PDF and save it to the user's disk as a normal download. */
export async function downloadLetterPdf(letterText: string, title: string): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  buildLetterPdf(doc, letterText)
  doc.save(pdfFilename(title))
}
