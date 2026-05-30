import type { ExpansionGraphNode } from '../../../../shared/kg4'
import TruncatedText from './TruncatedText'
import { useWorkspace } from '../../domains/workspace/useWorkspace'

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

  const handleOpenExpandView = () => {
    openTab({
      id: `expand_view_${expansionId}_${node.id}`,
      type: 'expand_view',
      title: 'Expand View',
      nodeId: node.id,
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
        <button className="stage-btn stage-btn--primary" onClick={handleOpenExpandView}>进入 Expand View</button>
        <p>在中央 Workspace 查看完整 Algorithm Idea Cards、对比和 feedback。</p>
      </div>
    </div>
  )
}

export default ExpansionNodeInspector
