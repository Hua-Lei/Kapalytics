interface AppHeaderProps {
  fontScale: number
  onCycleFontSize: () => void
  onOpenSettings: () => void
}

function AppHeader({ fontScale, onCycleFontSize, onOpenSettings }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__left">
        <span className="app-header__logo">Kapalytics</span>
        <span className="app-header__subtitle">AI Paper Learning</span>
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
