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
  MemoryReuseSuggestion,
  NodeUnderstandingMemory,
  ReflectiveFeedback,
  RemedialLesson
} from '../../../../shared/kg4'
import { normalizeKg4NodeLabel } from '../../../../shared/kg4'
import { mockRelatedPapers } from './nodeExpansion'

function now(): string {
  return new Date().toISOString()
}

function safeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item'
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/).filter((part) => part.length > 1)
}

function relationForIndex(index: number): AlgorithmIdeaCard['relationToCurrentNode'] {
  return (['foundation', 'predecessor', 'parallel', 'variant', 'successor'] as const)[index] ?? 'parallel'
}

export function buildKg4MockIdeaCards(node: GraphNode): AlgorithmIdeaCard[] {
  const queries = [...(node.searchQueries ?? []), node.label, node.description, node.insight ?? '']
  const queryTokens = new Set(queries.flatMap(tokenize))
  const matched = mockRelatedPapers
    .map((paper) => {
      const indexedText = [paper.title, paper.methodFamily, paper.branchLabel, paper.summary, ...paper.topicTags].join(' ')
      const score = tokenize(indexedText).filter((token) => queryTokens.has(token)).length
      return { paper, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.paper)

  return matched.map((paper, index) => ({
    id: `idea_${safeId(paper.id)}`,
    paperId: paper.id,
    paperTitle: paper.title,
    problemSetting: paper.solves,
    coreIdea: paper.summary,
    keyAssumption: `假设 ${paper.methodFamily} 的核心机制能在当前节点“${node.label}”关注的问题中复用或对照。`,
    mechanism: paper.relationToCurrentNode,
    objectiveOrUpdateRule: paper.adaptationStage ? `适配阶段：${paper.adaptationStage}` : '信息不足：需要阅读原文确认优化目标。',
    updatedObject: paper.updatedObject,
    strength: paper.whyCompare,
    limitation: paper.remainingGap,
    bestUseCase: paper.relationToCurrentPaper,
    relationToCurrentNode: relationForIndex(index),
    relationExplanation: paper.relationToCurrentNode,
    evidenceSource: {
      paperId: paper.id,
      source: 'mock',
      url: paper.url,
      externalId: paper.id
    }
  }))
}

export function buildKg4ExpansionRecord(node: GraphNode, paperInsight: PaperInsight | null): Kg4NodeExpansionRecord {
  const timestamp = now()
  const ideaCards = buildKg4MockIdeaCards(node)
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

  const missingDataReasons = ideaCards.length ? [] : ['当前 mock fixture 没有匹配论文；生产路径应使用 KG4 IPC 检索。']
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

export function generateLocalFeedback(
  node: GraphNode,
  workspace: AlgorithmIdeaComparisonWorkspace,
  userReflection: string
): Kg4Feedback {
  const timestamp = now()
  const selected = workspace.ideaCards.filter((card) => workspace.selectedIdeaCardIds.includes(card.id))
  const tooShort = userReflection.trim().length < 40
  const mentionsMechanism = /机制|假设|更新|目标|局限|适用|assumption|mechanism|objective|limitation/i.test(userReflection)

  if (tooShort || !mentionsMechanism) {
    const lesson: RemedialLesson = {
      id: `feedback_remedial_${safeId(node.id)}_${Date.now()}`,
      type: 'remedial',
      paperId: workspace.currentPaperId,
      nodeId: node.id,
      missingPrerequisite: '算法思想对比维度',
      whyItMattersForCurrentNode: `理解“${node.label}”时，需要能区分问题设置、关键假设、机制流程和更新对象。`,
      shortExplanation: '先问每篇论文解决什么问题，再问它更新什么对象、依赖什么假设、在哪些场景会失败。这样能避免把相邻方法都概括成“效果更好”。',
      example: selected[0] ? `例如 ${selected[0].paperTitle} 的更新对象是：${selected[0].updatedObject || '信息不足'}。` : undefined,
      recommendedPapers: selected.map((card) => card.paperId),
      recommendedArticles: [],
      checkQuestion: '请用一句话分别说明一个候选方法的“更新对象”和“失败边界”。',
      suggestedUnderstandingNote: `我对“${node.label}”的理解还需要补齐算法对比维度：问题设置、关键假设、机制流程、更新对象和局限。`,
      createdAt: timestamp
    }
    return lesson
  }

  const feedback: ReflectiveFeedback = {
    id: `feedback_reflective_${safeId(node.id)}_${Date.now()}`,
    type: 'reflective',
    paperId: workspace.currentPaperId,
    nodeId: node.id,
    selectedIdeaCardIds: workspace.selectedIdeaCardIds,
    strengths: ['你已经开始用机制或假设来比较算法思想，而不是只比较论文主题。'],
    missingDimensions: ['建议进一步明确更新对象、适用场景和可能失败条件。'],
    possibleCounterArguments: ['如果两个方法的问题设置不同，直接比较机制优劣可能会误导。'],
    evidenceFromPapers: selected.map((card) => ({ paperId: card.paperId, evidence: card.relationExplanation })),
    followUpQuestions: workspace.reflectionQuestions.slice(0, 3),
    suggestedUnderstandingNote: `关于“${node.label}”，我的当前理解是：${userReflection.trim()} 还需要继续用更新对象、关键假设和失败边界来验证这个判断。`,
    createdAt: timestamp
  }
  return feedback
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

export function buildLocalReuseSuggestions(node: GraphNode, memories: NodeUnderstandingMemory[]): MemoryReuseSuggestion[] {
  const normalized = normalizeKg4NodeLabel(node.label)
  const nodeTopics = new Set([...(node.searchQueries ?? []), node.label].map(normalizeKg4NodeLabel))
  return memories
    .map((memory) => {
      const signals: MemoryReuseSuggestion['matchedSignals'] = []
      if (memory.normalizedNodeLabel === normalized) signals.push('normalized_label')
      if (memory.nodeType === node.type) signals.push('node_type')
      if (memory.topicTags.some((tag) => nodeTopics.has(normalizeKg4NodeLabel(tag)))) signals.push('topic_tag')
      const confidence = Math.min(0.95, signals.length * 0.25 + (signals.includes('normalized_label') ? 0.35 : 0))
      return {
        id: `reuse_${memory.id}_${safeId(node.id)}`,
        memoryId: memory.id,
        currentNodeId: node.id,
        currentPaperId: 'current-paper',
        matchReason: signals.length ? `匹配信号：${signals.join(', ')}` : '弱匹配，建议谨慎查看。',
        matchedSignals: signals,
        confidence,
        suggestedReuseText: memory.userEditedUnderstandingNote || memory.generatedUnderstandingNote
      }
    })
    .filter((suggestion) => suggestion.confidence >= 0.3)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
}
