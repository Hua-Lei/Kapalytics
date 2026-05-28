import { useState, useCallback, useEffect, useRef } from 'react'
import CenterPanel from './components/CenterPanel'
import NodeDetailPanel from './components/NodeDetailPanel'
import MathText from './components/MathText'
import PdfViewer from './components/PdfViewer'
import AppHeader from './components/AppHeader'
import SettingsModal from './components/SettingsModal'
import DiagnosisView from './components/DiagnosisView'
import { mockStages } from './mock/stages'
import { Stage } from './types'
import { diagnose } from './modules/diagnosis/diagnose'
import { electronApi } from './modules/ipc/electronApi'
import { usePaperAnalysis } from './modules/paper/usePaperAnalysis'
import type { DiagnosisResult } from './modules/diagnosis/types'
import type { KnowledgeGraph } from '../../shared/paper'
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

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [diagnosisResults, setDiagnosisResults] = useState<Record<string, DiagnosisResult>>({})
  const [diagnosedStageIds, setDiagnosedStageIds] = useState<Set<string>>(new Set())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hasApiConfigured, setHasApiConfigured] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null)
  const {
    analysisSteps,
    analyzePaper,
    generating,
    genError,
    genProgress,
    graph,
    pdfUrl,
    selectPdf,
    setGraph,
    setPdfUrl
  } = usePaperAnalysis({ setStages, setActiveTab, setSelectedGraphNodeId })
  const selectedGraphNode = graph.nodes.find((n) => n.id === selectedGraphNodeId) ?? null
  const [fontScale, setFontScale] = useState(1)

  // Check API key status on mount
  useEffect(() => {
    electronApi.hasKey().then(setHasApiConfigured).catch(() => {})
  }, [])

  function isValidSavedData(data: Record<string, unknown>): boolean {
    if (data.activeTab !== undefined && !['graph', 'learning'].includes(String(data.activeTab)))
      return false
    if (data.graph !== undefined && typeof data.graph === 'object') {
      const g = data.graph as Record<string, unknown>
      if (!Array.isArray(g.nodes) || !Array.isArray(g.edges)) return false
      const nodeIds = new Set((g.nodes as Array<{ id?: string }>).map((n) => n.id).filter(Boolean))
      for (const e of g.edges as Array<{ sourceId?: string; targetId?: string }>) {
        if (e.sourceId && !nodeIds.has(e.sourceId)) return false
        if (e.targetId && !nodeIds.has(e.targetId)) return false
      }
    }
    return true
  }

  // Load saved state on mount
  useEffect(() => {
    electronApi
      .load()
      .then((saved) => {
        if (saved && typeof saved === 'object') {
          const data = saved as Record<string, unknown>
          if (!isValidSavedData(data)) {
            console.warn('[App] Saved data failed validation, using defaults')
            return
          }
          if (Array.isArray(data.stages)) setStages(data.stages as Stage[])
          if (data.answers && typeof data.answers === 'object')
            setAnswers(data.answers as Record<string, string>)
          if (data.diagnosisResults && typeof data.diagnosisResults === 'object')
            setDiagnosisResults(data.diagnosisResults as Record<string, DiagnosisResult>)
          if (typeof data.pdfUrl === 'string') setPdfUrl(data.pdfUrl)
          if (typeof data.activeTab === 'string') setActiveTab(data.activeTab as ActiveTab)
          if (data.graph && typeof data.graph === 'object') setGraph(data.graph as KnowledgeGraph)
        }
      })
      .catch(() => {})
      .finally(() => setHydrated(true))
  }, [])

  // Auto-save when state changes (debounced, only after hydration)
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    if (!hydrated) return
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      electronApi.save({ stages, answers, diagnosisResults, pdfUrl, activeTab, graph })
    }, 500)
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [stages, answers, diagnosisResults, pdfUrl, activeTab, graph, hydrated])

  const enterStage = (stageId: string) => {
    updateStageStatus(stageId, 'in_progress')
    setDiagnosedStageIds((prev) => {
      const next = new Set(prev)
      next.delete(stageId)
      return next
    })
  }
  const submitAnswer = async (stageId: string) => {
    const answer = drafts[stageId] ?? ''
    setAnswers((prev) => ({ ...prev, [stageId]: answer }))

    let result: DiagnosisResult
    const stage = stages.find((s) => s.id === stageId)!
    try {
      const hasKey = await electronApi.hasKey()
      if (hasKey) {
        result = await electronApi.diagnose({
          stageId,
          stageName: stage.name,
          taskDescription: stage.task,
          userAnswer: answer
        })
      } else {
        throw new Error('no_api_key')
      }
    } catch {
      result = diagnose(stageId, answer)
    }

    setDiagnosisResults((prev) => ({ ...prev, [stageId]: result }))
    // Auto-mark needs_review on wrong answer
    if (!result.isCorrect) {
      setStages((prev) =>
        prev.map((s) => (s.id === stageId ? { ...s, status: 'needs_review' as const } : s))
      )
    }
    setDiagnosedStageIds((prev) => {
      const next = new Set(prev)
      next.add(stageId)
      return next
    })
  }
  const confirmDiagnosis = (stageId: string) => {
    setStages((prev) =>
      prev.map((s) =>
        s.id === stageId
          ? { ...s, status: 'completed' as const, mastery: Math.min(100, s.mastery + 20) }
          : s
      )
    )
    setDiagnosedStageIds((prev) => {
      const next = new Set(prev)
      next.delete(stageId)
      return next
    })
  }
  const retryStage = (stageId: string) => {
    setDiagnosedStageIds((prev) => {
      const next = new Set(prev)
      next.delete(stageId)
      return next
    })
  }
  const markNeedsReview = (stageId: string) => {
    const answer = drafts[stageId] ?? ''
    setAnswers((prev) => ({ ...prev, [stageId]: answer }))
    const result = diagnose(stageId, answer)
    setDiagnosisResults((prev) => ({ ...prev, [stageId]: result }))
    updateStageStatus(stageId, 'needs_review')
  }

  const fontSizes = [0.85, 1, 1.15, 1.3]

  useEffect(() => {
    document
      .querySelectorAll('.panel-center .panel-body, .panel-right .panel-body')
      .forEach((el) => {
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

  const handleSelectPdf = () => selectPdf().catch(() => {})

  const handleTestConnection = async (): Promise<boolean> => {
    try { return await electronApi.testConnection() } catch { return false }
  }

  const leftPanel = (
    <aside
      className={`panel panel-left ${leftCollapsed ? 'panel--collapsed' : ''}`}
      style={{ width: leftCollapsed ? 32 : leftWidth }}
    >
      <div className="panel-header">
        {!leftCollapsed && <span className="panel-header-title">PDF 阅读区</span>}
        <div className="panel-header-actions">
          {pdfUrl && !leftCollapsed && (
            <button className="panel-action-btn" onClick={handleSelectPdf} title="更换 PDF">
              更换
            </button>
          )}
          <button
            className="panel-collapse-btn"
            onClick={() => setLeftCollapsed(!leftCollapsed)}
          >
            {leftCollapsed ? '▶' : '◀'}
          </button>
        </div>
      </div>
      {!leftCollapsed && (
        <div className="panel-body">
          {pdfUrl ? (
            <PdfViewer pdfUrl={pdfUrl} />
          ) : (
            <div className="empty-state">
              <div className="upload-area">
                <p>上传论文 PDF 以开始学习</p>
                <button className="upload-btn" onClick={handleSelectPdf}>
                  选择 PDF 文件
                </button>
              </div>
            </div>
          )}
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
      if (selectedGraphNode) {
        return <NodeDetailPanel node={selectedGraphNode} />
      }
      return (
        <div className="panel-section">
          <div className="panel-section__header">
            <h3 className="panel-section__title">论文分析</h3>
            <span className="panel-section__hint">
              {pdfUrl
                ? '点击分析自动提取 PDF 文本并生成知识图谱和任务'
                : '请先在左侧上传 PDF 论文'}
            </span>
          </div>
          {pdfUrl && (
            <button
              className="stage-btn stage-btn--primary"
              onClick={analyzePaper}
              disabled={generating}
              style={{ width: '100%' }}
            >
              {generating ? '分析中...' : '开始分析论文'}
            </button>
          )}
          {genProgress && (
            <p className="gen-progress">{genProgress}</p>
          )}
          <div className="analysis-steps">
            {analysisSteps.map((step) => (
              <div key={step.id} className={`analysis-step analysis-step--${step.status}`}>
                <span className="analysis-step__dot" />
                <span>{step.label}</span>
              </div>
            ))}
          </div>
          {genError && <p className="gen-error">{genError}</p>}
        </div>
      )
    }
    if (!selectedStage) {
      const nextStage = stages.find(
        (s) => s.status === 'not_started' || s.status === 'needs_review'
      )
      return (
        <div className="empty-state">
          <div>
            <p>选择左侧学习阶段以查看详情</p>
            {nextStage && (
              <p style={{ marginTop: 12, fontSize: 12, color: 'var(--color-text-muted)' }}>
                推荐下一步：阶段 {nextStage.order} — {nextStage.name}
                {nextStage.status === 'needs_review' ? '（需复习）' : ''}
              </p>
            )}
          </div>
        </div>
      )
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
        <div className="mastery-bar">
          <div className="mastery-bar__fill" style={{ width: `${selectedStage.mastery}%` }} />
        </div>
        <p className="stage-detail__description"><MathText text={selectedStage.description} /></p>

        {selectedStage.status === 'not_started' && (
          <div className="stage-actions">
            <button className="stage-btn stage-btn--primary" onClick={() => enterStage(selectedStage.id)}>
              开始学习
            </button>
          </div>
        )}

        {(selectedStage.status === 'in_progress' || selectedStage.status === 'needs_review') && (
          <>
            {diagnosedStageIds.has(selectedStage.id) ? (
              <DiagnosisView
                result={diagnosisResults[selectedStage.id]}
                answer={answers[selectedStage.id] ?? ''}
                onRetry={() => retryStage(selectedStage.id)}
                onConfirm={() => confirmDiagnosis(selectedStage.id)}
              />
            ) : (
              <div className="stage-task-area">
                <div className="task-label">阶段任务</div>
                <p className="task-prompt"><MathText text={selectedStage.task} /></p>
                <textarea
                  className="task-answer-input"
                  placeholder="在此输入你的答案..."
                  rows={4}
                  value={drafts[selectedStage.id] ?? answers[selectedStage.id] ?? ''}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [selectedStage.id]: e.target.value }))
                  }
                />
                <div className="stage-actions">
                  <button className="stage-btn stage-btn--primary" onClick={() => submitAnswer(selectedStage.id)} disabled={!(drafts[selectedStage.id] ?? '').trim()}>
                    提交答案
                  </button>
                  {selectedStage.status === 'in_progress' && (
                    <button className="stage-btn stage-btn--secondary" onClick={() => markNeedsReview(selectedStage.id)} disabled={!(drafts[selectedStage.id] ?? '').trim()}>
                      稍后复习
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {selectedStage.status === 'completed' && (
          <div className="stage-completed">
            <div className="stage-completed__icon">✓</div>
            <p className="stage-completed__text">你已完成本阶段的学习</p>
            {answers[selectedStage.id] && (
              <div className="stage-answer-saved">
                <div className="task-label">你的回答</div>
                <p className="stage-answer-text">{answers[selectedStage.id]}</p>
              </div>
            )}
            <div className="stage-actions">
              <button className="stage-btn stage-btn--secondary" onClick={() => enterStage(selectedStage.id)}>
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
      <AppHeader
        fontScale={fontScale}
        onCycleFontSize={cycleFontSize}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div className="app-main">
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
      </div>

      <SettingsModal
        open={settingsOpen}
        hasApiConfigured={hasApiConfigured}
        onClose={() => setSettingsOpen(false)}
        onSaveKey={async (key) => {
          await electronApi.setKey(key)
          setHasApiConfigured(true)
        }}
        onClearKey={async () => {
          await electronApi.clearKey()
          setHasApiConfigured(false)
        }}
        onTestConnection={handleTestConnection}
      />
    </div>
  )
}

export default App
