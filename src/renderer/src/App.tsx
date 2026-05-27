import { useState, useCallback, useEffect, useRef } from 'react'
import CenterPanel from './components/CenterPanel'
import RightPanel from './components/RightPanel'
import { mockStages } from './mock/stages'
import { Stage } from './types'
import './App.css'

type ActiveTab = 'graph' | 'learning'
type ResizeTarget = 'left' | 'right' | null

const MIN_PANEL = 200
const DEFAULT_LEFT = 280
const DEFAULT_RIGHT = 340

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('learning')
  const [stages] = useState<Stage[]>(mockStages)
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const selectedStage = stages.find((s) => s.id === selectedStageId) ?? null

  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT)
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)

  const resizing = useRef<ResizeTarget>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((target: ResizeTarget) => {
    resizing.current = target
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!resizing.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()

      if (resizing.current === 'left') {
        const w = e.clientX - rect.left
        setLeftWidth(Math.max(MIN_PANEL, Math.min(w, rect.width - MIN_PANEL * 2)))
      } else {
        const w = rect.right - e.clientX
        setRightWidth(Math.max(MIN_PANEL, Math.min(w, rect.width - MIN_PANEL * 2)))
      }
    },
    []
  )

  const handleMouseUp = useCallback(() => {
    resizing.current = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  const leftPanel = (
    <aside
      className={`panel panel-left ${leftCollapsed ? 'panel--collapsed' : ''}`}
      style={{ width: leftCollapsed ? 0 : leftWidth }}
    >
      <div className="panel-header">
        {!leftCollapsed && <span>PDF 阅读区</span>}
        <button
          className="panel-collapse-btn"
          onClick={() => setLeftCollapsed(!leftCollapsed)}
          title={leftCollapsed ? '展开' : '折叠'}
        >
          {leftCollapsed ? '▶' : '◀'}
        </button>
      </div>
      {!leftCollapsed && (
        <div className="panel-body">
          <div className="empty-state">上传论文 PDF 以开始学习</div>
        </div>
      )}
    </aside>
  )

  const rightPanel = (
    <aside
      className={`panel panel-right ${rightCollapsed ? 'panel--collapsed' : ''}`}
      style={{ width: rightCollapsed ? 0 : rightWidth }}
    >
      <div className="panel-header">
        <button
          className="panel-collapse-btn"
          onClick={() => setRightCollapsed(!rightCollapsed)}
          title={rightCollapsed ? '展开' : '折叠'}
        >
          {rightCollapsed ? '◀' : '▶'}
        </button>
        {!rightCollapsed && <span>AI 学习面板</span>}
      </div>
      {!rightCollapsed && (
        <div className="panel-body">
          {rightPanelBody()}
        </div>
      )}
    </aside>
  )

  function rightPanelBody() {
    if (!selectedStage) {
      return <div className="empty-state">选择左侧学习阶段以查看详情</div>
    }
    const statusText: Record<string, string> = {
      not_started: '未开始',
      in_progress: '学习中',
      completed: '已完成',
      needs_review: '需复习'
    }
    return (
      <div className="stage-detail">
        <div className="stage-detail__meta">
          阶段 {selectedStage.order} · {statusText[selectedStage.status]}
        </div>
        <h3 className="stage-detail__title">{selectedStage.name}</h3>
        <p className="stage-detail__description">{selectedStage.description}</p>
        <div className="stage-detail__task">
          <div className="task-label">阶段任务</div>
          <div className="task-placeholder">任务将在选择论文后由 AI 自动生成</div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container" ref={containerRef}>
      {leftPanel}

      {!leftCollapsed && (
        <div className="resize-handle" onMouseDown={() => handleMouseDown('left')} />
      )}

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

      {!rightCollapsed && (
        <div className="resize-handle" onMouseDown={() => handleMouseDown('right')} />
      )}

      {rightPanel}
    </div>
  )
}

export default App
