import { useWorkspace } from '../domains/workspace/useWorkspace'
import PaperGraphView from './PaperGraphView'
import ArgumentChainView from './ArgumentChainView'
import MethodMechanismView from './MethodMechanismView'
import PdfReaderWorkspace from './PdfReaderWorkspace'
import StageLearningView from './StageLearningView'
import FieldMemoryView from './FieldMemoryView'
import ExpansionLoadingView from './ExpansionLoadingView'
import ExpansionGraphView from './ExpansionGraphView'
import ExpandView from './ExpandView'

function WorkspaceRouter() {
  const { activeTab } = useWorkspace()
  const type = activeTab?.type ?? 'paper_graph'

  return (
    <main className="central-workspace">
      <div className="central-workspace__header">
        <div>
          <span className="panel-header-subtitle">Central Workspace</span>
          <h2>{activeTab?.title ?? 'Paper Graph'}</h2>
        </div>
        <span className="central-workspace__type">{type}</span>
      </div>
      <div className="central-workspace__body">
        {type === 'pdf_reader' && <PdfReaderWorkspace />}
        {type === 'paper_graph' && <PaperGraphView />}
        {type === 'argument_chain' && <ArgumentChainView />}
        {type === 'method_mechanism' && <MethodMechanismView />}
        {type === 'stage_learning' && <StageLearningView />}
        {type === 'node_expansion_loading' && <ExpansionLoadingView />}
        {type === 'expansion_graph' && <ExpansionGraphView />}
        {type === 'expand_view' && <ExpandView />}
        {type === 'field_memory' && <FieldMemoryView />}
        {!['pdf_reader', 'paper_graph', 'argument_chain', 'method_mechanism', 'stage_learning', 'node_expansion_loading', 'expansion_graph', 'expand_view', 'field_memory'].includes(type) && (
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

export default WorkspaceRouter
