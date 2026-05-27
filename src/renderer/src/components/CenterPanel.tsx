import { Stage } from '../types'
import LearningPath from './LearningPath'
import KnowledgeGraph from './KnowledgeGraph'
import { KnowledgeGraph as KGType } from '../modules/graph/types'

type ActiveTab = 'graph' | 'learning'

interface CenterPanelProps {
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
  stages: Stage[]
  selectedStageId: string | null
  onSelectStage: (stageId: string) => void
  graph: KGType
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
  selectedGraphNodeId,
  onSelectGraphNode
}: CenterPanelProps) {
  return (
    <main className="panel panel-center">
      <div className="panel-header panel-header--tabs">
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
      <div className="panel-body">
        {activeTab === 'graph' ? (
          <KnowledgeGraph
            graph={graph}
            selectedNodeId={selectedGraphNodeId}
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
