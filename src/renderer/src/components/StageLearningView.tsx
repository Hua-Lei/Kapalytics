import { useStages } from '../domains/stages/useStages'
import { useWorkspace } from '../domains/workspace/useWorkspace'
import LearningPath from './LearningPath'
import StageDetail from './StageDetail'

function StageLearningView() {
  const {
    stages, selectedStageId, selectStage, answers, diagnosedStageIds,
    diagnosisResults, drafts, enterStage, submitAnswer, confirmDiagnosis,
    retryStage, markNeedsReview, updateDraft
  } = useStages()

  const { selectObject } = useWorkspace()

  const handleSelectStage = (stageId: string) => {
    selectStage(stageId)
    selectObject({ type: 'learning_stage', id: stageId })
  }

  const selectedStage = stages.find((s) => s.id === selectedStageId) ?? null

  return (
    <div className="stage-learning-workspace">
      <div className="stage-learning-workspace__path">
        <LearningPath stages={stages} selectedStageId={selectedStageId} onSelectStage={handleSelectStage} />
      </div>
      <div className="stage-learning-workspace__detail">
        {selectedStage ? (
          <StageDetail
            answer={answers[selectedStage.id] ?? ''}
            diagnosed={diagnosedStageIds.has(selectedStage.id)}
            diagnosisResult={diagnosisResults[selectedStage.id]}
            draft={drafts[selectedStage.id] ?? ''}
            stage={selectedStage}
            onConfirmDiagnosis={() => confirmDiagnosis(selectedStage.id)}
            onEnterStage={() => enterStage(selectedStage.id)}
            onMarkNeedsReview={() => markNeedsReview(selectedStage.id)}
            onRetryStage={() => retryStage(selectedStage.id)}
            onSubmitAnswer={() => submitAnswer(selectedStage.id)}
            onUpdateDraft={(v: string) => updateDraft(selectedStage.id, v)}
          />
        ) : (
          <div className="workspace-placeholder-view">
            <h3>选择一个阶段开始学习</h3>
            <p>阶段作答和诊断位于中央 Stage Learning Workspace。</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default StageLearningView
