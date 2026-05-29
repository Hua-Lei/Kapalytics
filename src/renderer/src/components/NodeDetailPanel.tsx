import { useEffect, useState } from 'react'
import type {
  ComparisonWorkspace,
  DirectionMap,
  GraphNode,
  MethodLineage,
  NodeExpansionResult,
  PaperInsight
} from '../../../shared/paper'
import { buildComparisonWorkspaceForPaper, expandNode } from '../modules/learning/nodeExpansion'
import {
  buildComparisonWorkspace,
  buildKg4ExpansionRecord,
  buildLocalReuseSuggestions,
  buildNodeUnderstandingMemory,
  generateLocalFeedback
} from '../modules/learning/kg4Workbench'
import { canExpandGraphNode } from '../modules/paper/analysisState'
import { electronApi } from '../modules/ipc/electronApi'
import MathText from './MathText'
import type {
  AlgorithmIdeaCard,
  AlgorithmIdeaComparisonWorkspace,
  Kg4ExpansionGraphLayer,
  Kg4Feedback,
  Kg4NodeExpansionRecord,
  MemoryReuseSuggestion,
  NodeUnderstandingMemory
} from '../../../shared/kg4'

interface NodeDetailPanelProps {
  node: GraphNode | null
  paperInsight: PaperInsight | null
  onAdoptTransferTask: (prompt: string) => void
  onSetKg4ExpansionGraph: (layer: Kg4ExpansionGraphLayer | null) => void
}

const typeLabel: Record<string, string> = {
  field: '领域',
  concept: '核心概念',
  problem: '研究问题',
  method: '方法模块',
  formula: '公式算法',
  experiment: '实验',
  limitation: '局限'
}

