import type { ExpansionGraphNode } from '../../../shared/kg4'
import { ExpansionRouteHeader } from './ExpansionRouteHeader'
import KnowledgeGraph from './KnowledgeGraph'
import { useWorkspace } from '../domains/workspace/useWorkspace'
import { useExpansion } from '../domains/expansion/useExpansion'
import { usePaper } from '../domains/paper/usePaper'

const TYPE_LABELS: Record<string, string> = {
  method_family: 'method family',
  algorithm_idea: 'algorithm idea',
  related_paper: 'related paper',
  prerequisite_concept: 'prerequisite',
  open_problem: 'open problem'
}

function truncateDescription(description: string, maxLength = 220) {
  if (description.length <= maxLength) return description
  return `${description.slice(0, maxLength - 1).trimEnd()}...`
}

function formatRelationHints(relationHints: string[]) {
  return relationHints.join(' / ')
}

function ExpansionGraphView() {
  const { activeTab, openTab, selectObject, updateTabStatus } = useWorkspace()
  const { sessions, selectExpansionNode, clearExpansionGraph, startExpansion } = useExpansion()
  const { graph } = usePaper()

  const session = activeTab?.expansionId ? sessions[activeTab.expansionId] : undefined
  const record = session?.expansionRecord
  const lineage = record?.methodLineageView
  const digests = record?.paperMethodDigests ?? []
  const visibleDigests = digests.slice(0, 5)
  const anchorNode = session ? graph.nodes.find((n) => n.id === session.nodeId) : undefined
  const selectedExpansionNodeId = session?.selectedExpansionNodeId

  const handleClear = () => {
    if (!session) return
    clearExpansionGraph(session.id)
    updateTabStatus(activeTab?.id ?? '', 'empty')
    selectObject(undefined)
  }

  const handleSelectExpansionNode = (node: ExpansionGraphNode) => {
    if (!session) return
    selectExpansionNode(node, session.id)
    selectObject({ type: 'expansion_node', id: node.id, expansionId: session.id })
  }

  const handleRetryExpansion = async () => {
    if (!session) return
    const result = await startExpansion(session.nodeId, { forceRefresh: true })
    if (!result) return
    openTab({
      id: result.sessionId,
      type: 'node_expansion_loading',
      title: `Expand: ${session.nodeLabel}`,
      nodeId: session.nodeId,
      expansionId: result.sessionId,
      closable: true,
      status: 'loading'
    })
  }

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
          <p>{lineage?.summary ?? '浅色节点是 temporary expansion nodes。点击节点会更新右侧 AI Panel 细节，不会直接打开 compare workbench。'}</p>
        </div>
        <div className="ai-context-actions">
          <button className="stage-btn stage-btn--secondary" onClick={handleRetryExpansion}>重新检索分析</button>
          <button className="stage-btn stage-btn--secondary" onClick={handleClear}>清除 temporary graph</button>
        </div>
      </section>

      <ExpansionRouteHeader classification={record?.expansionClassification} nodeLabel={session.nodeLabel} />

      <section className="expansion-graph-canvas">
        <KnowledgeGraph
          graph={graph}
          paperInsight={null}
          selectedExpansionNodeId={selectedExpansionNodeId}
          selectedNodeId={anchorNode.id}
          view="argument"
          expansionGraph={expansionGraph}
          onNodeSelect={() => {}}
          onClearExpansionGraph={handleClear}
          onExpansionNodeSelect={handleSelectExpansionNode}
        />
      </section>

      {lineage ? (
        <section className="kg4-field-view">
          <span className="eyebrow">Method Lineage</span>
          <h4>{lineage.title}</h4>
          <p>{lineage.summary}</p>
          {lineage.readingOrder.length ? (
            <div>
              <strong>Reading Order</strong>
              <div className="kg4-family-list">
                {lineage.readingOrder.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
          ) : null}
          {lineage.openQuestions.length ? (
            <div>
              <strong>Open Questions</strong>
              <div className="kg4-family-list">
                {lineage.openQuestions.map((question) => (
                  <span key={question}>{question}</span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="expansion-node-list">
        {nodes.map((node) => (
          <button
            className={`expansion-graph-node ${selectedExpansionNodeId === node.id ? 'expansion-graph-node--selected' : ''}`}
            key={node.id}
            onClick={() => handleSelectExpansionNode(node)}
            type="button"
          >
            <span>{TYPE_LABELS[node.type] ?? node.type}</span>
            <strong>{node.label}</strong>
            <p>{truncateDescription(node.description)}</p>
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
        }) : <p>当前没有可展示的扩展边。</p>}
      </section>

      {digests.length ? (
        <section className="expansion-edge-list">
          <span className="eyebrow">Evidence Papers</span>
          {visibleDigests.map((digest) => (
            <article key={digest.id}>
              <strong>{digest.methodName || digest.paperTitle}</strong>
              <span>{formatRelationHints(digest.relationHints)}</span>
              <p>{truncateDescription(digest.evidenceSummary, 170)}</p>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  )
}

export default ExpansionGraphView
