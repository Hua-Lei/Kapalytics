import type { DiagnosisResult } from '../modules/diagnosis/types'
import MathText from './MathText'

interface DiagnosisViewProps {
  result: DiagnosisResult | undefined
  answer: string
  onRetry: () => void
  onConfirm: () => void
}

const errorLabels: Record<string, string> = {
  field_misclassification: '领域归类错误',
  concept_confusion: '概念混淆错误',
  method_flow_error: '方法流程错误',
  formula_misunderstanding: '公式理解错误',
  experiment_misinterpretation: '实验解读错误',
  contribution_misjudgement: '贡献误判错误',
  transfer_insufficient: '迁移能力不足'
}

function DiagnosisView({ result, answer, onRetry, onConfirm }: DiagnosisViewProps) {
  if (!result) return null

  return (
    <div className="diagnosis-view">
      <div
        className={`diagnosis-banner ${result.isCorrect ? 'diagnosis-banner--pass' : 'diagnosis-banner--fail'}`}
      >
        <span className="diagnosis-icon">{result.isCorrect ? '✓' : '!'}</span>
        <div>
          <div className="diagnosis-title">
            {result.isCorrect ? '回答正确' : `诊断：${errorLabels[result.errorType] ?? result.errorType}`}
          </div>
          {!result.isCorrect && (
            <div className="diagnosis-error-type">
              {errorLabels[result.errorType] ?? result.errorType}
            </div>
          )}
        </div>
      </div>

      <div className="diagnosis-section">
        <div className="diagnosis-label">反馈</div>
        <p className="diagnosis-text">
          <MathText text={result.feedback} />
        </p>
      </div>

      <div className="diagnosis-section">
        <div className="diagnosis-label">补救任务</div>
        <p className="diagnosis-text">
          <MathText text={result.remedialTask} />
        </p>
      </div>

      <div className="diagnosis-section">
        <div className="diagnosis-label">你的回答</div>
        <p className="diagnosis-answer">{answer}</p>
      </div>

      <div className="stage-actions">
        {!result.isCorrect && (
          <button className="stage-btn stage-btn--primary" onClick={onRetry}>
            重新作答
          </button>
        )}
        <button className="stage-btn stage-btn--secondary" onClick={onConfirm}>
          {result.isCorrect ? '继续' : '标记已理解'}
        </button>
      </div>
    </div>
  )
}

export default DiagnosisView
