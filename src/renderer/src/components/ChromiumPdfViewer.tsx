import { useRef, useEffect, useState } from 'react'
import { PdfViewerProps } from '../modules/paper/types'

function ChromiumPdfViewer({ pdfUrl }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const webviewRef = useRef<HTMLElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  if (!pdfUrl) {
    return (
      <div className="empty-state">
        <p>上传论文 PDF 以开始学习</p>
      </div>
    )
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const updateSize = () => {
      const rect = el.getBoundingClientRect()
      setSize({ w: rect.width, h: rect.height })
    }

    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return
    wv.style.width = size.w + 'px'
    wv.style.height = size.h + 'px'
  }, [size])

  return (
    <div ref={containerRef} className="pdf-container">
      <webview
        ref={webviewRef}
        src={pdfUrl}
        className="pdf-viewer"
        style={{ width: size.w + 'px', height: size.h + 'px' }}
      />
    </div>
  )
}

export default ChromiumPdfViewer
