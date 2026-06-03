import assert from 'node:assert/strict'
import type { ExpansionProgressEvent } from '../../../../shared/electron-api'
import { buildExpansionLoadingTelemetry } from './loadingTelemetry'
import { EXPANSION_STEPS, isReusableExpansionRecord, updateSessionFromJobProgress, type NodeExpansionSession } from './nodeExpansionSessions'

function session(): NodeExpansionSession {
  return {
    id: 'expansion_n1',
    nodeId: 'n1',
    nodeLabel: 'Hypernetwork',
    status: 'loading',
    currentStepId: 'retrieving',
    steps: EXPANSION_STEPS.map((step) => step.id === 'retrieving'
      ? { ...step, status: 'running' as const }
      : { ...step }
    ),
    usesMockData: false,
    createdAt: '2026-05-31T00:00:00.000Z',
    updatedAt: '2026-05-31T00:00:00.000Z'
  }
}

const teachingProgress: ExpansionProgressEvent = {
  sessionId: 'expansion_n1',
  jobId: 'job-teach',
  step: 'teaching',
  message: '正在生成概念教学解释...'
}

const teachingSession = updateSessionFromJobProgress(session(), teachingProgress)

assert.equal(teachingSession.currentStepId, 'teaching')
assert.equal(teachingSession.steps.find((step) => step.id === 'retrieving')?.status, 'done')
assert.equal(teachingSession.steps.find((step) => step.id === 'teaching')?.status, 'running')

const persistingSession = updateSessionFromJobProgress(teachingSession, {
  sessionId: 'expansion_n1',
  jobId: 'job-teach',
  step: 'persisting',
  message: '正在保存概念教学结果...'
})

assert.equal(persistingSession.steps.find((step) => step.id === 'teaching')?.status, 'done')
assert.equal(persistingSession.steps.find((step) => step.id === 'research_area')?.status, 'skipped')
assert.equal(persistingSession.steps.find((step) => step.id === 'digesting')?.status, 'skipped')
assert.equal(persistingSession.steps.find((step) => step.id === 'synthesizing')?.status, 'skipped')
assert.equal(persistingSession.steps.find((step) => step.id === 'generating')?.status, 'done')
assert.equal(persistingSession.steps.find((step) => step.id === 'persisting')?.status, 'running')
assert.equal(buildExpansionLoadingTelemetry(persistingSession).completedStepCount, 8)

assert.equal(isReusableExpansionRecord({ expansionGraphNodes: [] } as any), false)
assert.equal(isReusableExpansionRecord({ expansionGraphNodes: [{ id: 'node-a' }] } as any), true)

console.log('nodeExpansionSessions tests passed')
