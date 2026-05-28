import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import type { ExtractedPaperContent, ExtractedPaperPage } from '../../shared/paper'
import { extractFormulaCandidates } from './formulas'
import type { PdfTextItemLike } from './formulas/types'

export async function extractPdfContent(fileUrl: string): Promise<ExtractedPaperContent> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const filePath = fileURLToPath(fileUrl)
  const buf = readFileSync(filePath)
  const data = new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  const doc = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise

  const pages: ExtractedPaperPage[] = []
  const pageInputs: { page: number; text: string; items: PdfTextItemLike[] }[] = []

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const items = content.items as PdfTextItemLike[]
    const text = items.map((item) => item.str ?? '').join(' ')
    pages.push({ page: i, text })
    pageInputs.push({ page: i, text, items })
  }

  const formulaCandidates = extractFormulaCandidates(pageInputs)

  return { pages, formulaCandidates }
}
