import katex from 'katex'
import { Fragment } from 'react'

interface MathTextProps {
  text: string
  displayMode?: boolean
}

function renderMixedText(text: string): (string | { type: 'math'; formula: string; display: boolean })[] {
  const parts: (string | { type: 'math'; formula: string; display: boolean })[] = []
  const regex = /(\$\$[\s\S]*?\$\$|\$[^\$]*?\$)/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index))
    }
    const raw = match[0]
    if (raw.startsWith('$$') && raw.endsWith('$$')) {
      parts.push({ type: 'math', formula: raw.slice(2, -2), display: true })
    } else {
      parts.push({ type: 'math', formula: raw.slice(1, -1), display: false })
    }
    last = match.index + raw.length
  }
  if (last < text.length) {
    parts.push(text.slice(last))
  }
  return parts
}

function MathText({ text, displayMode }: MathTextProps) {
  const parts = renderMixedText(text)

  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === 'string') {
          return <Fragment key={i}>{part}</Fragment>
        }
        try {
          const html = katex.renderToString(part.formula, {
            displayMode: displayMode ?? part.display,
            throwOnError: false,
            trust: true
          })
          return (
            <span
              key={i}
              className={part.display ? 'math-block' : 'math-inline'}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )
        } catch {
          return <span key={i} style={{ color: '#e94560' }}>{`$${part.formula}$`}</span>
        }
      })}
    </>
  )
}

export default MathText
