import { PdfViewerProps } from '../modules/paper/types'

function ChromiumPdfViewer({ pdfUrl }: PdfViewerProps) {
  if (!pdfUrl) {
    return (
      <div className="empty-state">
        <p>上传论文 PDF 以开始学习</p>
      </div>
    )
  }

  return (
    <div className="pdf-container">
      <webview key={pdfUrl} src={pdfUrl} className="pdf-viewer" plugins />
    </div>
  )
}

export default ChromiumPdfViewer
