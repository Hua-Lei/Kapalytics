import type { ExpansionGraphNode } from '../../../../shared/kg4'
import TruncatedText from './TruncatedText'

const expansionTypeLabel: Record<string, string> = {
  method_family: 'Method Family',
  algorithm_idea: 'Algorithm Idea',
  related_paper: 'Related Paper',
  prerequisite_concept: 'Prerequisite Concept',
  open_problem: 'Open Problem'
}

function ExpansionNodeInspector({ node, expansionId, onOpenExpandView }: {
  node: ExpansionGraphNode
  expansionId: string
  onOpenExpandView: (expansionId: string, nodeId: string) => void
}) {
  return (
    <div className="ai-context-card">
      <span className="eyebrow">Expansion Node Inspector</span>
      <h3>{node.label}</h3>
      <span className="ai-context-badge">{expansionTypeLabel[node.type] ?? node.type}</span>
      <TruncatedText text={node.description} />
      <div className="ai-context-details">
        <div><strong>Temporary status</strong><p>该节点来自当前 expansion session，尚未写入长期图谱。</p></div>
        <div><strong>Sources</strong><p>{node.sourcePaperIds.length ? node.sourcePaperIds.join(', ') : '当前 fixture 未提供 source paper。'}</p></div>
      </div>
      <div className="ai-context-actions">
        <button className="stage-btn stage-btn--primary" onClick={() => onOpenExpandView(expansionId, node.id)}>进入 Expand View</button>
        <p>在中央 Workspace 查看完整 Algorithm Idea Cards、对比和 feedback。</p>
      </div>
    </div>
  )
}

export default ExpansionNodeInspector
