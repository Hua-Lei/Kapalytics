import { createContext, useCallback, useRef, useState, type ReactNode } from 'react'
import type { GraphNode, PaperInsight } from '../../../../shared/paper'
import type { ExpansionGraphNode } from '../../../../shared/kg4'
import { createNodeExpansionSession } from '../../domains/expansion/nodeExpansionSessions'
import type { NodeExpansionSession } from '../../domains/expansion/nodeExpansionSessions'
import type { ExpansionContextValue } from './types'

export const ExpansionContext = createContext<ExpansionContextValue | null>(null)

export function ExpansionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Record<string, NodeExpansionSession>>({})
  const graphRef = useRef<GraphNode[]>([])
  const paperInsightRef = useRef<PaperInsight | null>(null)

  const setGraphNodes = useCallback((nodes: GraphNode[]) => { graphRef.current = nodes }, [])
  const setPaperInsightRef = useCallback((pi: PaperInsight | null) => { paperInsightRef.current = pi }, [])

  const startExpansion = useCallback((nodeId: string): string | undefined => {
    const node = graphRef.current.find((n) => n.id === nodeId)
    if (!node) return undefined
    const session = createNodeExpansionSession(node, paperInsightRef.current)
    setSessions((prev) => ({ ...prev, [session.id]: session }))
    return session.id
  }, [])

  const selectExpansionNode = useCallback((node: ExpansionGraphNode, expansionId: string) => {
    setSessions((prev) => {
      const s = prev[expansionId]
      if (!s) return prev
      return { ...prev, [expansionId]: { ...s, selectedExpansionNodeId: node.id, updatedAt: new Date().toISOString() } }
    })
  }, [])

  const clearExpansionGraph = useCallback((sessionId: string) => {
    setSessions((prev) => {
      const s = prev[sessionId]
      if (!s) return prev
      return { ...prev, [sessionId]: { ...s, expansionGraph: undefined, selectedExpansionNodeId: undefined, updatedAt: new Date().toISOString() } }
    })
  }, [])

  return (
    <ExpansionContext.Provider value={{ sessions, setSessions, startExpansion, selectExpansionNode, clearExpansionGraph, setGraphNodes, setPaperInsightRef }}>
      {children}
    </ExpansionContext.Provider>
  )
}
