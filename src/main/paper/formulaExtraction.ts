import type { FormulaCandidate } from '../../shared/paper'

export interface TextItemLike {
  str?: string
  transform?: number[]
}

/**
 * 基于启发式规则从文本行生成 LaTeX hint。
 * 这是"公式候选"而非最终 LaTeX — 只能替换已知 Unicode 符号，
 * 无法还原分式、上下标、矩阵等复杂结构。
 * 最终 LaTeX 应由 LLM 结合论文上下文生成。
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

export function formatFormulaCandidates(candidates: FormulaCandidate[]): string {
  return candidates
    .slice(0, 32)
    .map((c) => {
      const location = c.y === undefined ? `Page ${c.page}` : `Page ${c.page}, y=${c.y}`
      return c.latexHint
        ? `${location}: ${c.rawText}\nLaTeX hint: ${c.latexHint}`
        : `${location}: ${c.rawText}`
    })
    .join('\n')
}

export function extractFormulaCandidatesFromText(
  pageText: string,
  page: number
): FormulaCandidate[] {
  const candidates = new Map<string, FormulaCandidate>()
  const formulaPatterns = [
    /[^.。;；]{0,80}(?:argmin|softmax|LoRA|∆W|ΔW|W\s*[′']|L\s*SFT|h\s*=|θ|ϕ|Ω|Ψ|\b[A-Z]\^?[TB]?\b\s*[=+−-])[^.。;；]{0,120}/g,
    /[^.。;；]{0,80}(?:\([0-9]+\)|[A-Za-z]\s*\([^)]{1,80}\)\s*=|\|[^|]{1,80}\|)[^.。;；]{0,120}/g
  ]

  for (const pattern of formulaPatterns) {
    for (const match of pageText.matchAll(pattern)) {
      const rawText = match[0].replace(/\s+/g, ' ').trim().slice(0, 220)
      const symbolCount = (rawText.match(/[=+−\-×*/^_∈∆ΔθϕΩΨ|]/g) ?? []).length
      if (rawText.length >= 20 && symbolCount >= 2)
        candidates.set(rawText, { page, rawText, latexHint: toLatexHint(rawText) })
    }
  }

  return [...candidates.values()].slice(0, 4)
}

export function extractFormulaCandidatesFromRows(
  items: TextItemLike[],
  page: number
): FormulaCandidate[] {
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
      .map((part) => part.text)
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
        page,
        y,
        rawText: rawText.slice(0, 240),
        latexHint: toLatexHint(rawText)
      })
    }
  }

  return candidates.slice(0, 8)
}
