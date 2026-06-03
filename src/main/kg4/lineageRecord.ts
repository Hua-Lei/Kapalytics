import { createHash } from 'crypto'
import type { DedupedPaperCandidate } from '../../shared/kg3'
import type {
  ConceptLearningView,
  ExpansionGraphEdge,
  ExpansionGraphNode,
  ExpansionNodeClassification,
  ExpansionRelation,
  Kg4NodeExpansionRecord,
  MethodLineageRelation,
  MethodLineageView,
  PaperMethodDigest,
  PaperQualitySignal,
  RelatedPaperRecommendation,
  ResearchAreaView,
  ExpansionIntent
} from '../../shared/kg4'
import { isKg4NodeExpansionRecord } from '../../shared/kg4'

function now(): string {
  return new Date().toISOString()
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha1').update(value).digest('hex').slice(0, 16)}`
}

function candidatePaperId(candidate: DedupedPaperCandidate): string {
  return candidate.canonicalId
}

function safeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item'
}

function shortHash(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 8)
}

export function toShortDisplayText(value: string | undefined, maxLength = 180): string {
  const normalized = value?.replace(/\s+/g, ' ').trim() ?? ''
  if (!normalized) return '暂无可展示摘要。'
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength).trimEnd()}…`
}

function mapLineageRelation(relation: MethodLineageRelation): ExpansionRelation | null {
  switch (relation) {
    case 'extends':
    case 'contrasts_with':
    case 'solves_limitation_of':
    case 'shares_assumption_with':
      return relation
    case 'applies_to_new_context':
      return 'extends'
    case 'evidence_insufficient':
      return null
  }
}

function nodesFromLineage(lineage: MethodLineageView): ExpansionGraphNode[] {
  return lineage.nodes.map((node) => ({
    id: node.id,
    type: node.role === 'open_problem' ? 'open_problem' : 'algorithm_idea',
    label: node.label,
    description: node.summary,
    sourcePaperIds: node.representativePaperIds,
    isTemporary: true,
    visualStyle: node.role === 'current_method' ? 'highlighted' : 'normal'
  }))
}

function relationFromHints(hints: PaperMethodDigest['relationHints']): MethodLineageRelation {
  if (hints.includes('improves_limitation')) return 'solves_limitation_of'
  if (hints.includes('parallel_variant')) return 'contrasts_with'
  if (hints.includes('application_variant')) return 'applies_to_new_context'
  if (hints.includes('extends')) return 'extends'
  if (hints.includes('foundation')) return 'extends'
  return 'evidence_insufficient'
}

function roleFromHints(hints: PaperMethodDigest['relationHints']): MethodLineageView['nodes'][number]['role'] {
  if (hints.includes('foundation')) return 'foundation_method'
  if (hints.includes('improves_limitation')) return 'improvement'
  if (hints.includes('application_variant')) return 'application_variant'
  if (hints.includes('parallel_variant') || hints.includes('extends')) return 'parallel_variant'
  return 'open_problem'
}

function buildDigestBackedLineageView(params: {
  paperId: string
  nodeId: string
  nodeLabel?: string
  digests: PaperMethodDigest[]
  missingReason?: string
}): MethodLineageView | undefined {
  if (!params.digests.length) return undefined
  const currentNodeId = `lineage_current_${safeId(params.nodeId)}`
  const externalNodes = params.digests.map((digest) => ({
    id: `lineage_digest_${safeId(digest.id)}_${shortHash(`${digest.id}:${digest.paperId}`)}`,
    label: digest.methodName ?? digest.paperTitle,
    role: roleFromHints(digest.relationHints),
    summary: toShortDisplayText([
      digest.problemSetting,
      digest.coreMechanism,
      digest.claimedImprovement ? `改进点：${digest.claimedImprovement}` : '',
      digest.limitation ? `局限：${digest.limitation}` : ''
    ].filter(Boolean).join(' '), 360),
    representativePaperIds: [digest.paperId],
    digestIds: [digest.id],
    evidence: [{
      sourceType: 'model_knowledge' as const,
      note: digest.evidenceSummary,
      confidence: digest.confidence
    }]
  }))

  const edges = externalNodes.map((node, index) => {
    const digest = params.digests[index]
    const relation = relationFromHints(digest.relationHints)
    return {
      id: `lineage_edge_${safeId(digest.id)}_${shortHash(`${params.nodeId}:${digest.id}`)}`,
      sourceId: relation === 'extends' ? node.id : currentNodeId,
      targetId: relation === 'extends' ? currentNodeId : node.id,
      relation,
      explanation: relation === 'evidence_insufficient'
        ? `仅能确认“${node.label}”与当前方法相关，但缺少稳定的 LLM 谱系判断。`
        : `根据论文方法摘要，“${node.label}”与当前方法存在 ${digest.relationHints.join('/')} 关系。`,
      evidencePaperIds: [digest.paperId],
      confidence: Math.max(0.25, Math.min(0.75, digest.confidence)),
      evidence: [{
        sourceType: 'model_knowledge' as const,
        note: digest.evidenceSummary,
        confidence: Math.max(0.25, Math.min(0.75, digest.confidence))
      }]
    }
  })

  const missingDataReasons = [
    params.missingReason ?? '方法谱系 LLM 输出不稳定，使用已消化的相关论文方法摘要构造兜底谱系。',
    '该谱系用于避免退化成论文列表；边方向和关系需要后续稳定 LLM 输出或人工复核。'
  ]

  return {
    id: stableId('fallback_method_lineage', `${params.paperId}:${params.nodeId}:${params.digests.map((digest) => digest.id).join(':')}`),
    anchorNodeId: params.nodeId,
    title: `${params.nodeLabel ?? params.nodeId} 方法谱系`,
    summary: `当前节点“${params.nodeLabel ?? params.nodeId}”的精细谱系生成不稳定，系统根据 ${params.digests.length} 篇相关论文的方法摘要构造了一个兜底谱系，帮助先看清候选方法之间的可能关系。`,
    problemSetup: {
      beginnerExplanation: `当前问题需要理解“${params.nodeLabel ?? params.nodeId}”与相关方法在问题设定、核心机制和改进目标上的关系。`,
      whyThisProblemMatters: '如果只列论文标题，读者很难判断哪些方法是基础、变体、改进或应用；兜底谱系至少保留方法关系假设和证据来源。',
      pdfEvidence: []
    },
    anchorPosition: {
      summary: `“${params.nodeLabel ?? params.nodeId}”作为当前论文中的目标方法或方法方向，是这次谱系的锚点。`,
      whatTheCurrentPaperChanges: '精确贡献需要结合当前 PDF 与稳定的谱系 synthesis 输出进一步确认。',
      whatItInherits: [],
      whatItDoesNotSolve: ['当前兜底谱系不等同于完整文献综述。'],
      pdfEvidence: []
    },
    confidenceAndEvidence: {
      groundedInCurrentPdf: [],
      fromModelKnowledge: params.digests.map((digest) => digest.paperTitle),
      needsFutureRetrieval: ['需要重新运行谱系 synthesis 或补充更强检索证据来确认边方向。']
    },
    nodes: [
      {
        id: currentNodeId,
        label: params.nodeLabel ?? params.nodeId,
        role: 'current_method',
        summary: '当前论文中的锚点方法；精确位置需要结合 PDF 原文和稳定谱系输出确认。',
        representativePaperIds: [params.paperId],
        digestIds: []
      },
      ...externalNodes
    ],
    edges,
    openQuestions: ['这些相关方法之间的先后关系和继承关系是否需要重新检索或人工确认？'],
    readingOrder: params.digests.map((digest) => digest.paperId),
    dataCompleteness: 'partial',
    missingDataReasons
  }
}

function edgesFromLineage(lineage: MethodLineageView): ExpansionGraphEdge[] {
  return lineage.edges.flatMap((edge) => {
    const relation = mapLineageRelation(edge.relation)
    return relation
      ? [{
        id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        relation,
        explanation: edge.explanation
      }]
      : []
  })
}

function nodesFromDigests(digests: PaperMethodDigest[]): ExpansionGraphNode[] {
  return digests.map((digest) => ({
    id: `kg4_method_${safeId(digest.id)}_${shortHash(`${digest.id}:${digest.paperId}`)}`,
    type: 'algorithm_idea',
    label: digest.methodName ?? digest.paperTitle,
    description: toShortDisplayText(digest.coreMechanism || digest.evidenceSummary),
    sourcePaperIds: [digest.paperId],
    isTemporary: true,
    visualStyle: 'normal'
  }))
}

function nodesFromRetrievedPapers(papers: DedupedPaperCandidate[]): ExpansionGraphNode[] {
  return papers.slice(0, 8).map((paper) => ({
    id: `kg4_paper_${safeId(candidatePaperId(paper))}`,
    type: 'related_paper',
    label: paper.title,
    description: toShortDisplayText(paper.abstract ?? `相关论文：${paper.title}`),
    sourcePaperIds: [candidatePaperId(paper)],
    isTemporary: true,
    visualStyle: 'faded'
  }))
}

export function assembleLineageExpansionRecord(params: {
  paperId: string
  nodeId: string
  nodeLabel?: string
  jobIds: string[]
  intent: ExpansionIntent
  retrievedPapers: DedupedPaperCandidate[]
  paperMethodDigests?: PaperMethodDigest[]
  methodLineageView?: MethodLineageView
  missingLineageReason?: string
  conceptLearningView?: ConceptLearningView
  researchAreaView?: ResearchAreaView
  classification?: ExpansionNodeClassification
  qualitySignals?: PaperQualitySignal[]
  relatedPaperRecommendations?: RelatedPaperRecommendation[]
}): Kg4NodeExpansionRecord {
  const timestamp = now()
  const digests = params.paperMethodDigests ?? []
  const methodLineageView = params.methodLineageView ?? (
    params.intent.kind === 'algorithm_method_lineage'
      ? buildDigestBackedLineageView({
        paperId: params.paperId,
        nodeId: params.nodeId,
        nodeLabel: params.nodeLabel,
        digests,
        missingReason: params.missingLineageReason
      })
      : undefined
  )
  const expansionGraphNodes = methodLineageView
    ? nodesFromLineage(methodLineageView)
    : digests.length
      ? nodesFromDigests(digests)
      : nodesFromRetrievedPapers(params.retrievedPapers)
  const expansionGraphEdges = methodLineageView ? edgesFromLineage(methodLineageView) : []
  const dataCompleteness = methodLineageView?.dataCompleteness ?? (expansionGraphNodes.length ? 'partial' : 'insufficient')
  const missingDataReasons = methodLineageView?.missingDataReasons ?? (expansionGraphNodes.length ? [] : ['No retrieved papers were available for this expansion.'])

  const record: Kg4NodeExpansionRecord = {
    id: stableId('kg4_lineage_expansion', `${params.paperId}:${params.nodeId}:${params.jobIds.join(':')}`),
    paperId: params.paperId,
    nodeId: params.nodeId,
    retrievedPaperIds: params.retrievedPapers.map(candidatePaperId),
    algorithmIdeaCards: [],
    expansionGraphNodes,
    expansionGraphEdges,
    expansionIntent: params.intent,
    expansionClassification: params.classification,
    qualitySignals: params.qualitySignals,
    relatedPaperRecommendations: params.relatedPaperRecommendations,
    paperMethodDigests: digests.length ? digests : undefined,
    methodLineageView,
    conceptLearningView: params.conceptLearningView,
    researchAreaView: params.researchAreaView,
    dataCompleteness,
    missingDataReasons,
    generatedByJobIds: params.jobIds,
    createdAt: timestamp,
    updatedAt: timestamp
  }

  if (!isKg4NodeExpansionRecord(record)) throw new Error('invalid_kg4_lineage_expansion_record')
  return record
}
