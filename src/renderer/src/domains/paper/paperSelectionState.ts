import type { KnowledgeGraph } from '../../../../shared/paper'

export function hasCurrentPaperAnalysis({
  graph,
  graphPaperId,
  paperId
}: {
  graph: KnowledgeGraph
  graphPaperId: string | null
  paperId: string | null
}): boolean {
  return Boolean(paperId && graphPaperId === paperId && graph.nodes.length > 0)
}
