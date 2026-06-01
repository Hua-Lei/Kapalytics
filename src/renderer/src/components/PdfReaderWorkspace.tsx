import { usePaper } from '../domains/paper/usePaper'
import { hasCurrentPaperAnalysis } from '../domains/paper/paperSelectionState'
import { useWorkspace } from '../domains/workspace/useWorkspace'
import PdfViewer from './PdfViewer'

function PdfReaderWorkspace() {
  const { pdfUrl, paperId, graphPaperId, selectPdf, analyzePaper, clearCurrentPaperAnalysis, generating, genError, genProgress, graph } = usePaper()
  const { activateTab } = useWorkspace()

  if (!pdfUrl) {
    return (
      <div className="pdf-workspace-empty">
        <div className="pdf-empty-state__mark">PDF</div>
        <h2>选择一篇 AI 论文开始构建学习地图</h2>
        <p>PDF Reader 是一个独立 Workspace。上传 PDF 后，可在这里阅读原文，并切换到 Paper Graph 生成图谱。</p>
        <button className="upload-btn" onClick={selectPdf}>选择 PDF 文件</button>
      </div>
    )
  }

  const hasAnalysis = hasCurrentPaperAnalysis({ graph, graphPaperId, paperId })

  return (
    <div className="pdf-workspace-reader">
      <div className="pdf-workspace-toolbar">
        <div>
          <span className="panel-header-subtitle">PDF Reader</span>
          <h3>阅读原文并构建学习地图</h3>
          <p>PDF 默认适配窗口宽度。若当前 PDF 绑定了错误图谱，可清除后重新分析。</p>
        </div>
        <div className="pdf-workspace-toolbar__actions">
          {!hasAnalysis ? (
            <button
              className="stage-btn stage-btn--primary"
              onClick={analyzePaper}
              disabled={generating}
            >
              {generating ? '分析中...' : '分析论文'}
            </button>
          ) : (
            <button
              className="stage-btn stage-btn--secondary"
              onClick={() => activateTab('paper_graph')}
            >
              查看知识图谱
            </button>
          )}
          <button className="stage-btn stage-btn--secondary" onClick={selectPdf}>更换 PDF</button>
          {hasAnalysis && (
            <button
              className="stage-btn stage-btn--secondary"
              onClick={() => {
                if (window.confirm('清除当前 PDF 已保存的知识图谱和学习阶段？此操作不会删除 PDF 文件。')) {
                  clearCurrentPaperAnalysis()
                }
              }}
            >
              清除图谱
            </button>
          )}
        </div>
      </div>
      {generating && (
        <div className="analysis-progress-banner">
          <span className="analysis-progress-banner__spinner" />
          <div>
            <strong>正在分析论文...</strong>
            <p>{genProgress || '准备中...'}</p>
          </div>
        </div>
      )}
      {genError && (
        <div className="diagnosis-banner diagnosis-banner--fail">
          <span className="diagnosis-icon">!</span>
          <div>
            <div className="diagnosis-title">分析失败</div>
            <p className="diagnosis-text">{genError}</p>
          </div>
          <button className="stage-btn stage-btn--primary" onClick={analyzePaper}>重试</button>
        </div>
      )}
      <PdfViewer pdfUrl={pdfUrl} />
    </div>
  )
}

export default PdfReaderWorkspace
