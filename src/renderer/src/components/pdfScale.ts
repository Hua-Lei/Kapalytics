const MIN_PDF_ZOOM = 0.5
const MAX_PDF_ZOOM = 3

export function clampPdfZoom(zoom: number): number {
  return Math.min(MAX_PDF_ZOOM, Math.max(MIN_PDF_ZOOM, Number(zoom.toFixed(2))))
}

export function getPdfRenderScale({
  containerWidth,
  horizontalPadding,
  pageWidth,
  zoom = 1
}: {
  containerWidth: number
  horizontalPadding: number
  pageWidth: number
  zoom?: number
}): number {
  if (containerWidth <= 0 || pageWidth <= 0) return zoom

  const availableWidth = Math.max(1, containerWidth - horizontalPadding)
  return Number(((availableWidth / pageWidth) * zoom).toFixed(3))
}

export function getStablePdfContainerWidth(previousWidth: number, measuredWidth: number): number {
  const nextWidth = Math.round(measuredWidth)
  if (previousWidth > 0 && Math.abs(previousWidth - nextWidth) < 24) return previousWidth
  return nextWidth
}
