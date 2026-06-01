import KnowledgeGraph from './KnowledgeGraph'
import { useEffect } from 'react'
import LearningPath from './LearningPath'
import StageDetail from './StageDetail'
import ExpansionLoadingView from './ExpansionLoadingView'
import ExpansionGraphView from './ExpansionGraphView'
import EvidencePaperDetailView from './EvidencePaperDetailView'
import ExpandView from './ExpandView'
import FieldMemoryView from './FieldMemoryView'
import ArgumentChainView from './ArgumentChainView'
import LineageNodeDetailView from './LineageNodeDetailView'
import MethodMechanismView from './MethodMechanismView'
import PdfReaderWorkspace from './PdfReaderWorkspace'
import { useWorkspace } from '../domains/workspace/useWorkspace'
import { usePaper } from '../domains/paper/usePaper'
import { useStages } from '../domains/stages/useStages'
import { useExpansion } from '../domains/expansion/useExpansion'
import { hasCurrentPaperAnalysis } from '../domains/paper/paperSelectionState'

function WorkspaceHeader() {
  const { activeTab } = useWorkspace()
  return (
    <div className="central-workspace__header">
      <div>
        <span className="panel-header-subtitle">Central Workspace</span>
        <h2>{activeTab?.title ?? 'Paper Graph'}</h2>
      </div>
      <span className="central-workspace__type">{activeTab?.type ?? 'paper_graph'}</span>
    </div>
  )
}

function StageLearningWorkspace() {
  const { selectObject } = useWorkspace()
  const { stages, selectedStageId, selectStage, answers, drafts, diagnosisResults, diagnosedStageIds, diagnosisError, diagnosisLoading, confirmDiagnosis, enterStage, markNeedsReview, retryDiagnosis, retryStage, submitAnswer, updateDraft } = useStages()
  const selectedStage = stages.find((s) => s.id === selectedStageId) ?? null

  useEffect(() => {
    if (!selectedStageId && stages[0]) {
      selectStage(stages[0].id)
      selectObject({ type: 'learning_stage', id: stages[0].id })
    }
  }, [selectObject, selectStage, selectedStageId, stages])

  const handleSelectStage = (stageId: string) => {
    selectStage(stageId)
    selectObject({ type: 'learning_stage', id: stageId })
  }

  return (
    <div className="stage-learning-workspace">
      <div className="stage-learning-workspace__path">
        <LearningPath stages={stages} selectedStageId={selectedStageId} onSelectStage={handleSelectStage} />
      </div>
      <div className="stage-learning-workspace__detail">
        {selectedStage ? (
          <StageDetail
            answer={answers[selectedStage.id] ?? ''}
            diagnosed={diagnosedStageIds.has(selectedStage.id)}
            diagnosisError={diagnosisError}
            diagnosisLoading={diagnosisLoading}
            diagnosisResult={diagnosisResults[selectedStage.id]}
            draft={drafts[selectedStage.id] ?? ''}
            onConfirmDiagnosis={() => confirmDiagnosis(selectedStage.id)}
            onEnterStage={() => enterStage(selectedStage.id)}
            onMarkNeedsReview={() => markNeedsReview(selectedStage.id)}
            onRetryDiagnosis={retryDiagnosis}
            onRetryStage={() => retryStage(selectedStage.id)}
            onSubmitAnswer={() => submitAnswer(selectedStage.id)}
            onUpdateDraft={(value) => updateDraft(selectedStage.id, value)}
            stage={selectedStage}
          />
        ) : (
          <div className="workspace-placeholder-view workspace-placeholder-view--learning">
            <span className="eyebrow">Stage Learning</span>
            <h3>{stages.length ? '选择一个阶段开始学习' : '先分析一篇 PDF 生成学习阶段'}</h3>
            <p>
              {stages.length
                ? '左侧阶段列表已准备好，选择任意阶段后可以查看目标、作答并获得诊断反馈。'
                : '在 PDF Reader 中选择论文并点击“分析论文”，系统会生成知识图谱和 7 个阶段任务。'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function CentralWorkspaceRouter() {
  const { activeTab, state, selectObject } = useWorkspace()
  const { graph, graphPaperId, paperId, paperInsight } = usePaper()
  const { sessions } = useExpansion()

  const type = activeTab?.type ?? 'paper_graph'
  const activeExpansionSession = activeTab?.expansionId ? sessions[activeTab.expansionId] : undefined
  const activeExpansionAnchor = activeExpansionSession ? graph.nodes.find((node) => node.id === activeExpansionSession.nodeId) : undefined

  // Derive selectedNodeId from workspace selectedObject
  const selectedNodeId = state.selectedObject?.type === 'graph_node' ? state.selectedObject.id : null

  const handleNodeSelect = (nodeId: string) => {
    selectObject({ type: 'graph_node', id: nodeId })
  }

  return (
    <main className="central-workspace">
      <WorkspaceHeader />
      <div className="central-workspace__body">
        {type === 'pdf_reader' && <PdfReaderWorkspace />}
        {type === 'paper_graph' && (
          <KnowledgeGraph
            graph={hasCurrentPaperAnalysis({ graph, graphPaperId, paperId }) ? graph : { nodes: [], edges: [] }}
            paperInsight={paperInsight}
            selectedNodeId={selectedNodeId}
            view="argument"
            onNodeSelect={handleNodeSelect}
          />
        )}
        {type === 'argument_chain' && <ArgumentChainView />}
        {type === 'method_mechanism' && <MethodMechanismView />}
        {type === 'stage_learning' && <StageLearningWorkspace />}
        {type === 'node_expansion_loading' && (
          <ExpansionLoadingView />
        )}
        {type === 'expansion_graph' && (
          <ExpansionGraphView />
        )}
        {type === 'lineage_node_detail' && <LineageNodeDetailView />}
        {type === 'evidence_paper_detail' && <EvidencePaperDetailView />}
        {type === 'expand_view' && (
          <ExpandView />
        )}
        {type === 'field_memory' && <FieldMemoryView />}
        {!['pdf_reader', 'paper_graph', 'argument_chain', 'method_mechanism', 'stage_learning', 'node_expansion_loading', 'expansion_graph', 'lineage_node_detail', 'evidence_paper_detail', 'expand_view', 'field_memory'].includes(type) && (
          <div className="workspace-placeholder-view">
            <span className="eyebrow">Coming Next</span>
            <h3>{activeTab?.title}</h3>
            <p>该 workspace type 已在状态模型中预留，后续版本会逐步接入。</p>
          </div>
        )}
      </div>
    </main>
  )
}

export default CentralWorkspaceRouter
