import type { GraphNode, PaperInsight } from '../../../../shared/paper'
import type { Kg4ExpansionGraphLayer, Kg4NodeExpansionRecord } from '../../../../shared/kg4'
import { buildKg4ExpansionRecord } from '../../modules/learning/kg4Workbench'

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

const STEP_DEFINITIONS: Array<{ id: string; label: string; detail: string }> = [
  { id: 'read_node_context', label: '读取节点上下文', detail: '整理当前节点的 summary、role、whyImportant 和 search queries。' },
  { id: 'build_search_query', label: '构造检索查询', detail: '基于节点标签和可展开方向生成候选检索词。' },
  { id: 'retrieve_papers', label: '检索候选论文', detail: '使用本地 mock/dev fixture 检索候选论文。' },
  { id: 'rank_candidates', label: '排序候选证据', detail: '按查询 token 与内置候选论文的匹配程度排序。' },
  { id: 'extract_algorithm_ideas', label: '抽取算法思想', detail: '从候选论文 fixture 构造可追溯 Algorithm Idea Cards。' },
  { id: 'generate_expansion_graph', label: '生成临时扩展图谱', detail: '准备 temporary expansion nodes 和 dashed expansion edges。' },
  { id: 'prepare_workspace', label: '准备后续 Workspace', detail: '完成后将自动进入 Expansion Graph View。' }
]

function safeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 52) || 'node'
}

function buildExpansionGraph(nodeId: string, record: Kg4NodeExpansionRecord): Kg4ExpansionGraphLayer {
  return {
    anchorNodeId: nodeId,
    nodes: record.expansionGraphNodes,
    edges: record.expansionGraphEdges
  }
}

function makeLoadingSteps(): NodeExpansionStep[] {
  return STEP_DEFINITIONS.map((step, index) => ({
    ...step,
    status: index === 0 ? ('running' as const) : ('pending' as const)
  }))
}

function makeCompletedSteps(record: Kg4NodeExpansionRecord): NodeExpansionStep[] {
  return STEP_DEFINITIONS.map((step) => ({
    ...step,
    status: 'done' as const,
    detail: step.id === 'retrieve_papers'
      ? `${step.detail} 已匹配 ${record.retrievedPaperIds.length} 个 mock candidate。`
      : step.detail
  }))
}

function makeFailedSteps(): NodeExpansionStep[] {
  return STEP_DEFINITIONS.map((step, index) => {
    if (step.id === 'retrieve_papers') return { ...step, status: 'failed' as const }
    if (index > 2) return { ...step, status: 'pending' as const }
    return { ...step, status: 'done' as const }
  })
}

function makeEmptySteps(): NodeExpansionStep[] {
  return STEP_DEFINITIONS.map((step, index) => {
    if (index >= 4) return { ...step, status: index === 4 ? 'failed' as const : 'pending' as const }
    return { ...step, status: 'done' as const }
  })
}

/** Create a session that always starts in "loading" so the user sees the step timeline. */
export function createNodeExpansionSession(node: GraphNode, _paperInsight: PaperInsight | null): NodeExpansionSession {
  const timestamp = new Date().toISOString()
  return {
    id: `node_expansion_${safeId(node.id)}`,
    nodeId: node.id,
    nodeLabel: node.label,
    status: 'loading',
    currentStepId: 'read_node_context',
    steps: makeLoadingSteps(),
    usesMockData: true,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

/**
 * Advance the loading session to the next step. Returns a new session.
 * When all steps are done, the session transitions to 'ready' with the real
 * expansion record populated.
 */
export function advanceExpansionStep(session: NodeExpansionSession, node: GraphNode, paperInsight: PaperInsight | null): NodeExpansionSession {
  const now = new Date().toISOString()
  const currentIndex = session.steps.findIndex((s) => s.status === 'running')

  if (currentIndex < 0 || currentIndex >= STEP_DEFINITIONS.length - 1) {
    // Last step finished — build the real result and transition to ready/failed/empty
    try {
      const expansionRecord = buildKg4ExpansionRecord(node, paperInsight)
      if (!expansionRecord.expansionGraphNodes.length) {
        return {
          ...session,
          status: 'empty',
          currentStepId: 'extract_algorithm_ideas',
          steps: makeEmptySteps(),
          errorMessage: expansionRecord.missingDataReasons[0],
          updatedAt: now
        }
      }
      return {
        ...session,
        status: 'ready',
        currentStepId: 'prepare_workspace',
        steps: makeCompletedSteps(expansionRecord),
        expansionGraph: buildExpansionGraph(node.id, expansionRecord),
        expansionRecord,
        updatedAt: now
      }
    } catch (error) {
      return {
        ...session,
        status: 'failed',
        currentStepId: 'retrieve_papers',
        steps: makeFailedSteps(),
        errorMessage: error instanceof Error ? error.message : 'Node expansion fixture failed.',
        updatedAt: now
      }
    }
  }

  // Advance one step
  const nextSteps = session.steps.map((step, index) => {
    if (index === currentIndex) return { ...step, status: 'done' as const }
    if (index === currentIndex + 1) return { ...step, status: 'running' as const }
    return { ...step }
  })

  return {
    ...session,
    currentStepId: STEP_DEFINITIONS[currentIndex + 1].id,
    steps: nextSteps,
    updatedAt: now
  }
}

/** How many steps remain before completion. Used to calculate simulated delay. */
export function remainingSteps(session: NodeExpansionSession): number {
  const currentIndex = session.steps.findIndex((s) => s.status === 'running')
  if (currentIndex < 0) return 0
  return STEP_DEFINITIONS.length - currentIndex
}
