import { createHash } from 'crypto'
import type {
  FuseGraphNodesResult,
  GraphEdgeRecord,
  GraphNodeRecord,
  MergeCandidate,
  MergedGraphEdge,
  MergedGraphNode,
  MergedRelationType
} from '../../shared/kg3'
import { FilePaperMemoryRepository, SqlitePaperMemoryRepository, paperMemoryRepository } from './kg3Repository'

function now(): string {
  return new Date().toISOString()
}

function hash(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 12)
}

function overlap(a: string, b: string): number {
  const left = new Set(a.split(/\s+/).filter(Boolean))
  const right = new Set(b.split(/\s+/).filter(Boolean))
  const intersection = [...left].filter((token) => right.has(token)).length
  return intersection / Math.max(1, Math.min(left.size, right.size))
}

export async function generateMergeCandidates(sourceNode: GraphNodeRecord): Promise<MergeCandidate[]> {
  const snapshot = await paperMemoryRepository.getSnapshot()
  return snapshot.mergedGraphNodes
    .map((merged) => {
      const normalizedLabelScore = sourceNode.normalizedLabel === merged.normalizedLabel
        ? 1
        : overlap(sourceNode.normalizedLabel, merged.normalizedLabel)
      const typeMatch = sourceNode.nodeType === merged.nodeType
      const descriptionOverlapScore = overlap(sourceNode.description, merged.consensusSummary)
      const sharedMethodFamily = merged.methodFamilies.find((family) => sourceNode.searchQueries.some((query) => family.toLowerCase().includes(query.toLowerCase())))
      const decisionStatus: MergeCandidate['decisionStatus'] = typeMatch && normalizedLabelScore > 0.82 && descriptionOverlapScore > 0.25
        ? 'pending'
        : normalizedLabelScore > 0.55
          ? 'needs_review'
          : 'rejected'
      return {
        id: `merge_${hash(`${sourceNode.id}:${merged.id}`)}`,
        sourceNodeId: sourceNode.id,
        targetMergedNodeId: merged.id,
        similaritySignals: {
          normalizedLabelScore,
          typeMatch,
          descriptionOverlapScore,
          sharedPaperTopics: [],
          sharedMethodFamily
        },
        decisionStatus
      }
    })
    .filter((candidate) => candidate.decisionStatus !== 'rejected')
}

export function decideGraphNodeFusion(sourceNode: GraphNodeRecord, target: MergedGraphNode): FuseGraphNodesResult {
  const normalizedLabelScore = sourceNode.normalizedLabel === target.normalizedLabel ? 1 : overlap(sourceNode.normalizedLabel, target.normalizedLabel)
  const typeMatch = sourceNode.nodeType === target.nodeType
  const contrast = Boolean(sourceNode.contrastWithPrior?.trim())

  if (!typeMatch || contrast) {
    return {
      decision: 'do_not_merge',
      reason: !typeMatch ? '节点类型不同，不能自动合并。' : '当前论文明确 contrastWithPrior，说明它不是同一节点。',
      disagreements: [{ sourcePaperId: sourceNode.paperId, description: sourceNode.description, whyItDiffers: sourceNode.contrastWithPrior ?? '语境存在冲突。' }],
      sourceNodeIds: [sourceNode.id, ...target.sourceNodeIds],
      sourcePaperIds: [...new Set([sourceNode.paperId, ...target.sourcePaperIds])]
    }
  }

  if (normalizedLabelScore > 0.82) {
    return {
      decision: 'merge',
      reason: 'normalized label 高相似且节点类型一致，描述没有明显语境冲突。',
      canonicalLabel: target.canonicalLabel,
      consensusSummary: [target.consensusSummary, sourceNode.description].filter(Boolean).join(' / '),
      disagreements: target.disagreements,
      sourceNodeIds: [...new Set([sourceNode.id, ...target.sourceNodeIds])],
      sourcePaperIds: [...new Set([sourceNode.paperId, ...target.sourcePaperIds])]
    }
  }

  return {
    decision: 'needs_review',
    reason: '标签或描述存在部分相似，但不足以自动合并，需要 LLM 或用户二次判断。',
    disagreements: [],
    sourceNodeIds: [sourceNode.id, ...target.sourceNodeIds],
    sourcePaperIds: [...new Set([sourceNode.paperId, ...target.sourcePaperIds])]
  }
}

