import { createHash } from 'crypto'
import type { DedupedPaperCandidate } from '../../shared/kg3'
import type {
  AlgorithmIdeaCard,
  ExpansionGraphEdge,
  ExpansionGraphNode,
  FieldCognitionView,
  Kg4NodeExpansionRecord
} from '../../shared/kg4'
import { isKg4NodeExpansionRecord } from '../../shared/kg4'

function now(): string {
  return new Date().toISOString()
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha1').update(value).digest('hex').slice(0, 16)}`
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []
}

function asCompleteness(value: unknown, fallback: Kg4NodeExpansionRecord['dataCompleteness']): Kg4NodeExpansionRecord['dataCompleteness'] {
  return value === 'complete' || value === 'partial' || value === 'insufficient' ? value : fallback
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined)
}

function safeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item'
}

export function candidatePaperId(candidate: DedupedPaperCandidate): string {
  return candidate.canonicalId
}

function normalizeIdeaCard(value: unknown, index: number): AlgorithmIdeaCard | null {
  if (!isRecord(value)) return null
  const paperId = readString(value, 'paperId')
  const title = readString(value, 'paperTitle') ?? readString(value, 'title')
  const description = readString(value, 'coreIdea') ?? readString(value, 'description')
  if (!paperId || !title || !description) return null

  return {
    id: readString(value, 'id') ?? `card_${index + 1}`,
    paperId,
    paperTitle: title,
    problemSetting: readString(value, 'problemSetting') ?? readString(value, 'problem') ?? description,
    coreIdea: description,
    keyAssumption: readString(value, 'keyAssumption') ?? '未在模型输出中明确说明。',
    mechanism: readString(value, 'mechanism') ?? description,
    objectiveOrUpdateRule: readString(value, 'objectiveOrUpdateRule'),
    updatedObject: readString(value, 'updatedObject'),
    strength: readString(value, 'strength') ?? '与当前节点存在可比较的机制关联。',
    limitation: readString(value, 'limitation') ?? '需要进一步阅读原文确认边界条件。',
    bestUseCase: readString(value, 'bestUseCase'),
    relationToCurrentNode: 'parallel',
    relationExplanation: readString(value, 'relationExplanation') ?? '由节点展开检索结果归纳得到。',
    evidenceSource: {
      paperId,
      source: 'openalex'
    },
    insufficientInformation: readString(value, 'insufficientInformation')
  }
}

function normalizeExpansionGraphNode(value: unknown): ExpansionGraphNode | null {
  if (!isRecord(value)) return null
  const id = readString(value, 'id')
  const label = readString(value, 'label')
  const type = readString(value, 'type') ?? readString(value, 'nodeType')
  const description = readString(value, 'description') ?? readString(value, 'abstract')
  const sourcePaperIds = readStringArray(value.sourcePaperIds)
  if (!id || !label || !type || !description || !sourcePaperIds.length) return null

  return {
    id,
    type: type as ExpansionGraphNode['type'],
    label,
    description,
    sourcePaperIds,
    isTemporary: typeof value.isTemporary === 'boolean' ? value.isTemporary : true,
    visualStyle: readString(value, 'visualStyle') as ExpansionGraphNode['visualStyle'] | undefined
  }
}

function normalizeExpansionGraphEdge(value: unknown): ExpansionGraphEdge | null {
  if (!isRecord(value)) return null
  const id = readString(value, 'id')
  const sourceId = readString(value, 'sourceId')
  const targetId = readString(value, 'targetId')
  if (!id || !sourceId || !targetId) return null

  return {
    id,
    sourceId,
    targetId,
    relation: (readString(value, 'relation') ?? 'uses_as_foundation') as ExpansionGraphEdge['relation'],
    explanation: readString(value, 'explanation') ?? '由节点展开结果生成。'
  }
}

export function buildExpansionRecord(params: {
  paperId: string
  nodeId: string
  jobId: string
  retrievedPapers: DedupedPaperCandidate[]
  llmOutput: unknown
}): Kg4NodeExpansionRecord {
  const output = params.llmOutput && typeof params.llmOutput === 'object'
    ? params.llmOutput as Record<string, unknown>
    : {}
  const timestamp = now()
  const retrievedPaperIds = asArray<string>(output.retrievedPaperIds).length
    ? asArray<string>(output.retrievedPaperIds)
    : params.retrievedPapers.map(candidatePaperId)
  const algorithmIdeaCards = asArray<unknown>(firstDefined(output.algorithmIdeaCards, output.ideaCards))
    .map(normalizeIdeaCard)
    .filter((card): card is AlgorithmIdeaCard => Boolean(card))
  const llmExpansionGraphNodes = asArray<unknown>(firstDefined(output.expansionGraphNodes, output.graphNodes))
    .map(normalizeExpansionGraphNode)
    .filter((node): node is ExpansionGraphNode => Boolean(node))
  const fallbackPaperNodes: ExpansionGraphNode[] = llmExpansionGraphNodes.length
    ? []
    : params.retrievedPapers.slice(0, 8).map((paper) => ({
      id: `kg4_paper_${safeId(candidatePaperId(paper))}`,
      type: 'related_paper',
      label: paper.title,
      description: paper.abstract ?? `Retrieved paper related to this node: ${paper.title}`,
      sourcePaperIds: [candidatePaperId(paper)],
      isTemporary: true,
      visualStyle: 'faded'
    }))
  const expansionGraphNodes = llmExpansionGraphNodes.length ? llmExpansionGraphNodes : fallbackPaperNodes
  const expansionGraphEdges = asArray<unknown>(firstDefined(output.expansionGraphEdges, output.graphEdges))
    .map(normalizeExpansionGraphEdge)
    .filter((edge): edge is ExpansionGraphEdge => Boolean(edge))
  const missingDataReasons = asArray<string>(output.missingDataReasons)
  const insufficientInformation = typeof output.insufficientInformation === 'string'
    ? [output.insufficientInformation]
    : []
  const structuralMissingDataReasons = [
    ...missingDataReasons,
    ...insufficientInformation,
    ...(llmExpansionGraphNodes.length || !fallbackPaperNodes.length ? [] : ['LLM did not generate expansion graph nodes; showing retrieved papers instead.']),
    ...(expansionGraphNodes.length ? [] : ['No expansion graph nodes were generated from the LLM output.'])
  ]
  const dataCompleteness = expansionGraphNodes.length
    ? asCompleteness(output.dataCompleteness, retrievedPaperIds.length ? 'partial' : 'insufficient')
    : 'insufficient'

  const record: Kg4NodeExpansionRecord = {
    id: stableId('kg4_expansion', `${params.paperId}:${params.nodeId}:${params.jobId}`),
    paperId: params.paperId,
    nodeId: params.nodeId,
    retrievedPaperIds,
    algorithmIdeaCards,
    expansionGraphNodes,
    expansionGraphEdges,
    fieldCognitionView: firstDefined(output.fieldCognitionView, output.fieldCognition) as FieldCognitionView | undefined,
    dataCompleteness,
    missingDataReasons: structuralMissingDataReasons,
    generatedByJobIds: [params.jobId],
    createdAt: timestamp,
    updatedAt: timestamp
  }

  if (!isKg4NodeExpansionRecord(record)) throw new Error('invalid_kg4_expansion_record')
  return record
}
