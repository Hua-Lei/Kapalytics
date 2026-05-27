import { PdfViewerProps } from '../modules/paper/types'
import ChromiumPdfViewer from './ChromiumPdfViewer'

/**
 * PDF 查看器统一入口。
 * 当前使用 Chromium 内置 PDF Viewer。
 * 后续替换为 PDF.js 实现时，只需修改此文件内部的实现组件，
 * 外部调用者（App.tsx）无需任何变更。
 */
function PdfViewer(props: PdfViewerProps) {
  return <ChromiumPdfViewer {...props} />
}

export default PdfViewer
