import type { NodeUnderstandingMemory } from '../../../../shared/kg4'
import TruncatedText from './TruncatedText'

function MemoryRecordInspector({ memory, onOpenFieldMemory }: { memory: NodeUnderstandingMemory; onOpenFieldMemory: () => void }) {
  const note = memory.userEditedUnderstandingNote || memory.generatedUnderstandingNote || memory.aiFeedbackSummary
  return (
    <div className="ai-context-card">
      <span className="eyebrow">Memory Record Inspector</span>
      <h3>{memory.nodeLabel}</h3>
      <span className="ai-context-badge">{memory.aiFeedbackType}</span>
      <TruncatedText text={note} />
      <div className="ai-context-details">
        <div><strong>Reuse signals</strong><p>{[...memory.topicTags, ...memory.methodFamilyTags].slice(0, 6).join(', ') || '暂无标签'}</p></div>
        <div><strong>Related papers</strong><p>{memory.relatedPaperIds.length ? memory.relatedPaperIds.join(', ') : '暂无关联论文'}</p></div>
        <div><strong>Updated</strong><p>{new Date(memory.updatedAt || memory.createdAt).toLocaleString()}</p></div>
      </div>
      <div className="ai-context-actions">
        <button className="stage-btn stage-btn--secondary" onClick={onOpenFieldMemory}>定位到 Field Memory</button>
      </div>
    </div>
  )
}

export default MemoryRecordInspector
