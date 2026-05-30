import { useState } from 'react'
import type { GraphNode } from '../../../../shared/paper'
import { canExpandGraphNode } from '../../modules/paper/analysisState'
import TruncatedText from './TruncatedText'

const typeLabel: Record<string, string> = {
  field: '领域',
  concept: '核心概念',
  problem: '研究问题',
  method: '方法模块',
  formula: '公式算法',
  experiment: '实验',
  limitation: '局限'
}

function NodeInspector({ node, onOpenNodeExpansion }: { node: GraphNode; onOpenNodeExpansion: (nodeId: string) => void }) {
  const expandable = canExpandGraphNode(node)
  const [expansionRequested, setExpansionRequested] = useState(false)

  const requestExpansion = () => {
    setExpansionRequested(true)
    onOpenNodeExpansion(node.id)
  }

  return (
    <div className="ai-context-card">
      <span className="eyebrow">Node Inspector</span>
      <h3>{node.label}</h3>
      <span className="ai-context-badge">{typeLabel[node.type] ?? node.type}</span>
      <TruncatedText text={node.detail?.summary || node.description} />
      <div className="ai-context-details">
        {node.whyImportant && <div><strong>Why it matters</strong><TruncatedText text={node.whyImportant} /></div>}
        {node.roleInPaper && <div><strong>Role in paper</strong><TruncatedText text={node.roleInPaper} /></div>}
        {node.evidenceNodeIds?.length ? <div><strong>Evidence nodes</strong><p>{node.evidenceNodeIds.join(', ')}</p></div> : null}
      </div>
      {expandable && (
        <div className="ai-context-actions">
          <div className="ai-context-query-chips">
            {(node.searchQueries ?? []).slice(0, 4).map((query) => <span key={query}>{query}</span>)}
          </div>
          <button className="stage-btn stage-btn--primary" onClick={requestExpansion}>展开该方向</button>
          {expansionRequested && <p>正在打开展开任务...</p>}
        </div>
      )}
    </div>
  )
}

export default NodeInspector
