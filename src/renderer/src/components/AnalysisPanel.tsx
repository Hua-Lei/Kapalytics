import type { AnalysisStep } from '../../../shared/paper'

interface AnalysisPanelProps {
  analysisSteps: AnalysisStep[]
  generating: boolean
  genError: string
  genProgress: string
  onAnalyzePaper: () => void
  onSelectPdf: () => void
  pdfUrl: string | null
}

function AnalysisPanel({
  analysisSteps,
  generating,
  genError,
  genProgress,
  onAnalyzePaper,
  onSelectPdf,
  pdfUrl
}: AnalysisPanelProps) {
  return (
    <div className="tutor-section analysis-panel">
      <div className="tutor-section__header">
        <span className="eyebrow">Paper Intelligence</span>
        <h3>论文分析</h3>
        <p>
          {pdfUrl
            ? '提取 PDF 正文，构建知识图谱，并生成阶段学习任务。'
            : '先上传一篇包含文字层的 PDF，再开始分析。'}
        </p>
      </div>

      <button
        className="stage-btn stage-btn--primary stage-btn--block"
        disabled={generating}
        onClick={pdfUrl ? onAnalyzePaper : onSelectPdf}
      >
        {pdfUrl ? (generating ? '分析中...' : '开始分析论文') : '选择 PDF 文件'}
      </button>

      {genProgress && <p className="gen-progress">{genProgress}</p>}
      {genError && <p className="gen-error">{genError}</p>}

      <div className="analysis-steps">
        {analysisSteps.map((step) => (
          <div key={step.id} className={`analysis-step analysis-step--${step.status}`}>
            <span className="analysis-step__dot" />
            <span>{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AnalysisPanel
