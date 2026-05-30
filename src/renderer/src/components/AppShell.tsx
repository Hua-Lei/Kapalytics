import TopBar from './TopBar'
import WorkspaceSidebar from './WorkspaceSidebar'
import CentralWorkspaceRouter from './CentralWorkspaceRouter'
import AIContextPanel from './AIContextPanel'
import type { Stage } from '../types'
import type { AnalysisStep, KnowledgeGraph, PaperInsight } from '../../../shared/paper'
import type { DiagnosisResult } from '../modules/diagnosis/types'
import type { LearningReport } from '../modules/learning/report'
import type { NodeExpansionSession } from '../modules/workspace/nodeExpansionSessions'
import type { ExpansionGraphNode, NodeUnderstandingMemory } from '../../../shared/kg4'
import type { SelectedObject, WorkspaceState } from '../domains/workspace/types'

type ResizeTarget = 'left' | 'right'

interface AppShellProps {
  analysisSteps: AnalysisStep[]
  answers: Record<string, string>
  diagnosedStageIds: Set<string>
  diagnosisResults: Record<string, DiagnosisResult>
  drafts: Record<string, string>
  fontScale: number
  generating: boolean
  genError: string
  genProgress: string
  graph: KnowledgeGraph
  learningReport: LearningReport | null
  memories: NodeUnderstandingMemory[]
  nodeExpansionSessions: Record<string, NodeExpansionSession>
  paperInsight: PaperInsight | null
  onActivateWorkspaceTab: (tabId: string) => void
  onAdoptTransferTask: (prompt: string) => void
  onAnalyzePaper: () => void
  onBackToExpansionGraph: (expansionId: string) => void
  onClearExpansionGraph: () => void
  onCloseWorkspaceTab: (tabId: string) => void
  onConfirmDiagnosis: (stageId: string) => void
  onCycleFontSize: () => void
  onEnterStage: (stageId: string) => void
  onGenerateLearningReport: () => void
  onMemoriesLoaded: (memories: NodeUnderstandingMemory[]) => void
  onMarkNeedsReview: (stageId: string) => void
  onOpenFieldMemory: () => void
  onMouseDownResize: (target: ResizeTarget) => void
  onOpenExpandView: (expansionId: string, nodeId: string) => void
  onOpenNodeExpansion: (nodeId: string) => void
  onOpenSettings: () => void
  onRetryStage: (stageId: string) => void
  onSelectExpansionNode: (node: ExpansionGraphNode, expansionId: string) => void
  onSelectGraphNode: (nodeId: string | null) => void
  onSelectMemory: (memory: NodeUnderstandingMemory) => void
  onSelectObject: (selectedObject?: SelectedObject) => void
  onSelectPdf: () => void
  onSelectStage: (stageId: string | null) => void
  onSubmitAnswer: (stageId: string) => void
  onToggleRight: () => void
  onUpdateDraft: (stageId: string, value: string) => void
  pdfUrl: string | null
  rightCollapsed: boolean
  rightWidth: number
  selectedGraphNodeId: string | null
  selectedMemoryId?: string
  selectedObject?: SelectedObject
  selectedStageId: string | null
  stages: Stage[]
  workspaceState: WorkspaceState
}

