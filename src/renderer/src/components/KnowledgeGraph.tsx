import { useState, useRef, useEffect } from 'react'
import { KnowledgeGraph as KG, GraphNode } from '../modules/graph/types'

interface KnowledgeGraphProps {
  graph: KG
  selectedNodeId: string | null
  onNodeSelect: (nodeId: string) => void
}

const COLORS: Record<string, string> = {
  field: '#4A90D9',
  concept: '#50C878',
  problem: '#E94560',
  method: '#F0A500',
  formula: '#9B59B6',
  experiment: '#1ABC9C',
  limitation: '#E67E22'
}

const DRAG_THRESHOLD = 3

function getNodeCenter(node: GraphNode, pos: { x: number; y: number }): { cx: number; cy: number } {
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

function renderNode(
  node: GraphNode,
  pos: { x: number; y: number },
  selected: boolean,
  onClick: () => void,
  onMouseDown: (e: React.MouseEvent) => void
) {
  const color = COLORS[node.type]
  const strokeW = selected ? 2.5 : 0
  const filter = selected ? 'url(#glow)' : undefined

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
            stroke="#fff"
            strokeWidth={strokeW}
            filter={filter}
            opacity={0.92}
          />
          <text x={pos.x} y={pos.y + 29} textAnchor="middle" fill="#fff" fontSize={13}>
            {node.label}
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
            stroke="#fff"
            strokeWidth={strokeW}
            filter={filter}
            opacity={0.92}
          />
          <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="#fff" fontSize={11}>
            {node.label}
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
            stroke="#fff"
            strokeWidth={strokeW}
            filter={filter}
            opacity={0.92}
          />
          <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="#fff" fontSize={10}>
            {node.label}
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
            stroke="#fff"
            strokeWidth={strokeW}
            filter={filter}
            opacity={0.92}
          />
          <text x={pos.x} y={pos.y + 25} textAnchor="middle" fill="#fff" fontSize={12}>
            {node.label}
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
            stroke="#fff"
            strokeWidth={strokeW}
            filter={filter}
            opacity={0.92}
          />
          <text x={pos.x} y={pos.y + 25} textAnchor="middle" fill="#fff" fontSize={11}>
            {node.label}
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
            stroke="#fff"
            strokeWidth={strokeW}
            filter={filter}
            opacity={0.92}
          />
          <text x={pos.x} y={pos.y + 24} textAnchor="middle" fill="#fff" fontSize={11}>
            {node.label}
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
            stroke="#fff"
            strokeWidth={strokeW}
            filter={filter}
            opacity={0.92}
          />
          <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="#fff" fontSize={9}>
            {node.label}
          </text>
        </g>
      )
    }
  }
}

function KnowledgeGraph({ graph, selectedNodeId, onNodeSelect }: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(() => {
    const m = new Map<string, { x: number; y: number }>()
    graph.nodes.forEach((n) => m.set(n.id, { x: n.x, y: n.y }))
    return m
  })

  // Sync positions when graph changes (e.g., new paper loaded in future)
  useEffect(() => {
    const m = new Map<string, { x: number; y: number }>()
    graph.nodes.forEach((n) => m.set(n.id, { x: n.x, y: n.y }))
    setPositions(m)
  }, [graph])

  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const dragRef = useRef<{
    type: 'node' | 'pan' | null
    nodeId?: string
    startX: number
    startY: number
    startPosX: number
    startPosY: number
    moved: boolean
  }>({ type: null, startX: 0, startY: 0, startPosX: 0, startPosY: 0, moved: false })

  if (graph.nodes.length === 0) {
    return <div className="empty-state">论文解析后将在此展示知识图谱</div>
  }

  const getPos = (nodeId: string) => positions.get(nodeId) ?? { x: 0, y: 0 }

  const handleNodeMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    dragRef.current = {
      type: 'node',
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: getPos(nodeId).x,
      startPosY: getPos(nodeId).y,
      moved: false
    }
  }

  const handleSvgMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    dragRef.current = { type: 'pan', startX: e.clientX, startY: e.clientY, startPosX: offset.x, startPosY: offset.y, moved: false }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const d = dragRef.current
    if (!d.type) return

    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY

    if (!d.moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      d.moved = true
    }

    if (!d.moved) return

    if (d.type === 'node' && d.nodeId) {
      setPositions((prev) => {
        const next = new Map(prev)
        next.set(d.nodeId!, {
          x: d.startPosX + dx / scale,
          y: d.startPosY + dy / scale
        })
        return next
      })
    } else if (d.type === 'pan') {
      setOffset({ x: d.startPosX + dx, y: d.startPosY + dy })
    }
  }

  const handleMouseUp = () => {
    const d = dragRef.current
    if (d.type === 'node' && d.nodeId && !d.moved) {
      onNodeSelect(d.nodeId)
    }
    dragRef.current = { type: null, startX: 0, startY: 0, startPosX: 0, startPosY: 0, moved: false }
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const newScale = Math.min(3, Math.max(0.3, scale * factor))

    setScale(newScale)
    setOffset((prev) => ({
      x: mx - (mx - prev.x) * (newScale / scale),
      y: my - (my - prev.y) * (newScale / scale)
    }))
  }

  const resetView = () => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }

  const isDragging = dragRef.current.type === 'pan' && dragRef.current.moved

  return (
    <div className="knowledge-graph">
      <svg
        ref={svgRef}
        viewBox="0 0 800 860"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', cursor: isDragging ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleSvgMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#555" />
          </marker>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${offset.x},${offset.y}) scale(${scale})`}>
          <g className="graph-edges">
            {graph.edges.map((edge) => {
              const srcNode = graph.nodes.find((n) => n.id === edge.sourceId)
              const tgtNode = graph.nodes.find((n) => n.id === edge.targetId)
              if (!srcNode || !tgtNode) return null
              const sc = getNodeCenter(srcNode, getPos(edge.sourceId))
              const tc = getNodeCenter(tgtNode, getPos(edge.targetId))
              return (
                <g key={edge.id}>
                  <line
                    x1={sc.cx}
                    y1={sc.cy}
                    x2={tc.cx}
                    y2={tc.cy}
                    stroke="#555"
                    strokeWidth={1.5}
                    markerEnd={edge.directed ? 'url(#arrowhead)' : undefined}
                  />
                  {edge.label && (
                    <>
                      <rect
                        x={(sc.cx + tc.cx) / 2 - edge.label.length * 4 - 4}
                        y={(sc.cy + tc.cy) / 2 - 10}
                        width={edge.label.length * 8 + 8}
                        height={16}
                        rx={3}
                        fill="#16213e"
                        opacity={0.85}
                      />
                      <text
                        x={(sc.cx + tc.cx) / 2}
                        y={(sc.cy + tc.cy) / 2 + 2}
                        textAnchor="middle"
                        fill="#888"
                        fontSize={10}
                      >
                        {edge.label}
                      </text>
                    </>
                  )}
                </g>
              )
            })}
          </g>

          <g className="graph-nodes">
            {graph.nodes.map((node) =>
              renderNode(
                node,
                getPos(node.id),
                node.id === selectedNodeId,
                () => {},
                (e) => handleNodeMouseDown(node.id, e)
              )
            )}
          </g>
        </g>
      </svg>

      <button className="graph-reset-btn" onClick={resetView} title="重置视图">
        ↺
      </button>
    </div>
  )
}

export default KnowledgeGraph
