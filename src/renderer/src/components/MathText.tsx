import katex from 'katex'
import { Fragment } from 'react'
import { segmentMathText } from './mathTextSegments'

interface MathTextProps {
  text: string
  displayMode?: boolean
}

function MathText({ text, displayMode }: MathTextProps) {
  const parts = segmentMathText(text, { displayMode })

  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === 'string') {
          return <Fragment key={i}>{part}</Fragment>
        }
        try {
          const html = katex.renderToString(part.formula.slice(0, 500), {
            displayMode: displayMode ?? part.display,
            throwOnError: false,
            trust: false
          })
          return (
            <span
              key={i}
              className={part.display ? 'math-block' : 'math-inline'}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )
        } catch {
          return <span key={i} className="math-error">{`$${part.formula}$`}</span>
        }
      })}
    </>
  )
}

export default MathText
