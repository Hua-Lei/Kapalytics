import type { Stage } from '../types'
import type { DiagnosisResult } from '../modules/diagnosis/types'
import MathText from './MathText'

interface StageDetailProps {
  answer: string
  diagnosed: boolean
  diagnosisError: string | null
  diagnosisLoading: boolean
  diagnosisResult: DiagnosisResult | undefined
  draft: string
  onConfirmDiagnosis: () => void
  onEnterStage: () => void
  onMarkNeedsReview: () => void
  onRetryDiagnosis: () => void
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
  diagnosisError,
  diagnosisLoading,
  diagnosisResult,
  draft,
  onConfirmDiagnosis,
  onEnterStage,
  onMarkNeedsReview,
  onRetryDiagnosis,
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
          <div className="diagnosis-view">
            <div className={`diagnosis-banner ${diagnosisResult?.isCorrect ? 'diagnosis-banner--pass' : 'diagnosis-banner--fail'}`}>
              <span className="diagnosis-icon">{diagnosisResult?.isCorrect ? '✓' : '!'}</span>
              <div>
                <div className="diagnosis-title">
                  {diagnosisResult?.isCorrect ? '回答正确' : '诊断：请查看反馈'}
                </div>
              </div>
            </div>
            {diagnosisResult?.feedback && (
              <div className="diagnosis-section">
                <div className="diagnosis-label">反馈</div>
                <p className="diagnosis-text"><MathText text={diagnosisResult.feedback} /></p>
              </div>
            )}
            <div className="stage-actions">
              {!diagnosisResult?.isCorrect && (
                <button className="stage-btn stage-btn--primary" onClick={onRetryStage}>重新作答</button>
              )}
              <button className="stage-btn stage-btn--secondary" onClick={onConfirmDiagnosis}>
                {diagnosisResult?.isCorrect ? '继续' : '标记已理解'}
              </button>
            </div>
          </div>
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
            {diagnosisError && (
              <div className="diagnosis-banner diagnosis-banner--fail" style={{ marginTop: 12 }}>
                <span className="diagnosis-icon">!</span>
                <div>
                  <div className="diagnosis-title">诊断失败</div>
                  <p className="diagnosis-text">{diagnosisError}</p>
                </div>
                <button
                  className="stage-btn stage-btn--primary"
                  onClick={onRetryDiagnosis}
                  disabled={diagnosisLoading}
                >
                  {diagnosisLoading ? '重试中...' : '重试'}
                </button>
              </div>
            )}
            <div className="stage-actions">
              <button
                className="stage-btn stage-btn--primary"
                disabled={!draft.trim() || diagnosisLoading}
                onClick={onSubmitAnswer}
              >
                {diagnosisLoading ? '诊断中...' : '提交答案'}
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
