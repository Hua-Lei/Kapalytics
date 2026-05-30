import type { GraphNode, PaperInsight } from '../../../../shared/paper'
import type {
  AlgorithmIdeaCard,
  AlgorithmIdeaComparisonDimension,
  AlgorithmIdeaComparisonRow,
  AlgorithmIdeaComparisonWorkspace,
  ExpansionGraphEdge,
  ExpansionGraphNode,
  FieldCognitionView,
  Kg4Feedback,
  Kg4NodeExpansionRecord,
  NodeUnderstandingMemory
} from '../../../../shared/kg4'
import { normalizeKg4NodeLabel } from '../../../../shared/kg4'

function now(): string {
  return new Date().toISOString()
}

function safeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item'
}

export function buildKg4ExpansionRecord(
  node: GraphNode,
  ideaCards: AlgorithmIdeaCard[],
  paperInsight: PaperInsight | null
): Kg4NodeExpansionRecord {
  const timestamp = now()
  const families = [...new Set(ideaCards.map((card) => card.updatedObject || card.relationToCurrentNode))].slice(0, 3)
  const familyNodes: ExpansionGraphNode[] = families.map((family) => ({
    id: `kg4_family_${safeId(node.id)}_${safeId(family)}`,
    type: 'method_family',
    label: family,
    description: `由当前候选算法思想归纳出的临时方法路线：${family}`,
    sourcePaperIds: ideaCards.filter((card) => (card.updatedObject || card.relationToCurrentNode) === family).map((card) => card.paperId),
    isTemporary: true,
    visualStyle: 'faded'
  }))
  const ideaNodes: ExpansionGraphNode[] = ideaCards.slice(0, 5).map((card) => ({
    id: `kg4_idea_${card.id}`,
    type: 'algorithm_idea',
    label: card.paperTitle,
    description: card.coreIdea,
    sourcePaperIds: [card.paperId],
    isTemporary: true,
    visualStyle: 'faded'
  }))
  const paperNodes: ExpansionGraphNode[] = ideaCards.slice(0, 5).map((card) => ({
    id: `kg4_paper_${safeId(card.paperId)}`,
    type: 'related_paper',
    label: card.paperTitle,
    description: card.problemSetting,
    sourcePaperIds: [card.paperId],
    isTemporary: true,
    visualStyle: 'faded'
  }))
  const edges: ExpansionGraphEdge[] = []
  ideaCards.slice(0, 5).forEach((card, index) => {
    const family = familyNodes[index % Math.max(1, familyNodes.length)]
    if (family) {
      edges.push({
        id: `kg4_edge_family_${card.id}`,
        sourceId: family.id,
        targetId: `kg4_idea_${card.id}`,
        relation: 'uses_as_foundation',
        explanation: `${card.paperTitle} 可归入 ${family.label} 路线。`
      })
    }
    edges.push({
      id: `kg4_edge_paper_${card.id}`,
      sourceId: `kg4_idea_${card.id}`,
      targetId: `kg4_paper_${safeId(card.paperId)}`,
      relation: card.relationToCurrentNode === 'variant' ? 'extends' : 'same_problem_different_method',
      explanation: card.relationExplanation
    })
  })

  const missingDataReasons = ideaCards.length ? [] : ['当前没有匹配论文；生产路径应使用 KG4 IPC 检索。']
  return {
    id: `kg4_expansion_${safeId(node.id)}`,
    paperId: 'current-paper',
    nodeId: node.id,
    retrievedPaperIds: ideaCards.map((card) => card.paperId),
    algorithmIdeaCards: ideaCards,
    expansionGraphNodes: [...familyNodes, ...ideaNodes, ...paperNodes].slice(0, 8),
    expansionGraphEdges: edges.slice(0, 10),
    fieldCognitionView: buildFieldCognitionView(node, ideaCards, paperInsight),
    dataCompleteness: ideaCards.length >= 2 ? 'partial' : 'insufficient',
    missingDataReasons,
    generatedByJobIds: [],
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

export function buildFieldCognitionView(
  node: GraphNode,
  ideaCards: AlgorithmIdeaCard[],
  paperInsight: PaperInsight | null
): FieldCognitionView {
  const groups = new Map<string, AlgorithmIdeaCard[]>()
  for (const card of ideaCards) {
    const label = card.updatedObject || card.relationToCurrentNode
    groups.set(label, [...(groups.get(label) ?? []), card])
  }

  return {
    id: `field_cognition_${safeId(node.id)}`,
    nodeId: node.id,
    fieldTitle: node.label,
    coreProblemSummary: node.whyImportant || paperInsight?.priorLimitation || node.description,
    methodFamilies: [...groups.entries()].map(([label, cards]) => ({
      id: `family_${safeId(label)}`,
      label,
      ideaCardIds: cards.map((card) => card.id),
      representativePaperIds: cards.map((card) => card.paperId),
      isCurrentPaperRoute: cards.some((card) => card.relationToCurrentNode === 'foundation' || card.relationToCurrentNode === 'variant'),
      routeExplanation: `该路线由 ${cards.map((card) => card.paperTitle).join('、')} 支撑。`
    })),
    prerequisiteConcepts: [
      { label: '问题设置', whyNeeded: '需要先判断候选论文是否解决同一层级的问题。' },
      { label: '更新对象', whyNeeded: '更新对象决定算法机制和当前节点是否可直接对比。' }
    ],
    insufficientInformation: ideaCards.length ? undefined : '缺少可追溯候选论文，暂不能构造领域认知视图。'
  }
}

const COMPARISON_DIMENSIONS: Array<{ dimension: AlgorithmIdeaComparisonDimension; label: string; field: keyof AlgorithmIdeaCard }> = [
  { dimension: 'research_problem', label: '研究问题', field: 'problemSetting' },
  { dimension: 'core_idea', label: '核心思想', field: 'coreIdea' },
  { dimension: 'key_assumption', label: '关键假设', field: 'keyAssumption' },
  { dimension: 'mechanism_flow', label: '机制流程', field: 'mechanism' },
  { dimension: 'objective_or_update_rule', label: '优化目标 / 更新规则', field: 'objectiveOrUpdateRule' },
  { dimension: 'updated_object', label: '更新对象', field: 'updatedObject' },
  { dimension: 'strength', label: '优势', field: 'strength' },
  { dimension: 'limitation', label: '局限', field: 'limitation' },
  { dimension: 'best_use_case', label: '适用场景', field: 'bestUseCase' },
  { dimension: 'relation_to_current_paper', label: '与当前论文关系', field: 'relationExplanation' }
]

export function buildComparisonWorkspace(
  node: GraphNode,
  paperInsight: PaperInsight | null,
  ideaCards: AlgorithmIdeaCard[],
  selectedIdeaCardIds: string[]
): AlgorithmIdeaComparisonWorkspace {
  const selected = ideaCards.filter((card) => selectedIdeaCardIds.includes(card.id)).slice(0, 3)
  const rows: AlgorithmIdeaComparisonRow[] = selected.length >= 2
    ? COMPARISON_DIMENSIONS.map(({ dimension, label, field }) => ({
      dimension,
      label,
      currentNodeOrPaper: dimension === 'research_problem'
        ? paperInsight?.priorLimitation || node.description
        : node.insight || node.detail?.summary || node.description,
      selectedIdeas: selected.map((card) => ({
        ideaCardId: card.id,
        value: String(card[field] || '信息不足'),
        evidencePaperId: card.paperId
      })),
      contrastInsight: selected
        .map((card) => `${card.paperTitle}: ${String(card[field] || '信息不足').slice(0, 80)}`)
        .join(' / ')
    }))
    : []

  return {
    id: `kg4_workspace_${safeId(node.id)}`,
    nodeId: node.id,
    currentPaperId: 'current-paper',
    ideaCards,
    selectedIdeaCardIds: selected.map((card) => card.id),
    comparisonRows: rows,
    reflectionQuestions: selected.length >= 2 ? [
      `这些方法在“${node.label}”上到底共享了哪个问题假设？`,
      '哪一个方法把成本从训练阶段转移到了推理、条件表示或数据覆盖上？',
      '如果把其中一个机制迁移到当前论文，最可能失败的边界是什么？'
    ] : [],
    insufficientInformation: selected.length < 2 ? '请至少选择 2 张算法思想卡后再生成对比。' : undefined
  }
}

export function buildNodeUnderstandingMemory(params: {
  node: GraphNode
  workspace: AlgorithmIdeaComparisonWorkspace
  feedback: Kg4Feedback
  userReflection: string
  editedNote?: string
}): NodeUnderstandingMemory {
  const timestamp = now()
  const selected = params.workspace.ideaCards.filter((card) => params.workspace.selectedIdeaCardIds.includes(card.id))
  const feedbackSummary = params.feedback.type === 'reflective'
    ? [...params.feedback.strengths, ...params.feedback.missingDimensions].join(' ')
    : `${params.feedback.missingPrerequisite}: ${params.feedback.shortExplanation}`
  return {
    id: `node_memory_${safeId(params.node.id)}_${Date.now()}`,
    nodeId: params.node.id,
    nodeLabel: params.node.label,
    nodeType: params.node.type,
    normalizedNodeLabel: normalizeKg4NodeLabel(params.node.label),
    sourcePaperId: params.workspace.currentPaperId,
    relatedPaperIds: selected.map((card) => card.paperId),
    ideaCardIds: selected.map((card) => card.id),
    methodFamilyTags: [...new Set(selected.map((card) => card.updatedObject || card.relationToCurrentNode))],
    topicTags: [...new Set([...(params.node.searchQueries ?? []), params.node.label])],
    userReflection: params.userReflection,
    aiFeedbackType: params.feedback.type,
    aiFeedbackSummary: feedbackSummary,
    strengths: params.feedback.type === 'reflective' ? params.feedback.strengths : [],
    missingDimensions: params.feedback.type === 'reflective' ? params.feedback.missingDimensions : [],
    prerequisiteGaps: params.feedback.type === 'remedial' ? [params.feedback.missingPrerequisite] : [],
    generatedUnderstandingNote: params.feedback.suggestedUnderstandingNote,
    userEditedUnderstandingNote: params.editedNote,
    comparisonWorkspaceId: params.workspace.id,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

