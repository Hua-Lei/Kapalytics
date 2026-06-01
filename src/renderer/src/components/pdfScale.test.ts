import assert from 'node:assert/strict'
import { clampPdfZoom, getPdfRenderScale, getStablePdfContainerWidth } from './pdfScale'

assert.equal(clampPdfZoom(0.1), 0.5)
assert.equal(clampPdfZoom(4), 3)
assert.equal(clampPdfZoom(1.25), 1.25)

assert.equal(getPdfRenderScale({ containerWidth: 900, pageWidth: 600, zoom: 1, horizontalPadding: 40 }), 1.433)
assert.equal(getPdfRenderScale({ containerWidth: 900, pageWidth: 600, zoom: 1.5, horizontalPadding: 40 }), 2.15)
assert.equal(getPdfRenderScale({ containerWidth: 0, pageWidth: 600, zoom: 1, horizontalPadding: 40 }), 1)
assert.equal(getPdfRenderScale({ containerWidth: 900, pageWidth: 600, horizontalPadding: 40 }), 1.433)

assert.equal(getStablePdfContainerWidth(800, 785), 800)
assert.equal(getStablePdfContainerWidth(800, 760), 760)
assert.equal(getStablePdfContainerWidth(0, 799.6), 800)

console.log('pdfScale tests passed')
