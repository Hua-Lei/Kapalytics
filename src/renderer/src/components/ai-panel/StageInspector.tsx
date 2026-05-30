import type { Stage } from '../../types'
import type { DiagnosisResult } from '../../../../shared/electron-api'
import TruncatedText from './TruncatedText'
import { useWorkspace } from '../../domains/workspace/useWorkspace'

function StageInspector({ stage, diagnosis, diagnosed }: {
  stage: Stage
  diagnosis: DiagnosisResult | undefined
  diagnosed: boolean
}) {
  const { activateTab, selectObject } = useWorkspace()

  const handleOpenStageLearning = () => {
    activateTab('stage_learning')
    selectObject({ type: 'learning_stage', id: stage.id })
  }

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
        <button className="stage-btn stage-btn--secondary" onClick={handleOpenStageLearning}>定位到中央学习区</button>
      </div>
    </div>
  )
}

export default StageInspector
