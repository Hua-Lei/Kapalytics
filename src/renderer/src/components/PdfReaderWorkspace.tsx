import { usePaper } from '../domains/paper/usePaper'
import { useWorkspace } from '../domains/workspace/useWorkspace'
import PdfViewer from './PdfViewer'

function PdfReaderWorkspace() {
  const { pdfUrl, selectPdf, analyzePaper, generating, genError, genProgress, graph } = usePaper()
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

  const hasAnalysis = graph.nodes.length > 0

  return (
    <div className="pdf-workspace-reader">
      <div className="pdf-workspace-toolbar">
        <button className="upload-btn" onClick={selectPdf}>重新选择 PDF</button>
        {!hasAnalysis && (
          <button
            className="stage-btn stage-btn--primary"
            onClick={analyzePaper}
            disabled={generating}
          >
            {generating ? '分析中...' : '分析论文'}
          </button>
        )}
        {hasAnalysis && (
          <button
            className="stage-btn stage-btn--secondary"
            onClick={() => activateTab('paper_graph')}
          >
            查看知识图谱
          </button>
        )}
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
