import { Stage } from '../types'

interface RightPanelProps {
  selectedStage: Stage | null
}

const statusText: Record<string, string> = {
  not_started: '未开始',
  in_progress: '学习中',
  completed: '已完成',
  needs_review: '需复习'
}

function RightPanel({ selectedStage }: RightPanelProps) {
  if (!selectedStage) {
    return (
      <aside className="panel panel-right">
        <div className="panel-header">AI 学习面板</div>
        <div className="panel-body">
          <div className="empty-state">选择左侧学习阶段以查看详情</div>
        </div>
      </aside>
    )
  }

  return (
    <aside className="panel panel-right">
      <div className="panel-header">AI 学习面板</div>
      <div className="panel-body">
        <div className="stage-detail">
          <div className="stage-detail__meta">
            阶段 {selectedStage.order} · {statusText[selectedStage.status]}
          </div>
          <h3 className="stage-detail__title">{selectedStage.name}</h3>
          <p className="stage-detail__description">{selectedStage.description}</p>
          <div className="stage-detail__task">
            <div className="task-label">阶段任务</div>
            <div className="task-placeholder">任务将在选择论文后由 AI 自动生成</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default RightPanel
