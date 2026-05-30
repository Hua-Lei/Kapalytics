import { useEffect, useState } from 'react'
import type { GraphNode, PaperInsight } from '../../../shared/paper'
import type {
  AlgorithmIdeaCard,
  AlgorithmIdeaComparisonWorkspace,
  Kg4Feedback,
  MemoryReuseSuggestion,
  NodeUnderstandingMemory
} from '../../../shared/kg4'
import type { NodeExpansionSession } from '../modules/workspace/nodeExpansionSessions'
import {
  buildComparisonWorkspace,
  buildLocalReuseSuggestions,
  buildNodeUnderstandingMemory,
  generateLocalFeedback
} from '../modules/learning/kg4Workbench'
import { electronApi } from '../modules/ipc/electronApi'
import MathText from './MathText'

interface ExpandViewProps {
  anchorNode: GraphNode | undefined
  paperInsight: PaperInsight | null
  session: NodeExpansionSession | undefined
  selectedExpansionNodeId?: string
  onBackToExpansionGraph: (expansionId: string) => void
  onAdoptTransferTask: (prompt: string) => void
}

function EmptyExpansionState({ message }: { message: string }) {
  return <div className="node-expansion-empty"><p>{message}</p></div>
}

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

function Kg4IdeaCardGrid({ cards, selectedIds, onToggle }: {
  cards: AlgorithmIdeaCard[]
  selectedIds: string[]
  onToggle: (id: string) => void
}) {
  if (!cards.length) return <EmptyExpansionState message="当前没有可追溯的算法思想卡。请接入检索 provider 或扩充 dev fixture。" />
  return (
    <div className="kg4-card-grid">
      {cards.map((card) => {
        const selected = selectedIds.includes(card.id)
        return (
          <button
            key={card.id}
            className={`kg4-idea-card ${selected ? 'kg4-idea-card--selected' : ''}`}
            onClick={() => onToggle(card.id)}
            type="button"
          >
            <span className="kg4-card-source">{card.evidenceSource.source} · {card.evidenceSource.externalId}</span>
            <strong>{card.paperTitle}</strong>
            <p><b>问题：</b><MathText text={card.problemSetting} /></p>
            <p><b>思想：</b><MathText text={card.coreIdea} /></p>
            <p><b>假设：</b><MathText text={card.keyAssumption} /></p>
            <p><b>机制：</b><MathText text={card.mechanism} /></p>
            <p><b>优势：</b><MathText text={card.strength} /></p>
            <p><b>局限：</b><MathText text={card.limitation} /></p>
          </button>
        )
      })}
    </div>
  )
}

function Kg4ComparisonTable({ workspace }: { workspace: AlgorithmIdeaComparisonWorkspace }) {
  if (workspace.insufficientInformation) return <EmptyExpansionState message={workspace.insufficientInformation} />
  return (
    <div className="kg4-comparison">
      <table className="node-detail__table sharp-comparison-table">
        <thead>
          <tr>
            <th>维度</th>
            <th>当前节点 / 论文</th>
            {workspace.selectedIdeaCardIds.map((id) => {
              const card = workspace.ideaCards.find((item) => item.id === id)
              return <th key={id}>{card?.paperTitle ?? id}</th>
            })}
            <th>Contrast Insight</th>
          </tr>
        </thead>
        <tbody>
          {workspace.comparisonRows.map((row) => (
            <tr key={row.dimension}>
              <td>{row.label}</td>
              <td><MathText text={row.currentNodeOrPaper} /></td>
              {row.selectedIdeas.map((cell) => <td key={cell.ideaCardId}><MathText text={cell.value} /></td>)}
              <td><MathText text={row.contrastInsight} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="kg4-reflection-questions">
        <span className="node-expansion__label">Reflection Questions</span>
        <ul>{workspace.reflectionQuestions.map((question) => <li key={question}>{question}</li>)}</ul>
      </div>
    </div>
  )
}

function Kg4FeedbackView({ feedback }: { feedback: Kg4Feedback | null }) {
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

function ExpandView({ anchorNode, paperInsight, session, selectedExpansionNodeId, onBackToExpansionGraph, onAdoptTransferTask }: ExpandViewProps) {
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

  return (
    <div className="expand-view kg4-workbench">
      <section className="expand-view__hero">
        <div>
          <span className="eyebrow">Expand View</span>
          <h3>{anchorNode.label}</h3>
          <p>完整 Algorithm Idea Workbench 已迁移到中央 Workspace。右侧 AI Panel 只保留摘要和入口。</p>
          {selectedExpansionNode && <p>当前入口节点：{selectedExpansionNode.label}</p>}
        </div>
        <button className="stage-btn stage-btn--secondary" onClick={() => onBackToExpansionGraph(session.id)}>返回 Expansion Graph</button>
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

      <Kg4IdeaCardGrid cards={ideaCards} selectedIds={selectedIds} onToggle={toggleCard} />
      <div className="kg4-selected-tray">
        <span className="node-expansion__label">Selected Ideas</span>
        <p>{selectedIds.length}/3 selected · 至少选择 2 张卡生成正式对比。</p>
      </div>
      <Kg4ComparisonTable workspace={workspace} />
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
      <Kg4FeedbackView feedback={feedback} />
      {feedback && (
        <div className="kg4-memory-save">
          <span className="node-expansion__label">建议保存的理解笔记</span>
          <textarea className="task-answer-input" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} />
          <button className="stage-btn stage-btn--primary" onClick={saveMemory}>保存为长期理解</button>
          {saveStatus && <p>{saveStatus}</p>}
        </div>
      )}
      <div className="transfer-task-card kg4-optional-transfer">
        <span>Optional Transfer Task</span>
        <p>迁移任务保留为可选入口，不作为 KG4 主流程。</p>
        <button className="stage-btn" onClick={() => onAdoptTransferTask(`请基于 KG4 工作台比较“${anchorNode.label}”的 2-3 个算法思想，并提出一个可迁移到当前论文的新假设。`)}>
          接入 transfer_comparison
        </button>
      </div>
    </div>
  )
}

export default ExpandView
