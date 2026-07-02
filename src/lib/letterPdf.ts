// PDF download for the appeal letter. Builds a formal serif letter document with jsPDF
// and saves it straight to disk — no print dialog. jsPDF is loaded via dynamic import()
// only when the user clicks Export PDF, so it stays out of the main bundle.
import type { jsPDF } from 'jspdf'

// US Letter in points, 1in margins.
const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN = 72
const FONT_SIZE = 12
const LINE_HEIGHT = FONT_SIZE * 1.45
const PARAGRAPH_GAP = FONT_SIZE * 0.9

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
  const contentWidth = PAGE_WIDTH - 2 * MARGIN
  let y = MARGIN

  for (const paragraph of letterText.split(/\n{2,}/)) {
    for (const sourceLine of paragraph.split('\n')) {
      const wrapped: string[] = sourceLine === '' ? [''] : doc.splitTextToSize(sourceLine, contentWidth)
      for (const line of wrapped) {
        if (y > PAGE_HEIGHT - MARGIN) {
          doc.addPage()
          y = MARGIN
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