export async function fusePaperGraph(paperId: string): Promise<{ mergedNodes: MergedGraphNode[]; candidates: MergeCandidate[] }> {
  const snapshot = await paperMemoryRepository.getSnapshot()
  const sourceNodes = snapshot.graphNodes.filter((node) => node.paperId === paperId)
  const candidates: MergeCandidate[] = []
  const mergedNodes = [...snapshot.mergedGraphNodes]
  const sourceNodeToMergedId = new Map<string, string>()

  for (const node of sourceNodes) {
    const nodeCandidates = await generateMergeCandidates(node)
    candidates.push(...nodeCandidates)
    const best = nodeCandidates.find((candidate) => candidate.decisionStatus === 'pending' && candidate.targetMergedNodeId)
    const target = best ? mergedNodes.find((merged) => merged.id === best.targetMergedNodeId) : undefined

    if (target) {
      const decision = decideGraphNodeFusion(node, target)
      if (decision.decision === 'merge') {
        const index = mergedNodes.findIndex((merged) => merged.id === target.id)
        mergedNodes[index] = {
          ...target,
          sourceNodeIds: decision.sourceNodeIds,
          sourcePaperIds: decision.sourcePaperIds,
          consensusSummary: decision.consensusSummary ?? target.consensusSummary,
          disagreements: decision.disagreements,
          lastSeenAt: now(),
          updatedAt: now(),
          confidence: Math.min(1, target.confidence + 0.08)
        }
        sourceNodeToMergedId.set(node.id, target.id)
        continue
      }
    }

    const newMergedId = createMergedNodeId(node, mergedNodes)
    const existing = mergedNodes.find((merged) => merged.id === newMergedId)
    const mergedNode: MergedGraphNode = existing ? {
      ...existing,
      aliases: [...new Set([...existing.aliases, node.label])],
      sourceNodeIds: [...new Set([...existing.sourceNodeIds, node.id])],
      sourcePaperIds: [...new Set([...existing.sourcePaperIds, node.paperId])],
      representativePaperIds: [...new Set([...existing.representativePaperIds, node.paperId])],
      keyInsights: [...new Set([...existing.keyInsights, node.insight].filter((item): item is string => Boolean(item)))],
      methodFamilies: [...new Set([...existing.methodFamilies, ...node.searchQueries])],
      lastSeenAt: now(),
      updatedAt: now(),
      confidence: Math.min(1, existing.confidence + 0.04)
    } : {
      id: newMergedId,
      canonicalLabel: node.label,
      aliases: [node.label],
      normalizedLabel: node.normalizedLabel,
      nodeType: node.nodeType,
      sourceNodeIds: [node.id],
      sourcePaperIds: [node.paperId],
      representativePaperIds: [node.paperId],
      consensusSummary: node.description,
      keyInsights: [node.insight].filter((item): item is string => Boolean(item)),
      disagreements: [],
      methodFamilies: node.searchQueries,
      firstSeenAt: now(),
      lastSeenAt: now(),
      confidence: 0.62,
      createdAt: now(),
      updatedAt: now()
    }

    const existingIndex = mergedNodes.findIndex((merged) => merged.id === newMergedId)
    if (existingIndex === -1) mergedNodes.push(mergedNode)
    else mergedNodes[existingIndex] = mergedNode
    sourceNodeToMergedId.set(node.id, newMergedId)
  }

  snapshot.mergedGraphNodes = mergedNodes
  snapshot.mergedGraphEdges = upsertMergedGraphEdges(snapshot.mergedGraphEdges, snapshot.graphEdges.filter((edge) => edge.paperId === paperId), sourceNodeToMergedId)
  if (paperMemoryRepository instanceof FilePaperMemoryRepository || paperMemoryRepository instanceof SqlitePaperMemoryRepository) {
    await paperMemoryRepository.saveSnapshot(snapshot)
  }
  await paperMemoryRepository.saveLLMJob({
    id: `job_fuse_${hash(paperId)}`,
    type: 'fuse_graph_nodes',
    status: 'succeeded',
    priority: 'low',
    inputHash: hash(paperId),
    cacheKey: `fuse:${paperId}`,
    paperId,
    relatedPaperIds: [],
    promptVersion: 'rule-based-v1',
    model: 'deepseek-chat',
    jsonMode: true,
    maxTokens: 0,
    temperature: 0,
    attempts: 0,
    maxAttempts: 0,
    progressStep: 'done',
    progressMessage: '已完成轻量图谱记忆融合。',
    resultJson: { mergedNodeCount: mergedNodes.length, mergedEdgeCount: snapshot.mergedGraphEdges.length, candidateCount: candidates.length },
    createdAt: now(),
    finishedAt: now()
  })
  return { mergedNodes, candidates }
}

