import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { PdfViewerProps } from '../modules/paper/types'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

/**
 * PDF 查看器统一入口，使用 PDF.js 渲染。
 */
function PdfViewer({ pdfUrl, onPageChange }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onPageChangeRef = useRef(onPageChange)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    onPageChangeRef.current = onPageChange
  }, [onPageChange])

  useEffect(() => {
    let cancelled = false

    async function renderPdf() {
      const container = containerRef.current
      if (!pdfUrl || !container) return

      setLoading(true)
      setError('')
      container.innerHTML = ''

      try {
        const data = await window.electronAPI?.readPdfFile?.(pdfUrl)
        if (!data) throw new Error('无法读取 PDF 文件')
        const pdf = await pdfjsLib.getDocument({ data }).promise
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
          if (cancelled) return

          const page = await pdf.getPage(pageNum)
          const viewport = page.getViewport({ scale: 1.2 })
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          if (!context) continue

          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.className = 'pdf-page-canvas'
          container.appendChild(canvas)

          await page.render({ canvasContext: context, viewport }).promise
          onPageChangeRef.current?.(pageNum)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'PDF 加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    renderPdf()
    return () => {
      cancelled = true
    }
  }, [pdfUrl])

  if (!pdfUrl) {
    return <div className="empty-state">上传论文 PDF 以开始学习</div>
  }

  return (
    <div className="pdf-js-viewer">
      {loading && <div className="pdf-loading">正在加载 PDF...</div>}
      {error && <div className="pdf-error">{error}</div>}
      <div className="pdf-pages" ref={containerRef} />
    </div>
  )
}

export default PdfViewer
