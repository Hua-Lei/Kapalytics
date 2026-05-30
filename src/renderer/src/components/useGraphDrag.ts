import { useState, useRef, useEffect } from 'react'
import type { GraphNode } from '../modules/graph/types'

const DRAG_THRESHOLD = 3

export function useGraphDrag(
  onNodeSelect: (nodeId: string) => void,
  scale: number,
  offset: { x: number; y: number },
  setOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>,
  visibleGraphNodes: GraphNode[]
) {
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(() => {
    const m = new Map<string, { x: number; y: number }>()
    visibleGraphNodes.forEach((n) => m.set(n.id, { x: n.x, y: n.y }))
    return m
  })

  useEffect(() => {
    const m = new Map<string, { x: number; y: number }>()
    visibleGraphNodes.forEach((n) => m.set(n.id, { x: n.x, y: n.y }))
    setPositions(m)
  }, [visibleGraphNodes])

  const dragRef = useRef<{
    type: 'node' | 'pan' | null
    nodeId?: string
    startX: number
    startY: number
    startPosX: number
    startPosY: number
    moved: boolean
  }>({ type: null, startX: 0, startY: 0, startPosX: 0, startPosY: 0, moved: false })

  const getPos = (nodeId: string) => positions.get(nodeId) ?? { x: 0, y: 0 }

  const isDragging = dragRef.current.type === 'pan' && dragRef.current.moved

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

  return {
    positions,
    setPositions,
    isDragging,
    getPos,
    handleNodeMouseDown,
    handleSvgMouseDown,
    handleMouseMove,
    handleMouseUp
  }
}
