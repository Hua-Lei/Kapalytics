import type { GraphNode } from '../modules/graph/types'

export const COLORS: Record<string, string> = {
  field: '#3f6f85',
  concept: '#55785f',
  problem: '#9a6159',
  method: '#62678d',
  formula: '#806f8f',
  experiment: '#5f8489',
  limitation: '#92774a'
}

export const NODE_STROKE = '#fffaf1'

export const TYPE_LABELS: Record<string, string> = {
  field: '领域',
  concept: '概念',
  problem: '问题',
  method: '方法',
  formula: '公式',
  experiment: '实验',
  limitation: '局限'
}

const truncateLabel = (label: string) => label.length > 12 ? `${label.slice(0, 11)}...` : label

export function getNodeCenter(node: GraphNode, pos: { x: number; y: number }): { cx: number; cy: number } {
  switch (node.type) {
    case 'field':
      return { cx: pos.x, cy: pos.y + 25 }
    case 'concept':
      return { cx: pos.x, cy: pos.y }
    case 'problem':
      return { cx: pos.x, cy: pos.y }
    case 'method':
      return { cx: pos.x, cy: pos.y + 21 }
    case 'formula':
      return { cx: pos.x, cy: pos.y + 21 }
    case 'experiment':
      return { cx: pos.x, cy: pos.y + 20 }
    case 'limitation':
      return { cx: pos.x, cy: pos.y }
  }
}

export function getExpansionMarkerPosition(node: GraphNode, pos: { x: number; y: number }): { x: number; y: number } {
  const center = getNodeCenter(node, pos)
  return { x: center.cx + 44, y: center.cy - 28 }
}

export function renderNode(
  node: GraphNode,
  pos: { x: number; y: number },
  selected: boolean,
  onClick: () => void,
  onMouseDown: (e: React.MouseEvent) => void
) {
  const color = COLORS[node.type]
  const strokeW = selected ? 2.6 : 1.15
  const filter = selected ? 'url(#selectedGlow)' : 'url(#nodeDepth)'

  switch (node.type) {
    case 'field': {
      const w = 150,
        h = 50
      return (
        <g
          onClick={onClick}
          onMouseDown={onMouseDown}
          style={{ cursor: 'grab' }}
          data-node-id={node.id}
        >
          <rect
            x={pos.x - w / 2}
            y={pos.y}
            width={w}
            height={h}
            rx={12}
            ry={12}
            fill={color}
            stroke={NODE_STROKE}
            strokeWidth={strokeW}
            filter={filter}
            opacity={0.96}
          />
          <text x={pos.x} y={pos.y + 29} textAnchor="middle" fill="#fff" fontSize={13}>
            {truncateLabel(node.label)}
          </text>
        </g>
      )
    }
    case 'concept': {
      const r = 32
      return (
        <g
          onClick={onClick}
          onMouseDown={onMouseDown}
          style={{ cursor: 'grab' }}
          data-node-id={node.id}
        >
          <circle
            cx={pos.x}
            cy={pos.y}
            r={r}
            fill={color}
            stroke={NODE_STROKE}
            strokeWidth={strokeW}
            filter={filter}
            opacity={0.96}
          />
          <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="#fff" fontSize={11}>
            {truncateLabel(node.label)}
          </text>
        </g>
      )
    }
    case 'problem': {
      const s = 44
      const pts = `${pos.x},${pos.y - s / 2} ${pos.x + s / 2},${pos.y} ${pos.x},${pos.y + s / 2} ${pos.x - s / 2},${pos.y}`
      return (
        <g
          onClick={onClick}
          onMouseDown={onMouseDown}
          style={{ cursor: 'grab' }}
          data-node-id={node.id}
        >
          <polygon
            points={pts}
            fill={color}
            stroke={NODE_STROKE}
            strokeWidth={strokeW}
            filter={filter}
            opacity={0.96}
          />
          <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="#fff" fontSize={10}>
            {truncateLabel(node.label)}
          </text>
        </g>
      )
    }
    case 'method': {
      const w = 140,
        h = 42
      return (
        <g
          onClick={onClick}
          onMouseDown={onMouseDown}
          style={{ cursor: 'grab' }}
          data-node-id={node.id}
        >
          <rect
            x={pos.x - w / 2}
            y={pos.y}
            width={w}
            height={h}
            rx={5}
            ry={5}
            fill={color}
            stroke={NODE_STROKE}
            strokeWidth={strokeW}
            filter={filter}
            opacity={0.96}
          />
          <text x={pos.x} y={pos.y + 25} textAnchor="middle" fill="#fff" fontSize={12}>
            {truncateLabel(node.label)}
          </text>
        </g>
      )
    }
    case 'formula': {
      const w = 140,
        h = 42,
        skew = 8
      const pts = `${pos.x - w / 2 + skew},${pos.y} ${pos.x + w / 2 + skew},${pos.y} ${pos.x + w / 2 - skew},${pos.y + h} ${pos.x - w / 2 - skew},${pos.y + h}`
      return (
        <g
          onClick={onClick}
          onMouseDown={onMouseDown}
          style={{ cursor: 'grab' }}
          data-node-id={node.id}
        >
          <polygon
            points={pts}
            fill={color}
            stroke={NODE_STROKE}
            strokeWidth={strokeW}
            filter={filter}
            opacity={0.96}
          />
          <text x={pos.x} y={pos.y + 25} textAnchor="middle" fill="#fff" fontSize={11}>
            {truncateLabel(node.label)}
          </text>
        </g>
      )
    }
    case 'experiment': {
      const w = 130,
        h = 40
      return (
        <g
          onClick={onClick}
          onMouseDown={onMouseDown}
          style={{ cursor: 'grab' }}
          data-node-id={node.id}
        >
          <rect
            x={pos.x - w / 2}
            y={pos.y}
            width={w}
            height={h}
            rx={20}
            ry={20}
            fill={color}
            stroke={NODE_STROKE}
            strokeWidth={strokeW}
            filter={filter}
            opacity={0.96}
          />
          <text x={pos.x} y={pos.y + 24} textAnchor="middle" fill="#fff" fontSize={11}>
            {truncateLabel(node.label)}
          </text>
        </g>
      )
    }
    case 'limitation': {
      const s = 38
      const r = s / 2
      const c = 0.383 * r
      const pts = [
        [pos.x + c, pos.y - r],
        [pos.x + r, pos.y - c],
        [pos.x + r, pos.y + c],
        [pos.x + c, pos.y + r],
        [pos.x - c, pos.y + r],
        [pos.x - r, pos.y + c],
        [pos.x - r, pos.y - c],
        [pos.x - c, pos.y - r]
      ]
        .map((p) => p.join(','))
        .join(' ')
      return (
        <g
          onClick={onClick}
          onMouseDown={onMouseDown}
          style={{ cursor: 'grab' }}
          data-node-id={node.id}
        >
          <polygon
            points={pts}
            fill={color}
            stroke={NODE_STROKE}
            strokeWidth={strokeW}
            filter={filter}
            opacity={0.96}
          />
          <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="#fff" fontSize={9}>
            {truncateLabel(node.label)}
          </text>
        </g>
      )
    }
  }
}
