import { useEffect } from 'react'
import { usePaper } from '../paper/usePaper'
import { useExpansion } from './useExpansion'

export function ExpansionPaperSyncBridge() {
  const { graph, paperId, paperInsight } = usePaper()
  const { setPaperContext } = useExpansion()

  useEffect(() => {
    setPaperContext({ graphNodes: graph.nodes, paperInsight, paperId })
  }, [graph.nodes, paperId, paperInsight, setPaperContext])

  return null
}
