/** 用户在 PDF 中的文本选中区域 */
export interface PdfSelection {
  text: string
  page: number
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  }
}

/** PdfViewer 组件对外暴露的 props 接口 */
export interface PdfViewerProps {
  /** PDF 文件的 file:// URL */
  pdfUrl: string | null
  /** 用户选中 PDF 文本时触发（PDF.js 实现后生效） */
  onTextSelect?: (selection: PdfSelection) => void
  /** 页码变化时触发（PDF.js 实现后生效） */
  onPageChange?: (page: number) => void
  /** 用户点击已标注高亮时触发，传入高亮 ID */
  onHighlightClick?: (highlightId: string) => void
}
