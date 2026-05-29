import type { AnalysisStep, GraphNode, PaperInsight } from '../../../shared/paper'
import type { Kg4ExpansionGraphLayer } from '../../../shared/kg4'
import type { DiagnosisResult } from '../modules/diagnosis/types'
import type { LearningReport } from '../modules/learning/report'
import type { Stage } from '../types'
import AnalysisPanel from './AnalysisPanel'
import LearningReportPanel from './LearningReportPanel'
import NodeDetailPanel from './NodeDetailPanel'
import StageDetail from './StageDetail'

type ActiveTab = 'graph' | 'learning'

export interface RightLearningPanelProps {
  activeTab: ActiveTab
  analysisSteps: AnalysisStep[]
  answers: Record<string, string>
  diagnosedStageIds: Set<string>
  diagnosisResults: Record<string, DiagnosisResult>
  drafts: Record<string, string>
  generating: boolean
  genError: string
  genProgress: string
  learningReport: LearningReport | null
  onAnalyzePaper: () => void
  onAdoptTransferTask: (prompt: string) => void
  onSetKg4ExpansionGraph: (layer: Kg4ExpansionGraphLayer | null) => void
  onConfirmDiagnosis: (stageId: string) => void
  onEnterStage: (stageId: string) => void
  onGenerateLearningReport: () => void
  onMarkNeedsReview: (stageId: string) => void
  onRetryStage: (stageId: string) => void
  onSelectPdf: () => void
  onSubmitAnswer: (stageId: string) => void
  onUpdateDraft: (stageId: string, value: string) => void
  pdfUrl: string | null
  paperInsight: PaperInsight | null
  selectedGraphNode: GraphNode | null
  selectedStage: Stage | null
  stages: Stage[]
}

function EmptyTutorState({ pdfUrl, stages }: { pdfUrl: string | null; stages: Stage[] }) {
  const nextStage = stages.find((s) => s.status === 'not_started' || s.status === 'needs_review')
  return (
    <div className="tutor-empty-state">
      <span className="eyebrow">Next Step</span>
      <h3>{pdfUrl ? '选择一个节点或学习阶段' : '从上传论文开始'}</h3>
      <p>
        {pdfUrl
          ? '图谱节点用于理解概念关系，学习路径用于阶段练习和诊断。'
          : '上传 PDF 后，右侧会引导你完成分析、学习和诊断。'}
      </p>
      {nextStage && (
        <div className="next-stage-card">
          <span>推荐下一步</span>
          <strong>阶段 {nextStage.order} · {nextStage.name}</strong>
          {nextStage.status === 'needs_review' && <em>需要复习</em>}
        </div>
      )}
    </div>
  )
}

function RightLearningPanel(props: RightLearningPanelProps) {
  const {
    activeTab,
    analysisSteps,
    answers,
    diagnosedStageIds,
    diagnosisResults,
    drafts,
    generating,
    genError,
    genProgress,
    learningReport,
    onAnalyzePaper,
    onAdoptTransferTask,
    onSetKg4ExpansionGraph,
    onConfirmDiagnosis,
    onEnterStage,
    onGenerateLearningReport,
    onMarkNeedsReview,
    onRetryStage,
    onSelectPdf,
    onSubmitAnswer,
    onUpdateDraft,
    pdfUrl,
    paperInsight,
    selectedGraphNode,
    selectedStage,
    stages
  } = props

  let body: React.ReactNode
  if (activeTab === 'graph') {
    body = selectedGraphNode ? (
      <NodeDetailPanel
        node={selectedGraphNode}
        paperInsight={paperInsight}
        onAdoptTransferTask={onAdoptTransferTask}
        onSetKg4ExpansionGraph={onSetKg4ExpansionGraph}
      />
    ) : (
      <AnalysisPanel
        analysisSteps={analysisSteps}
        generating={generating}
        genError={genError}
        genProgress={genProgress}
        onAnalyzePaper={onAnalyzePaper}
        onSelectPdf={onSelectPdf}
        pdfUrl={pdfUrl}
      />
    )
  } else if (selectedStage) {
    body = (
      <StageDetail
        answer={answers[selectedStage.id] ?? ''}
        diagnosed={diagnosedStageIds.has(selectedStage.id)}
        diagnosisResult={diagnosisResults[selectedStage.id]}
        draft={drafts[selectedStage.id] ?? ''}
        onConfirmDiagnosis={() => onConfirmDiagnosis(selectedStage.id)}
        onEnterStage={() => onEnterStage(selectedStage.id)}
        onMarkNeedsReview={() => onMarkNeedsReview(selectedStage.id)}
        onRetryStage={() => onRetryStage(selectedStage.id)}
        onSubmitAnswer={() => onSubmitAnswer(selectedStage.id)}
        onUpdateDraft={(value) => onUpdateDraft(selectedStage.id, value)}
        stage={selectedStage}
      />
    )
  } else {
    body = (
      <>
        <EmptyTutorState pdfUrl={pdfUrl} stages={stages} />
        <LearningReportPanel report={learningReport} onGenerate={onGenerateLearningReport} />
      </>
    )
  }

  return <div className="panel-body tutor-panel">{body}</div>
}

export default RightLearningPanel
