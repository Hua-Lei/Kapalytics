import type { GraphEdgeRecord, GraphNodeRecord, Kg3MemorySnapshot, PaperInsightRecord } from '../../../../shared/kg3'
import type { GraphEdge, GraphNode, KnowledgeGraph, PaperInsight } from '../../../../shared/paper'
import { sanitizeGraph } from './analysisState'

export interface SavedPaperAnalysis {
  graph: KnowledgeGraph
  paperInsight: PaperInsight | null
}

function localNodeId(recordId: string, paperId: string): string {
  const prefix = `${paperId}:`
  return recordId.startsWith(prefix) ? recordId.slice(prefix.length) : recordId
}

function restoreNode(record: GraphNodeRecord, paperId: string): GraphNode {
  return {
    id: localNodeId(record.id, paperId),
    type: record.nodeType,
    label: record.label,
    description: record.description,
    x: Number.NaN,
    y: Number.NaN,
    insight: record.insight,
    whyImportant: record.whyImportant,
    roleInPaper: record.roleInPaper,
    contrastWithPrior: record.contrastWithPrior,
    evidenceNodeIds: record.evidenceNodeIds.map((id) => localNodeId(id, paperId)),
    expandable: record.expandable,
    expansionType: record.expansionType,
    searchQueries: record.searchQueries,
    detail: record.detailJson
  }
}

function restoreEdge(record: GraphEdgeRecord, paperId: string): GraphEdge {
  return {
    id: localNodeId(record.id, paperId),
    sourceId: localNodeId(record.sourceNodeId, paperId),
    targetId: localNodeId(record.targetNodeId, paperId),
    label: record.label,
    directed: record.directed
  }
}

function restoreInsight(record: PaperInsightRecord | undefined): PaperInsight | null {
  if (!record) return null
  return {
    centralInsight: record.centralInsight,
    priorLimitation: record.priorLimitation,
    methodMechanism: record.methodMechanism,
    evidenceChain: record.evidenceChain,
    remainingGap: record.remainingGap
  }
}

export function restoreSavedPaperAnalysis(snapshot: Kg3MemorySnapshot, paperId: string): SavedPaperAnalysis | null {
  const graphNodes = snapshot.graphNodes.filter((node) => node.paperId === paperId)
  if (!graphNodes.length) return null

  const graphEdges = snapshot.graphEdges.filter((edge) => edge.paperId === paperId)
  const graph = sanitizeGraph({
    nodes: graphNodes.map((node) => restoreNode(node, paperId)),
    edges: graphEdges.map((edge) => restoreEdge(edge, paperId))
  })

  return {
    graph,
    paperInsight: restoreInsight(snapshot.paperInsights.find((insight) => insight.paperId === paperId))
  }
}
