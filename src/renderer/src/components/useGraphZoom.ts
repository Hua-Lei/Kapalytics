import { useState, useRef } from 'react'

export function useGraphZoom(
  offset: { x: number; y: number },
  setOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>
) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [scale, setScale] = useState(1)

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

  return { scale, setScale, svgRef, handleWheel, resetView }
}
