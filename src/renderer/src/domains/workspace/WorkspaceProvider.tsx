import { createContext, useCallback, useReducer, type ReactNode } from 'react'
import { initialWorkspaceState, workspaceReducer } from './workspaceReducer'
import type { WorkspaceAction } from './workspaceReducer'
import type { SelectedObject, WorkspaceState, WorkspaceTab } from './types'

export interface WorkspaceContextValue {
  state: WorkspaceState
  activeTab: WorkspaceTab | undefined
  openTab: (tab: WorkspaceTab) => void
  closeTab: (tabId: string) => void
  activateTab: (tabId: string) => void
  selectObject: (obj?: SelectedObject) => void
  updateTabStatus: (tabId: string, status: WorkspaceTab['status']) => void
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState)

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId)

  const openTab = useCallback((tab: WorkspaceTab) => {
    dispatch({ type: 'open_tab', tab })
  }, [])

  const closeTab = useCallback((tabId: string) => {
    dispatch({ type: 'close_tab', tabId })
  }, [])

  const activateTab = useCallback((tabId: string) => {
    dispatch({ type: 'activate_tab', tabId })
  }, [])

  const selectObject = useCallback((obj?: SelectedObject) => {
    dispatch({ type: 'select_object', selectedObject: obj })
  }, [])

  const updateTabStatus = useCallback((tabId: string, status: WorkspaceTab['status']) => {
    dispatch({ type: 'update_tab_status', tabId, status })
  }, [])

  return (
    <WorkspaceContext.Provider value={{ state, activeTab, openTab, closeTab, activateTab, selectObject, updateTabStatus }}>
      {children}
    </WorkspaceContext.Provider>
  )
}
