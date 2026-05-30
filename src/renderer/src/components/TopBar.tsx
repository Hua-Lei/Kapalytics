import type { WorkspaceTab } from '../domains/workspace/types'

interface TopBarProps {
  activeTab: WorkspaceTab | undefined
  fontScale: number
  hasGraph: boolean
  hasPdf: boolean
  onCycleFontSize: () => void
  onOpenSettings: () => void
}

function TopBar({ activeTab, fontScale, hasGraph, hasPdf, onCycleFontSize, onOpenSettings }: TopBarProps) {
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
      <div className="workspace-topbar__status" aria-label="论文状态">
        <span className={`status-pill ${hasPdf ? 'status-pill--ready' : ''}`}>{hasPdf ? 'PDF 已载入' : '等待 PDF'}</span>
        <span className={`status-pill ${hasGraph ? 'status-pill--ready' : ''}`}>{hasGraph ? '图谱已生成' : '未分析'}</span>
        <button className="header-btn" onClick={onCycleFontSize} title="调整字体大小">A {Math.round(fontScale * 100)}%</button>
        <button className="header-btn header-btn--settings" onClick={onOpenSettings} title="设置">设置</button>
      </div>
    </header>
  )
}

export default TopBar
