import { Stage } from '../types'

interface LearningPathProps {
  stages: Stage[]
  selectedStageId: string | null
  onSelectStage: (stageId: string) => void
}

function LearningPath({ stages, selectedStageId, onSelectStage }: LearningPathProps) {
  const statusLabel: Record<string, string> = {
    not_started: '未开始',
    in_progress: '学习中',
    completed: '已完成',
    needs_review: '需复习'
  }

  return (
    <div className="learning-path">
      {stages.map((stage) => {
        const isSelected = stage.id === selectedStageId

        return (
          <div
            key={stage.id}
            className={`stage-item ${isSelected ? 'stage-item--selected' : ''}`}
            onClick={() => onSelectStage(stage.id)}
          >
            <div className={`stage-number stage-number--${stage.status}`}>
              {stage.status === 'completed' ? '✓' : stage.order}
            </div>
            <div className="stage-info">
              <span className="stage-name">{stage.order}. {stage.name}</span>
            </div>
            <span className={`stage-badge stage-badge--${stage.status}`}>
              {statusLabel[stage.status]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default LearningPath
