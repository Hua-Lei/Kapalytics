import assert from 'node:assert/strict'
import { hasCurrentPaperAnalysis } from './paperSelectionState'
import type { KnowledgeGraph } from '../../../../shared/paper'

const graph: KnowledgeGraph = {
  nodes: [{ id: 'n1', type: 'concept', label: 'D2L', description: 'old graph', x: 0, y: 0 }],
  edges: []
}

assert.equal(hasCurrentPaperAnalysis({ graph, graphPaperId: 'd2l', paperId: 'd2l' }), true)
assert.equal(hasCurrentPaperAnalysis({ graph, graphPaperId: 'd2l', paperId: 'cql' }), false)
assert.equal(hasCurrentPaperAnalysis({ graph: { nodes: [], edges: [] }, graphPaperId: 'd2l', paperId: 'd2l' }), false)

console.log('paperSelectionState tests passed')
