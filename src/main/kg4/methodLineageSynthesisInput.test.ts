import assert from 'node:assert/strict'
import type { PaperMethodDigest, PaperQualitySignal } from '../../shared/kg4'
import type { CompactLineagePaper } from './llmInput'
import { buildHybridMethodLineageSynthesisInput } from './methodLineageSynthesisInput'
import type { MethodLineageContext } from './paperSourceContext'

const methodLineageContext: MethodLineageContext = {
  anchor: {
    nodeId: 'n1',
    label: 'TTT-E2E',
    type: 'method',
    expansionType: 'method_evolution'
  },
  paperSource: {
    pdfUrl: 'file:///paper.pdf',
    extractedText: '[Page 1]\nCurrent paper text.',
    pages: [{ pageNumber: 1, text: 'Current paper text.' }]
  },
  localGraphNeighborhood: { nodes: [], edges: [] },
  evidenceSlots: [],
  readerIntent: 'novice_paper_anchored_lineage'
}

const retrievedPapers: CompactLineagePaper[] = [{
  id: 'paper-a',
  title: 'Earlier Test-Time Training',
  year: 2024,
  sources: ['openalex'],
  abstract: 'A predecessor method.'
}]

const paperMethodDigests: PaperMethodDigest[] = [{
  id: 'digest-a',
  paperId: 'paper-a',
  paperTitle: 'Earlier Test-Time Training',
  methodName: 'TTT-KVB',
  problemSetting: 'Long-context language modeling.',
  coreMechanism: 'Uses layer-level reconstruction losses.',
  relationHints: ['foundation'],
  evidenceSummary: 'A predecessor to the current method.',
  confidence: 0.8
}]

const qualitySignals: PaperQualitySignal[] = [{
  paperId: 'paper-a',
  qualityScore: 0.72,
  trendScore: 0.44,
  badges: ['recent'],
  reasons: ['Recent predecessor.'],
  warnings: []
}]

const input = buildHybridMethodLineageSynthesisInput({
  requestNonce: 123,
  methodLineageContext,
  retrievedPapers,
  paperMethodDigests,
  qualitySignals
})

assert.equal(input.requestNonce, 123)
assert.equal(input.methodLineageContext.paperSource.extractedText, '[Page 1]\nCurrent paper text.')
assert.equal(input.retrievedPapers.length, 1)
assert.equal(input.paperMethodDigests.length, 1)
assert.equal(input.qualitySignals.length, 1)
assert.equal(input.readerGoal, 'hybrid_pdf_and_retrieved_paper_lineage')

const pdfOnlyFallback = buildHybridMethodLineageSynthesisInput({
  methodLineageContext,
  retrievedPapers: [],
  paperMethodDigests: [],
  qualitySignals: []
})

assert.deepEqual(pdfOnlyFallback.retrievedPapers, [])
assert.deepEqual(pdfOnlyFallback.paperMethodDigests, [])
assert.deepEqual(pdfOnlyFallback.qualitySignals, [])

console.log('methodLineageSynthesisInput tests passed')
