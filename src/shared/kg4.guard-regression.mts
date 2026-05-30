import assert from 'node:assert/strict'

import { isKg4NodeExpansionRecord } from './kg4'

const validRecord = {
  id: 'expansion-1',
  paperId: 'paper-1',
  nodeId: 'node-1',
  retrievedPaperIds: ['paper-a'],
  algorithmIdeaCards: [
    {
      id: 'idea-1',
      paperId: 'paper-a',
      paperTitle: 'Paper A',
      problemSetting: 'setting',
      coreIdea: 'idea',
      keyAssumption: 'assumption',
      mechanism: 'mechanism',
      strength: 'strength',
      limitation: 'limitation',
      relationToCurrentNode: 'parallel',
      relationExplanation: 'explains relation',
      evidenceSource: {
        paperId: 'paper-a',
        source: 'arxiv'
      }
    }
  ],
  expansionGraphNodes: [
    {
      id: 'graph-node-1',
      type: 'algorithm_idea',
      label: 'Algorithm node',
      description: 'description',
      sourcePaperIds: ['paper-a'],
      isTemporary: false
    }
  ],
  expansionGraphEdges: [
    {
      id: 'edge-1',
      sourceId: 'graph-node-1',
      targetId: 'graph-node-2',
      relation: 'extends',
      explanation: 'edge explanation'
    }
  ],
  fieldCognitionView: {
    id: 'field-1',
    nodeId: 'node-1',
    fieldTitle: 'Field title',
    coreProblemSummary: 'summary',
    methodFamilies: [],
    prerequisiteConcepts: []
  },
  dataCompleteness: 'partial',
  missingDataReasons: ['missing paper'],
  generatedByJobIds: ['job-1'],
  createdAt: '2026-05-30T00:00:00.000Z',
  updatedAt: '2026-05-30T00:00:00.000Z'
}

assert.equal(isKg4NodeExpansionRecord(validRecord), true)

const invalidIdeaCard = {
  ...validRecord,
  algorithmIdeaCards: [
    {
      ...validRecord.algorithmIdeaCards[0],
      evidenceSource: {
        paperId: 'paper-a',
        source: 123
      }
    }
  ]
}

assert.equal(isKg4NodeExpansionRecord(invalidIdeaCard), false)

const invalidFieldCognitionView = {
  ...validRecord,
  fieldCognitionView: {
    ...validRecord.fieldCognitionView,
    methodFamilies: 'not-an-array'
  }
}

assert.equal(isKg4NodeExpansionRecord(invalidFieldCognitionView), false)

const invalidRetrievedPaperIds = {
  ...validRecord,
  retrievedPaperIds: ['paper-a', 2]
}

assert.equal(isKg4NodeExpansionRecord(invalidRetrievedPaperIds), false)
