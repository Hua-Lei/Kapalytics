import { useExpansion } from '../domains/expansion/useExpansion'
import { useWorkspace } from '../domains/workspace/useWorkspace'

function LineageNodeDetailView() {
  const { activeTab } = useWorkspace()
  const { sessions } = useExpansion()

  const session = activeTab?.expansionId ? sessions[activeTab.expansionId] : undefined
  const lineage = session?.expansionRecord?.methodLineageView
  const node = lineage?.nodes.find((item) => item.id === activeTab?.nodeId)
  const relatedEdges = lineage?.edges.filter((edge) => edge.sourceId === node?.id || edge.targetId === node?.id) ?? []

  if (!session || !lineage || !node) {
    return (
      <div className="workspace-placeholder-view">
        <span className="eyebrow">Lineage Node Detail</span>
        <h3>找不到谱系节点详情</h3>
        <p>请先从 Expansion Graph View 选择一个方法谱系节点，再查看这里的详细信息。</p>
      </div>
    )
  }

  const labelForNode = (id: string) => lineage.nodes.find((item) => item.id === id)?.label ?? id

  return (
    <div className="expand-view kg4-workbench">
      <section className="expand-view__hero">
        <div>
          <span className="eyebrow">Lineage Node Detail</span>
          <h3>{node.label}</h3>
          <p>{node.summary}</p>
        </div>
      </section>

      <section className="kg4-field-view">
        <span className="node-expansion__label">Role</span>
        <strong>{node.role}</strong>
        <p>代表论文：{node.representativePaperIds.length ? node.representativePaperIds.join(', ') : '暂无'}</p>
        <p>关联 digest：{node.digestIds.length ? node.digestIds.join(', ') : '暂无'}</p>
      </section>

      <section className="expansion-edge-list">
        <span className="eyebrow">Related Lineage Edges</span>
        {relatedEdges.length ? relatedEdges.map((edge) => (
          <article key={edge.id}>
            <strong>{labelForNode(edge.sourceId)} → {labelForNode(edge.targetId)}</strong>
            <span>{edge.relation}</span>
            <p>{edge.explanation}</p>
          </article>
        )) : <p>当前节点还没有可展示的谱系关系。</p>}
      </section>

      <section className="kg4-selected-tray">
        <span className="node-expansion__label">Next Step</span>
        <p>对比工作台会在选择 2-3 个可比较方法后开放。当前详情先用于理解谱系位置和证据。</p>
      </section>
    </div>
  )
}

export default LineageNodeDetailView
