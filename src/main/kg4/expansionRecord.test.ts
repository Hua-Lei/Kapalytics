import assert from 'node:assert/strict'
import { buildExpansionRecord } from './expansionRecord'
import type { DedupedPaperCandidate } from '../../shared/kg3'

function candidate(id: string, title: string): DedupedPaperCandidate {
  return {
    canonicalId: id,
    mergedFrom: [],
    title,
    authors: [],
    sources: ['openalex'],
    externalIds: [],
    bestUrl: `https://example.test/${id}`,
    abstract: `${title} abstract`,
    score: 1
  }
}

const record = buildExpansionRecord({
  paperId: 'paper-1',
  nodeId: 'n5',
  jobId: 'job-1',
  retrievedPapers: [candidate('paper-a', 'MetaPruning'), candidate('paper-b', 'Meta-Learning Survey')],
  llmOutput: {
    insight: 'Hypernetworks generate weights for another network.',
    retrievedPapersRelevance: [
      { paperId: 'paper-a', title: 'MetaPruning', relevance: 'Uses a meta network.' }
    ],
    insufficientInformation: false
  }
})

assert.equal(record.dataCompleteness, 'partial')
assert.equal(record.expansionGraphNodes.length, 2)
assert.equal(record.expansionGraphNodes[0].type, 'related_paper')
assert.equal(record.expansionGraphNodes[0].sourcePaperIds[0], 'paper-a')
assert.match(record.missingDataReasons.join('\n'), /showing retrieved papers/i)

const llmShapeRecord = buildExpansionRecord({
  paperId: 'paper-1',
  nodeId: 'n5',
  jobId: 'job-2',
  retrievedPapers: [candidate('paper-a', 'MetaPruning')],
  llmOutput: {
    algorithmIdeaCards: [
      {
        id: 'card_1',
        title: 'Hypernetwork for Automatic Neural Network Channel Pruning',
        description: 'Trains a PruningNet hypernetwork to generate weight parameters for pruned networks.',
        paperId: 'paper-a',
        nodeId: 'n5'
      }
    ],
    expansionGraphNodes: [
      {
        id: 'expPaper1',
        label: 'MetaPruning',
        nodeType: 'related_paper',
        sourcePaperIds: ['paper-a'],
        abstract: 'Meta-learning approach where a PruningNet generates weights for pruned networks.'
      },
      {
        id: 'expAlg1',
        label: 'Hypernetwork Weight Generation',
        nodeType: 'algorithm_idea',
        sourcePaperIds: ['paper-a'],
        description: 'A meta-network that generates the weights of another network.'
      }
    ]
  }
})

assert.equal(llmShapeRecord.algorithmIdeaCards.length, 1)
assert.equal(llmShapeRecord.algorithmIdeaCards[0].paperTitle, 'Hypernetwork for Automatic Neural Network Channel Pruning')
assert.equal(llmShapeRecord.expansionGraphNodes.length, 2)
assert.equal(llmShapeRecord.expansionGraphNodes[0].type, 'related_paper')
assert.equal(llmShapeRecord.expansionGraphNodes[0].description, 'Meta-learning approach where a PruningNet generates weights for pruned networks.')
assert.equal(llmShapeRecord.expansionGraphNodes[0].isTemporary, true)

console.log('expansionRecord tests passed')
