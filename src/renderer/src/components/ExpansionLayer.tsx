import { useMemo } from 'react'
import type { Kg4ExpansionGraphLayer, ExpansionGraphNode } from '../../../shared/kg4'

const truncateLabel = (label: string) => label.length > 12 ? `${label.slice(0, 11)}...` : label

function expansionNodePos(anchor: { x: number; y: number }, index: number, total: number): { x: number; y: number } {
  const angle = (-Math.PI / 2) + (index / Math.max(1, total)) * Math.PI * 1.65
  const radius = 180 + (index % 2) * 46
  return { x: anchor.x + Math.cos(angle) * radius, y: anchor.y + Math.sin(angle) * radius }
}

function renderExpansionNode(node: ExpansionGraphNode, pos: { x: number; y: number }, selected: boolean, onClick?: () => void) {
  const width = node.type === 'related_paper' ? 150 : 132
  return (
    <g
      className={`kg4-expansion-node ${selected ? 'kg4-expansion-node--selected' : ''}`}
      data-expansion-node-id={node.id}
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <rect x={pos.x - width / 2} y={pos.y - 22} width={width} height={44} rx="12" />
      <text x={pos.x} y={pos.y - 3} textAnchor="middle">{truncateLabel(node.label)}</text>
      <text x={pos.x} y={pos.y + 13} textAnchor="middle" className="kg4-expansion-node__type">temporary</text>
    </g>
  )
}

interface ExpansionLayerProps {
  expansionGraph: Kg4ExpansionGraphLayer
  expansionAnchor: { x: number; y: number }
  selectedExpansionNodeId?: string
  onExpansionNodeSelect?: (node: ExpansionGraphNode) => void
}

function ExpansionLayer({ expansionGraph, expansionAnchor, selectedExpansionNodeId, onExpansionNodeSelect }: ExpansionLayerProps) {
  const expansionPositions = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>()
    expansionGraph.nodes.forEach((node, index) => m.set(node.id, expansionNodePos(expansionAnchor, index, expansionGraph.nodes.length)))
    return m
  }, [expansionGraph, expansionAnchor])

  return (
    <g className="kg4-expansion-layer">
      <g className="kg4-expansion-edges">
        {expansionGraph.edges.map((edge) => {
          const src = expansionPositions.get(edge.sourceId) ?? (edge.sourceId === expansionGraph.anchorNodeId ? expansionAnchor : null)
          const tgt = expansionPositions.get(edge.targetId) ?? (edge.targetId === expansionGraph.anchorNodeId ? expansionAnchor : null)
          if (!src || !tgt) return null
          return (
            <g key={edge.id}>
              <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y} />
              <text x={(src.x + tgt.x) / 2} y={(src.y + tgt.y) / 2 - 4} textAnchor="middle">{edge.relation}</text>
            </g>
          )
        })}
        {expansionGraph.nodes.slice(0, 3).map((node) => {
          const pos = expansionPositions.get(node.id)
          if (!pos) return null
          return <line key={`anchor-${node.id}`} x1={expansionAnchor.x} y1={expansionAnchor.y} x2={pos.x} y2={pos.y} />
        })}
      </g>
      <g className="kg4-expansion-nodes">
        {expansionGraph.nodes.map((node) => {
          const pos = expansionPositions.get(node.id)
          return pos
            ? <g key={node.id}>{renderExpansionNode(node, pos, selectedExpansionNodeId === node.id, () => onExpansionNodeSelect?.(node))}</g>
            : null
        })}
      </g>
    </g>
  )
}

export default ExpansionLayer
