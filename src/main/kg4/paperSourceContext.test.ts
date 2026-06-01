import assert from 'node:assert/strict'
import type { ExtractedPaperContent } from '../../shared/paper'
import { buildMethodLineageContext, buildPaperSourceContext } from './paperSourceContext'

const content: ExtractedPaperContent = {
  pages: [
    { page: 1, text: 'Abstract text. We study efficient adaptation.' },
    { page: 2, text: 'Method text. Our method generates adapter weights.' }
  ],
  formulaCandidates: []
}

const source = buildPaperSourceContext('file:///paper.pdf', content)
assert.equal(source.pdfUrl, 'file:///paper.pdf')
assert.equal(source.pages.length, 2)
assert.equal(source.pages[0].pageNumber, 1)
assert.match(source.extractedText, /\[Page 1\]/)
assert.match(source.extractedText, /Our method generates adapter weights/)

const context = buildMethodLineageContext({
  anchor: {
    nodeId: 'n1',
    label: 'Generated Adapters',
    type: 'method',
    expansionType: 'method_evolution',
    description: 'A method node.'
  },
  paperSource: source,
  paperInsight: {
    title: 'Generated Adapters',
    problem: 'Efficient adaptation',
    method: 'Generated adapter weights',
    contribution: 'Context-conditioned adaptation'
  },
  graphNeighborhood: {
    nodes: [{ id: 'n1', label: 'Generated Adapters', type: 'method', description: 'A method node.' }],
    edges: []
  }
})

assert.equal(context.readerIntent, 'novice_paper_anchored_lineage')
assert.equal(context.paperSource.extractedText, source.extractedText)
assert.equal(context.localGraphNeighborhood.nodes[0].id, 'n1')
assert.deepEqual(context.evidenceSlots, [])

console.log('paperSourceContext tests passed')
