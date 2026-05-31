import assert from 'node:assert/strict'
import { buildExpansionLoadingTelemetry, formatElapsedTime } from './loadingTelemetry'
import type { NodeExpansionSession } from './nodeExpansionSessions'

assert.equal(formatElapsedTime('2026-05-31T00:00:00.000Z', Date.parse('2026-05-31T00:00:07.000Z')), '7s')
assert.equal(formatElapsedTime('2026-05-31T00:00:00.000Z', Date.parse('2026-05-31T00:01:05.000Z')), '1m 5s')

const session: NodeExpansionSession = {
  id: 'expansion_n1',
  nodeId: 'n1',
  nodeLabel: 'Hypernetwork',
  status: 'loading',
  currentStepId: 'digesting',
  steps: [
    { id: 'job_created', label: '创建展开任务', status: 'done' },
    { id: 'retrieving', label: '检索相关论文', status: 'done' },
    { id: 'digesting', label: '消化论文方法', status: 'running', detail: '正在提炼候选论文的方法摘要...' }
  ],
  expansionRecord: {
    id: 'record-a',
    paperId: 'paper-a',
    nodeId: 'n1',
    retrievedPaperIds: ['paper-1', 'paper-2'],
    algorithmIdeaCards: [],
    expansionGraphNodes: [
      { id: 'node-1', type: 'algorithm_idea', label: 'Method A', description: 'desc', sourcePaperIds: ['paper-1'], isTemporary: true }
    ],
    expansionGraphEdges: [],
    paperMethodDigests: [
      {
        id: 'digest-1',
        paperId: 'paper-1',
        paperTitle: 'Paper 1',
        problemSetting: '问题',
        coreMechanism: '机制',
        relationHints: ['foundation'],
        evidenceSummary: '证据',
        confidence: 0.7
      }
    ],
    dataCompleteness: 'partial',
    missingDataReasons: [],
    generatedByJobIds: ['job-1'],
    createdAt: '2026-05-31T00:00:00.000Z',
    updatedAt: '2026-05-31T00:00:00.000Z'
  },
  usesMockData: false,
  createdAt: '2026-05-31T00:00:00.000Z',
  updatedAt: '2026-05-31T00:00:00.000Z'
}

const telemetry = buildExpansionLoadingTelemetry(session, Date.parse('2026-05-31T00:00:45.000Z'))

assert.equal(telemetry.currentStep?.id, 'digesting')
assert.equal(telemetry.completedStepCount, 2)
assert.equal(telemetry.candidateCount, 2)
assert.equal(telemetry.digestCount, 1)
assert.equal(telemetry.expansionNodeCount, 1)
assert.equal(telemetry.elapsedTime, '45s')

console.log('loadingTelemetry tests passed')
