import { useState, useCallback, useEffect, useRef, useReducer } from 'react'
import AppShell from './components/AppShell'
import SettingsModal from './components/SettingsModal'
import { mockStages } from './mock/stages'
import { Stage } from './types'
import { diagnose } from './modules/diagnosis/diagnose'
import { electronApi } from './modules/ipc/electronApi'
import { generateLearningReport, type LearningReport } from './modules/learning/report'
import { derivePaperInsight, sanitizeGraph } from './modules/paper/analysisState'
import { usePaperAnalysis } from './modules/paper/usePaperAnalysis'
import type { DiagnosisResult } from './modules/diagnosis/types'
import type { GraphNode, KnowledgeGraph, PaperInsight } from '../../shared/paper'
import type { ExpansionGraphNode, NodeUnderstandingMemory } from '../../shared/kg4'
import { initialWorkspaceState, workspaceReducer } from './domains/workspace/workspaceReducer'
import type { SelectedObject, WorkspaceState } from './domains/workspace/types'
import { createNodeExpansionSession, advanceExpansionStep, type NodeExpansionSession } from './modules/workspace/nodeExpansionSessions'
import { PersistenceGate } from './domains/persistence/PersistenceGate'
import { PaperProvider } from './domains/paper/PaperProvider'
import { StageProvider } from './domains/stages/StageProvider'
import { ExpansionProvider } from './domains/expansion/ExpansionProvider'
import { MemoryProvider } from './domains/memory/MemoryProvider'
import { WorkspaceProvider } from './domains/workspace/WorkspaceProvider'

type ResizeTarget = 'left' | 'right' | null

const MIN_PANEL = 200
const DEFAULT_LEFT = 280
const DEFAULT_RIGHT = 340
const STAGE_STATUSES = new Set<Stage['status']>(['not_started', 'in_progress', 'completed', 'needs_review'])

function normalizeSavedStages(value: unknown): Stage[] | undefined {
  if (!Array.isArray(value)) return undefined

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const saved = item as Partial<Stage>
      const fallback = mockStages.find((stage) => stage.id === saved.id) ?? mockStages[index]
      const id = typeof saved.id === 'string' ? saved.id : fallback?.id
      if (!id) return null

      return {
        ...(fallback ?? mockStages[0]),
        ...saved,
        id,
        order: typeof saved.order === 'number' ? saved.order : fallback?.order ?? index + 1,
        name: typeof saved.name === 'string' ? saved.name : fallback?.name ?? id,
        status: STAGE_STATUSES.has(saved.status as Stage['status'])
          ? saved.status as Stage['status']
          : fallback?.status ?? 'not_started',
        mastery: typeof saved.mastery === 'number' ? saved.mastery : fallback?.mastery ?? 0,
        description: typeof saved.description === 'string' ? saved.description : fallback?.description ?? '',
        task: typeof saved.task === 'string' ? saved.task : fallback?.task ?? ''
      }
    })
    .filter((stage): stage is Stage => Boolean(stage))
}

