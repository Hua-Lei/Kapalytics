import AppHeader from './AppHeader'
import CenterPanel from './CenterPanel'
import PdfPanel from './PdfPanel'
import RightLearningPanel, { RightLearningPanelProps } from './RightLearningPanel'
import type { Stage } from '../types'
import type { KnowledgeGraph, PaperInsight } from '../../../shared/paper'
import type { Kg4ExpansionGraphLayer } from '../../../shared/kg4'

type ActiveTab = 'graph' | 'learning'
type ResizeTarget = 'left' | 'right'

interface AppShellProps extends RightLearningPanelProps {
  activeTab: ActiveTab
  fontScale: number
  graph: KnowledgeGraph
  kg4ExpansionGraph: Kg4ExpansionGraphLayer | null
  paperInsight: PaperInsight | null
  leftCollapsed: boolean
  leftWidth: number
  onCycleFontSize: () => void
  onAdoptTransferTask: (prompt: string) => void
  onSetKg4ExpansionGraph: (layer: Kg4ExpansionGraphLayer | null) => void
  onMouseDownResize: (target: ResizeTarget) => void
  onOpenSettings: () => void
  onSelectGraphNode: (nodeId: string | null) => void
  onSelectStage: (stageId: string | null) => void
  onSelectTab: (tab: ActiveTab) => void
  onToggleLeft: () => void
  onToggleRight: () => void
  rightCollapsed: boolean
  rightWidth: number
  selectedGraphNodeId: string | null
  selectedStageId: string | null
  stages: Stage[]
}

function AppShell({
  activeTab,
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
  kg4ExpansionGraph,
  paperInsight,
  leftCollapsed,
  leftWidth,
  learningReport,
  onAnalyzePaper,
  onAdoptTransferTask,
  onConfirmDiagnosis,
  onCycleFontSize,
  onEnterStage,
  onSetKg4ExpansionGraph,
  onGenerateLearningReport,
  onMarkNeedsReview,
  onMouseDownResize,
  onOpenSettings,
  onRetryStage,
  onSelectGraphNode,
  onSelectPdf,
  onSelectStage,
  onSelectTab,
  onSubmitAnswer,
  onToggleLeft,
  onToggleRight,
  onUpdateDraft,
  pdfUrl,
  rightCollapsed,
  rightWidth,
  selectedGraphNode,
  selectedGraphNodeId,
  selectedStage,
  selectedStageId,
  stages
}: AppShellProps) {
  return (
    <div className="app-container">
      <AppHeader
        fontScale={fontScale}
        hasPdf={Boolean(pdfUrl)}
        hasGraph={graph.nodes.length > 0}
        onCycleFontSize={onCycleFontSize}
        onOpenSettings={onOpenSettings}
      />

      <div className="app-main">
        <PdfPanel
          collapsed={leftCollapsed}
          onSelectPdf={onSelectPdf}
          onToggleCollapsed={onToggleLeft}
          pdfUrl={pdfUrl}
          width={leftCollapsed ? 36 : leftWidth}
        />

        {!leftCollapsed && (
          <div className="resize-handle" onMouseDown={() => onMouseDownResize('left')} />
        )}

        <CenterPanel
          activeTab={activeTab}
          graph={graph}
          paperInsight={paperInsight}
          onSelectGraphNode={(nodeId) => onSelectGraphNode(nodeId)}
          onSelectStage={(stageId) => onSelectStage(stageId)}
          onTabChange={(tab) => {
            onSelectTab(tab)
            onSelectStage(null)
            onSelectGraphNode(null)
          }}
          selectedGraphNodeId={selectedGraphNodeId}
          selectedStageId={selectedStageId}
          stages={stages}
          expansionGraph={kg4ExpansionGraph}
          onClearExpansionGraph={() => onSetKg4ExpansionGraph(null)}
        />

        {!rightCollapsed && (
          <div className="resize-handle" onMouseDown={() => onMouseDownResize('right')} />
        )}

        <aside
          className={`panel panel-right ${rightCollapsed ? 'panel--collapsed' : ''}`}
          style={{ width: rightCollapsed ? 36 : rightWidth }}
        >
          <div className="panel-header panel-header--right">
            <button className="panel-collapse-btn" onClick={onToggleRight} title="折叠学习面板">
              {rightCollapsed ? '‹' : '›'}
            </button>
            {!rightCollapsed && <span className="panel-header-title">AI Tutor</span>}
          </div>
          {!rightCollapsed && (
            <RightLearningPanel
              activeTab={activeTab}
              analysisSteps={analysisSteps}
              answers={answers}
              diagnosedStageIds={diagnosedStageIds}
              diagnosisResults={diagnosisResults}
              drafts={drafts}
              generating={generating}
              genError={genError}
              genProgress={genProgress}
              learningReport={learningReport}
              onAnalyzePaper={onAnalyzePaper}
              onAdoptTransferTask={onAdoptTransferTask}
              onSetKg4ExpansionGraph={onSetKg4ExpansionGraph}
              onConfirmDiagnosis={onConfirmDiagnosis}
              onEnterStage={onEnterStage}
              onGenerateLearningReport={onGenerateLearningReport}
              onMarkNeedsReview={onMarkNeedsReview}
              onRetryStage={onRetryStage}
              onSelectPdf={onSelectPdf}
              onSubmitAnswer={onSubmitAnswer}
              onUpdateDraft={onUpdateDraft}
              pdfUrl={pdfUrl}
              paperInsight={paperInsight}
              selectedGraphNode={selectedGraphNode}
              selectedStage={selectedStage}
              stages={stages}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

export default AppShell