const color: Record<string, string> = {
  field: '#315c72',
  concept: '#4e6f5b',
  problem: '#8f574f',
  method: '#5b5f86',
  formula: '#76617f',
  experiment: '#52737a',
  limitation: '#8a7045'
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

function LabeledText({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null
  return (
    <div className="node-detail__field">
      <span className="node-detail__field-label">{label}</span>
      <span className="node-detail__field-value"><MathText text={value} /></span>
    </div>
  )
}

function TypeStructuredDetail({ node }: { node: GraphNode }) {
  const detail = node.detail
  const methodFlow = Array.isArray(detail?.methodFlow) ? detail.methodFlow : []
  const formulaSymbols = Array.isArray(detail?.formulaExplanation?.symbols)
    ? detail.formulaExplanation.symbols
    : []
  const claimEvidence = Array.isArray(detail?.claimEvidence) ? detail.claimEvidence : []
  const failureConditions = Array.isArray(detail?.failureConditions) ? detail.failureConditions : []

  if (node.type === 'method' && methodFlow.length) {
    return (
      <section className="node-detail__section">
        <h4>方法流程</h4>
        <div className="method-flow">
          {methodFlow.map((step, index) => (
            <div className="method-flow__step" key={step.id || index}>
              <span>{index + 1}</span>
              <strong>{step.label}</strong>
              <p><MathText text={step.description} /></p>
              {step.input && <em>输入：{step.input}</em>}
              {step.output && <em>输出：{step.output}</em>}
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (node.type === 'formula' && detail?.formulaExplanation) {
    const formula = detail.formulaExplanation
    return (
      <section className="node-detail__section">
        <h4>公式拆解</h4>
        <div className="formula-box"><MathText text={formula.latex || node.description} /></div>
        {formulaSymbols.length > 0 && (
          <table className="node-detail__table">
            <thead><tr><th>符号</th><th>含义</th></tr></thead>
            <tbody>{formulaSymbols.map((row) => <tr key={row.symbol}><td>{row.symbol}</td><td>{row.meaning}</td></tr>)}</tbody>
          </table>
        )}
        <LabeledText label="训练目标" value={formula.trainingObjective} />
        <LabeledText label="方法位置" value={formula.positionInMethod} />
        <LabeledText label="去掉/改变的影响" value={formula.ablationThought} />
      </section>
    )
  }

  if (node.type === 'experiment' && claimEvidence.length) {
    return (
      <section className="node-detail__section">
        <h4>Claim-Evidence</h4>
        <table className="node-detail__table">
          <thead><tr><th>实验</th><th>验证 claim</th><th>观察结果</th><th>结论</th></tr></thead>
          <tbody>
            {claimEvidence.map((row, index) => (
              <tr key={`${row.experiment}-${index}`}>
                <td>{row.experiment}</td>
                <td>{row.claim}</td>
                <td>{row.observation}</td>
                <td>{row.conclusion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    )
  }

  if (node.type === 'limitation') {
    return <DetailList title="失败条件" items={failureConditions} />
  }

  return <DetailList title="关键点" items={detail?.keyPoints} />
}

type ExpansionView = 'direction' | 'lineage' | 'comparison'

const LINEAGE_ROLE_LABEL: Record<string, string> = {
  predecessor: 'predecessor',
  foundation: 'foundation',
  variant: 'variant',
  current_paper: 'current paper',
  possible_successor: 'possible successor'
}

function EmptyExpansionState({ message }: { message: string }) {
  return (
    <div className="node-expansion-empty">
      <p>{message}</p>
    </div>
  )
}

function DirectionMapView({ map }: { map: DirectionMap | undefined }) {
  if (!map) return <EmptyExpansionState message="当前节点还没有方向地图数据。" />
  if (map.insufficientDataReason) return <EmptyExpansionState message={map.insufficientDataReason} />

  const currentBranchId = map.currentPaperPosition?.branchId
  return (
    <div className="direction-map">
      <div className="direction-map__root">
        <span>研究方向</span>
        <strong>{map.fieldTitle}</strong>
        <p><MathText text={map.fieldDefinition} /></p>
      </div>
      <div className="direction-map__column">
        <span className="node-expansion__label">核心问题</span>
        {map.coreProblems.map((problem) => (
          <article className="direction-map__problem" key={problem.id}>
            <strong>{problem.label}</strong>
            <p>{problem.whyItMatters}</p>
          </article>
        ))}
      </div>
      <div className="direction-map__column">
        <span className="node-expansion__label">方法分支</span>
        {map.methodBranches.map((branch) => (
          <article
            className={`direction-map__branch ${branch.id === currentBranchId ? 'direction-map__branch--current' : ''}`}
            key={branch.id}
          >
            <strong>{branch.label}</strong>
            <p>{branch.description}</p>
            <span>{branch.representativePaperIds.length} 篇候选论文</span>
          </article>
        ))}
      </div>
      {map.currentPaperPosition && (
        <div className="direction-map__current">
          <span>当前论文位置</span>
          <strong>{map.currentPaperPosition.positionLabel}</strong>
          <p><MathText text={map.currentPaperPosition.reason} /></p>
          <em>{map.currentPaperPosition.remainingGap}</em>
        </div>
      )}
    </div>
  )
}

function MethodLineageView({ lineage }: { lineage: MethodLineage | undefined }) {
  if (!lineage) return <EmptyExpansionState message="当前节点还没有方法谱系数据。" />
  return (
    <div className="lineage-view">
      <h4>{lineage.title}</h4>
      <div className="lineage-track">
        {lineage.steps.map((step) => (
          <article
            className={`lineage-step ${step.isCurrentPaper ? 'lineage-step--current' : ''} ${step.missing ? 'lineage-step--missing' : ''}`}
            key={step.id}
          >
            <span>{LINEAGE_ROLE_LABEL[step.role]}</span>
            <strong>{step.label}</strong>
            <p><b>解决：</b>{step.solves}</p>
            <p><b>留下：</b>{step.remainingGap}</p>
            <p><b>关系：</b>{step.relationToCurrentPaper}</p>
            {step.representativePaperIds.length ? <em>{step.representativePaperIds.join(', ')}</em> : null}
          </article>
        ))}
      </div>
    </div>
  )
}

function ComparisonWorkspaceView({ workspace, onSelectPaper, onAdoptTransferTask }: {
  workspace: ComparisonWorkspace | undefined
  onSelectPaper: (paperId: string) => void
  onAdoptTransferTask: (prompt: string) => void
}) {
  if (!workspace) return <EmptyExpansionState message="当前节点还没有对比工作台数据。" />
  if (workspace.insufficientDataReason) return <EmptyExpansionState message={workspace.insufficientDataReason} />

  return (
    <div className="comparison-workspace">
      <div className="related-paper-selector">
        {workspace.candidates.map((paper) => (
          <button
            className={`related-paper-card ${paper.id === workspace.selectedRelatedPaperId ? 'related-paper-card--selected' : ''}`}
            key={paper.id}
            onClick={() => onSelectPaper(paper.id)}
          >
            <strong>{paper.title}</strong>
            <span>{[paper.year, paper.venue, paper.source].filter(Boolean).join(' · ')}</span>
            <em>{paper.methodFamily}</em>
            <p>{paper.relationToCurrentNode}</p>
            <small>{paper.whyCompare}</small>
          </button>
        ))}
      </div>

      <table className="node-detail__table sharp-comparison-table">
        <thead><tr><th>维度</th><th>当前论文 / 当前节点</th><th>所选代表论文</th><th>Sharp Insight</th></tr></thead>
        <tbody>
          {workspace.comparisonRows.map((row) => (
            <tr key={row.dimension}>
              <td>{row.label}</td>
              <td><MathText text={row.currentPaper} /></td>
              <td><MathText text={row.relatedPaper} /></td>
              <td><MathText text={row.sharpInsight} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {workspace.transferTask && (
        <div className="transfer-task-card">
          <span>迁移任务</span>
          <p><MathText text={workspace.transferTask.prompt} /></p>
          <DetailList title="期望推理点" items={workspace.transferTask.expectedReasoningPoints} />
          <button className="stage-btn stage-btn--primary" onClick={() => onAdoptTransferTask(workspace.transferTask!.prompt)}>
            接入学习闭环
          </button>
        </div>
      )}
    </div>
  )
}

function ExpansionCard({ node, paperInsight, expansion, onAdoptTransferTask }: {
  node: GraphNode
  paperInsight: PaperInsight | null
  expansion: NodeExpansionResult
  onAdoptTransferTask: (prompt: string) => void
}) {
  const [view, setView] = useState<ExpansionView>('direction')
  const [workspace, setWorkspace] = useState<ComparisonWorkspace | undefined>(expansion.comparisonWorkspace)

  const selectPaper = (paperId: string) => {
    setWorkspace(buildComparisonWorkspaceForPaper(node, paperInsight, paperId))
  }

  return (
    <section className="node-detail__section expansion-card node-expansion-v2">
      <div className="source-note">当前版本只使用内置候选论文库，不由 LLM 编造相关论文。</div>
      <div className="node-expansion__header">
        <div>
          <h4>{expansion.overview.title}</h4>
          <p><MathText text={expansion.overview.definition} /></p>
        </div>
        <span>{expansion.relatedPapers.length} candidates</span>
      </div>

      <div className="node-expansion-tabs">
        {([
          ['direction', 'Direction Map'],
          ['lineage', 'Method Evolution'],
          ['comparison', 'Comparison Workspace']
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            className={`node-expansion-tab ${view === tab ? 'node-expansion-tab--active' : ''}`}
            onClick={() => setView(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'direction' && <DirectionMapView map={expansion.directionMap} />}
      {view === 'lineage' && <MethodLineageView lineage={expansion.methodLineage} />}
      {view === 'comparison' && (
        <ComparisonWorkspaceView
          workspace={workspace}
          onSelectPaper={selectPaper}
          onAdoptTransferTask={onAdoptTransferTask}
        />
      )}
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

function Kg4Workbench({ node, paperInsight, onAdoptTransferTask, onSetKg4ExpansionGraph }: {
  node: GraphNode
  paperInsight: PaperInsight | null
  onAdoptTransferTask: (prompt: string) => void
  onSetKg4ExpansionGraph: (layer: Kg4ExpansionGraphLayer | null) => void
}) {
  const [record, setRecord] = useState<Kg4NodeExpansionRecord>(() => buildKg4ExpansionRecord(node, paperInsight))
  const [selectedIds, setSelectedIds] = useState<string[]>(() => record.algorithmIdeaCards.slice(0, 2).map((card) => card.id))
  const [workspace, setWorkspace] = useState<AlgorithmIdeaComparisonWorkspace>(() => buildComparisonWorkspace(node, paperInsight, record.algorithmIdeaCards, selectedIds))
  const [reflection, setReflection] = useState('')
  const [feedback, setFeedback] = useState<Kg4Feedback | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [reuseSuggestions, setReuseSuggestions] = useState<MemoryReuseSuggestion[]>([])

  useEffect(() => {
    const nextRecord = buildKg4ExpansionRecord(node, paperInsight)
    setRecord(nextRecord)
    const nextSelected = nextRecord.algorithmIdeaCards.slice(0, 2).map((card) => card.id)
    setSelectedIds(nextSelected)
    setWorkspace(buildComparisonWorkspace(node, paperInsight, nextRecord.algorithmIdeaCards, nextSelected))
    setFeedback(null)
    setNoteDraft('')
    setSaveStatus(null)
    onSetKg4ExpansionGraph({
      anchorNodeId: node.id,
      nodes: nextRecord.expansionGraphNodes,
      edges: nextRecord.expansionGraphEdges
    })
    electronApi.kg4.listNodeUnderstandingMemories({ limit: 50 })
      .then((memories: NodeUnderstandingMemory[]) => setReuseSuggestions(buildLocalReuseSuggestions(node, memories)))
      .catch(() => setReuseSuggestions([]))
    return () => onSetKg4ExpansionGraph(null)
  }, [node.id, paperInsight, onSetKg4ExpansionGraph])

  useEffect(() => {
    setWorkspace(buildComparisonWorkspace(node, paperInsight, record.algorithmIdeaCards, selectedIds))
  }, [selectedIds, record, node, paperInsight])

  const toggleCard = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id)
      if (prev.length >= 3) return [...prev.slice(1), id]
      return [...prev, id]
    })
  }

  const requestFeedback = () => {
    const next = generateLocalFeedback(node, workspace, reflection)
    setFeedback(next)
    setNoteDraft(next.suggestedUnderstandingNote)
  }

  const saveMemory = async () => {
    if (!feedback) return
    const memory = buildNodeUnderstandingMemory({ node, workspace, feedback, userReflection: reflection, editedNote: noteDraft })
    const result = await electronApi.kg4.saveNodeUnderstandingMemory(memory)
    setSaveStatus(result.ok ? '已保存到 Node Understanding Memory。' : '保存失败：KG4 IPC 不可用。')
  }

  return (
    <section className="node-detail__section kg4-workbench">
      <div className="node-expansion__header">
        <div>
          <h4>KG4 Algorithm Idea Workbench</h4>
          <p>从节点扩展到可追溯论文、算法思想、临时子图、对比和理解记忆。</p>
        </div>
        <span>{record.dataCompleteness}</span>
      </div>
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
      <Kg4IdeaCardGrid cards={record.algorithmIdeaCards} selectedIds={selectedIds} onToggle={toggleCard} />
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
        <button className="stage-btn" onClick={() => onAdoptTransferTask(`请基于 KG4 工作台比较“${node.label}”的 2-3 个算法思想，并提出一个可迁移到当前论文的新假设。`)}>
          接入 transfer_comparison
        </button>
      </div>
    </section>
  )
}

function NodeDetailPanel({ node, paperInsight, onAdoptTransferTask, onSetKg4ExpansionGraph }: NodeDetailPanelProps) {
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null)

  if (!node) {
    return <div className="empty-state">点击图谱中的节点以查看详情</div>
  }

  const canExpand = canExpandGraphNode(node)
  const expansion = expandedNodeId === node.id ? expandNode(node, paperInsight) : null

  return (
    <div className="node-detail">
      <div className="node-detail__header">
        <span className="node-detail__type-badge" style={{ background: color[node.type] }}>
          {typeLabel[node.type]}
        </span>
        {canExpand && <span className="node-detail__expandable">可扩展</span>}
      </div>
      <h3 className="node-detail__title">{node.label}</h3>
      <p className="node-detail__description"><MathText text={node.detail?.summary || node.description} /></p>

      <section className="node-detail__section">
        <LabeledText label="关键洞察" value={node.insight} />
        <LabeledText label="为什么重要" value={node.whyImportant} />
        <LabeledText label="论文角色" value={node.roleInPaper} />
        <LabeledText label="相对已有方法" value={node.contrastWithPrior} />
        <LabeledText label="证据节点" value={node.evidenceNodeIds?.join(', ')} />
      </section>

      <TypeStructuredDetail node={node} />

      {canExpand && (
        <section className="node-detail__section">
          <h4>KG4 Node Expansion</h4>
          <p className="node-detail__muted">从当前节点进入临时扩展子图、算法思想对比、反馈和长期理解记忆。</p>
          {node.searchQueries?.length ? <DetailList title="检索查询" items={node.searchQueries} /> : null}
          <button className="stage-btn stage-btn--primary" onClick={() => setExpandedNodeId(expandedNodeId === node.id ? null : node.id)}>
            {expandedNodeId === node.id ? '收起 KG4 工作台' : '打开 KG4 工作台'}
          </button>
        </section>
      )}

      {expansion && (
        <Kg4Workbench
          key={`kg4-${node.id}`}
          node={node}
          paperInsight={paperInsight}
          onAdoptTransferTask={onAdoptTransferTask}
          onSetKg4ExpansionGraph={onSetKg4ExpansionGraph}
        />
      )}

      {expansion && (
        <ExpansionCard
          key={`kg3-${node.id}`}
          node={node}
          paperInsight={paperInsight}
          expansion={expansion}
          onAdoptTransferTask={onAdoptTransferTask}
        />
      )}
    </div>
  )
}

export default NodeDetailPanel
