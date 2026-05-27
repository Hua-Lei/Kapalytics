import { useState, useRef, useCallback } from 'react'
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

function getNodeCenter(node: GraphNode): { cx: number; cy: number } {
  switch (node.type) {
    case 'field':
      return { cx: node.x, cy: node.y + 25 }
    case 'concept':
      return { cx: node.x, cy: node.y }
    case 'problem':
      return { cx: node.x, cy: node.y }
    case 'method':
      return { cx: node.x, cy: node.y + 21 }
    case 'formula':
      return { cx: node.x, cy: node.y + 21 }
    case 'experiment':
      return { cx: node.x, cy: node.y + 20 }
    case 'limitation':
      return { cx: node.x, cy: node.y }
  }
}

function renderNode(node: GraphNode, selected: boolean, onClick: () => void) {
  const color = COLORS[node.type]
  const strokeW = selected ? 2.5 : 0
  const filter = selected ? 'url(#glow)' : undefined

  switch (node.type) {
    case 'field': {
      const w = 150,
        h = 50
      return (
        <g onClick={onClick} style={{ cursor: 'pointer' }}>
          <rect
            x={node.x - w / 2}
            y={node.y}
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
          <text x={node.x} y={node.y + 29} textAnchor="middle" fill="#fff" fontSize={13}>
            {node.label}
          </text>
        </g>
      )
    }
    case 'concept': {
      const r = 32
      return (
        <g onClick={onClick} style={{ cursor: 'pointer' }}>
          <circle
            cx={node.x}
            cy={node.y}
            r={r}
            fill={color}
            stroke="#fff"
            strokeWidth={strokeW}
            filter={filter}
            opacity={0.92}
          />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#fff" fontSize={11}>
            {node.label}
          </text>
        </g>
      )
    }
    case 'problem': {
      const s = 44
      const pts = `${node.x},${node.y - s / 2} ${node.x + s / 2},${node.y} ${node.x},${node.y + s / 2} ${node.x - s / 2},${node.y}`
      return (
        <g onClick={onClick} style={{ cursor: 'pointer' }}>
          <polygon
            points={pts}
            fill={color}
            stroke="#fff"
            strokeWidth={strokeW}
            filter={filter}
            opacity={0.92}
          />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#fff" fontSize={10}>
            {node.label}
          </text>
        </g>
      )
    }
    case 'method': {
      const w = 140,
        h = 42
      return (
        <g onClick={onClick} style={{ cursor: 'pointer' }}>
          <rect
            x={node.x - w / 2}
            y={node.y}
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
          <text x={node.x} y={node.y + 25} textAnchor="middle" fill="#fff" fontSize={12}>
            {node.label}
          </text>
        </g>
      )
    }
    case 'formula': {
      const w = 140,
        h = 42,
        skew = 8
      const pts = `${node.x - w / 2 + skew},${node.y} ${node.x + w / 2 + skew},${node.y} ${node.x + w / 2 - skew},${node.y + h} ${node.x - w / 2 - skew},${node.y + h}`
      return (
        <g onClick={onClick} style={{ cursor: 'pointer' }}>
          <polygon
            points={pts}
            fill={color}
            stroke="#fff"
            strokeWidth={strokeW}
            filter={filter}
            opacity={0.92}
          />
          <text x={node.x} y={node.y + 25} textAnchor="middle" fill="#fff" fontSize={11}>
            {node.label}
          </text>
        </g>
      )
    }
    case 'experiment': {
      const w = 130,
        h = 40
      return (
        <g onClick={onClick} style={{ cursor: 'pointer' }}>
          <rect
            x={node.x - w / 2}
            y={node.y}
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
          <text x={node.x} y={node.y + 24} textAnchor="middle" fill="#fff" fontSize={11}>
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
        [node.x + c, node.y - r],
        [node.x + r, node.y - c],
        [node.x + r, node.y + c],
        [node.x + c, node.y + r],
        [node.x - c, node.y + r],
        [node.x - r, node.y + c],
        [node.x - r, node.y - c],
        [node.x - c, node.y - r]
      ]
        .map((p) => p.join(','))
        .join(' ')
      return (
        <g onClick={onClick} style={{ cursor: 'pointer' }}>
          <polygon
            points={pts}
            fill={color}
            stroke="#fff"
            strokeWidth={strokeW}
            filter={filter}
            opacity={0.92}
          />
          <text x={node.x} y={node.y + 4} textAnchor="middle" fill="#fff" fontSize={9}>
            {node.label}
          </text>
        </g>
      )
    }
  }
}

function KnowledgeGraph({ graph, selectedNodeId, onNodeSelect }: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const panning = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const draggingOnNode = useRef(false)

  if (graph.nodes.length === 0) {
    return <div className="empty-state">论文解析后将在此展示知识图谱</div>
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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      panning.current = true
      lastPos.current = { x: e.clientX, y: e.clientY }
      e.stopPropagation()
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!panning.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
  }

  const handleMouseUp = () => {
    panning.current = false
  }

  const resetView = () => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }

  return (
    <div className="knowledge-graph">
      <svg
        ref={svgRef}
        viewBox="0 0 800 860"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: '100%', cursor: panning.current ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
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
              const src = graph.nodes.find((n) => n.id === edge.sourceId)
              const tgt = graph.nodes.find((n) => n.id === edge.targetId)
              if (!src || !tgt) return null
              const sc = getNodeCenter(src)
              const tc = getNodeCenter(tgt)
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
              renderNode(node, node.id === selectedNodeId, () => onNodeSelect(node.id))
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
