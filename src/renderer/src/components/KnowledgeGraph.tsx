import { useState, useMemo } from 'react'
import { useGraphDrag } from './useGraphDrag'
import { useGraphZoom } from './useGraphZoom'
import ExpansionLayer from './ExpansionLayer'
import { KnowledgeGraph as KG, GraphNode } from '../modules/graph/types'
import { canExpandGraphNode } from '../modules/paper/analysisState'
import type { PaperInsight } from '../../../shared/paper'
import type { Kg4ExpansionGraphLayer, ExpansionGraphNode } from '../../../shared/kg4'

interface KnowledgeGraphProps {
  graph: KG
  paperInsight: PaperInsight | null
  selectedExpansionNodeId?: string
  selectedNodeId: string | null
  view: 'argument' | 'mechanism' | 'expansion'
  expansionGraph?: Kg4ExpansionGraphLayer | null
  onNodeSelect: (nodeId: string) => void
  onClearExpansionGraph?: () => void
  onExpansionNodeSelect?: (node: ExpansionGraphNode) => void
}

const COLORS: Record<string, string> = {
  field: '#3f6f85',
  concept: '#55785f',
  problem: '#9a6159',
  method: '#62678d',
  formula: '#806f8f',
  experiment: '#5f8489',
  limitation: '#92774a'
}

const NODE_STROKE = '#fffaf1'

const TYPE_LABELS: Record<string, string> = {
  field: '领域',
  concept: '概念',
  problem: '问题',
  method: '方法',
  formula: '公式',
  experiment: '实验',
  limitation: '局限'
}

const truncateLabel = (label: string) => label.length > 12 ? `${label.slice(0, 11)}...` : label

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

function getExpansionMarkerPosition(node: GraphNode, pos: { x: number; y: number }): { x: number; y: number } {
  const center = getNodeCenter(node, pos)
  return { x: center.cx + 44, y: center.cy - 28 }
}

function renderNode(
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

function getViewGraph(graph: KG, view: KnowledgeGraphProps['view']): KG {
  if (view === 'argument') return graph
  const nodeTypes = view === 'mechanism'
    ? new Set(['method', 'formula', 'experiment'])
    : new Set(['field', 'concept', 'method'])
  const nodes = graph.nodes.filter((node) => nodeTypes.has(node.type))
  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = graph.edges.filter((edge) => nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId))
  return { nodes: nodes.length ? nodes : graph.nodes, edges: nodes.length ? edges : graph.edges }
}

function KnowledgeGraph({ graph, paperInsight, selectedExpansionNodeId, selectedNodeId, view, expansionGraph, onNodeSelect, onClearExpansionGraph, onExpansionNodeSelect }: KnowledgeGraphProps) {
  const visibleGraph = useMemo(() => getViewGraph(graph, view), [graph, view])

  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const { scale, svgRef, handleWheel, resetView } = useGraphZoom(offset, setOffset)
  const { positions, setPositions, isDragging, getPos, handleNodeMouseDown, handleSvgMouseDown, handleMouseMove, handleMouseUp } =
    useGraphDrag(onNodeSelect, scale, offset, setOffset, visibleGraph.nodes)

  // Sync scaled positions when scale changes (keep nodes under cursor)
  // Use effect-less approach: positions are managed by useGraphDrag

  const expansionAnchor = expansionGraph ? getPos(expansionGraph.anchorNodeId) : null

  if (graph.nodes.length === 0) {
    return (
      <div className="graph-empty-state">
        <span className="eyebrow">Knowledge Map</span>
        <h2>上传并分析论文后生成理解地图</h2>
        <p>核心概念、方法、公式、实验和局限会在这里组成可交互图谱。</p>
      </div>
    )
  }

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
            <polygon points="0 0, 8 3, 0 6" fill="#b7ad9d" />
          </marker>
          <filter id="nodeDepth" x="-24%" y="-24%" width="148%" height="148%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#342b20" floodOpacity="0.16" />
          </filter>
          <filter id="selectedGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="#2f5d70" floodOpacity="0.26" />
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraph" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${offset.x},${offset.y}) scale(${scale})`}>
          {view === 'argument' && paperInsight?.centralInsight && (
            <g className="graph-insight-card">
              <rect x="24" y="62" width="322" height="96" rx="14" fill="#fffaf1" stroke="#d9d0bf" opacity="0.95" />
              <text x="42" y="90" fill="#2f3a35" fontSize="13" fontWeight="700">Central Insight</text>
              <foreignObject x="42" y="100" width="286" height="48">
                <div className="graph-insight-text">{paperInsight.centralInsight}</div>
              </foreignObject>
            </g>
          )}
          <g className="graph-edges">
            {visibleGraph.edges.map((edge) => {
              const srcNode = visibleGraph.nodes.find((n) => n.id === edge.sourceId)
              const tgtNode = visibleGraph.nodes.find((n) => n.id === edge.targetId)
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
                    stroke="#b7aea3"
                    strokeWidth={1.2}
                    opacity={0.72}
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
                        fill="#fbfaf7"
                        stroke="#e3ded3"
                        opacity={0.92}
                      />
                      <text
                        x={(sc.cx + tc.cx) / 2}
                        y={(sc.cy + tc.cy) / 2 + 2}
                        textAnchor="middle"
                        fill="#625d55"
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
            {visibleGraph.nodes.map((node) =>
              renderNode(
                node,
                getPos(node.id),
                node.id === selectedNodeId,
                () => {},
                (e) => handleNodeMouseDown(node.id, e)
              )
            )}
          </g>
          {expansionGraph && expansionAnchor && (
            <ExpansionLayer
              expansionGraph={expansionGraph}
              expansionAnchor={expansionAnchor}
              selectedExpansionNodeId={selectedExpansionNodeId}
              onExpansionNodeSelect={onExpansionNodeSelect}
            />
          )}
          <g className="graph-expansion-markers" pointerEvents="none">
            {visibleGraph.nodes.filter(canExpandGraphNode).map((node) => {
              const marker = getExpansionMarkerPosition(node, getPos(node.id))
              return (
                <g key={`expand-${node.id}`} className="graph-expansion-marker">
                  <circle cx={marker.x} cy={marker.y} r="10" />
                  <text x={marker.x} y={marker.y + 4} textAnchor="middle">+</text>
                </g>
              )
            })}
          </g>
        </g>
      </svg>

      <button className="graph-reset-btn" onClick={resetView} title="重置视图">
        ↺
      </button>
      {expansionGraph && (
        <button className="kg4-clear-expansion-btn" onClick={onClearExpansionGraph} title="清除 KG4 临时扩展层">
          清除 KG4 临时层
        </button>
      )}
      <div className="graph-legend" aria-label="节点类型图例">
        {Object.entries(TYPE_LABELS).map(([type, label]) => (
          <span key={type} className="graph-legend__item">
            <span className="graph-legend__dot" style={{ background: COLORS[type] }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default KnowledgeGraph
