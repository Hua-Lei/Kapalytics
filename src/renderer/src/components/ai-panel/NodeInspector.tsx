import { useState } from 'react'
import type { GraphNode } from '../../../../shared/paper'
import { canExpandGraphNode } from '../../modules/paper/analysisState'
import TruncatedText from './TruncatedText'
import { useExpansion } from '../../domains/expansion/useExpansion'
import { useWorkspace } from '../../domains/workspace/useWorkspace'

const typeLabel: Record<string, string> = {
  field: '领域',
  concept: '核心概念',
  problem: '研究问题',
  method: '方法模块',
  formula: '公式算法',
  experiment: '实验',
  limitation: '局限'
}

function NodeInspector({ node }: { node: GraphNode }) {
  const expandable = canExpandGraphNode(node)
  const [expansionRequested, setExpansionRequested] = useState(false)
  const { startExpansion } = useExpansion()
  const { openTab } = useWorkspace()

  const requestExpansion = async () => {
    setExpansionRequested(true)
    try {
      const result = await startExpansion(node.id)
      if (!result) return
      if (result.status === 'ready-from-cache') {
        openTab({
          id: result.sessionId,
          type: 'expansion_graph',
          title: `Expansion Graph: ${node.label}`,
          nodeId: node.id,
          expansionId: result.sessionId,
          closable: true,
          status: 'ready'
        })
        return
      }

      openTab({
        id: result.sessionId,
        type: 'node_expansion_loading',
        title: `Expand: ${node.label}`,
        nodeId: node.id,
        expansionId: result.sessionId,
        closable: true,
        status: 'loading'
      })
    } finally {
      setExpansionRequested(false)
    }
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
          <button className="stage-btn stage-btn--primary" onClick={requestExpansion} disabled={expansionRequested}>展开该方向</button>
          {expansionRequested && <p>正在打开展开任务...</p>}
        </div>
      )}
    </div>
  )
}

export default NodeInspector
