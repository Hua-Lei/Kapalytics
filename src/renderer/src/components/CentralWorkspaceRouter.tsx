import type { Stage } from '../types'
import type { KnowledgeGraph as KGType } from '../modules/graph/types'
import type { DiagnosisResult } from '../modules/diagnosis/types'
import type { WorkspaceTab } from '../domains/workspace/types'
import type { NodeExpansionSession } from '../modules/workspace/nodeExpansionSessions'
import type { NodeUnderstandingMemory } from '../../../shared/kg4'
import type { ExpansionGraphNode, Kg4ExpansionGraphLayer } from '../../../shared/kg4'
import type { PaperInsight } from '../../../shared/paper'
import KnowledgeGraph from './KnowledgeGraph'
import LearningPath from './LearningPath'
import StageDetail from './StageDetail'
import ExpansionLoadingView from './ExpansionLoadingView'
import ExpansionGraphView from './ExpansionGraphView'
import ExpandView from './ExpandView'
import FieldMemoryView from './FieldMemoryView'
import ArgumentChainView from './ArgumentChainView'
import MethodMechanismView from './MethodMechanismView'
import PdfReaderWorkspace from './PdfReaderWorkspace'

interface CentralWorkspaceRouterProps {
  activeTab: WorkspaceTab | undefined
  answers: Record<string, string>
  diagnosedStageIds: Set<string>
  diagnosisResults: Record<string, DiagnosisResult>
  drafts: Record<string, string>
  graph: KGType
  kg4ExpansionGraph: Kg4ExpansionGraphLayer | null
  memories: NodeUnderstandingMemory[]
  nodeExpansionSessions: Record<string, NodeExpansionSession>
  paperInsight: PaperInsight | null
  selectedGraphNodeId: string | null
  selectedMemoryId?: string
  selectedStageId: string | null
  stages: Stage[]
  pdfUrl: string | null
  onClearExpansionGraph: () => void
  onConfirmDiagnosis: (stageId: string) => void
  onEnterStage: (stageId: string) => void
  onAdoptTransferTask: (prompt: string) => void
  onBackToExpansionGraph: (expansionId: string) => void
  onMemoriesLoaded: (memories: NodeUnderstandingMemory[]) => void
  onMarkNeedsReview: (stageId: string) => void
  onRetryStage: (stageId: string) => void
  onSelectGraphNode: (nodeId: string) => void
  onSelectExpansionNode: (node: ExpansionGraphNode, expansionId: string) => void
  onSelectMemory: (memory: NodeUnderstandingMemory) => void
  onSelectStage: (stageId: string) => void
  onSubmitAnswer: (stageId: string) => void
  onUpdateDraft: (stageId: string, value: string) => void
  onSelectPdf: () => void
}

function WorkspaceHeader({ activeTab }: { activeTab: WorkspaceTab | undefined }) {
  return (
    <div className="central-workspace__header">
      <div>
        <span className="panel-header-subtitle">Central Workspace</span>
        <h2>{activeTab?.title ?? 'Paper Graph'}</h2>
      </div>
      <span className="central-workspace__type">{activeTab?.type ?? 'paper_graph'}</span>
    </div>
  )
}

