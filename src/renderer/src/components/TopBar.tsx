import { useWorkspace } from '../domains/workspace/useWorkspace'
import { usePaper } from '../domains/paper/usePaper'

interface TopBarProps {
  fontScale: number
  onCycleFontSize: () => void
  onOpenSettings: () => void
}

function TopBar({ fontScale, onCycleFontSize, onOpenSettings }: TopBarProps) {
  const { activeTab } = useWorkspace()
  const { pdfUrl, graph, analyzePaper, generating } = usePaper()
  const hasPdf = Boolean(pdfUrl)
  const hasGraph = graph.nodes.length > 0
  const canAnalyze = hasPdf && !hasGraph && !generating

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
        {canAnalyze && (
          <button className="stage-btn stage-btn--primary" onClick={analyzePaper} style={{ padding: '4px 12px', fontSize: '0.85rem' }}>
            分析论文
          </button>
        )}
        <button className="header-btn" onClick={onCycleFontSize} title="调整字体大小">A {Math.round(fontScale * 100)}%</button>
        <button className="header-btn header-btn--settings" onClick={onOpenSettings} title="设置">设置</button>
      </div>
    </header>
  )
}

export default TopBar
