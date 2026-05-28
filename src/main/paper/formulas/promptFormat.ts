import type { FormulaCandidate } from '../../../shared/paper'

export function formatFormulaCandidatesForPrompt(candidates: FormulaCandidate[]): string {
  if (candidates.length === 0) return ''
  const lines = [
    '',
    '[Formula candidates extracted from PDF - reference hints, not final LaTeX]'
  ]
  for (const c of candidates.slice(0, 40)) {
    const location = `Page ${c.page}${c.y !== undefined ? `, y=${Math.round(c.y)}` : ''}`
    const meta = `source=${c.source}, extractor=${c.extractor}${c.confidence !== undefined ? `, confidence=${c.confidence.toFixed(2)}` : ''}`
    lines.push(`${location} (${meta}): ${c.rawText}`)
    if (c.latexHint) lines.push(`LaTeX hint: ${c.latexHint}`)
  }
  return lines.join('\n')
}
