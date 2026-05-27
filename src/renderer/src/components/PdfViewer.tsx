import { PdfViewerProps } from '../modules/paper/types'
import PdfJsViewer from './PdfJsViewer'

/**
 * PDF 查看器统一入口。
 * PDF 查看器统一入口，当前使用 PDF.js 渲染。
 */
function PdfViewer(props: PdfViewerProps) {
  return <PdfJsViewer {...props} />
}

export default PdfViewer
