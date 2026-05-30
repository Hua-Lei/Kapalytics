import { useWorkspace } from '../domains/workspace/useWorkspace'

const WORKSPACE_DESCRIPTIONS: Record<string, string> = {
  pdf_reader: '论文原文阅读',
  paper_graph: '当前论文图谱',
  argument_chain: '论证链理解',
  method_mechanism: '方法机制拆解',
  stage_learning: '阶段学习诊断',
  node_expansion_loading: '节点展开任务',
  expansion_graph: '临时扩展图谱',
  expand_view: '完整展开工作台',
  field_memory: '长期理解记忆'
}

function WorkspaceSidebar() {
  const { state, activateTab, closeTab } = useWorkspace()
  const coreTabs = state.tabs.filter((tab) => !tab.closable)
  const sessionTabs = state.tabs.filter((tab) => tab.closable)

  return (
    <aside className="workspace-sidebar" aria-label="Workspace navigation">
      <section className="workspace-sidebar__section">
        <span className="workspace-sidebar__label">Workspaces</span>
        <div className="workspace-sidebar__nav">
          {coreTabs.map((tab) => (
            <button
              key={tab.id}
              className={`workspace-nav-item ${state.activeTabId === tab.id ? 'workspace-nav-item--active' : ''}`}
              onClick={() => activateTab(tab.id)}
              type="button"
            >
              <strong>{tab.title}</strong>
              <span>{WORKSPACE_DESCRIPTIONS[tab.type] ?? tab.type}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="workspace-sidebar__section workspace-sidebar__section--grow">
        <span className="workspace-sidebar__label">Open Expansion Tabs</span>
        {sessionTabs.length ? (
          <div className="workspace-sidebar__nav">
            {sessionTabs.map((tab) => (
              <div
                key={tab.id}
                className={`workspace-nav-item ${state.activeTabId === tab.id ? 'workspace-nav-item--active' : ''}`}
              >
                <button className="workspace-nav-item__main" onClick={() => activateTab(tab.id)} type="button">
                  <strong>{tab.title}</strong>
                  <span>{tab.status ?? tab.type}</span>
                </button>
                <button className="workspace-nav-item__close" onClick={() => closeTab(tab.id)} title="关闭 workspace" type="button">×</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="workspace-sidebar__empty">暂无打开的 Expansion Tab。点击可展开节点后，任务进度将显示在这里。</p>
        )}
      </section>
    </aside>
  )
}

export default WorkspaceSidebar
