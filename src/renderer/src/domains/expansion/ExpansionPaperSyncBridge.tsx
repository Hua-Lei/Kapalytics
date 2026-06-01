import { useEffect } from 'react'
import { usePaper } from '../paper/usePaper'
import { useExpansion } from './useExpansion'

export function ExpansionPaperSyncBridge() {
  const { graph, paperId, paperInsight, pdfUrl } = usePaper()
  const { setPaperContext } = useExpansion()

  useEffect(() => {
    setPaperContext({ graphNodes: graph.nodes, graphEdges: graph.edges, paperInsight, paperId, pdfUrl })
  }, [graph.nodes, graph.edges, paperId, paperInsight, pdfUrl, setPaperContext])

  return null
}
