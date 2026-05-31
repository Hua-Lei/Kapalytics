import { createHash } from 'crypto'
import type { DedupedPaperCandidate } from '../../shared/kg3'
import type {
  ExpansionGraphEdge,
  ExpansionGraphNode,
  ExpansionRelation,
  Kg4NodeExpansionRecord,
  MethodLineageRelation,
  MethodLineageView,
  PaperMethodDigest,
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
    description: toShortDisplayText(`相关论文：${paper.title}`),
    sourcePaperIds: [candidatePaperId(paper)],
    isTemporary: true,
    visualStyle: 'faded'
  }))
}

export function assembleLineageExpansionRecord(params: {
  paperId: string
  nodeId: string
  jobIds: string[]
  intent: ExpansionIntent
  retrievedPapers: DedupedPaperCandidate[]
  paperMethodDigests?: PaperMethodDigest[]
  methodLineageView?: MethodLineageView
}): Kg4NodeExpansionRecord {
  const timestamp = now()
  const digests = params.paperMethodDigests ?? []
  const expansionGraphNodes = params.methodLineageView
    ? nodesFromLineage(params.methodLineageView)
    : digests.length
      ? nodesFromDigests(digests)
      : nodesFromRetrievedPapers(params.retrievedPapers)
  const expansionGraphEdges = params.methodLineageView ? edgesFromLineage(params.methodLineageView) : []
  const dataCompleteness = params.methodLineageView?.dataCompleteness ?? (expansionGraphNodes.length ? 'partial' : 'insufficient')
  const missingDataReasons = params.methodLineageView?.missingDataReasons ?? (expansionGraphNodes.length ? [] : ['No retrieved papers were available for this expansion.'])

  const record: Kg4NodeExpansionRecord = {
    id: stableId('kg4_lineage_expansion', `${params.paperId}:${params.nodeId}:${params.jobIds.join(':')}`),
    paperId: params.paperId,
    nodeId: params.nodeId,
    retrievedPaperIds: params.retrievedPapers.map(candidatePaperId),
    algorithmIdeaCards: [],
    expansionGraphNodes,
    expansionGraphEdges,
    expansionIntent: params.intent,
    paperMethodDigests: digests.length ? digests : undefined,
    methodLineageView: params.methodLineageView,
    dataCompleteness,
    missingDataReasons,
    generatedByJobIds: params.jobIds,
    createdAt: timestamp,
    updatedAt: timestamp
  }

  if (!isKg4NodeExpansionRecord(record)) throw new Error('invalid_kg4_lineage_expansion_record')
  return record
}
