import type {
  AnalysisStep,
  AnalysisStepStatus,
  ClaimEvidenceRow,
  FormulaExplanation,
  GraphNode,
  KnowledgeGraph,
  MethodFlowStep,
  NodeDetail,
  PaperInsight
} from '../../../../shared/paper'
import type { Stage } from '../../types'
import { EMPTY_GRAPH, INITIAL_ANALYSIS_STEPS } from '../../../../shared/paper'

const VALID_NODE_TYPES = new Set(['field', 'concept', 'problem', 'method', 'formula', 'experiment', 'limitation'])
const EXPANDABLE_NODE_TYPES = new Set<GraphNode['type']>(['field', 'concept', 'method'])

const ROLE_BY_TYPE: Record<GraphNode['type'], string> = {
  field: '论文领域定位',
  concept: '理解论文所需的前置概念',
  problem: '论文动机和待解决瓶颈',
  method: '论文提出或采用的核心机制',
  formula: '支撑方法的训练目标或参数化关系',
  experiment: '验证论文 claim 的证据',
  limitation: '方法适用边界或失败条件'
}

const WHY_IMPORTANT_BY_TYPE: Record<GraphNode['type'], string> = {
  field: '先判断论文处在哪条研究路线，后续概念、方法和实验才有参照系。',
  concept: '这个概念是读懂方法设计和实验对比的基础。',
  problem: '论文贡献要围绕这个瓶颈是否被解决来判断。',
  method: '这是论文从动机走向技术方案的主线节点。',
  formula: '公式说明了模型实际优化或参数化的对象。',
  experiment: '实验结果提供了论文主张是否成立的证据。',
  limitation: '局限决定方法能否迁移到下一篇论文或新场景。'
}

export { EMPTY_GRAPH, INITIAL_ANALYSIS_STEPS }

export function updateStep(steps: AnalysisStep[], id: string, status: AnalysisStepStatus): AnalysisStep[] {
  return steps.map((step) => (step.id === id ? { ...step, status } : step))
}

export function markActiveStepFailed(steps: AnalysisStep[]): AnalysisStep[] {
  return steps.map((step) => (step.status === 'active' ? { ...step, status: 'error' } : step))
}

export function canExpandGraphNode(node: GraphNode): boolean {
  return node.expandable !== false && EXPANDABLE_NODE_TYPES.has(node.type)
}

function compactText(value: string | undefined, max = 220): string {
  if (!value) return ''
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readStringField(record: Record<string, unknown>, key: string): string | undefined {
  return readString(record[key])
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => readString(item))
      .filter((item): item is string => Boolean(item))
    return items.length ? items : undefined
  }
  const single = readString(value)
  return single ? [single] : undefined
}

function normalizeMethodFlow(value: unknown): MethodFlowStep[] | undefined {
  if (!Array.isArray(value)) return undefined
  const steps = value
    .map((item, index): MethodFlowStep | null => {
      if (typeof item === 'string' && item.trim()) {
        return { id: `step-${index + 1}`, label: `步骤 ${index + 1}`, description: item.trim() }
      }
      if (!isRecord(item)) return null
      const label = readStringField(item, 'label') ?? readStringField(item, 'name') ?? `步骤 ${index + 1}`
      const description = readStringField(item, 'description') ?? readStringField(item, 'summary') ?? label
      return {
        id: readStringField(item, 'id') ?? `step-${index + 1}`,
        label,
        description,
        input: readStringField(item, 'input'),
        output: readStringField(item, 'output')
      }
    })
    .filter((item): item is MethodFlowStep => Boolean(item))
  return steps.length ? steps : undefined
}

function normalizeFormulaExplanation(value: unknown): FormulaExplanation | undefined {
  if (!isRecord(value)) return undefined
  const latex = readStringField(value, 'latex') ?? readStringField(value, 'formula')
  const symbols = Array.isArray(value.symbols)
    ? value.symbols
        .map((item): { symbol: string; meaning: string } | null => {
          if (typeof item === 'string' && item.trim()) return { symbol: item.trim(), meaning: '' }
          if (!isRecord(item)) return null
          const symbol = readStringField(item, 'symbol') ?? readStringField(item, 'name')
          if (!symbol) return null
          return { symbol, meaning: readStringField(item, 'meaning') ?? readStringField(item, 'description') ?? '' }
        })
        .filter((item): item is { symbol: string; meaning: string } => Boolean(item))
    : []
  if (!latex && !symbols.length) return undefined
  return {
    latex: latex ?? '',
    symbols,
    trainingObjective: readStringField(value, 'trainingObjective'),
    positionInMethod: readStringField(value, 'positionInMethod'),
    ablationThought: readStringField(value, 'ablationThought')
  }
}

