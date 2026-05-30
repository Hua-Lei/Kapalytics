import { usePaper } from '../domains/paper/usePaper'
import PdfViewer from './PdfViewer'

function PdfReaderWorkspace() {
  const { pdfUrl, selectPdf } = usePaper()

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
  return <div className="pdf-workspace-reader"><PdfViewer pdfUrl={pdfUrl} /></div>
}

export default PdfReaderWorkspace
