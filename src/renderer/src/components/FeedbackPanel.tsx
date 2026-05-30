import MathText from './MathText'
import type { Kg4Feedback } from '../../../shared/kg4'

function DetailList({ title, items }: { title: string; items: unknown }) {
  const list = Array.isArray(items) ? items.filter((item): item is string => typeof item === 'string') : []
  if (!list.length) return null
  return (
    <section className="node-detail__section">
      <h4>{title}</h4>
      <ul className="node-detail__list">
        {list.map((item, index) => <li key={`${title}-${index}`}><MathText text={item} /></li>)}
      </ul>
    </section>
  )
}

interface FeedbackPanelProps {
  feedback: Kg4Feedback | null
}

function FeedbackPanel({ feedback }: FeedbackPanelProps) {
  if (!feedback) return null
  if (feedback.type === 'remedial') {
    return (
      <div className="kg4-feedback kg4-feedback--remedial">
        <span>Remedial Lesson</span>
        <strong>{feedback.missingPrerequisite}</strong>
        <p>{feedback.whyItMattersForCurrentNode}</p>
        <p>{feedback.shortExplanation}</p>
        {feedback.example && <p><b>例子：</b>{feedback.example}</p>}
        <p><b>检查问题：</b>{feedback.checkQuestion}</p>
      </div>
    )
  }
  return (
    <div className="kg4-feedback kg4-feedback--reflective">
      <span>Reflective Feedback</span>
      <DetailList title="你抓住了什么" items={feedback.strengths} />
      <DetailList title="还缺哪些比较维度" items={feedback.missingDimensions} />
      <DetailList title="可能的反驳" items={feedback.possibleCounterArguments} />
      <DetailList title="下一步问题" items={feedback.followUpQuestions} />
    </div>
  )
}

export default FeedbackPanel
