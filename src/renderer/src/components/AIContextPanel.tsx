import { useState } from 'react'
import type { AnalysisStep, GraphNode, PaperInsight } from '../../../shared/paper'
import type { AlgorithmIdeaCard, ExpansionGraphNode, NodeUnderstandingMemory } from '../../../shared/kg4'
import type { Stage } from '../types'
import type { DiagnosisResult } from '../modules/diagnosis/types'
import type { LearningReport } from '../modules/learning/report'
import type { NodeExpansionSession } from '../modules/workspace/nodeExpansionSessions'
import type { SelectedObject } from '../domains/workspace/types'
import AnalysisPanel from './AnalysisPanel'
import LearningReportPanel from './LearningReportPanel'
import MathText from './MathText'
import { canExpandGraphNode } from '../modules/paper/analysisState'

interface AIContextPanelProps {
  analysisSteps: AnalysisStep[]
  generating: boolean
  genError: string
  genProgress: string
  graphNodes: GraphNode[]
  learningReport: LearningReport | null
  memories: NodeUnderstandingMemory[]
  nodeExpansionSessions: Record<string, NodeExpansionSession>
  paperInsight: PaperInsight | null
  pdfUrl: string | null
  selectedObject?: SelectedObject
  stages: Stage[]
  diagnosisResults: Record<string, DiagnosisResult>
  diagnosedStageIds: Set<string>
  onAnalyzePaper: () => void
  onGenerateLearningReport: () => void
  onOpenExpandView: (expansionId: string, nodeId: string) => void
  onOpenNodeExpansion: (nodeId: string) => void
  onOpenStageLearning: (stageId: string) => void
  onOpenFieldMemory: () => void
  onSelectPdf: () => void
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

const expansionTypeLabel: Record<string, string> = {
  method_family: 'Method Family',
  algorithm_idea: 'Algorithm Idea',
  related_paper: 'Related Paper',
  prerequisite_concept: 'Prerequisite Concept',
  open_problem: 'Open Problem'
}

function TruncatedText({ text }: { text: string | undefined }) {
  if (!text) return null
  const value = text.length > 180 ? `${text.slice(0, 180)}...` : text
  return <p><MathText text={value} /></p>
}

function NodeInspector({ node, onOpenNodeExpansion }: { node: GraphNode; onOpenNodeExpansion: (nodeId: string) => void }) {
  const expandable = canExpandGraphNode(node)
  const [expansionRequested, setExpansionRequested] = useState(false)

  const requestExpansion = () => {
    setExpansionRequested(true)
    onOpenNodeExpansion(node.id)
  }

  return (
    <div className="ai-context-card">
      <span className="eyebrow">Node Inspector</span>
      <h3>{node.label}</h3>
      <span className="ai-context-badge">{typeLabel[node.type] ?? node.type}</span>
      <TruncatedText text={node.detail?.summary || node.description} />
      <div className="ai-context-details">
        {node.whyImportant && <div><strong>Why it matters</strong><TruncatedText text={node.whyImportant} /></div>}
        {node.roleInPaper && <div><strong>Role in paper</strong><TruncatedText text={node.roleInPaper} /></div>}
        {node.evidenceNodeIds?.length ? <div><strong>Evidence nodes</strong><p>{node.evidenceNodeIds.join(', ')}</p></div> : null}
      </div>
      {expandable && (
        <div className="ai-context-actions">
          <div className="ai-context-query-chips">
            {(node.searchQueries ?? []).slice(0, 4).map((query) => <span key={query}>{query}</span>)}
          </div>
          <button className="stage-btn stage-btn--primary" onClick={requestExpansion}>展开该方向</button>
          {expansionRequested && <p>正在打开展开任务...</p>}
        </div>
      )}
    </div>
  )
}

function StageInspector({ stage, diagnosis, diagnosed, onOpenStageLearning }: {
  stage: Stage
  diagnosis: DiagnosisResult | undefined
  diagnosed: boolean
  onOpenStageLearning: (stageId: string) => void
}) {
  const waitingForAnswer = stage.status === 'in_progress' || stage.status === 'needs_review'
  return (
    <div className="ai-context-card">
      <span className="eyebrow">AI Diagnosis Panel</span>
      <h3>{stage.name}</h3>
      <span className={`stage-badge stage-badge--${stage.status}`}>{stage.status}</span>
      <div className="ai-context-details">
        {diagnosed && diagnosis ? (
          <>
            <div><strong>Result</strong><p>{diagnosis.isCorrect ? '回答通过，可以确认完成。' : '回答需要继续修正。'}</p></div>
            <div><strong>Feedback</strong><TruncatedText text={diagnosis.feedback} /></div>
            {diagnosis.remedialTask && <div><strong>Remedial task</strong><TruncatedText text={diagnosis.remedialTask} /></div>}
          </>
        ) : waitingForAnswer ? (
          <>
            <div><strong>等待你的回答</strong><p>请在中央 Stage Learning Workspace 完成作答并提交。提交后，诊断结果会显示在这里。</p></div>
            <div><strong>当前阶段</strong><TruncatedText text={stage.description} /></div>
          </>
        ) : stage.status === 'not_started' ? (
          <div><strong>尚未开始</strong><p>点击中央 Workspace 中的开始学习后，这里会等待你的提交并显示诊断输出。</p></div>
        ) : (
          <div><strong>已完成</strong><p>本阶段已经完成。重新学习后，新的诊断结果会显示在这里。</p></div>
        )}
      </div>
      <div className="ai-context-actions">
        <button className="stage-btn stage-btn--secondary" onClick={() => onOpenStageLearning(stage.id)}>定位到中央学习区</button>
      </div>
    </div>
  )
}

function ExpansionNodeInspector({ node, expansionId, onOpenExpandView }: {
  node: ExpansionGraphNode
  expansionId: string
  onOpenExpandView: (expansionId: string, nodeId: string) => void
}) {
  return (
    <div className="ai-context-card">
      <span className="eyebrow">Expansion Node Inspector</span>
      <h3>{node.label}</h3>
      <span className="ai-context-badge">{expansionTypeLabel[node.type] ?? node.type}</span>
      <TruncatedText text={node.description} />
      <div className="ai-context-details">
        <div><strong>Temporary status</strong><p>该节点来自当前 expansion session，尚未写入长期图谱。</p></div>
        <div><strong>Sources</strong><p>{node.sourcePaperIds.length ? node.sourcePaperIds.join(', ') : '当前 fixture 未提供 source paper。'}</p></div>
      </div>
      <div className="ai-context-actions">
        <button className="stage-btn stage-btn--primary" onClick={() => onOpenExpandView(expansionId, node.id)}>进入 Expand View</button>
        <p>在中央 Workspace 查看完整 Algorithm Idea Cards、对比和 feedback。</p>
      </div>
    </div>
  )
}

function AlgorithmIdeaInspector({ card, expansionId, onOpenExpandView }: {
  card: AlgorithmIdeaCard
  expansionId: string
  onOpenExpandView: (expansionId: string, nodeId: string) => void
}) {
  return (
    <div className="ai-context-card">
      <span className="eyebrow">Algorithm Idea Inspector</span>
      <h3>{card.paperTitle}</h3>
      <span className="ai-context-badge">{card.evidenceSource.source}</span>
      <TruncatedText text={card.coreIdea} />
      <div className="ai-context-details">
        <div><strong>Key assumption</strong><TruncatedText text={card.keyAssumption} /></div>
        <div><strong>Mechanism</strong><TruncatedText text={card.mechanism} /></div>
        {card.strength && <div><strong>Strength</strong><TruncatedText text={card.strength} /></div>}
        {card.limitation && <div><strong>Limitation</strong><TruncatedText text={card.limitation} /></div>}
      </div>
      <div className="ai-context-actions">
        <button className="stage-btn stage-btn--primary" onClick={() => onOpenExpandView(expansionId, card.id)}>进入 Expand View</button>
        <p>在中央 Workspace 中对比多个算法思想卡。</p>
      </div>
    </div>
  )
}

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

function EmptyContextPanel({ pdfUrl, stages }: { pdfUrl: string | null; stages: Stage[] }) {
  const nextStage = stages.find((s) => s.status === 'not_started' || s.status === 'needs_review')
  return (
    <div className="tutor-empty-state">
      <span className="eyebrow">AI Context Panel</span>
      <h3>{pdfUrl ? '选择节点或阶段' : '从上传论文开始'}</h3>
      <p>右侧面板现在只显示轻量 Inspector 和操作入口；完整内容进入中央 Workspace。</p>
      {nextStage && (
        <div className="next-stage-card">
          <span>推荐下一步</span>
          <strong>阶段 {nextStage.order} · {nextStage.name}</strong>
        </div>
      )}
    </div>
  )
}

function AIContextPanel(props: AIContextPanelProps) {
  let body: React.ReactNode
  if (!props.pdfUrl && !props.selectedObject) {
    body = (
      <AnalysisPanel
        analysisSteps={props.analysisSteps}
        generating={props.generating}
        genError={props.genError}
        genProgress={props.genProgress}
        onAnalyzePaper={props.onAnalyzePaper}
        onSelectPdf={props.onSelectPdf}
        pdfUrl={props.pdfUrl}
      />
    )
  } else if (props.selectedObject?.type === 'graph_node') {
    const node = props.graphNodes.find((item) => item.id === props.selectedObject?.id)
    body = node ? <NodeInspector node={node} onOpenNodeExpansion={props.onOpenNodeExpansion} /> : <EmptyContextPanel pdfUrl={props.pdfUrl} stages={props.stages} />
  } else if (props.selectedObject?.type === 'learning_stage') {
    const stage = props.stages.find((item) => item.id === props.selectedObject?.id)
    body = stage
      ? <StageInspector stage={stage} diagnosed={props.diagnosedStageIds.has(stage.id)} diagnosis={props.diagnosisResults[stage.id]} onOpenStageLearning={props.onOpenStageLearning} />
      : <EmptyContextPanel pdfUrl={props.pdfUrl} stages={props.stages} />
  } else if (props.selectedObject?.type === 'expansion_node') {
    const session = props.nodeExpansionSessions[props.selectedObject.expansionId]
    const node = session?.expansionGraph?.nodes.find((item) => item.id === props.selectedObject?.id)
    body = node
      ? <ExpansionNodeInspector node={node} expansionId={props.selectedObject.expansionId} onOpenExpandView={props.onOpenExpandView} />
      : <EmptyContextPanel pdfUrl={props.pdfUrl} stages={props.stages} />
  } else if (props.selectedObject?.type === 'algorithm_idea') {
    const card = Object.values(props.nodeExpansionSessions)
      .flatMap((s) => s.expansionRecord?.algorithmIdeaCards ?? [])
      .find((c) => c.id === props.selectedObject?.id)
    body = card
      ? <AlgorithmIdeaInspector card={card} expansionId={props.selectedObject.expansionId} onOpenExpandView={props.onOpenExpandView} />
      : <EmptyContextPanel pdfUrl={props.pdfUrl} stages={props.stages} />
  } else if (props.selectedObject?.type === 'memory_record') {
    const memory = props.memories.find((item) => item.id === props.selectedObject?.id)
    body = memory
      ? <MemoryRecordInspector memory={memory} onOpenFieldMemory={props.onOpenFieldMemory} />
      : <EmptyContextPanel pdfUrl={props.pdfUrl} stages={props.stages} />
  } else {
    body = (
      <>
        <EmptyContextPanel pdfUrl={props.pdfUrl} stages={props.stages} />
        <LearningReportPanel report={props.learningReport} onGenerate={props.onGenerateLearningReport} />
      </>
    )
  }

  return <div className="panel-body tutor-panel ai-context-panel">{body}</div>
}

export default AIContextPanel
