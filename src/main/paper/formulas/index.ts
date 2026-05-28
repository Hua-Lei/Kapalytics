import type { FormulaCandidate } from '../../../shared/paper'
import type { FormulaExtractionPageInput, FormulaExtractor } from './types'
import { heuristicFormulaExtractor, resetGlobalIndex } from './heuristicExtractor'
export { formatFormulaCandidatesForPrompt } from './promptFormat'
export type { FormulaExtractor, FormulaExtractionPageInput } from './types'

const DEFAULT_EXTRACTORS: FormulaExtractor[] = [heuristicFormulaExtractor]

/** 归一化文本用于去重比较 */
function normalizeForDedup(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 100)
}

export function extractFormulaCandidates(
  pages: FormulaExtractionPageInput[],
  extractors: FormulaExtractor[] = DEFAULT_EXTRACTORS
): FormulaCandidate[] {
  resetGlobalIndex()

  const all: FormulaCandidate[] = []
  for (const page of pages) {
    for (const extractor of extractors) {
      all.push(...extractor.extract(page))
    }
  }

  // Deduplicate by page + normalized text, prefer higher confidence
  const seen = new Map<string, FormulaCandidate>()
  for (const c of all) {
    const key = `${c.page}:${normalizeForDedup(c.rawText)}`
    const existing = seen.get(key)
    if (!existing || (c.confidence ?? 0) > (existing.confidence ?? 0)) {
      seen.set(key, c)
    }
  }

  // Sort by page/y, cap at 40
  return [...seen.values()]
    .sort((a, b) => a.page - b.page || (a.y ?? 0) - (b.y ?? 0))
    .slice(0, 40)
}
