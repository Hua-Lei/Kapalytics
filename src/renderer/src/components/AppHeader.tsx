interface AppHeaderProps {
  fontScale: number
  hasGraph: boolean
  hasPdf: boolean
  onCycleFontSize: () => void
  onOpenSettings: () => void
}

function AppHeader({ fontScale, hasGraph, hasPdf, onCycleFontSize, onOpenSettings }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__left">
        <span className="app-header__logo">Kapalytics</span>
        <span className="app-header__subtitle">Paper Learning Workspace</span>
      </div>
      <div className="app-header__status" aria-label="论文状态">
        <span className={`status-pill ${hasPdf ? 'status-pill--ready' : ''}`}>
          {hasPdf ? 'PDF 已载入' : '等待 PDF'}
        </span>
        <span className={`status-pill ${hasGraph ? 'status-pill--ready' : ''}`}>
          {hasGraph ? '图谱已生成' : '未分析'}
        </span>
      </div>
      <div className="app-header__right">
        <button className="header-btn" onClick={onCycleFontSize} title="调整字体大小">
          A {Math.round(fontScale * 100)}%
        </button>
        <button className="header-btn header-btn--settings" onClick={onOpenSettings} title="设置">
          设置
        </button>
      </div>
    </header>
  )
}

export default AppHeader
