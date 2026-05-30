export type WorkspaceTabType =
  | 'pdf_reader'
  | 'paper_graph'
  | 'argument_chain'
  | 'method_mechanism'
  | 'stage_learning'
  | 'node_expansion_loading'
  | 'expansion_graph'
  | 'expand_view'
  | 'field_memory'

export interface WorkspaceTab {
  id: string
  type: WorkspaceTabType
  title: string
  paperId?: string
  nodeId?: string
  anchorNodeId?: string
  expansionId?: string
  closable: boolean
  status?: 'idle' | 'loading' | 'ready' | 'failed' | 'empty'
}

export type SelectedObject =
  | { type: 'graph_node'; id: string }
  | { type: 'expansion_node'; id: string; expansionId: string }
  | { type: 'learning_stage'; id: string }
  | { type: 'algorithm_idea'; id: string; expansionId: string }
  | { type: 'memory_record'; id: string }

export interface WorkspaceState {
  activeTabId: string
  tabs: WorkspaceTab[]
  selectedObject?: SelectedObject
  activePaperId?: string
}
