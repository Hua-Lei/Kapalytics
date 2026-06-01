import { useWorkspace } from '../domains/workspace/useWorkspace'
import { usePaper } from '../domains/paper/usePaper'
import { hasCurrentPaperAnalysis } from '../domains/paper/paperSelectionState'

interface TopBarProps {
  fontScale: number
  onCycleFontSize: () => void
  onOpenSettings: () => void
}

function TopBar({ fontScale, onCycleFontSize, onOpenSettings }: TopBarProps) {
  const { activeTab } = useWorkspace()
  const { pdfUrl, paperId, graphPaperId, graph, generating } = usePaper()
  const hasPdf = Boolean(pdfUrl)
  const hasGraph = hasCurrentPaperAnalysis({ graph, graphPaperId, paperId })

  return (
    <header className="workspace-topbar">
      <div className="workspace-topbar__brand">
        <span className="workspace-topbar__logo">Kapalytics</span>
        <span className="workspace-topbar__subtitle">Multi-workspace research desk</span>
      </div>
      <div className="workspace-topbar__current">
        <span>Workspace</span>
        <strong>{activeTab?.title ?? 'Paper Graph'}</strong>
      </div>
      <div className="workspace-topbar__status">
        <span className={`status-pill ${hasPdf ? 'status-pill--ready' : ''}`}>{hasPdf ? 'PDF 已载入' : '等待 PDF'}</span>
        <span className={`status-pill ${hasGraph ? 'status-pill--ready' : ''}`}>{hasGraph ? '图谱已生成' : generating ? '分析中...' : '未分析'}</span>
        <button className="header-btn" onClick={onCycleFontSize} title="调整字体大小">字号 {['舒适', '大', '更大', '最大'][fontScale] ?? '舒适'}</button>
        <button className="header-btn header-btn--settings" onClick={onOpenSettings} title="设置">设置</button>
      </div>
    </header>
  )
}

export default TopBar
