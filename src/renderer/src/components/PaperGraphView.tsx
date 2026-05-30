import { usePaper } from '../domains/paper/usePaper'
import { useWorkspace } from '../domains/workspace/useWorkspace'
import KnowledgeGraph from './KnowledgeGraph'

function PaperGraphView() {
  const { graph, paperInsight } = usePaper()
  const { state, selectObject } = useWorkspace()
  const selectedNodeId = state.selectedObject?.type === 'graph_node' ? state.selectedObject.id : null

  const handleNodeSelect = (nodeId: string) => {
    selectObject({ type: 'graph_node', id: nodeId })
  }

  if (graph.nodes.length === 0) {
    return (
      <div className="graph-empty-state">
        <span className="eyebrow">Knowledge Map</span>
        <h2>上传并分析论文后生成理解地图</h2>
        <p>核心概念、方法、公式、实验和局限会在这里组成可交互图谱。</p>
      </div>
    )
  }

  return (
    <KnowledgeGraph
      graph={graph}
      paperInsight={paperInsight}
      selectedNodeId={selectedNodeId}
      view="argument"
      onNodeSelect={handleNodeSelect}
    />
  )
}

export default PaperGraphView
