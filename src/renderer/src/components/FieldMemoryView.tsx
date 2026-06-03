import { useEffect } from 'react'
import { useMemories } from '../domains/memory/useMemories'
import { useWorkspace } from '../domains/workspace/useWorkspace'

function FieldMemoryView() {
  const { memories, loading, loadMemories } = useMemories()
  const { selectObject, state } = useWorkspace()
  const selectedMemoryId = state.selectedObject?.type === 'memory_record' ? state.selectedObject.id : undefined

  useEffect(() => {
    loadMemories()
  }, [loadMemories])

  const totalIdeaCards = memories.reduce((sum, memory) => sum + memory.ideaCardIds.length, 0)
  const topicTags = [...new Set(memories.flatMap((memory) => memory.topicTags))].slice(0, 8)

  const handleSelectMemory = (memory: typeof memories[number]) => {
    selectObject({ type: 'memory_record', id: memory.id })
  }

  return (
    <div className="field-memory-view">
      <section className="field-memory-hero">
        <div>
          <span className="eyebrow">Field Memory</span>
          <h3>Understanding Memories</h3>
          <p>这里汇总你主动保存的节点理解记录。点击任意记录可在右侧 AI Panel 查看详情和复用入口。</p>
        </div>
        <span className="field-memory-count">{loading ? 'Loading' : `${memories.length} records`}</span>
      </section>

      <section className="field-memory-stats">
        <article><span>Memory records</span><strong>{memories.length}</strong></article>
        <article><span>Idea cards referenced</span><strong>{totalIdeaCards}</strong></article>
        <article><span>Topic tags</span><strong>{topicTags.length}</strong></article>
      </section>

      {topicTags.length > 0 && (
        <section className="field-memory-tags">
          {topicTags.map((tag) => <span key={tag}>{tag}</span>)}
        </section>
      )}

      {memories.length ? (
        <section className="field-memory-list" aria-label="Node understanding memories">
          {memories.map((memory) => (
            <button
              className={`field-memory-card ${selectedMemoryId === memory.id ? 'field-memory-card--selected' : ''}`}
              key={memory.id}
              onClick={() => handleSelectMemory(memory)}
              type="button"
            >
              <span>{memory.nodeType} · {memory.aiFeedbackType}</span>
              <strong>{memory.nodeLabel}</strong>
              <p>{memory.userEditedUnderstandingNote || memory.generatedUnderstandingNote || memory.aiFeedbackSummary}</p>
              <em>{new Date(memory.updatedAt || memory.createdAt).toLocaleString()}</em>
            </button>
          ))}
        </section>
      ) : (
        <section className="workspace-placeholder-view field-memory-empty">
          <span className="eyebrow">No Memories Yet</span>
          <h3>保存一条节点理解后会出现记录</h3>
          <p>在 Expand View 中生成 feedback，并点击“保存为长期理解”。保存完成后，这里会展示可复用的 Node Understanding Memory。</p>
        </section>
      )}
    </div>
  )
}

export default FieldMemoryView
