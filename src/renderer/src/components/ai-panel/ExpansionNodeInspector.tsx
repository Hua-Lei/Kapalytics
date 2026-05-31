import type { ExpansionGraphNode } from '../../../../shared/kg4'
import TruncatedText from './TruncatedText'
import { useWorkspace } from '../../domains/workspace/useWorkspace'
import { useExpansion } from '../../domains/expansion/useExpansion'

const expansionTypeLabel: Record<string, string> = {
  method_family: 'Method Family',
  algorithm_idea: 'Algorithm Idea',
  related_paper: 'Related Paper',
  prerequisite_concept: 'Prerequisite Concept',
  open_problem: 'Open Problem'
}

function ExpansionNodeInspector({ node, expansionId }: {
  node: ExpansionGraphNode
  expansionId: string
}) {
  const { openTab } = useWorkspace()
  const { sessions } = useExpansion()
  const session = sessions[expansionId]
  const hasLineageView = Boolean(session?.expansionRecord?.methodLineageView)
  const sourcePaperId = node.sourcePaperIds[0]
  const detailTabType = node.type === 'related_paper' || (!hasLineageView && sourcePaperId) ? 'evidence_paper_detail' : 'lineage_node_detail'
  const detailNodeId = detailTabType === 'evidence_paper_detail' ? (sourcePaperId ?? node.id) : node.id

  const handleOpenDetail = () => {
    openTab({
      id: `${detailTabType}_${expansionId}_${node.id}`,
      type: detailTabType,
      title: detailTabType === 'evidence_paper_detail' ? 'Evidence Paper Detail' : 'Lineage Node Detail',
      nodeId: detailNodeId,
      anchorNodeId: session?.nodeId,
      expansionId,
      closable: true,
      status: 'idle'
    })
  }

  return (
    <div className="ai-context-card">
      <span className="eyebrow">Expansion Node Inspector</span>
      <h3>{node.label}</h3>
      <span className="ai-context-badge">{expansionTypeLabel[node.type] ?? node.type}</span>
      <TruncatedText text={node.description} />
      <div className="ai-context-details">
        <div><strong>Temporary status</strong><p>该节点来自当前 expansion session，尚未写入长期图谱。</p></div>
        <div><strong>Sources</strong><p>{node.sourcePaperIds.length ? node.sourcePaperIds.join(', ') : '该节点未关联 source paper。'}</p></div>
      </div>
      <div className="ai-context-actions">
        <button className="stage-btn stage-btn--primary" onClick={handleOpenDetail}>查看详情</button>
        <p>先在中央 Workspace 查看节点或证据论文详情，再按需进入 Compare Workbench 做算法对比。</p>
      </div>
    </div>
  )
}

export default ExpansionNodeInspector
