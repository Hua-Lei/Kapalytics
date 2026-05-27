import { GraphNode } from '../modules/graph/types'

interface NodeDetailPanelProps {
  node: GraphNode | null
}

function NodeDetailPanel({ node }: NodeDetailPanelProps) {
  if (!node) {
    return <div className="empty-state">点击图谱中的节点以查看详情</div>
  }

  const typeLabel: Record<string, string> = {
    field: '领域',
    concept: '核心概念',
    problem: '研究问题',
    method: '方法模块',
    formula: '公式算法',
    experiment: '实验',
    limitation: '局限'
  }

  const color: Record<string, string> = {
    field: '#4A90D9',
    concept: '#50C878',
    problem: '#E94560',
    method: '#F0A500',
    formula: '#9B59B6',
    experiment: '#1ABC9C',
    limitation: '#E67E22'
  }

  return (
    <div className="node-detail">
      <div className="node-detail__header">
        <span
          className="node-detail__type-badge"
          style={{ background: color[node.type] }}
        >
          {typeLabel[node.type]}
        </span>
      </div>
      <h3 className="node-detail__title">{node.label}</h3>
      <p className="node-detail__description">{node.description}</p>

      <div className="node-detail__section">
        <div className="node-detail__field">
          <span className="node-detail__field-label">节点 ID</span>
          <span className="node-detail__field-value">{node.id}</span>
        </div>
        <div className="node-detail__field">
          <span className="node-detail__field-label">类型</span>
          <span className="node-detail__field-value">{typeLabel[node.type]}</span>
        </div>
        <div className="node-detail__field">
          <span className="node-detail__field-label">位置</span>
          <span className="node-detail__field-value">
            ({node.x}, {node.y})
          </span>
        </div>
      </div>
    </div>
  )
}

export default NodeDetailPanel
