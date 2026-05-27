import { useState, useCallback, useEffect, useRef } from 'react'
import CenterPanel from './components/CenterPanel'
import NodeDetailPanel from './components/NodeDetailPanel'
import MathText from './components/MathText'
import { mockStages } from './mock/stages'
import { mockKnowledgeGraph } from './mock/knowledgeGraph'
import { Stage } from './types'
import './App.css'

type ActiveTab = 'graph' | 'learning'
type ResizeTarget = 'left' | 'right' | null

const MIN_PANEL = 200
const DEFAULT_LEFT = 280
const DEFAULT_RIGHT = 340

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('learning')
  const [stages, setStages] = useState<Stage[]>(mockStages)
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const selectedStage = stages.find((s) => s.id === selectedStageId) ?? null

  const updateStageStatus = (stageId: string, status: Stage['status']) => {
    setStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, status } : s)))
  }

  const enterStage = (stageId: string) => updateStageStatus(stageId, 'in_progress')
  const completeStage = (stageId: string) => updateStageStatus(stageId, 'completed')
  const markNeedsReview = (stageId: string) => updateStageStatus(stageId, 'needs_review')

  const [graph] = useState<KGType>(mockKnowledgeGraph)
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null)
  const selectedGraphNode =
    graph.nodes.find((n) => n.id === selectedGraphNodeId) ?? null

  const [fontScale, setFontScale] = useState(1)
  const fontSizes = [0.85, 1, 1.15, 1.3]

  useEffect(() => {
    document.querySelectorAll('.panel-body').forEach((el) => {
      ;(el as HTMLElement).style.zoom = String(fontScale)
    })
  }, [fontScale])

  const cycleFontSize = () => {
    const idx = fontSizes.indexOf(fontScale)
    setFontScale(fontSizes[(idx + 1) % fontSizes.length])
  }

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
      style={{ width: leftCollapsed ? 32 : leftWidth }}
    >
      <div className="panel-header">
        {!leftCollapsed && <span className="panel-header-title">PDF 阅读区</span>}
        <button
          className="panel-collapse-btn"
          onClick={() => setLeftCollapsed(!leftCollapsed)}
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
      style={{ width: rightCollapsed ? 32 : rightWidth }}
    >
      <div className="panel-header">
        <button
          className="panel-collapse-btn"
          onClick={() => setRightCollapsed(!rightCollapsed)}
        >
          {rightCollapsed ? '◀' : '▶'}
        </button>
        {!rightCollapsed && <span className="panel-header-title">AI 学习面板</span>}
      </div>
      {!rightCollapsed && (
        <div className="panel-body">
          {rightPanelBody()}
        </div>
      )}
    </aside>
  )

  function rightPanelBody() {
    if (activeTab === 'graph') {
      return <NodeDetailPanel node={selectedGraphNode} />
    }
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
        <div className={`stage-detail__meta stage-detail__meta--${selectedStage.status}`}>
          阶段 {selectedStage.order} · {statusText[selectedStage.status]}
        </div>
        <h3 className="stage-detail__title">{selectedStage.name}</h3>
        <p className="stage-detail__description"><MathText text={selectedStage.description} /></p>

        {selectedStage.status === 'not_started' && (
          <div className="stage-actions">
            <button className="stage-btn stage-btn--primary" onClick={() => enterStage(selectedStage.id)}>
              开始学习
            </button>
          </div>
        )}

        {(selectedStage.status === 'in_progress' || selectedStage.status === 'needs_review') && (
          <div className="stage-task-area">
            <div className="task-label">阶段任务</div>
            <p className="task-prompt"><MathText text={selectedStage.task} /></p>
            <textarea
              className="task-answer-input"
              placeholder="在此输入你的答案..."
              rows={4}
            />
            <div className="stage-actions">
              <button className="stage-btn stage-btn--primary" onClick={() => completeStage(selectedStage.id)}>
                标记完成
              </button>
              {selectedStage.status === 'in_progress' && (
                <button className="stage-btn stage-btn--secondary" onClick={() => markNeedsReview(selectedStage.id)}>
                  稍后复习
                </button>
              )}
            </div>
          </div>
        )}

        {selectedStage.status === 'completed' && (
          <div className="stage-completed">
            <div className="stage-completed__icon">✓</div>
            <p className="stage-completed__text">你已完成本阶段的学习</p>
            <div className="stage-actions">
              <button className="stage-btn stage-btn--secondary" onClick={() => updateStageStatus(selectedStage.id, 'in_progress')}>
                重新学习
              </button>
            </div>
          </div>
        )}
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
          setSelectedGraphNodeId(null)
        }}
        stages={stages}
        selectedStageId={selectedStageId}
        onSelectStage={setSelectedStageId}
        graph={graph}
        selectedGraphNodeId={selectedGraphNodeId}
        onSelectGraphNode={setSelectedGraphNodeId}
      />

      {!rightCollapsed && (
        <div className="resize-handle" onMouseDown={() => handleMouseDown('right')} />
      )}

      {rightPanel}

      <div className="font-size-control">
        <button className="font-size-btn" onClick={cycleFontSize} title="调整字体大小">
          A<span className="font-size-label">{Math.round(fontScale * 100)}%</span>
        </button>
      </div>
    </div>
  )
}

export default App
