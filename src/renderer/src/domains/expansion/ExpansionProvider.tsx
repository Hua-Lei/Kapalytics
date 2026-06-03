import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { GraphNode, PaperInsight } from '../../../../shared/paper'
import type { ExpansionGraphNode } from '../../../../shared/kg4'
import { createReadySessionFromRecord, EXPANSION_STEPS, isReusableExpansionRecord, updateSessionFromJobProgress } from '../../domains/expansion/nodeExpansionSessions'
import type { NodeExpansionSession } from '../../domains/expansion/nodeExpansionSessions'
import type { ExpansionContextValue, StartExpansionUiResult } from './types'
import { electronApi } from '../../modules/ipc/electronApi'

export const ExpansionContext = createContext<ExpansionContextValue | null>(null)

function buildLocalGraphNeighborhood(
  nodeId: string,
  nodes: GraphNode[],
  edges: Array<{ sourceId: string; targetId: string; label?: string }>
) {
  const connectedNodeIds = new Set<string>([nodeId])
  edges.forEach((edge) => {
    if (edge.sourceId === nodeId) connectedNodeIds.add(edge.targetId)
    if (edge.targetId === nodeId) connectedNodeIds.add(edge.sourceId)
  })
  return {
    nodes: nodes
      .filter((node) => connectedNodeIds.has(node.id))
      .slice(0, 12)
      .map((node) => ({
        id: node.id,
        label: node.label,
        type: node.type,
        description: node.description
      })),
    edges: edges
      .filter((edge) => connectedNodeIds.has(edge.sourceId) && connectedNodeIds.has(edge.targetId))
      .slice(0, 18)
      .map((edge) => ({ sourceId: edge.sourceId, targetId: edge.targetId, label: edge.label }))
  }
}

export function ExpansionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Record<string, NodeExpansionSession>>({})
  const graphRef = useRef<GraphNode[]>([])
  const graphEdgesRef = useRef<Array<{ id: string; sourceId: string; targetId: string; label?: string; directed: boolean }>>([])
  const paperInsightRef = useRef<PaperInsight | null>(null)
  const paperIdRef = useRef<string | null>(null)
  const pdfUrlRef = useRef<string | null>(null)

  useEffect(() => {
    const unsub = electronApi.kg4.onExpansionProgress((event) => {
      setSessions((prev) => {
        const session = prev[event.sessionId]
        if (!session) return prev
        return { ...prev, [event.sessionId]: updateSessionFromJobProgress(session, event) }
      })
    })
    return unsub
  }, [])

  const setPaperContext = useCallback((context: {
    graphNodes: GraphNode[]
    graphEdges: Array<{ id: string; sourceId: string; targetId: string; label?: string; directed: boolean }>
    paperInsight: PaperInsight | null
    paperId: string | null
    pdfUrl: string | null
  }) => {
    graphRef.current = context.graphNodes
    graphEdgesRef.current = context.graphEdges
    paperInsightRef.current = context.paperInsight
    paperIdRef.current = context.paperId
    pdfUrlRef.current = context.pdfUrl
  }, [])

  const startExpansion = useCallback(async (nodeId: string, options: { forceRefresh?: boolean } = {}): Promise<StartExpansionUiResult | undefined> => {
    const node = graphRef.current.find((n) => n.id === nodeId)
    if (!node) return undefined
    const paperId = paperIdRef.current ?? undefined

    if (paperId && !options.forceRefresh) {
      const record = await electronApi.kg4.getExpansionRecord({ paperId, nodeId: node.id })
      if (record && isReusableExpansionRecord(record)) {
        const session = createReadySessionFromRecord(record, node)
        setSessions((prev) => ({ ...prev, [session.id]: session }))
        return { sessionId: session.id, status: 'ready-from-cache' }
      }
    }

    const now = new Date().toISOString()
    const sessionId = `expansion_${node.id}_${Date.now()}`
    const session: NodeExpansionSession = {
      id: sessionId,
      nodeId: node.id,
      nodeLabel: node.label,
      paperId,
      status: 'loading',
      currentStepId: 'job_created',
      steps: EXPANSION_STEPS.map((step) => step.id === 'job_created' ? { ...step, status: 'running' as const } : { ...step }),
      usesMockData: false,
      createdAt: now,
      updatedAt: now
    }

    setSessions((prev) => ({ ...prev, [session.id]: session }))

    const graphNeighborhood = buildLocalGraphNeighborhood(node.id, graphRef.current, graphEdgesRef.current)

    const result = await electronApi.kg4.startExpansion({
      sessionId,
      nodeId: node.id,
      nodeLabel: node.label,
      nodeType: node.type,
      expansionType: node.expansionType,
      paperId,
      pdfUrl: pdfUrlRef.current ?? undefined,
      graphNeighborhood,
      searchQueries: node.searchQueries ?? [],
      forceRefresh: Boolean(options.forceRefresh),
      paperInsight: paperInsightRef.current
        ? {
            title: paperInsightRef.current.centralInsight,
            problem: paperInsightRef.current.priorLimitation,
            method: paperInsightRef.current.methodMechanism,
            contribution: paperInsightRef.current.remainingGap
          }
        : undefined
    })

    if (result.sessionId !== sessionId) {
      setSessions((prev) => {
        const current = prev[sessionId]
        if (!current) return prev
        const { [sessionId]: _removed, ...rest } = prev
        return { ...rest, [result.sessionId]: { ...current, id: result.sessionId, updatedAt: new Date().toISOString() } }
      })
    }

    return { sessionId: result.sessionId, status: 'loading' }
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
    <ExpansionContext.Provider value={{ sessions, setSessions, startExpansion, selectExpansionNode, clearExpansionGraph, setPaperContext }}>
      {children}
    </ExpansionContext.Provider>
  )
}
