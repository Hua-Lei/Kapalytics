import type { Kg4ExpansionGraphLayer, Kg4NodeExpansionRecord } from '../../../../shared/kg4'
import type { ExpansionProgressEvent } from '../../../../shared/electron-api'

export type NodeExpansionStatus = 'loading' | 'ready' | 'failed' | 'empty'
export type NodeExpansionStepStatus = 'pending' | 'running' | 'done' | 'failed'

export interface NodeExpansionStep {
  id: string
  label: string
  status: NodeExpansionStepStatus
  detail?: string
}

export interface NodeExpansionSession {
  id: string
  nodeId: string
  nodeLabel: string
  paperId?: string
  status: NodeExpansionStatus
  currentStepId?: string
  steps: NodeExpansionStep[]
  expansionGraph?: Kg4ExpansionGraphLayer
  expansionRecord?: Kg4NodeExpansionRecord
  selectedExpansionNodeId?: string
  usesMockData: boolean
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

export function updateSessionFromJobProgress(
  session: NodeExpansionSession,
  event: ExpansionProgressEvent
): NodeExpansionSession {
  const now = new Date().toISOString()
  const stepOrder = ['job_created', 'retrieving', 'analyzing', 'generating', 'done'] as const

  const currentIndex = stepOrder.indexOf(event.step as typeof stepOrder[number])
  const steps = session.steps.map((step) => {
    const stepIndex = stepOrder.indexOf(step.id as typeof stepOrder[number])
    if (stepIndex < currentIndex) return { ...step, status: 'done' as const }
    if (stepIndex === currentIndex) {
      if (event.step === 'failed') return { ...step, status: 'failed' as const, detail: event.error || event.message }
      return { ...step, status: 'running' as const, detail: event.message }
    }
    return step
  })

  if (event.step === 'failed') {
    return {
      ...session,
      status: 'failed',
      currentStepId: event.step,
      steps,
      errorMessage: event.error || event.message,
      updatedAt: now
    }
  }

  if (event.step === 'done') {
    const result = event.result as Record<string, unknown> | undefined
    const expansionGraph: Kg4ExpansionGraphLayer | undefined = result?.expansionGraphNodes ? {
      anchorNodeId: session.nodeId,
      nodes: (result.expansionGraphNodes || []) as Kg4ExpansionGraphLayer['nodes'],
      edges: (result.expansionGraphEdges || []) as Kg4ExpansionGraphLayer['edges']
    } : undefined

    const expansionRecord: Kg4NodeExpansionRecord | undefined = result ? {
      id: `kg4_expansion_${session.nodeId}_${Date.now()}`,
      paperId: 'current-paper',
      nodeId: session.nodeId,
      retrievedPaperIds: (result.retrievedPaperIds || []) as string[],
      algorithmIdeaCards: (result.algorithmIdeaCards || []) as Kg4NodeExpansionRecord['algorithmIdeaCards'],
      expansionGraphNodes: (result.expansionGraphNodes || []) as Kg4NodeExpansionRecord['expansionGraphNodes'],
      expansionGraphEdges: (result.expansionGraphEdges || []) as Kg4NodeExpansionRecord['expansionGraphEdges'],
      fieldCognitionView: result.fieldCognitionView as Kg4NodeExpansionRecord['fieldCognitionView'],
      dataCompleteness: (result.dataCompleteness as Kg4NodeExpansionRecord['dataCompleteness']) || 'partial',
      missingDataReasons: (result.missingDataReasons || []) as string[],
      generatedByJobIds: [event.jobId],
      createdAt: session.createdAt,
      updatedAt: now
    } : undefined

    return {
      ...session,
      status: 'ready',
      currentStepId: 'done',
      steps,
      expansionGraph,
      expansionRecord,
      updatedAt: now
    }
  }

  return {
    ...session,
    currentStepId: event.step,
    steps,
    updatedAt: now
  }
}