function App() {
  const [workspaceState, dispatchWorkspace] = useReducer(workspaceReducer, initialWorkspaceState)
  const [stages, setStages] = useState<Stage[]>(mockStages)
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)

  const updateStageStatus = (stageId: string, status: Stage['status']) => {
    setStages((prev) => prev.map((s) => (s.id === stageId ? { ...s, status } : s)))
  }

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [diagnosisResults, setDiagnosisResults] = useState<Record<string, DiagnosisResult>>({})
  const [diagnosedStageIds, setDiagnosedStageIds] = useState<Set<string>>(new Set())
  const [learningReport, setLearningReport] = useState<LearningReport | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hasApiConfigured, setHasApiConfigured] = useState(false)
  const [proxyUrl, setProxyUrl] = useState('')
  const [hydrated, setHydrated] = useState(false)

  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null)
  const [memories, setMemories] = useState<NodeUnderstandingMemory[]>([])
  const [nodeExpansionSessions, setNodeExpansionSessions] = useState<Record<string, NodeExpansionSession>>({})
  const paperInsightRef = useRef<PaperInsight | null>(null)
  const {
    analysisSteps,
    analyzePaper,
    generating,
    genError,
    genProgress,
    graph,
    paperInsight,
    pdfUrl,
    selectPdf,
    setGraph,
    setPaperInsight,
    setPdfUrl
  } = usePaperAnalysis({ setStages, onAnalysisComplete: () => dispatchWorkspace({ type: 'activate_tab', tabId: 'paper_graph' }), setSelectedGraphNodeId })
  const [fontScale, setFontScale] = useState(1)

  // Keep a ref to paperInsight so async expansion simulation doesn't capture stale value
  useEffect(() => { paperInsightRef.current = paperInsight }, [paperInsight])

  const selectWorkspaceObject = (selectedObject?: SelectedObject) => {
    dispatchWorkspace({ type: 'select_object', selectedObject })
  }

  // Check API key status on mount
  useEffect(() => {
    electronApi.hasKey().then(setHasApiConfigured).catch(() => {})
    electronApi.getLlmConfig().then((config) => setProxyUrl(config.proxyUrl ?? '')).catch(() => {})
  }, [])

  function isValidSavedData(data: Record<string, unknown>): boolean {
    // workspaceState is the new canonical tab state; old activeTab field is ignored
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
          const savedStages = normalizeSavedStages(data.stages)
          let savedGraph: KnowledgeGraph | null = null

          if (savedStages) setStages(savedStages)
          if (data.answers && typeof data.answers === 'object')
            setAnswers(data.answers as Record<string, string>)
          if (data.diagnosisResults && typeof data.diagnosisResults === 'object')
            setDiagnosisResults(data.diagnosisResults as Record<string, DiagnosisResult>)
          if (typeof data.pdfUrl === 'string') setPdfUrl(data.pdfUrl)
          if (data.workspaceState && typeof data.workspaceState === 'object') {
            const ws = data.workspaceState as Record<string, unknown>
            if (typeof ws.activeTabId === 'string' && Array.isArray(ws.tabs)) {
              dispatchWorkspace({ type: 'restore_state', state: data.workspaceState as WorkspaceState })
            }
          }
          if (data.graph && typeof data.graph === 'object') {
            savedGraph = sanitizeGraph(data.graph as KnowledgeGraph)
            setGraph(savedGraph)
          }
          if (data.paperInsight && typeof data.paperInsight === 'object') {
            setPaperInsight(data.paperInsight as PaperInsight)
          } else if (savedGraph) {
            setPaperInsight(derivePaperInsight(savedGraph, savedStages))
          }
          if (data.learningReport && typeof data.learningReport === 'object') {
            setLearningReport(data.learningReport as LearningReport)
          }
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
      electronApi.save({ stages, answers, diagnosisResults, learningReport, pdfUrl, workspaceState, graph, paperInsight })
    }, 500)
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [stages, answers, diagnosisResults, learningReport, pdfUrl, workspaceState, graph, paperInsight, hydrated])

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

  const [, setLeftWidth] = useState(DEFAULT_LEFT)
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT)
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

  const updateDraft = (stageId: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [stageId]: value }))
  }

  const handleTestConnection = async (): Promise<{ ok: boolean; message: string }> => {
    try { return await electronApi.testConnection() } catch { return { ok: false, message: '连接测试失败' } }
  }

  const generateReport = () => {
    setLearningReport(generateLearningReport(stages, diagnosisResults, answers))
  }

  const openNodeExpansion = (nodeId: string) => {
    const node = graph.nodes.find((item) => item.id === nodeId)
    if (!node) return
    const session = createNodeExpansionSession(node, paperInsight)
    setNodeExpansionSessions((prev) => ({ ...prev, [session.id]: session }))
    dispatchWorkspace({
      type: 'open_tab',
      tab: {
        id: session.id,
        type: 'node_expansion_loading',
        title: `Expand: ${node.label}`,
        nodeId: node.id,
        expansionId: session.id,
        closable: true,
        status: 'loading'
      }
    })
    // Simulate async step-by-step loading; each step advances after a short delay
    runExpansionSimulation(session.id, node)
  }

  const runExpansionSimulation = async (sessionId: string, node: GraphNode) => {
    const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
    // Advance through all steps
    for (let i = 0; i < 7; i++) {
      await delay(350 + Math.random() * 250) // 350-600ms per step
      setNodeExpansionSessions((prev) => {
        const current = prev[sessionId]
        if (!current || current.status !== 'loading') return prev
        const advanced = advanceExpansionStep(current, node, paperInsightRef.current)
        dispatchWorkspace({ type: 'update_tab_status', tabId: sessionId, status: advanced.status })
        return { ...prev, [sessionId]: advanced }
      })
    }
    // After loop, check final state and switch to expansion_graph tab if ready
    setNodeExpansionSessions((prev) => {
      const final = prev[sessionId]
      if (!final || final.status !== 'ready') return prev
      return prev
    })
    // Re-open the tab as expansion_graph so the router renders ExpansionGraphView
    dispatchWorkspace({
      type: 'open_tab',
      tab: {
        id: sessionId,
        type: 'expansion_graph',
        title: `Expand: ${node.label}`,
        nodeId: node.id,
        expansionId: sessionId,
        closable: true,
        status: 'ready'
      }
    })
  }

  const selectExpansionNode = (node: ExpansionGraphNode, expansionId: string) => {
    setNodeExpansionSessions((prev) => {
      const session = prev[expansionId]
      if (!session) return prev
      return { ...prev, [expansionId]: { ...session, selectedExpansionNodeId: node.id, updatedAt: new Date().toISOString() } }
    })
    dispatchWorkspace({ type: 'select_object', selectedObject: { type: 'expansion_node', id: node.id, expansionId } })
  }

  const selectMemoryRecord = (memory: NodeUnderstandingMemory) => {
    dispatchWorkspace({ type: 'select_object', selectedObject: { type: 'memory_record', id: memory.id } })
  }

  const openFieldMemory = () => {
    dispatchWorkspace({ type: 'activate_tab', tabId: 'field_memory' })
  }

  const clearActiveExpansionGraph = () => {
    const activeTab = workspaceState.tabs.find((tab) => tab.id === workspaceState.activeTabId)
    if (!activeTab?.expansionId) return
    setNodeExpansionSessions((prev) => {
      const session = prev[activeTab.expansionId!]
      if (!session) return prev
      return { ...prev, [activeTab.expansionId!]: { ...session, expansionGraph: undefined, selectedExpansionNodeId: undefined, updatedAt: new Date().toISOString() } }
    })
    dispatchWorkspace({ type: 'select_object', selectedObject: undefined })
    dispatchWorkspace({ type: 'update_tab_status', tabId: activeTab.id, status: 'empty' })
  }

  const openExpandView = (expansionId: string, nodeId: string) => {
    dispatchWorkspace({
      type: 'open_tab',
      tab: {
        id: `expand_view_${expansionId}_${nodeId}`,
        type: 'expand_view',
        title: 'Expand View',
        nodeId,
        expansionId,
        closable: true,
        status: 'idle'
      }
    })
  }

  const backToExpansionGraph = (expansionId: string) => {
    dispatchWorkspace({ type: 'activate_tab', tabId: expansionId })
  }

  const adoptTransferTask = (prompt: string) => {
    setStages((prev) =>
      prev.map((stage) =>
        stage.id === 'transfer_comparison'
          ? { ...stage, task: prompt, status: 'in_progress' as const }
          : stage
      )
    )
    setSelectedStageId('transfer_comparison')
    dispatchWorkspace({ type: 'activate_tab', tabId: 'stage_learning' })
  }

  return (
    <PersistenceGate onLoad={(data) => { /* restore logic stays in useEffect, unchanged */ }}>
      <PaperProvider onAnalysisComplete={() => dispatchWorkspace({ type: 'activate_tab', tabId: 'paper_graph' })}>
        <StageProvider>
          <ExpansionProvider>
            <MemoryProvider>
              <WorkspaceProvider>
                <div ref={containerRef} className="app-root">
                  <AppShell
        analysisSteps={analysisSteps}
        answers={answers}
        diagnosedStageIds={diagnosedStageIds}
        diagnosisResults={diagnosisResults}
        drafts={drafts}
        fontScale={fontScale}
        generating={generating}
        genError={genError}
        genProgress={genProgress}
        graph={graph}
        workspaceState={workspaceState}
        paperInsight={paperInsight}
        learningReport={learningReport}
        memories={memories}
        nodeExpansionSessions={nodeExpansionSessions}
        onAdoptTransferTask={adoptTransferTask}
        onAnalyzePaper={analyzePaper}
        onActivateWorkspaceTab={(tabId) => dispatchWorkspace({ type: 'activate_tab', tabId })}
        onBackToExpansionGraph={backToExpansionGraph}
        onCloseWorkspaceTab={(tabId) => dispatchWorkspace({ type: 'close_tab', tabId })}
        onConfirmDiagnosis={confirmDiagnosis}
        onCycleFontSize={cycleFontSize}
        onEnterStage={enterStage}
        onGenerateLearningReport={generateReport}
        onMemoriesLoaded={setMemories}
        onMarkNeedsReview={markNeedsReview}
        onOpenFieldMemory={openFieldMemory}
        onMouseDownResize={handleMouseDown}
        onOpenExpandView={openExpandView}
        onOpenNodeExpansion={openNodeExpansion}
        onOpenSettings={() => setSettingsOpen(true)}
        onRetryStage={retryStage}
        onClearExpansionGraph={clearActiveExpansionGraph}
        onSelectGraphNode={setSelectedGraphNodeId}
        onSelectExpansionNode={selectExpansionNode}
        onSelectMemory={selectMemoryRecord}
        onSelectObject={selectWorkspaceObject}
        onSelectPdf={handleSelectPdf}
        onSelectStage={setSelectedStageId}
        onSubmitAnswer={submitAnswer}
        onToggleRight={() => setRightCollapsed(!rightCollapsed)}
        onUpdateDraft={updateDraft}
        pdfUrl={pdfUrl}
        rightCollapsed={rightCollapsed}
        rightWidth={rightWidth}
        selectedGraphNodeId={selectedGraphNodeId}
        selectedMemoryId={workspaceState.selectedObject?.type === 'memory_record' ? workspaceState.selectedObject.id : undefined}
        selectedObject={workspaceState.selectedObject}
        selectedStageId={selectedStageId}
        stages={stages}
      />

      <SettingsModal
        open={settingsOpen}
        hasApiConfigured={hasApiConfigured}
        initialProxyUrl={proxyUrl}
        onClose={() => setSettingsOpen(false)}
        onSaveKey={async (key) => {
          await electronApi.setKey(key)
          setHasApiConfigured(true)
        }}
        onClearKey={async () => {
          await electronApi.clearKey()
          setHasApiConfigured(false)
        }}
        onSaveProxyUrl={async (nextProxyUrl) => {
          await electronApi.setProxyUrl(nextProxyUrl)
          setProxyUrl(nextProxyUrl ?? '')
        }}
        onTestConnection={handleTestConnection}
      />
    </div>
              </WorkspaceProvider>
            </MemoryProvider>
          </ExpansionProvider>
        </StageProvider>
      </PaperProvider>
    </PersistenceGate>
  )
}

export default App
