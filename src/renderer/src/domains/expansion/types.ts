import type { ExpansionGraphNode } from '../../../../shared/kg4'
import type { GraphNode, PaperInsight } from '../../../../shared/paper'
import type { NodeExpansionSession } from '../../domains/expansion/nodeExpansionSessions'

export interface ExpansionState {
  sessions: Record<string, NodeExpansionSession>
}

export interface StartExpansionUiResult {
  sessionId: string
  status: 'loading' | 'ready-from-cache'
}

export interface ExpansionActions {
  startExpansion: (nodeId: string, options?: { forceRefresh?: boolean }) => Promise<StartExpansionUiResult | undefined>
  selectExpansionNode: (node: ExpansionGraphNode, expansionId: string) => void
  clearExpansionGraph: (sessionId: string) => void
  setSessions: React.Dispatch<React.SetStateAction<Record<string, NodeExpansionSession>>>
  setPaperContext: (context: { graphNodes: GraphNode[]; paperInsight: PaperInsight | null; paperId: string | null }) => void
}

export type ExpansionContextValue = ExpansionState & ExpansionActions
