import type { FormulaCandidate } from '../../../shared/paper'
import type { FormulaExtractionPageInput, FormulaExtractor } from './types'

let globalIndex = 0

function nextId(page: number, source: FormulaCandidate['source']): string {
  return `f-${page}-${source}-${++globalIndex}`
}

function resetGlobalIndex(): void {
  globalIndex = 0
}

/**
 * 基于启发式规则生成 LaTeX hint。
 * 这是"公式候选"而非最终 LaTeX — 只能替换已知 Unicode 符号，
 * 无法还原分式、上下标、矩阵等复杂结构。
 */
function toLatexHint(text: string): string | undefined {
  const normalized = text
    .replace(/∆/g, '\\Delta ')
    .replace(/Δ/g, '\\Delta ')
    .replace(/θ/g, '\\theta')
    .replace(/ϕ/g, '\\phi')
    .replace(/Ω/g, '\\Omega')
    .replace(/Ψ/g, '\\Psi')
    .replace(/∈/g, ' \\in ')
    .replace(/≤/g, ' \\le ')
    .replace(/≥/g, ' \\ge ')
    .replace(/×/g, ' \\times ')
    .replace(/−/g, '-')
    .replace(/argmin/g, '\\arg\\min')
    .replace(/\s+/g, ' ')
    .trim()

  const symbolCount = (normalized.match(/[=+\-*/^_\\|<>]/g) ?? []).length
  return symbolCount >= 2 ? `$${normalized}$` : undefined
}

/** 从页面纯文本中提取公式候选 */
function extractFromText(page: number, pageText: string): FormulaCandidate[] {
  const candidates = new Map<string, FormulaCandidate>()
  const patterns = [
    /[^.。;；]{0,80}(?:argmin|softmax|LoRA|∆W|ΔW|W\s*[′']|L\s*SFT|h\s*=|θ|ϕ|Ω|Ψ|\b[A-Z]\^?[TB]?\b\s*[=+−-])[^.。;；]{0,120}/g,
    /[^.。;；]{0,80}(?:\([0-9]+\)|[A-Za-z]\s*\([^)]{1,80}\)\s*=|\|[^|]{1,80}\|)[^.。;；]{0,120}/g
  ]

  for (const pattern of patterns) {
    for (const match of pageText.matchAll(pattern)) {
      const rawText = match[0].replace(/\s+/g, ' ').trim().slice(0, 220)
      const symbolCount = (rawText.match(/[=+−\-×*/^_∈∆ΔθϕΩΨ|]/g) ?? []).length
      if (rawText.length >= 20 && symbolCount >= 2) {
        candidates.set(rawText, {
          id: nextId(page, 'pdf-text'),
          page,
          rawText,
          latexHint: toLatexHint(rawText),
          confidence: symbolCount >= 4 ? 0.45 : 0.3,
          source: 'pdf-text',
          extractor: 'heuristic-text-v1'
        })
      }
    }
  }

  return [...candidates.values()].slice(0, 4)
}

/** 从 PDF text items（按行分组）提取公式候选 */
function extractFromRows(items: FormulaExtractionPageInput['items'], page: number): FormulaCandidate[] {
  const rows = new Map<number, { x: number; text: string }[]>()

  for (const item of items) {
    if (!item.str?.trim() || !Array.isArray(item.transform)) continue
    const x = item.transform[4] ?? 0
    const y = Math.round(item.transform[5] ?? 0)
    const row = rows.get(y) ?? []
    row.push({ x, text: item.str })
    rows.set(y, row)
  }

  const candidates: FormulaCandidate[] = []
  for (const [y, row] of rows) {
    const rawText = row
      .sort((a, b) => a.x - b.x)
      .map((p) => p.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    const symbolCount = (rawText.match(/[=+−×*/^_∈∆ΔθϕΩΨΣ∑√|<>≤≥]/g) ?? []).length
    const hasMathSymbol = /[=+−×*/^_∈∆ΔθϕΩΨΣ∑√|<>≤≥]/.test(rawText)
    const mathWordCount = (
      rawText.match(/\b(?:argmin|softmax|loss|rank|LoRA|SFT|head|emb|MLP|T2L)\b/gi) ?? []
    ).length

    if (rawText.length >= 12 && hasMathSymbol && (symbolCount >= 2 || mathWordCount >= 1)) {
      candidates.push({
        id: nextId(page, 'pdf-row'),
        page,
        y,
        rawText: rawText.slice(0, 240),
        latexHint: toLatexHint(rawText),
        confidence: symbolCount >= 4 ? 0.55 : 0.35,
        source: 'pdf-row',
        extractor: 'heuristic-row-v1'
      })
    }
  }

  return candidates.slice(0, 8)
}

export const heuristicFormulaExtractor: FormulaExtractor = {
  id: 'heuristic-v1',

  extract(input: FormulaExtractionPageInput): FormulaCandidate[] {
    const textCandidates = extractFromText(input.page, input.text)
    const rowCandidates = extractFromRows(input.items, input.page)
    return [...textCandidates, ...rowCandidates]
  }
}

export { resetGlobalIndex }
