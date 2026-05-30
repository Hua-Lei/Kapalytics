import type { GraphNode } from '../../../shared/paper'
import type { KnowledgeGraph as KGType } from '../modules/graph/types'
import type { ExpansionGraphNode } from '../../../shared/kg4'
import type { NodeExpansionSession } from '../modules/workspace/nodeExpansionSessions'
import KnowledgeGraph from './KnowledgeGraph'

interface ExpansionGraphViewProps {
  anchorNode: GraphNode | undefined
  graph: KGType
  selectedExpansionNodeId?: string
  session: NodeExpansionSession | undefined
  onClear: () => void
  onSelectExpansionNode: (node: ExpansionGraphNode, expansionId: string) => void
}

const TYPE_LABELS: Record<string, string> = {
  method_family: 'method family',
  algorithm_idea: 'algorithm idea',
  related_paper: 'related paper',
  prerequisite_concept: 'prerequisite',
  open_problem: 'open problem'
}

function ExpansionGraphView({ anchorNode, graph, selectedExpansionNodeId, session, onClear, onSelectExpansionNode }: ExpansionGraphViewProps) {
  if (!session || !session.expansionGraph || !anchorNode) {
    return (
      <div className="workspace-placeholder-view expansion-graph-view expansion-graph-view--empty">
        <span className="eyebrow">Expansion Graph</span>
        <h3>没有可展示的临时扩展图谱</h3>
        <p>请先从可展开节点创建 Node Expansion Loading View。</p>
      </div>
    )
  }

  const expansionGraph = {
    ...session.expansionGraph,
    nodes: session.expansionGraph.nodes.slice(0, 8)
  }
  const nodes = expansionGraph.nodes
  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = session.expansionGraph.edges.filter((edge) => nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId))
  expansionGraph.edges = edges

  return (
    <div className="expansion-graph-view">
      <section className="expansion-graph-toolbar">
        <div>
          <span className="eyebrow">Expansion Graph View</span>
          <h3>{session.nodeLabel}</h3>
          <p>浅色节点是 temporary expansion nodes。点击节点只更新右侧 AI Panel，不打开完整 Workbench。</p>
        </div>
        <button className="stage-btn stage-btn--secondary" onClick={onClear}>清除 temporary graph</button>
      </section>

      <section className="expansion-graph-canvas">
        <KnowledgeGraph
          graph={graph}
          paperInsight={null}
          selectedExpansionNodeId={selectedExpansionNodeId}
          selectedNodeId={anchorNode.id}
          view="argument"
          expansionGraph={expansionGraph}
          onNodeSelect={() => {}}
          onClearExpansionGraph={onClear}
          onExpansionNodeSelect={(node) => onSelectExpansionNode(node, session.id)}
        />
      </section>

      <section className="expansion-node-list">
        {nodes.map((node) => (
          <button
            className={`expansion-graph-node ${selectedExpansionNodeId === node.id ? 'expansion-graph-node--selected' : ''}`}
            key={node.id}
            onClick={() => onSelectExpansionNode(node, session.id)}
            type="button"
          >
            <span>{TYPE_LABELS[node.type] ?? node.type}</span>
            <strong>{node.label}</strong>
            <p>{node.description}</p>
            <em>{node.sourcePaperIds.length} source paper{node.sourcePaperIds.length === 1 ? '' : 's'}</em>
          </button>
        ))}
      </section>

      <section className="expansion-edge-list">
        <span className="eyebrow">Temporary Expansion Edges</span>
        {edges.length ? edges.map((edge) => {
          const source = nodes.find((node) => node.id === edge.sourceId)
          const target = nodes.find((node) => node.id === edge.targetId)
          return (
            <article key={edge.id}>
              <strong>{source?.label ?? edge.sourceId} → {target?.label ?? edge.targetId}</strong>
              <span>{edge.relation}</span>
              <p>{edge.explanation}</p>
            </article>
          )
        }) : <p>当前 fixture 没有可展示的扩展边。</p>}
      </section>
    </div>
  )
}

export default ExpansionGraphView
