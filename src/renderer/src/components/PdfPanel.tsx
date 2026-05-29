import PdfViewer from './PdfViewer'

interface PdfPanelProps {
  collapsed: boolean
  onSelectPdf: () => void
  onToggleCollapsed: () => void
  pdfUrl: string | null
  width: number
}

function PdfPanel({ collapsed, onSelectPdf, onToggleCollapsed, pdfUrl, width }: PdfPanelProps) {
  return (
    <aside className={`panel panel-left ${collapsed ? 'panel--collapsed' : ''}`} style={{ width }}>
      <div className="panel-header panel-header--paper">
        {!collapsed && (
          <div className="panel-heading">
            <span className="panel-header-title">Paper Panel</span>
            <span className="panel-header-subtitle">PDF Reader</span>
          </div>
        )}
        <div className="panel-header-actions">
          {pdfUrl && !collapsed && (
            <button className="panel-action-btn" onClick={onSelectPdf} title="更换 PDF">
              更换 PDF
            </button>
          )}
          <button className="panel-collapse-btn" onClick={onToggleCollapsed} title="折叠 PDF 面板">
            {collapsed ? '›' : '‹'}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="panel-body panel-body--pdf">
          {pdfUrl ? (
            <PdfViewer pdfUrl={pdfUrl} />
          ) : (
            <div className="pdf-empty-state">
              <div className="pdf-empty-state__mark">PDF</div>
              <h2>选择一篇 AI 论文开始构建学习地图</h2>
              <p>上传包含文字层的 PDF，Kapalytics 会提取正文、生成知识图谱，并拆分阶段学习任务。</p>
              <button className="upload-btn" onClick={onSelectPdf}>选择 PDF 文件</button>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

export default PdfPanel