function AppShell({
  analysisSteps,
  answers,
  diagnosedStageIds,
  diagnosisResults,
  drafts,
  fontScale,
  generating,
  genError,
  genProgress,
  graph,
  paperInsight,
  learningReport,
  memories,
  nodeExpansionSessions,
  onActivateWorkspaceTab,
  onAdoptTransferTask,
  onAnalyzePaper,
  onBackToExpansionGraph,
  onClearExpansionGraph,
  onCloseWorkspaceTab,
  onConfirmDiagnosis,
  onCycleFontSize,
  onEnterStage,
  onGenerateLearningReport,
  onMemoriesLoaded,
  onMarkNeedsReview,
  onOpenFieldMemory,
  onMouseDownResize,
  onOpenExpandView,
  onOpenNodeExpansion,
  onOpenSettings,
  onRetryStage,
  onSelectExpansionNode,
  onSelectGraphNode,
  onSelectMemory,
  onSelectObject,
  onSelectPdf,
  onSelectStage,
  onSubmitAnswer,
  onToggleRight,
  onUpdateDraft,
  pdfUrl,
  rightCollapsed,
  rightWidth,
  selectedGraphNodeId,
  selectedMemoryId,
  selectedObject,
  selectedStageId,
  stages,
  workspaceState
}: AppShellProps) {
  const activeWorkspaceTab = workspaceState.tabs.find((tab) => tab.id === workspaceState.activeTabId)

  const selectGraphNode = (nodeId: string) => {
    onSelectGraphNode(nodeId)
    onSelectObject({ type: 'graph_node', id: nodeId })
  }

  const selectStage = (stageId: string) => {
    onSelectStage(stageId)
    onSelectObject({ type: 'learning_stage', id: stageId })
  }

  const openStageLearning = (stageId: string) => {
    onActivateWorkspaceTab('stage_learning')
    selectStage(stageId)
  }

  return (
    <div className="app-container workspace-shell">
      <TopBar
        activeTab={activeWorkspaceTab}
        fontScale={fontScale}
        hasPdf={Boolean(pdfUrl)}
        hasGraph={graph.nodes.length > 0}
        onCycleFontSize={onCycleFontSize}
        onOpenSettings={onOpenSettings}
      />

      <div
        className="workspace-main"
        style={{
          gridTemplateColumns: `190px minmax(0, 1fr) ${!rightCollapsed ? '10px' : ''} ${rightCollapsed ? '36px' : `${rightWidth}px`}`
        }}
      >
        <WorkspaceSidebar
          activeTabId={workspaceState.activeTabId}
          tabs={workspaceState.tabs}
          onActivateTab={onActivateWorkspaceTab}
          onCloseTab={onCloseWorkspaceTab}
        />

        <CentralWorkspaceRouter
          activeTab={activeWorkspaceTab}
          answers={answers}
          diagnosedStageIds={diagnosedStageIds}
          diagnosisResults={diagnosisResults}
          drafts={drafts}
          graph={graph}
          kg4ExpansionGraph={null}
          memories={memories}
          nodeExpansionSessions={nodeExpansionSessions}
          paperInsight={paperInsight}
          selectedGraphNodeId={selectedGraphNodeId}
          selectedMemoryId={selectedMemoryId}
          selectedStageId={selectedStageId}
          stages={stages}
          pdfUrl={pdfUrl}
          onAdoptTransferTask={onAdoptTransferTask}
          onBackToExpansionGraph={onBackToExpansionGraph}
          onClearExpansionGraph={onClearExpansionGraph}
          onConfirmDiagnosis={onConfirmDiagnosis}
          onEnterStage={onEnterStage}
          onMarkNeedsReview={onMarkNeedsReview}
          onMemoriesLoaded={onMemoriesLoaded}
          onRetryStage={onRetryStage}
          onSelectExpansionNode={onSelectExpansionNode}
          onSelectGraphNode={selectGraphNode}
          onSelectMemory={onSelectMemory}
          onSelectStage={selectStage}
          onSubmitAnswer={onSubmitAnswer}
          onUpdateDraft={onUpdateDraft}
          onSelectPdf={onSelectPdf}
        />

        {!rightCollapsed && <div className="resize-handle" onMouseDown={() => onMouseDownResize('right')} />}

        <aside className={`panel panel-right ai-context-shell ${rightCollapsed ? 'panel--collapsed' : ''}`}>
          <div className="panel-header panel-header--right">
            <button className="panel-collapse-btn" onClick={onToggleRight} title="折叠 AI Context Panel">
              {rightCollapsed ? '‹' : '›'}
            </button>
            {!rightCollapsed && <span className="panel-header-title">AI Context</span>}
          </div>
          {!rightCollapsed && (
            <AIContextPanel
              analysisSteps={analysisSteps}
              generating={generating}
              genError={genError}
              genProgress={genProgress}
              graphNodes={graph.nodes}
              learningReport={learningReport}
              memories={memories}
              nodeExpansionSessions={nodeExpansionSessions}
              paperInsight={paperInsight}
              pdfUrl={pdfUrl}
              selectedObject={selectedObject}
              stages={stages}
              diagnosisResults={diagnosisResults}
              diagnosedStageIds={diagnosedStageIds}
              onAnalyzePaper={onAnalyzePaper}
              onGenerateLearningReport={onGenerateLearningReport}
              onOpenExpandView={onOpenExpandView}
              onOpenFieldMemory={onOpenFieldMemory}
              onOpenNodeExpansion={onOpenNodeExpansion}
              onOpenStageLearning={openStageLearning}
              onSelectPdf={onSelectPdf}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

export default AppShell
