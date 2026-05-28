import type { FormulaCandidate } from '../../../shared/paper'

export interface PdfTextItemLike {
  str?: string
  transform?: number[]
}

export interface FormulaExtractionPageInput {
  page: number
  text: string
  items: PdfTextItemLike[]
  // Future OCR extractors may use rendered page image data.
  pageImagePath?: string
  pageImageBuffer?: ArrayBuffer
}

export interface FormulaExtractor {
  id: string
  extract(input: FormulaExtractionPageInput): FormulaCandidate[]
}
