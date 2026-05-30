import type { AnalysisStep, GraphNode, PaperInsight } from '../../../shared/paper'
import type { AlgorithmIdeaCard, ExpansionGraphNode, NodeUnderstandingMemory } from '../../../shared/kg4'
import type { Stage } from '../types'
import type { DiagnosisResult } from '../modules/diagnosis/types'
import type { LearningReport } from '../modules/learning/report'
import type { NodeExpansionSession } from '../modules/workspace/nodeExpansionSessions'
import type { SelectedObject } from '../domains/workspace/types'
import AlgorithmIdeaInspector from './ai-panel/AlgorithmIdeaInspector'
import EmptyContextPanel from './ai-panel/EmptyContextPanel'
import ExpansionNodeInspector from './ai-panel/ExpansionNodeInspector'
import MemoryRecordInspector from './ai-panel/MemoryRecordInspector'
import NodeInspector from './ai-panel/NodeInspector'
import StageInspector from './ai-panel/StageInspector'

interface AIContextPanelProps {
  analysisSteps: AnalysisStep[]
  generating: boolean
  genError: string
  genProgress: string
  graphNodes: GraphNode[]
  learningReport: LearningReport | null
  memories: NodeUnderstandingMemory[]
  nodeExpansionSessions: Record<string, NodeExpansionSession>
  paperInsight: PaperInsight | null
  pdfUrl: string | null
  selectedObject?: SelectedObject
  stages: Stage[]
  diagnosisResults: Record<string, DiagnosisResult>
  diagnosedStageIds: Set<string>
  onAnalyzePaper: () => void
  onGenerateLearningReport: () => void
  onSelectPdf: () => void
}

function AIContextPanel(props: AIContextPanelProps) {
  let body: React.ReactNode
  if (!props.pdfUrl && !props.selectedObject) {
    body = <EmptyContextPanel pdfUrl={props.pdfUrl} stages={props.stages} />
  } else if (props.selectedObject?.type === 'graph_node') {
    const node = props.graphNodes.find((item) => item.id === props.selectedObject?.id)
    body = node ? <NodeInspector node={node} /> : <EmptyContextPanel pdfUrl={props.pdfUrl} stages={props.stages} />
  } else if (props.selectedObject?.type === 'learning_stage') {
    const stage = props.stages.find((item) => item.id === props.selectedObject?.id)
    body = stage
      ? <StageInspector stage={stage} diagnosed={props.diagnosedStageIds.has(stage.id)} diagnosis={props.diagnosisResults[stage.id]} />
      : <EmptyContextPanel pdfUrl={props.pdfUrl} stages={props.stages} />
  } else if (props.selectedObject?.type === 'expansion_node') {
    const session = props.nodeExpansionSessions[props.selectedObject.expansionId]
    const node = session?.expansionGraph?.nodes.find((item) => item.id === props.selectedObject?.id)
    body = node
      ? <ExpansionNodeInspector node={node} expansionId={props.selectedObject.expansionId} />
      : <EmptyContextPanel pdfUrl={props.pdfUrl} stages={props.stages} />
  } else if (props.selectedObject?.type === 'algorithm_idea') {
    const card = Object.values(props.nodeExpansionSessions)
      .flatMap((s) => s.expansionRecord?.algorithmIdeaCards ?? [])
      .find((c) => c.id === props.selectedObject?.id)
    body = card
      ? <AlgorithmIdeaInspector card={card} expansionId={props.selectedObject.expansionId} />
      : <EmptyContextPanel pdfUrl={props.pdfUrl} stages={props.stages} />
  } else if (props.selectedObject?.type === 'memory_record') {
    const memory = props.memories.find((item) => item.id === props.selectedObject?.id)
    body = memory
      ? <MemoryRecordInspector memory={memory} />
      : <EmptyContextPanel pdfUrl={props.pdfUrl} stages={props.stages} />
  } else {
    body = <EmptyContextPanel pdfUrl={props.pdfUrl} stages={props.stages} />
  }

  return <div className="panel-body tutor-panel ai-context-panel">{body}</div>
}

export default AIContextPanel