function StageLearningWorkspace(props: CentralWorkspaceRouterProps) {
  const selectedStage = props.stages.find((stage) => stage.id === props.selectedStageId) ?? null
  return (
    <div className="stage-learning-workspace">
      <div className="stage-learning-workspace__path">
        <LearningPath stages={props.stages} selectedStageId={props.selectedStageId} onSelectStage={props.onSelectStage} />
      </div>
      <div className="stage-learning-workspace__detail">
        {selectedStage ? (
          <StageDetail
            answer={props.answers[selectedStage.id] ?? ''}
            diagnosed={props.diagnosedStageIds.has(selectedStage.id)}
            diagnosisResult={props.diagnosisResults[selectedStage.id]}
            draft={props.drafts[selectedStage.id] ?? ''}
            onConfirmDiagnosis={() => props.onConfirmDiagnosis(selectedStage.id)}
            onEnterStage={() => props.onEnterStage(selectedStage.id)}
            onMarkNeedsReview={() => props.onMarkNeedsReview(selectedStage.id)}
            onRetryStage={() => props.onRetryStage(selectedStage.id)}
            onSubmitAnswer={() => props.onSubmitAnswer(selectedStage.id)}
            onUpdateDraft={(value) => props.onUpdateDraft(selectedStage.id, value)}
            stage={selectedStage}
          />
        ) : (
          <div className="workspace-placeholder-view"><h3>选择一个阶段开始学习</h3><p>阶段作答和诊断现在位于中央 Stage Learning Workspace。</p></div>
        )}
      </div>
    </div>
  )
}

function CentralWorkspaceRouter(props: CentralWorkspaceRouterProps) {
  const type = props.activeTab?.type ?? 'paper_graph'
  const activeExpansionSession = props.activeTab?.expansionId ? props.nodeExpansionSessions[props.activeTab.expansionId] : undefined
  const activeExpansionAnchor = activeExpansionSession ? props.graph.nodes.find((node) => node.id === activeExpansionSession.nodeId) : undefined
  return (
    <main className="central-workspace">
      <WorkspaceHeader activeTab={props.activeTab} />
      <div className="central-workspace__body">
        {type === 'pdf_reader' && <PdfReaderWorkspace />}
        {type === 'paper_graph' && (
          <KnowledgeGraph
            graph={props.graph}
            paperInsight={props.paperInsight}
            selectedNodeId={props.selectedGraphNodeId}
            view="argument"
            expansionGraph={props.kg4ExpansionGraph}
            onNodeSelect={props.onSelectGraphNode}
            onClearExpansionGraph={props.onClearExpansionGraph}
          />
        )}
        {type === 'argument_chain' && <ArgumentChainView />}
        {type === 'method_mechanism' && <MethodMechanismView />}
        {type === 'stage_learning' && <StageLearningWorkspace {...props} />}
        {type === 'node_expansion_loading' && (
          <ExpansionLoadingView session={activeExpansionSession} />
        )}
        {type === 'expansion_graph' && (
          <ExpansionGraphView
            anchorNode={activeExpansionAnchor}
            graph={props.graph}
            selectedExpansionNodeId={activeExpansionSession?.selectedExpansionNodeId}
            session={activeExpansionSession}
            onClear={props.onClearExpansionGraph}
            onSelectExpansionNode={props.onSelectExpansionNode}
          />
        )}
        {type === 'expand_view' && (
          <ExpandView
            anchorNode={activeExpansionAnchor}
            paperInsight={props.paperInsight}
            selectedExpansionNodeId={props.activeTab?.nodeId}
            session={activeExpansionSession}
            onAdoptTransferTask={props.onAdoptTransferTask}
            onBackToExpansionGraph={props.onBackToExpansionGraph}
          />
        )}
        {type === 'field_memory' && (
          <FieldMemoryView
            memories={props.memories}
            selectedMemoryId={props.selectedMemoryId}
            onMemoriesLoaded={props.onMemoriesLoaded}
            onSelectMemory={props.onSelectMemory}
          />
        )}
        {!['pdf_reader', 'paper_graph', 'argument_chain', 'method_mechanism', 'stage_learning', 'node_expansion_loading', 'expansion_graph', 'expand_view', 'field_memory'].includes(type) && (
          <div className="workspace-placeholder-view">
            <span className="eyebrow">Coming Next</span>
            <h3>{props.activeTab?.title}</h3>
            <p>该 workspace type 已在状态模型中预留，后续版本会逐步接入。</p>
          </div>
        )}
      </div>
    </main>
  )
}

export default CentralWorkspaceRouter
