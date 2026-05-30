import type { Kg4ExpansionGraphLayer, Kg4NodeExpansionRecord } from '../../../../shared/kg4'
import type { ExpansionProgressEvent } from '../../../../shared/electron-api'
import type { GraphNode } from '../../../../shared/paper'

export type NodeExpansionStatus = 'loading' | 'ready' | 'failed' | 'empty'
export type NodeExpansionStepStatus = 'pending' | 'running' | 'done' | 'failed'

export interface NodeExpansionStep {
  id: string
  label: string
  status: NodeExpansionStepStatus
  detail?: string
}

export interface NodeExpansionSession {
  id: string
  nodeId: string
  nodeLabel: string
  paperId?: string
  status: NodeExpansionStatus
  currentStepId?: string
  steps: NodeExpansionStep[]
  expansionGraph?: Kg4ExpansionGraphLayer
  expansionRecord?: Kg4NodeExpansionRecord
  selectedExpansionNodeId?: string
  usesMockData: boolean
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

export const EXPANSION_STEPS: NodeExpansionStep[] = [
  { id: 'job_created', label: '创建检索任务', status: 'pending', detail: '正在准备检索任务...' },
  { id: 'retrieving', label: '检索相关论文', status: 'pending', detail: '检索本地和外部论文源...' },
  { id: 'analyzing', label: '分析算法思想', status: 'pending', detail: 'LLM 抽取和对比算法思想...' },
  { id: 'generating', label: '生成扩展图谱', status: 'pending', detail: '构建临时扩展节点和边...' },
  { id: 'persisting', label: '保存展开结果', status: 'pending', detail: '写入本地数据库...' },
  { id: 'done', label: '完成', status: 'pending', detail: '展开结果已就绪' }
]

export function createReadySessionFromRecord(record: Kg4NodeExpansionRecord, node: GraphNode): NodeExpansionSession {
  const now = new Date().toISOString()
  return {
    id: `expansion_${record.nodeId}_${Date.now()}`,
    nodeId: record.nodeId,
    nodeLabel: node.label,
    paperId: record.paperId,
    status: 'ready',
    currentStepId: 'done',
    steps: EXPANSION_STEPS.map((step) => ({ ...step, status: 'done' as const })),
    expansionGraph: {
      anchorNodeId: record.nodeId,
      nodes: record.expansionGraphNodes,
      edges: record.expansionGraphEdges
    },
    expansionRecord: record,
    usesMockData: false,
    createdAt: now,
    updatedAt: now
  }
}

export function updateSessionFromJobProgress(
  session: NodeExpansionSession,
  event: ExpansionProgressEvent
): NodeExpansionSession {
  const now = new Date().toISOString()
  const stepOrder = ['job_created', 'retrieving', 'analyzing', 'generating', 'persisting', 'done'] as const

  const currentIndex = stepOrder.indexOf(event.step as typeof stepOrder[number])
  const steps = session.steps.map((step) => {
    const stepIndex = stepOrder.indexOf(step.id as typeof stepOrder[number])
    if (stepIndex < currentIndex) return { ...step, status: 'done' as const }
    if (stepIndex === currentIndex) {
      if (event.step === 'failed') return { ...step, status: 'failed' as const, detail: event.error || event.message }
      return { ...step, status: 'running' as const, detail: event.message }
    }
    return step
  })

  if (event.step === 'failed') {
    return {
      ...session,
      status: 'failed',
      currentStepId: event.step,
      steps,
      errorMessage: event.error || event.message,
      updatedAt: now
    }
  }

  if (event.step === 'done') {
    const record = event.result as Kg4NodeExpansionRecord | undefined
    const expansionGraph: Kg4ExpansionGraphLayer | undefined = record ? {
      anchorNodeId: session.nodeId,
      nodes: record.expansionGraphNodes,
      edges: record.expansionGraphEdges
    } : undefined

    return {
      ...session,
      status: record ? 'ready' : 'empty',
      currentStepId: 'done',
      steps: steps.map((step) => step.id === 'done' ? { ...step, status: 'done' as const, detail: event.message } : step),
      expansionGraph,
      expansionRecord: record,
      errorMessage: record ? undefined : '展开任务完成，但没有返回可展示的 KG4 expansion record。',
      updatedAt: now
    }
  }

  return {
    ...session,
    currentStepId: event.step,
    steps,
    updatedAt: now
  }
}