function createMergedNodeId(node: GraphNodeRecord, existingNodes: MergedGraphNode[]): string {
  const base = `merged_${hash(`${node.nodeType}:${node.normalizedLabel}`)}`
  if (!existingNodes.some((nodeRecord) => nodeRecord.id === base)) return base
  const compatible = existingNodes.find((nodeRecord) => nodeRecord.id === base && nodeRecord.nodeType === node.nodeType && nodeRecord.normalizedLabel === node.normalizedLabel)
  if (compatible) return base
  return `${base}_${hash(node.description).slice(0, 6)}`
}

function upsertMergedGraphEdges(
  existingEdges: MergedGraphEdge[],
  sourceEdges: GraphEdgeRecord[],
  sourceNodeToMergedId: Map<string, string>
): MergedGraphEdge[] {
  let next = [...existingEdges]
  for (const edge of sourceEdges) {
    const sourceMergedNodeId = sourceNodeToMergedId.get(edge.sourceNodeId)
    const targetMergedNodeId = sourceNodeToMergedId.get(edge.targetNodeId)
    if (!sourceMergedNodeId || !targetMergedNodeId || sourceMergedNodeId === targetMergedNodeId) continue

    const relationType = mapRelationToMergedType(edge.label)
    const id = `merged_edge_${hash(`${sourceMergedNodeId}:${targetMergedNodeId}:${relationType}`)}`
    const existing = next.find((candidate) => candidate.id === id)
    const record: MergedGraphEdge = existing ? {
      ...existing,
      sourceEdgeIds: [...new Set([...existing.sourceEdgeIds, edge.id])],
      sourcePaperIds: [...new Set([...existing.sourcePaperIds, edge.paperId])],
      evidenceSnippets: [...new Set([...existing.evidenceSnippets, edge.evidence].filter((item): item is string => Boolean(item)))],
      confidence: Math.min(1, existing.confidence + 0.06),
      updatedAt: now()
    } : {
      id,
      sourceMergedNodeId,
      targetMergedNodeId,
      relationType,
      label: edge.label,
      sourceEdgeIds: [edge.id],
      sourcePaperIds: [edge.paperId],
      evidenceSnippets: [edge.evidence].filter((item): item is string => Boolean(item)),
      confidence: edge.confidence,
      createdAt: now(),
      updatedAt: now()
    }
    next = next.filter((candidate) => candidate.id !== id).concat(record)
  }
  return next
}

export function mapRelationToMergedType(label: string): MergedRelationType {
  if (/动机|motiv/i.test(label)) return 'motivates'
  if (/解决|solve/i.test(label)) return 'solves'
  if (/使用|use/i.test(label)) return 'uses'
  if (/扩展|extend/i.test(label)) return 'extends'
  if (/对比|contrast/i.test(label)) return 'contrasts_with'
  if (/验证|valid/i.test(label)) return 'validated_by'
  if (/限制|limit/i.test(label)) return 'limited_by'
  if (/演进|evolve/i.test(label)) return 'evolves_to'
  return 'is_prerequisite_of'
}
