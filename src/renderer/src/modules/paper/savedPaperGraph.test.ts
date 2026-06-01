import assert from 'node:assert/strict'
import { restoreSavedPaperAnalysis } from './savedPaperGraph'
import type { Kg3MemorySnapshot } from '../../../../shared/kg3'

const snapshot: Kg3MemorySnapshot = {
  papers: [],
  paperInsights: [
    {
      id: 'paper-1:insight',
      paperId: 'paper-1',
      centralInsight: 'central',
      priorLimitation: 'prior',
      methodMechanism: 'method',
      evidenceChain: ['Hypernetwork'],
      evidenceChainNodeIds: ['paper-1:n1'],
      remainingGap: 'gap',
      createdAt: '2026-05-30T00:00:00.000Z',
      updatedAt: '2026-05-30T00:00:00.000Z'
    }
  ],
  graphNodes: [
    {
      id: 'paper-1:n1',
      paperId: 'paper-1',
      nodeType: 'concept',
      label: 'Hypernetwork',
      normalizedLabel: 'hypernetwork',
      description: 'Generates weights for another network.',
      evidenceNodeIds: [],
      expandable: true,
      expansionType: 'related_papers',
      searchQueries: ['hypernetwork'],
      confidence: 0.72,
      createdAt: '2026-05-30T00:00:00.000Z',
      updatedAt: '2026-05-30T00:00:00.000Z'
    }
  ],
  graphEdges: [
    {
      id: 'paper-1:e1',
      paperId: 'paper-1',
      sourceNodeId: 'paper-1:n1',
      targetNodeId: 'paper-1:n1',
      relationType: 'related',
      label: 'self',
      directed: true,
      confidence: 0.68,
      createdAt: '2026-05-30T00:00:00.000Z',
      updatedAt: '2026-05-30T00:00:00.000Z'
    }
  ],
  readingSessions: [],
  learningTasks: [
    {
      id: 'paper-1:stage:formula_algorithm',
      paperId: 'paper-1',
      taskType: 'stage_task',
      stageId: 'formula_algorithm',
      prompt: '解释关键公式。',
      expectedReasoningPoints: [],
      relatedPaperIds: [],
      relatedMergedNodeIds: [],
      status: 'not_started',
      createdAt: '2026-05-30T00:00:00.000Z',
      updatedAt: '2026-05-30T00:00:00.000Z'
    }
  ],
  diagnoses: [],
  nodeExpansions: [],
  paperSearchResults: [],
  mergedGraphNodes: [],
  mergedGraphEdges: [],
  userMastery: [],
  llmJobs: [],
  nodeUnderstandingMemories: []
}

const restored = restoreSavedPaperAnalysis(snapshot, 'paper-1')

assert.ok(restored)
assert.equal(restored.graph.nodes.length, 1)
assert.equal(restored.graph.nodes[0].id, 'n1')
assert.equal(restored.graph.nodes[0].label, 'Hypernetwork')
assert.equal(restored.graph.edges[0].sourceId, 'n1')
assert.equal(restored.paperInsight?.centralInsight, 'central')
assert.equal(restored.stageTasks.formula_algorithm, '解释关键公式。')

console.log('savedPaperGraph tests passed')
