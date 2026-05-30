import MathText from '../MathText'

function TruncatedText({ text }: { text: string | undefined }) {
  if (!text) return null
  const value = text.length > 180 ? `${text.slice(0, 180)}...` : text
  return <p><MathText text={value} /></p>
}

export default TruncatedText
