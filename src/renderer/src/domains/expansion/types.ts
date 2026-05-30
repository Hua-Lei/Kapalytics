import type { ExpansionGraphNode } from '../../../../shared/kg4'
import type { NodeExpansionSession } from '../../modules/workspace/nodeExpansionSessions'

export interface ExpansionState {
  sessions: Record<string, NodeExpansionSession>
}

export interface ExpansionActions {
  startExpansion: (nodeId: string) => string | undefined
  selectExpansionNode: (node: ExpansionGraphNode, expansionId: string) => void
  clearExpansionGraph: (sessionId: string) => void
  setSessions: React.Dispatch<React.SetStateAction<Record<string, NodeExpansionSession>>>
  setGraphNodes: (nodes: import('../../../../shared/paper').GraphNode[]) => void
  setPaperInsightRef: (pi: import('../../../../shared/paper').PaperInsight | null) => void
}

export type ExpansionContextValue = ExpansionState & ExpansionActions
