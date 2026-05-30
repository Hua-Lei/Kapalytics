import { useEffect, useState } from 'react'
import type {
  AlgorithmIdeaCard,
  AlgorithmIdeaComparisonWorkspace,
  Kg4Feedback,
  MemoryReuseSuggestion,
  NodeUnderstandingMemory
} from '../../../shared/kg4'
import {
  buildComparisonWorkspace,
  buildLocalReuseSuggestions,
  buildNodeUnderstandingMemory,
  generateLocalFeedback
} from '../modules/learning/kg4Workbench'
import { electronApi } from '../modules/ipc/electronApi'
import IdeaCardGrid from './IdeaCardGrid'
import ComparisonTable from './ComparisonTable'
import FeedbackPanel from './FeedbackPanel'
import MemorySavePanel from './MemorySavePanel'
import { useExpansion } from '../domains/expansion/useExpansion'
import { usePaper } from '../domains/paper/usePaper'
import { useWorkspace } from '../domains/workspace/useWorkspace'
import { useStages } from '../domains/stages/useStages'

function ExpandView() {
  const { activeTab, activateTab } = useWorkspace()
  const { sessions } = useExpansion()
  const { graph, paperInsight } = usePaper()
  const { setStages, selectStage } = useStages()

  const session = activeTab?.expansionId ? sessions[activeTab.expansionId] : undefined
  const anchorNode = session ? graph.nodes.find((node) => node.id === session.nodeId) : undefined
  const selectedExpansionNodeId = activeTab?.nodeId

  const record = session?.expansionRecord
  const selectedExpansionNode = session?.expansionGraph?.nodes.find((node) => node.id === selectedExpansionNodeId)
  const ideaCards = record?.algorithmIdeaCards ?? []
  const [selectedIds, setSelectedIds] = useState<string[]>(() => ideaCards.slice(0, 2).map((card) => card.id))
  const [workspace, setWorkspace] = useState<AlgorithmIdeaComparisonWorkspace | null>(null)
  const [reflection, setReflection] = useState('')
  const [feedback, setFeedback] = useState<Kg4Feedback | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [reuseSuggestions, setReuseSuggestions] = useState<MemoryReuseSuggestion[]>([])

  useEffect(() => {
    if (!anchorNode) return
    const nextSelected = ideaCards.slice(0, 2).map((card) => card.id)
    setSelectedIds(nextSelected)
    setWorkspace(buildComparisonWorkspace(anchorNode, paperInsight, ideaCards, nextSelected))
    setFeedback(null)
    setNoteDraft('')
    setSaveStatus(null)
    electronApi.kg4.listNodeUnderstandingMemories({ limit: 50 })
      .then((memories: NodeUnderstandingMemory[]) => setReuseSuggestions(buildLocalReuseSuggestions(anchorNode, memories)))
      .catch(() => setReuseSuggestions([]))
  }, [anchorNode?.id, paperInsight, session?.id])

  useEffect(() => {
    if (!anchorNode) return
    setWorkspace(buildComparisonWorkspace(anchorNode, paperInsight, ideaCards, selectedIds))
  }, [selectedIds, anchorNode, paperInsight, session?.id])

  if (!session || !anchorNode || !record || !workspace) {
    return (
      <div className="workspace-placeholder-view">
        <span className="eyebrow">Expand View</span>
        <h3>找不到完整工作台数据</h3>
        <p>请从 Expansion Graph View 选择一个 temporary node 后重新进入 Expand View。</p>
      </div>
    )
  }

  const toggleCard = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id)
      if (prev.length >= 3) return [...prev.slice(1), id]
      return [...prev, id]
    })
  }

  const requestFeedback = () => {
    const next = generateLocalFeedback(anchorNode, workspace, reflection)
    setFeedback(next)
    setNoteDraft(next.suggestedUnderstandingNote)
  }

  const saveMemory = async () => {
    if (!feedback) return
    const memory = buildNodeUnderstandingMemory({ node: anchorNode, workspace, feedback, userReflection: reflection, editedNote: noteDraft })
    const result = await electronApi.kg4.saveNodeUnderstandingMemory(memory)
    setSaveStatus(result.ok ? '已保存到 Node Understanding Memory。' : '保存失败：KG4 IPC 不可用。')
  }

  const handleBackToExpansionGraph = () => {
    activateTab(session.id)
  }

  const handleAdoptTransferTask = () => {
    setStages((prev) =>
      prev.map((stage) =>
        stage.id === 'transfer_comparison'
          ? { ...stage, task: `请基于 KG4 工作台比较"${anchorNode.label}"的 2-3 个算法思想，并提出一个可迁移到当前论文的新假设。`, status: 'in_progress' as const }
          : stage
      )
    )
    selectStage('transfer_comparison')
    activateTab('stage_learning')
  }

  return (
    <div className="expand-view kg4-workbench">
      <section className="expand-view__hero">
        <div>
          <span className="eyebrow">Expand View</span>
          <h3>{anchorNode.label}</h3>
          <p>完整 Algorithm Idea Workbench 已迁移到中央 Workspace。右侧 AI Panel 只保留摘要和入口。</p>
          {selectedExpansionNode && <p>当前入口节点：{selectedExpansionNode.label}</p>}
        </div>
        <button className="stage-btn stage-btn--secondary" onClick={handleBackToExpansionGraph}>返回 Expansion Graph</button>
      </section>

      <div className="source-note">当前 MVP 使用 dev fixture，所有 paperTitle/source/externalId 都来自候选数据；生产路径应替换为 KG4 IPC 检索和 orchestrator job。</div>

      {reuseSuggestions.length > 0 && (
        <div className="kg4-reuse-box">
          <span className="node-expansion__label">Memory Reuse Suggestions</span>
          {reuseSuggestions.map((suggestion) => (
            <article key={suggestion.id}>
              <strong>{Math.round(suggestion.confidence * 100)}% · {suggestion.matchReason}</strong>
              <p>{suggestion.suggestedReuseText}</p>
            </article>
          ))}
        </div>
      )}

      <div className="kg4-field-view">
        <span className="node-expansion__label">Field Cognition View</span>
        <strong>{record.fieldCognitionView?.fieldTitle}</strong>
        <p>{record.fieldCognitionView?.coreProblemSummary}</p>
        <div className="kg4-family-list">
          {record.fieldCognitionView?.methodFamilies.map((family) => (
            <span key={family.id}>{family.label} · {family.representativePaperIds.length} papers</span>
          ))}
        </div>
      </div>

      <IdeaCardGrid cards={ideaCards} selectedIds={selectedIds} onToggle={toggleCard} />
      <div className="kg4-selected-tray">
        <span className="node-expansion__label">Selected Ideas</span>
        <p>{selectedIds.length}/3 selected · 至少选择 2 张卡生成正式对比。</p>
      </div>
      <ComparisonTable workspace={workspace} />
      <div className="kg4-reflection-panel">
        <span className="node-expansion__label">你的理解</span>
        <textarea
          className="task-answer-input"
          value={reflection}
          onChange={(event) => setReflection(event.target.value)}
          placeholder="写下你对这些算法思想差异的理解，例如：A 与 B 的关键差异在更新对象和假设..."
        />
        <button className="stage-btn stage-btn--primary" disabled={!reflection.trim()} onClick={requestFeedback}>生成 Reflective / Remedial Feedback</button>
      </div>
      <FeedbackPanel feedback={feedback} />
      {feedback && (
        <MemorySavePanel
          noteDraft={noteDraft}
          onNoteDraftChange={setNoteDraft}
          onSaveMemory={saveMemory}
          saveStatus={saveStatus}
        />
      )}
      <div className="transfer-task-card kg4-optional-transfer">
        <span>Optional Transfer Task</span>
        <p>迁移任务保留为可选入口，不作为 KG4 主流程。</p>
        <button className="stage-btn" onClick={handleAdoptTransferTask}>
          接入 transfer_comparison
        </button>
      </div>
    </div>
  )
}

export default ExpandView
