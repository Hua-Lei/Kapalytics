import AlgorithmIdeaInspector from './ai-panel/AlgorithmIdeaInspector'
import EmptyContextPanel from './ai-panel/EmptyContextPanel'
import ExpansionNodeInspector from './ai-panel/ExpansionNodeInspector'
import MemoryRecordInspector from './ai-panel/MemoryRecordInspector'
import NodeInspector from './ai-panel/NodeInspector'
import StageInspector from './ai-panel/StageInspector'
import { usePaper } from '../domains/paper/usePaper'
import { useStages } from '../domains/stages/useStages'
import { useMemories } from '../domains/memory/useMemories'
import { useExpansion } from '../domains/expansion/useExpansion'
import { useWorkspace } from '../domains/workspace/useWorkspace'

function AIContextPanel() {
  const { pdfUrl, graph, paperInsight, analysisSteps, generating, genError, genProgress, analyzePaper, selectPdf } = usePaper()
  const { stages, diagnosisResults, diagnosedStageIds, learningReport, generateReport } = useStages()
  const { memories } = useMemories()
  const { sessions } = useExpansion()
  const { state } = useWorkspace()

  const selectedObject = state.selectedObject

  let body: React.ReactNode
  if (!pdfUrl && !selectedObject) {
    body = <EmptyContextPanel pdfUrl={pdfUrl} stages={stages} />
  } else if (selectedObject?.type === 'graph_node') {
    const node = graph.nodes.find((item) => item.id === selectedObject?.id)
    body = node ? <NodeInspector node={node} /> : <EmptyContextPanel pdfUrl={pdfUrl} stages={stages} />
  } else if (selectedObject?.type === 'learning_stage') {
    const stage = stages.find((item) => item.id === selectedObject?.id)
    body = stage
      ? <StageInspector stage={stage} diagnosed={diagnosedStageIds.has(stage.id)} diagnosis={diagnosisResults[stage.id]} />
      : <EmptyContextPanel pdfUrl={pdfUrl} stages={stages} />
  } else if (selectedObject?.type === 'expansion_node') {
    const session = sessions[selectedObject.expansionId]
    const node = session?.expansionGraph?.nodes.find((item) => item.id === selectedObject?.id)
    body = node
      ? <ExpansionNodeInspector node={node} expansionId={selectedObject.expansionId} />
      : <EmptyContextPanel pdfUrl={pdfUrl} stages={stages} />
  } else if (selectedObject?.type === 'algorithm_idea') {
    const card = Object.values(sessions)
      .flatMap((s) => s.expansionRecord?.algorithmIdeaCards ?? [])
      .find((c) => c.id === selectedObject?.id)
    body = card
      ? <AlgorithmIdeaInspector card={card} expansionId={selectedObject.expansionId} />
      : <EmptyContextPanel pdfUrl={pdfUrl} stages={stages} />
  } else if (selectedObject?.type === 'memory_record') {
    const memory = memories.find((item) => item.id === selectedObject?.id)
    body = memory
      ? <MemoryRecordInspector memory={memory} />
      : <EmptyContextPanel pdfUrl={pdfUrl} stages={stages} />
  } else {
    body = <EmptyContextPanel pdfUrl={pdfUrl} stages={stages} />
  }

  return <div className="panel-body tutor-panel ai-context-panel">{body}</div>
}

export default AIContextPanel
