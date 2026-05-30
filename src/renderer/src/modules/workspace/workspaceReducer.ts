import { defaultWorkspaceTabs } from './defaultTabs'
import type { SelectedObject, WorkspaceState, WorkspaceTab } from './types'

export type WorkspaceAction =
  | { type: 'open_tab'; tab: WorkspaceTab }
  | { type: 'close_tab'; tabId: string }
  | { type: 'activate_tab'; tabId: string }
  | { type: 'select_object'; selectedObject?: SelectedObject }
  | { type: 'update_tab_status'; tabId: string; status: WorkspaceTab['status'] }
  | { type: 'restore_state'; state: WorkspaceState }

export const initialWorkspaceState: WorkspaceState = {
  activeTabId: 'paper_graph',
  tabs: defaultWorkspaceTabs
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'open_tab': {
      const exists = state.tabs.some((tab) => tab.id === action.tab.id)
      return {
        ...state,
        activeTabId: action.tab.id,
        tabs: exists ? state.tabs.map((tab) => (tab.id === action.tab.id ? action.tab : tab)) : [...state.tabs, action.tab]
      }
    }
    case 'close_tab': {
      const tab = state.tabs.find((item) => item.id === action.tabId)
      if (!tab?.closable) return state
      const nextTabs = state.tabs.filter((item) => item.id !== action.tabId)
      const activeTabId = state.activeTabId === action.tabId ? nextTabs[0]?.id ?? 'paper_graph' : state.activeTabId
      return { ...state, activeTabId, tabs: nextTabs }
    }
    case 'activate_tab':
      return state.tabs.some((tab) => tab.id === action.tabId) ? { ...state, activeTabId: action.tabId } : state
    case 'select_object':
      return { ...state, selectedObject: action.selectedObject }
    case 'update_tab_status':
      return {
        ...state,
        tabs: state.tabs.map((tab) => (tab.id === action.tabId ? { ...tab, status: action.status } : tab))
      }
    case 'restore_state':
      return action.state
  }
}
