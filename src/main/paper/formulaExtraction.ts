export interface TextItemLike {
  str?: string
  transform?: number[]
}

export interface FormulaCandidate {
  page: number
  y?: number
  text: string
  latexHint?: string
}

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
    .map((candidate) => {
      const location = candidate.y === undefined ? `Page ${candidate.page}` : `Page ${candidate.page}, y=${candidate.y}`
      return candidate.latexHint
        ? `${location}: ${candidate.text}\nLaTeX hint: ${candidate.latexHint}`
        : `${location}: ${candidate.text}`
    })
    .join('\n')
}

export function extractFormulaCandidatesFromText(pageText: string, page: number): FormulaCandidate[] {
  const candidates = new Map<string, FormulaCandidate>()
  const formulaPatterns = [
    /[^.。;；]{0,80}(?:argmin|softmax|LoRA|∆W|ΔW|W\s*[′']|L\s*SFT|h\s*=|[A-Z]\s*[∈=]|θ|ϕ|Ω|Ψ|\b[A-Z]\^?[TB]?\b\s*[=+−-])[^.。;；]{0,120}/g,
    /[^.。;；]{0,80}(?:\([0-9]+\)|[A-Za-z]\s*\([^)]{1,80}\)\s*=|\|[^|]{1,80}\|)[^.。;；]{0,120}/g
  ]

  for (const pattern of formulaPatterns) {
    for (const match of pageText.matchAll(pattern)) {
      const text = match[0].replace(/\s+/g, ' ').trim().slice(0, 220)
      const symbolCount = (text.match(/[=+−\-×*/^_∈∆ΔθϕΩΨ|]/g) ?? []).length
      if (text.length >= 20 && symbolCount >= 2) candidates.set(text, { page, text, latexHint: toLatexHint(text) })
    }
  }

  return [...candidates.values()].slice(0, 4)
}

export function extractFormulaCandidatesFromRows(items: TextItemLike[], page: number): FormulaCandidate[] {
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
    const text = row
      .sort((a, b) => a.x - b.x)
      .map((part) => part.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    const symbolCount = (text.match(/[=+−×*/^_∈∆ΔθϕΩΨΣ∑√|<>≤≥]/g) ?? []).length
    const hasMathSymbol = /[=+−×*/^_∈∆ΔθϕΩΨΣ∑√|<>≤≥]/.test(text)
    const mathWordCount = (text.match(/\b(?:argmin|softmax|loss|rank|LoRA|SFT|head|emb|MLP|T2L)\b/gi) ?? []).length
    if (text.length >= 12 && hasMathSymbol && (symbolCount >= 2 || mathWordCount >= 1)) {
      candidates.push({ page, y, text: text.slice(0, 240), latexHint: toLatexHint(text) })
    }
  }

  return candidates.slice(0, 8)
}
