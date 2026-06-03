import { isKg4NodeExpansionRecord, type Kg4ExpansionGraphLayer, type Kg4NodeExpansionRecord } from '../../../../shared/kg4'
import type { ExpansionProgressEvent } from '../../../../shared/electron-api'
import type { GraphNode } from '../../../../shared/paper'

export type NodeExpansionStatus = 'loading' | 'ready' | 'failed' | 'empty'
export type NodeExpansionStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped'

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
  { id: 'job_created', label: '创建展开任务', status: 'pending', detail: '正在准备展开任务...' },
  { id: 'classifying', label: '判断展开意图', status: 'pending', detail: '识别当前节点是否适合方法谱系展开...' },
  { id: 'retrieving', label: '检索相关论文', status: 'pending', detail: '检索本地和外部论文源...' },
  { id: 'teaching', label: '生成概念教学', status: 'pending', detail: '构建概念解释、公式和常见误区...' },
  { id: 'research_area', label: '生成研究方向图', status: 'pending', detail: '整理关键问题、方法族和热点方向...' },
  { id: 'digesting', label: '消化论文方法', status: 'pending', detail: '从候选论文中提炼问题、机制和改进线索...' },
  { id: 'synthesizing', label: '汇总方法谱系', status: 'pending', detail: '整理方法节点、关系和阅读顺序...' },
  { id: 'generating', label: '生成扩展图谱', status: 'pending', detail: '构建临时扩展节点和边...' },
  { id: 'persisting', label: '保存展开结果', status: 'pending', detail: '写入本地数据库...' },
  { id: 'done', label: '完成', status: 'pending', detail: '展开结果已就绪' }
]

export function isReusableExpansionRecord(record: Kg4NodeExpansionRecord): boolean {
  return record.expansionGraphNodes.length > 0
}

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
  const normalizedStep = event.step === 'analyzing' ? 'digesting' : event.step
  const stepOrder = [
    'job_created',
    'classifying',
    'retrieving',
    'teaching',
    'research_area',
    'digesting',
    'synthesizing',
    'generating',
    'persisting',
    'done'
  ] as const

  if (event.step === 'failed') {
    const fallbackStepId =
      session.steps.find((step) => step.status === 'running')?.id ??
      (session.currentStepId === 'analyzing' ? 'digesting' : session.currentStepId) ??
      [...session.steps].reverse().find((step) => step.status !== 'done')?.id
    const errorMessage = event.error || event.message

    return {
      ...session,
      status: 'failed',
      currentStepId: fallbackStepId,
      steps: session.steps.map((step) => step.id === fallbackStepId ? { ...step, status: 'failed' as const, detail: errorMessage } : step),
      errorMessage,
      updatedAt: now
    }
  }

  const currentIndex = stepOrder.indexOf(normalizedStep as typeof stepOrder[number])
  const steps = session.steps.map((step) => {
    const stepIndex = stepOrder.indexOf(step.id as typeof stepOrder[number])
    if (stepIndex < currentIndex) {
      const skipped =
        step.status === 'pending' &&
        (step.id === 'teaching' || step.id === 'research_area' || step.id === 'digesting' || step.id === 'synthesizing')
      return { ...step, status: skipped ? 'skipped' as const : 'done' as const }
    }
    if (stepIndex === currentIndex) {
      return { ...step, status: 'running' as const, detail: event.message }
    }
    return step
  })

  if (normalizedStep === 'done') {
    const record = isKg4NodeExpansionRecord(event.result) ? event.result : undefined
    const hasExpansionNodes = Boolean(record?.expansionGraphNodes.length)
    const expansionGraph: Kg4ExpansionGraphLayer | undefined = record ? {
      anchorNodeId: session.nodeId,
      nodes: record.expansionGraphNodes,
      edges: record.expansionGraphEdges
    } : undefined

    return {
      ...session,
      status: record && hasExpansionNodes ? 'ready' : 'empty',
      currentStepId: 'done',
      steps: steps.map((step) => step.id === 'done' ? { ...step, status: 'done' as const, detail: event.message } : step),
      expansionGraph,
      expansionRecord: record,
      errorMessage: record
        ? record.missingDataReasons.join('；') || '展开任务完成，但没有生成可展示的 temporary nodes。'
        : '展开任务完成，但返回的 KG4 expansion record 无效或不可展示。',
      updatedAt: now
    }
  }

  return {
    ...session,
    currentStepId: normalizedStep,
    steps,
    updatedAt: now
  }
}
