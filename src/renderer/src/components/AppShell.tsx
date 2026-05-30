import TopBar from './TopBar'
import WorkspaceSidebar from './WorkspaceSidebar'
import CentralWorkspaceRouter from './CentralWorkspaceRouter'
import AIContextPanel from './AIContextPanel'

interface AppShellProps {
  fontScale: number
  rightCollapsed: boolean
  rightWidth: number
  onCycleFontSize: () => void
  onMouseDownResize: () => void
  onOpenSettings: () => void
  onToggleRight: () => void
}

function AppShell({
  fontScale,
  rightCollapsed,
  rightWidth,
  onCycleFontSize,
  onMouseDownResize,
  onOpenSettings,
  onToggleRight
}: AppShellProps) {
  return (
    <div className="app-container workspace-shell">
      <TopBar
        fontScale={fontScale}
        onCycleFontSize={onCycleFontSize}
        onOpenSettings={onOpenSettings}
      />

      <div
        className="workspace-main"
        style={{
          gridTemplateColumns: `190px minmax(0, 1fr) ${!rightCollapsed ? '10px' : ''} ${rightCollapsed ? '36px' : `${rightWidth}px`}`
        }}
      >
        <WorkspaceSidebar />

        <CentralWorkspaceRouter />

        {!rightCollapsed && <div className="resize-handle" onMouseDown={onMouseDownResize} />}

        <aside className={`panel panel-right ai-context-shell ${rightCollapsed ? 'panel--collapsed' : ''}`}>
          <div className="panel-header panel-header--right">
            <button className="panel-collapse-btn" onClick={onToggleRight} title="折叠 AI Context Panel">
              {rightCollapsed ? '‹' : '›'}
            </button>
            {!rightCollapsed && <span className="panel-header-title">AI Context</span>}
          </div>
          {!rightCollapsed && <AIContextPanel />}
        </aside>
      </div>
    </div>
  )
}

export default AppShell
