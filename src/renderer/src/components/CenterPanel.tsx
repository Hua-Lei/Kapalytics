import { useState } from 'react'
import { Stage } from '../types'
import LearningPath from './LearningPath'
import KnowledgeGraph from './KnowledgeGraph'
import { KnowledgeGraph as KGType } from '../modules/graph/types'
import type { PaperInsight } from '../../../shared/paper'

type ActiveTab = 'graph' | 'learning'
type GraphView = 'argument' | 'mechanism' | 'expansion'

interface CenterPanelProps {
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
  stages: Stage[]
  selectedStageId: string | null
  onSelectStage: (stageId: string) => void
  graph: KGType
  paperInsight: PaperInsight | null
  selectedGraphNodeId: string | null
  onSelectGraphNode: (nodeId: string) => void
}

function CenterPanel({
  activeTab,
  onTabChange,
  stages,
  selectedStageId,
  onSelectStage,
  graph,
  paperInsight,
  selectedGraphNodeId,
  onSelectGraphNode
}: CenterPanelProps) {
  const [graphView, setGraphView] = useState<GraphView>('argument')
  const completed = stages.filter((stage) => stage.status === 'completed').length
  const needsReview = stages.filter((stage) => stage.status === 'needs_review').length

  return (
    <main className="panel panel-center">
      <div className="panel-header panel-header--tabs">
        <div className="workspace-heading">
          <span className="panel-header-title">Workspace</span>
          <span className="panel-header-subtitle">
            {graph.nodes.length ? `${graph.nodes.length} nodes · ${completed}/${stages.length} stages` : '等待论文分析'}
            {needsReview ? ` · ${needsReview} review` : ''}
          </span>
        </div>
        <div className="segmented-control">
          <button
            className={`segmented-btn ${activeTab === 'graph' ? 'segmented-btn--active' : ''}`}
            onClick={() => onTabChange('graph')}
          >
            知识图谱
          </button>
          <button
            className={`segmented-btn ${activeTab === 'learning' ? 'segmented-btn--active' : ''}`}
            onClick={() => onTabChange('learning')}
          >
            学习路径
          </button>
        </div>
      </div>
      {activeTab === 'graph' && graph.nodes.length > 0 && (
        <div className="graph-view-switcher">
          {([
            ['argument', '论文论证图'],
            ['mechanism', '方法机制图'],
            ['expansion', '领域扩展图']
          ] as const).map(([view, label]) => (
            <button
              key={view}
              className={`graph-view-btn ${graphView === view ? 'graph-view-btn--active' : ''}`}
              onClick={() => setGraphView(view)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="panel-body">
        {activeTab === 'graph' ? (
          <KnowledgeGraph
            graph={graph}
            paperInsight={paperInsight}
            selectedNodeId={selectedGraphNodeId}
            view={graphView}
            onNodeSelect={onSelectGraphNode}
          />
        ) : (
          <LearningPath
            stages={stages}
            selectedStageId={selectedStageId}
            onSelectStage={onSelectStage}
          />
        )}
      </div>
    </main>
  )
}

export default CenterPanel
