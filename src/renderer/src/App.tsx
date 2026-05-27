import { useState } from 'react'
import CenterPanel from './components/CenterPanel'
import RightPanel from './components/RightPanel'
import { mockStages } from './mock/stages'
import { Stage } from './types'
import './App.css'

type ActiveTab = 'graph' | 'learning'

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('learning')
  const [stages] = useState<Stage[]>(mockStages)
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)

  const selectedStage = stages.find((s) => s.id === selectedStageId) ?? null

  return (
    <div className="app-container">
      <aside className="panel panel-left">
        <div className="panel-header">PDF 阅读区</div>
        <div className="panel-body">
          <div className="empty-state">上传论文 PDF 以开始学习</div>
        </div>
      </aside>

      <CenterPanel
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab)
          setSelectedStageId(null)
        }}
        stages={stages}
        selectedStageId={selectedStageId}
        onSelectStage={setSelectedStageId}
      />

      <RightPanel selectedStage={selectedStage} />
    </div>
  )
}

export default App
