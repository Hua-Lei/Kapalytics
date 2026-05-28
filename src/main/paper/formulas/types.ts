import type { FormulaCandidate } from '../../../shared/paper'

export interface PdfTextItemLike {
  str?: string
  transform?: number[]
}

export interface FormulaExtractionPageInput {
  page: number
  text: string
  items: PdfTextItemLike[]
}

export interface FormulaExtractor {
  id: string
  extract(input: FormulaExtractionPageInput): FormulaCandidate[]
}
