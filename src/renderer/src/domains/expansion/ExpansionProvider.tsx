import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { GraphNode, PaperInsight } from '../../../../shared/paper'
import type { ExpansionGraphNode } from '../../../../shared/kg4'
import { updateSessionFromJobProgress } from '../../domains/expansion/nodeExpansionSessions'
import type { NodeExpansionSession } from '../../domains/expansion/nodeExpansionSessions'
import type { ExpansionContextValue } from './types'
import { electronApi } from '../../modules/ipc/electronApi'

export const ExpansionContext = createContext<ExpansionContextValue | null>(null)

export function ExpansionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Record<string, NodeExpansionSession>>({})
  const graphRef = useRef<GraphNode[]>([])
  const paperInsightRef = useRef<PaperInsight | null>(null)
  const paperIdRef = useRef<string | null>(null)

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

  const setPaperContext = useCallback((context: { graphNodes: GraphNode[]; paperInsight: PaperInsight | null; paperId: string | null }) => {
    graphRef.current = context.graphNodes
    paperInsightRef.current = context.paperInsight
    paperIdRef.current = context.paperId
  }, [])

  const startExpansion = useCallback(async (nodeId: string): Promise<string | undefined> => {
    const node = graphRef.current.find((n) => n.id === nodeId)
    if (!node) return undefined

    const result = await electronApi.kg4.startExpansion({
      nodeId: node.id,
      nodeLabel: node.label,
      paperId: paperIdRef.current ?? undefined
    })

    const now = new Date().toISOString()
    const session: NodeExpansionSession = {
      id: result.sessionId,
      nodeId: node.id,
      nodeLabel: node.label,
      status: 'loading',
      currentStepId: 'job_created',
      steps: [
        { id: 'job_created', label: '创建检索任务', status: 'running', detail: '正在准备检索任务...' },
        { id: 'retrieving', label: '检索相关论文', status: 'pending', detail: '检索本地和外部论文源...' },
        { id: 'analyzing', label: '分析算法思想', status: 'pending', detail: 'LLM 抽取和对比算法思想...' },
        { id: 'generating', label: '生成扩展图谱', status: 'pending', detail: '构建临时扩展节点和边...' },
        { id: 'done', label: '完成', status: 'pending', detail: '展开结果已就绪' }
      ],
      usesMockData: false,
      createdAt: now,
      updatedAt: now
    }

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
    <ExpansionContext.Provider value={{ sessions, setSessions, startExpansion, selectExpansionNode, clearExpansionGraph, setPaperContext }}>
      {children}
    </ExpansionContext.Provider>
  )
}
