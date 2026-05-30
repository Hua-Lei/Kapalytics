import type { Stage } from '../../types'

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

export default EmptyContextPanel
