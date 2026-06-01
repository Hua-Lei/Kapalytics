import type { NodeExpansionSession } from './nodeExpansionSessions'

export function formatElapsedTime(startedAt: string, nowMs = Date.now()): string {
  const elapsedMs = Math.max(0, nowMs - new Date(startedAt).getTime())
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`
}

export function buildExpansionLoadingTelemetry(session: NodeExpansionSession, nowMs = Date.now()): {
  currentStep?: NodeExpansionSession['steps'][number]
  completedStepCount: number
  candidateCount: number
  digestCount: number
  expansionNodeCount: number
  elapsedTime: string
} {
  return {
    currentStep: session.steps.find((step) => step.id === session.currentStepId) ?? session.steps.find((step) => step.status === 'running'),
    completedStepCount: session.steps.filter((step) => step.status === 'done' || step.status === 'skipped').length,
    candidateCount: session.expansionRecord?.retrievedPaperIds.length ?? 0,
    digestCount: session.expansionRecord?.paperMethodDigests?.length ?? 0,
    expansionNodeCount: session.expansionRecord?.expansionGraphNodes.length ?? 0,
    elapsedTime: formatElapsedTime(session.createdAt, nowMs)
  }
}
