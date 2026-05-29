import type { Stage } from '../types'
import type { DiagnosisResult } from '../modules/diagnosis/types'
import DiagnosisView from './DiagnosisView'
import MathText from './MathText'

interface StageDetailProps {
  answer: string
  diagnosed: boolean
  diagnosisResult: DiagnosisResult | undefined
  draft: string
  onConfirmDiagnosis: () => void
  onEnterStage: () => void
  onMarkNeedsReview: () => void
  onRetryStage: () => void
  onSubmitAnswer: () => void
  onUpdateDraft: (value: string) => void
  stage: Stage
}

const statusText: Record<Stage['status'], string> = {
  not_started: '未开始',
  in_progress: '学习中',
  completed: '已完成',
  needs_review: '需复习'
}

function StageDetail({
  answer,
  diagnosed,
  diagnosisResult,
  draft,
  onConfirmDiagnosis,
  onEnterStage,
  onMarkNeedsReview,
  onRetryStage,
  onSubmitAnswer,
  onUpdateDraft,
  stage
}: StageDetailProps) {
  const currentAnswer = draft || answer

  return (
    <div className="stage-detail">
      <div className="stage-detail__meta-row">
        <span className={`stage-detail__meta stage-detail__meta--${stage.status}`}>
          阶段 {stage.order} · {statusText[stage.status]}
        </span>
        <span className="stage-detail__mastery">掌握度 {stage.mastery}%</span>
      </div>
      <h3 className="stage-detail__title">{stage.name}</h3>
      <div className="mastery-bar">
        <div className="mastery-bar__fill" style={{ width: `${stage.mastery}%` }} />
      </div>

      <section className="learning-card">
        <div className="task-label">阶段目标</div>
        <p className="stage-detail__description"><MathText text={stage.description} /></p>
      </section>

      {stage.status === 'not_started' && (
        <div className="stage-actions">
          <button className="stage-btn stage-btn--primary" onClick={onEnterStage}>开始学习</button>
        </div>
      )}

      {(stage.status === 'in_progress' || stage.status === 'needs_review') && (
        diagnosed ? (
          <DiagnosisView
            answer={answer}
            onConfirm={onConfirmDiagnosis}
            onRetry={onRetryStage}
            result={diagnosisResult}
          />
        ) : (
          <div className="stage-task-area">
            <section className="learning-card learning-card--task">
              <div className="task-label">阶段任务</div>
              <p className="task-prompt"><MathText text={stage.task} /></p>
            </section>
            <label className="task-label" htmlFor={`answer-${stage.id}`}>你的回答</label>
            <textarea
              id={`answer-${stage.id}`}
              className="task-answer-input"
              placeholder="像写研究笔记一样回答：指出关键概念、推理链条和论文证据。"
              rows={6}
              value={currentAnswer}
              onChange={(e) => onUpdateDraft(e.target.value)}
            />
            <div className="stage-actions">
              <button
                className="stage-btn stage-btn--primary"
                disabled={!draft.trim()}
                onClick={onSubmitAnswer}
              >
                提交答案
              </button>
              {stage.status === 'in_progress' && (
                <button
                  className="stage-btn stage-btn--secondary"
                  disabled={!draft.trim()}
                  onClick={onMarkNeedsReview}
                >
                  稍后复习
                </button>
              )}
            </div>
          </div>
        )
      )}

      {stage.status === 'completed' && (
        <div className="stage-completed">
          <div className="stage-completed__icon">✓</div>
          <p className="stage-completed__text">本阶段已完成。你可以重新学习以更新理解。</p>
          {answer && (
            <div className="stage-answer-saved">
              <div className="task-label">你的回答</div>
              <p className="stage-answer-text">{answer}</p>
            </div>
          )}
          <div className="stage-actions">
            <button className="stage-btn stage-btn--secondary" onClick={onEnterStage}>重新学习</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default StageDetail
