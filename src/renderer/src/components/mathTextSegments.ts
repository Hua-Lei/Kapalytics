export type MathTextSegment = string | { type: 'math'; formula: string; display: boolean }

function looksLikeFormulaBody(text: string): boolean {
  const value = text.trim()
  if (!value || /\s/.test(value) && !/[=^_{}\\]/.test(value)) return false
  if (/^[A-Z]:\\/.test(value)) return false
  return /[=^_{}]|\\(?:Delta|theta|frac|sum|prod|int|alpha|beta|gamma|lambda|mu|sigma|mathbb|mathbf|hat|tilde|log|exp|argmax|argmin)/.test(value)
}

function normalizeFormula(formula: string): string {
  return formula
    .trim()
    .replace(/\\\\([A-Za-z]+)/g, '\\$1')
    .replace(/η/g, '\\eta')
    .replace(/θ/g, '\\theta')
    .replace(/α/g, '\\alpha')
    .replace(/β/g, '\\beta')
    .replace(/γ/g, '\\gamma')
    .replace(/λ/g, '\\lambda')
    .replace(/μ/g, '\\mu')
    .replace(/σ/g, '\\sigma')
    .replace(/∇/g, '\\nabla')
    .replace(/ℓ/g, '\\ell')
    .replace(/Σ/g, '\\sum')
    .replace(/\\nabla(?=\\[A-Za-z])/g, '\\nabla ')
}

function pushBareFormulaSegments(text: string, parts: MathTextSegment[]): void {
  const equationRegex = /([A-Za-z][A-Za-z0-9_]*(?:\([^，；。]*?\))?\s*=\s*[^，；。]+?)(?=，|；|。|$)/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = equationRegex.exec(text)) !== null) {
    pushBareSymbolSegments(text.slice(last, match.index), parts)
    parts.push({ type: 'math', formula: normalizeFormula(match[1]), display: false })
    last = match.index + match[1].length
  }

  pushBareSymbolSegments(text.slice(last), parts)
}

function pushBareSymbolSegments(text: string, parts: MathTextSegment[]): void {
  const symbolRegex = /(\\(?:Delta|theta|frac|sum|prod|int|alpha|beta|gamma|lambda|mu|sigma|ell|mathcal|mathbb|mathbf|nabla|hat|tilde|log|exp|argmax|argmin)(?:\{[^}]+\})?(?:_\{[^}]+\}|_[A-Za-z0-9]+)?(?:\^\{[^}]+\}|\^[A-Za-z0-9]+)?|[A-Za-zℓ]_(?:\{[^}]+\}|[A-Za-z0-9]+)(?:\^\{[^}]+\}|\^[A-Za-z0-9]+)?)/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = symbolRegex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push({ type: 'math', formula: normalizeFormula(match[1]), display: false })
    last = match.index + match[1].length
  }

  if (last < text.length) parts.push(text.slice(last))
}

export function segmentMathText(text: string, options: { displayMode?: boolean } = {}): MathTextSegment[] {
  if (!text) return ['']

  if (!/[\u4e00-\u9fa5$]/.test(text) && !/\\[\[(]/.test(text) && looksLikeFormulaBody(text)) {
    return [{ type: 'math', formula: normalizeFormula(text), display: Boolean(options.displayMode) }]
  }

  const parts: MathTextSegment[] = []
  const regex = /(\$\$[\s\S]*?\$\$|\$[^$]*?\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) pushBareFormulaSegments(text.slice(last, match.index), parts)

    const raw = match[0]
    if (raw.startsWith('$$')) {
      parts.push({ type: 'math', formula: normalizeFormula(raw.slice(2, -2)), display: true })
    } else if (raw.startsWith('$')) {
      parts.push({ type: 'math', formula: normalizeFormula(raw.slice(1, -1)), display: false })
    } else if (raw.startsWith('\\[')) {
      parts.push({ type: 'math', formula: normalizeFormula(raw.slice(2, -2)), display: true })
    } else {
      parts.push({ type: 'math', formula: normalizeFormula(raw.slice(2, -2)), display: false })
    }

    last = match.index + raw.length
  }

  if (last < text.length) pushBareFormulaSegments(text.slice(last), parts)
  return parts.length ? parts : [text]
}
