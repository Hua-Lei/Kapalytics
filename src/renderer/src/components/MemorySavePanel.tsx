interface MemorySavePanelProps {
  noteDraft: string
  onNoteDraftChange: (value: string) => void
  onSaveMemory: () => void
  saveStatus: string | null
}

function MemorySavePanel({ noteDraft, onNoteDraftChange, onSaveMemory, saveStatus }: MemorySavePanelProps) {
  return (
    <div className="kg4-memory-save">
      <span className="node-expansion__label">建议保存的理解笔记</span>
      <textarea className="task-answer-input" value={noteDraft} onChange={(event) => onNoteDraftChange(event.target.value)} />
      <button className="stage-btn stage-btn--primary" onClick={onSaveMemory}>保存为长期理解</button>
      {saveStatus && <p>{saveStatus}</p>}
    </div>
  )
}

export default MemorySavePanel
