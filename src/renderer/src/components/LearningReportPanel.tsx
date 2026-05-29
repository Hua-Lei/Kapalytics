import type { LearningReport } from '../modules/learning/report'

interface LearningReportPanelProps {
  report: LearningReport | null
  onGenerate: () => void
}

function LearningReportPanel({ report, onGenerate }: LearningReportPanelProps) {
  return (
    <section className="learning-report">
      <div className="tutor-section__header">
        <span className="eyebrow">Future Feature F4</span>
        <h3>学习报告</h3>
        <p>基于阶段完成度、回答记录和诊断反馈，生成本篇论文的复盘报告。</p>
      </div>
      <button className="stage-btn stage-btn--primary stage-btn--block" onClick={onGenerate}>
        {report ? '重新生成学习报告' : '生成学习报告'}
      </button>

      {report && (
        <div className="learning-report__body">
          <div className="learning-report__summary">{report.summary}</div>

          <div className="learning-report__section">
            <h4>已掌握内容</h4>
            <ul>{report.mastered.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>

          <div className="learning-report__section">
            <h4>薄弱点</h4>
            <ul>{report.weakPoints.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>

          <div className="learning-report__section">
            <h4>错误历史</h4>
            {report.errorHistory.length ? (
              <ul>
                {report.errorHistory.map((item) => (
                  <li key={`${item.stageName}-${item.errorType}`}>
                    <strong>{item.stageName}</strong> · {item.errorType}：{item.feedback}
                  </li>
                ))}
              </ul>
            ) : (
              <p>暂无错误历史。</p>
            )}
          </div>

          <div className="learning-report__section">
            <h4>推荐复习内容</h4>
            <ul>{report.reviewRecommendations.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>

          <div className="learning-report__section learning-report__section--next">
            <h4>推荐下一篇论文</h4>
            <p>{report.nextPaperRecommendation}</p>
          </div>
        </div>
      )}
    </section>
  )
}

export default LearningReportPanel
