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

function asCompleteness(value: unknown, fallback: Kg4NodeExpansionRecord['dataCompleteness']): Kg4NodeExpansionRecord['dataCompleteness'] {
  return value === 'complete' || value === 'partial' || value === 'insufficient' ? value : fallback
}

export function candidatePaperId(candidate: DedupedPaperCandidate): string {
  return candidate.canonicalId
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

  const record: Kg4NodeExpansionRecord = {
    id: stableId('kg4_expansion', `${params.paperId}:${params.nodeId}:${params.jobId}`),
    paperId: params.paperId,
    nodeId: params.nodeId,
    retrievedPaperIds,
    algorithmIdeaCards: asArray<AlgorithmIdeaCard>(output.algorithmIdeaCards),
    expansionGraphNodes: asArray<ExpansionGraphNode>(output.expansionGraphNodes),
    expansionGraphEdges: asArray<ExpansionGraphEdge>(output.expansionGraphEdges),
    fieldCognitionView: output.fieldCognitionView as FieldCognitionView | undefined,
    dataCompleteness: asCompleteness(output.dataCompleteness, retrievedPaperIds.length ? 'partial' : 'insufficient'),
    missingDataReasons: asArray<string>(output.missingDataReasons),
    generatedByJobIds: [params.jobId],
    createdAt: timestamp,
    updatedAt: timestamp
  }

  if (!isKg4NodeExpansionRecord(record)) throw new Error('invalid_kg4_expansion_record')
  return record
}