function normalizeClaimEvidence(value: unknown): ClaimEvidenceRow[] | undefined {
  if (!Array.isArray(value)) return undefined
  const rows = value
    .map((item, index): ClaimEvidenceRow | null => {
      if (typeof item === 'string' && item.trim()) {
        return { experiment: `实验 ${index + 1}`, claim: item.trim(), observation: '', conclusion: '' }
      }
      if (!isRecord(item)) return null
      return {
        experiment: readStringField(item, 'experiment') ?? readStringField(item, 'name') ?? `实验 ${index + 1}`,
        claim: readStringField(item, 'claim') ?? '',
        observation: readStringField(item, 'observation') ?? readStringField(item, 'result') ?? '',
        conclusion: readStringField(item, 'conclusion') ?? ''
      }
    })
    .filter((item): item is ClaimEvidenceRow => Boolean(item))
  return rows.length ? rows : undefined
}

function normalizeNodeDetail(value: unknown, fallbackSummary: string): NodeDetail {
  const detail = isRecord(value) ? value : {}
  return {
    summary: readStringField(detail, 'summary') ?? fallbackSummary,
    keyPoints: normalizeStringArray(detail.keyPoints),
    roleInArgument: readStringField(detail, 'roleInArgument'),
    formulaExplanation: normalizeFormulaExplanation(detail.formulaExplanation),
    methodFlow: normalizeMethodFlow(detail.methodFlow),
    claimEvidence: normalizeClaimEvidence(detail.claimEvidence),
    failureConditions: normalizeStringArray(detail.failureConditions)
  }
}

function inferExpansionType(node: GraphNode): GraphNode['expansionType'] {
  if (node.type === 'field') return 'field_overview'
  if (node.type === 'method') return 'method_evolution'
  if (node.type === 'concept') return 'related_papers'
  return undefined
}

function inferSearchQueries(node: GraphNode): string[] {
  const text = `${node.label} ${node.description}`
  const queries = [node.label]

  if (/lora|adapter|适配/i.test(text)) queries.push('lora', 'parameter efficient fine tuning')
  if (/hypernetwork|超网络/i.test(text)) queries.push('hypernetwork', 'conditional parameter generation')
  if (/context|上下文|蒸馏|distill/i.test(text)) queries.push('context distillation')
  if (/perceiver/i.test(text)) queries.push('perceiver')
  if (/test.?time|测试时|泛化|迁移/i.test(text)) queries.push('test time adaptation')

  return [...new Set(queries.map((query) => query.trim()).filter(Boolean))].slice(0, 5)
}

function inferDetail(node: GraphNode): NodeDetail {
  const detail = normalizeNodeDetail(node.detail, node.description)
  const keyPoints = detail.keyPoints?.length
    ? detail.keyPoints
    : [node.insight, node.whyImportant, node.description].filter((item): item is string => Boolean(item?.trim()))

  return {
    ...detail,
    summary: detail.summary || node.description,
    roleInArgument: detail.roleInArgument ?? node.roleInPaper ?? ROLE_BY_TYPE[node.type],
    keyPoints: keyPoints.length ? keyPoints : undefined
  }
}

function upgradeNode(node: GraphNode): GraphNode {
  const expandable = node.expandable ?? EXPANDABLE_NODE_TYPES.has(node.type)

  return {
    ...node,
    roleInPaper: node.roleInPaper ?? node.detail?.roleInArgument ?? ROLE_BY_TYPE[node.type],
    whyImportant: node.whyImportant ?? WHY_IMPORTANT_BY_TYPE[node.type],
    expandable,
    expansionType: node.expansionType ?? (expandable ? inferExpansionType(node) : undefined),
    searchQueries: node.searchQueries?.length ? node.searchQueries : expandable ? inferSearchQueries(node) : undefined,
    detail: inferDetail(node)
  }
}

export function sanitizeGraph(raw: KnowledgeGraph): KnowledgeGraph {
  const nodes = raw.nodes
    .filter((node) => node.id && VALID_NODE_TYPES.has(node.type))
    .map((node, index) => ({
      ...node,
      x: Number.isFinite(node.x) ? node.x : 140 + (index % 4) * 170,
      y: Number.isFinite(node.y) ? node.y : 80 + Math.floor(index / 4) * 130
    }))
    .map(upgradeNode)
  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = raw.edges.filter((edge) => nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId))
  return { nodes, edges }
}

export function derivePaperInsight(graph: KnowledgeGraph, stages?: Stage[]): PaperInsight | null {
  const stageText = (id: string) => stages?.find((stage) => stage.id === id)?.task
  const firstOfType = (type: GraphNode['type']) => graph.nodes.find((node) => node.type === type)
  const method = firstOfType('method')
  const problem = firstOfType('problem')
  const limitation = firstOfType('limitation')

  const centralInsight = compactText(
    method?.insight ?? method?.description ?? stageText('method_overview') ?? graph.nodes[0]?.description
  )
  const priorLimitation = compactText(
    problem?.description ?? stageText('problem_motivation')
  )
  const methodMechanism = compactText(
    method?.description ?? stageText('method_overview')
  )
  const remainingGap = compactText(
    limitation?.description ?? stageText('contribution_limitation')
  )
  const evidenceChain = graph.nodes
    .filter((node) => ['formula', 'experiment', 'method'].includes(node.type))
    .slice(0, 5)
    .map((node) => node.label)

  if (!centralInsight && !priorLimitation && !methodMechanism && !remainingGap) return null

  return {
    centralInsight,
    priorLimitation,
    methodMechanism,
    evidenceChain,
    remainingGap
  }
}
