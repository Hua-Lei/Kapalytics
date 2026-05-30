import { useState, useCallback, useEffect, useRef } from 'react'
import AppShell from './components/AppShell'
import SettingsModal from './components/SettingsModal'
import { electronApi } from './modules/ipc/electronApi'
import { initialWorkspaceState } from './domains/workspace/workspaceReducer'
import type { WorkspaceState } from './domains/workspace/types'
import { PersistenceGate } from './domains/persistence/PersistenceGate'
import { PaperProvider } from './domains/paper/PaperProvider'
import { StageProvider } from './domains/stages/StageProvider'
import { ExpansionProvider } from './domains/expansion/ExpansionProvider'
import { ExpansionPaperSyncBridge } from './domains/expansion/ExpansionPaperSyncBridge'
import { MemoryProvider } from './domains/memory/MemoryProvider'
import { WorkspaceProvider } from './domains/workspace/WorkspaceProvider'
import { buildStagesFromTasks } from './domains/stages/stageFramework'
import { useStages } from './domains/stages/useStages'
import { useWorkspace } from './domains/workspace/useWorkspace'

type ResizeTarget = 'left' | 'right' | null

const MIN_PANEL = 200
const DEFAULT_RIGHT = 340

function StageSyncBridge({ setStagesRef: ref }: { setStagesRef: React.MutableRefObject<((tasks: Record<string, string>) => void) | null> }) {
  const { setStages } = useStages()
  ref.current = (tasks: Record<string, string>) => {
    setStages(buildStagesFromTasks(tasks))
  }
  return null
}

function PaperWorkspaceBridge({
  children,
  setStagesRef
}: {
  children: React.ReactNode
  setStagesRef: React.MutableRefObject<((tasks: Record<string, string>) => void) | null>
}) {
  const { activateTab } = useWorkspace()

  return (
    <PaperProvider onAnalysisComplete={() => activateTab('paper_graph')} setStagesRef={setStagesRef}>
      {children}
    </PaperProvider>
  )
}

function App() {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>(initialWorkspaceState)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hasApiConfigured, setHasApiConfigured] = useState(false)
  const [proxyUrl, setProxyUrl] = useState('')
  const [fontScale, setFontScale] = useState(1)
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const workspaceStateReady = useRef(false)

  // Check API key status on mount
  useEffect(() => {
    electronApi.hasKey().then(setHasApiConfigured).catch(() => {})
    electronApi.getLlmConfig().then((config) => setProxyUrl(config.proxyUrl ?? '')).catch(() => {})
  }, [])

  const setStagesRef = useRef<((tasks: Record<string, string>) => void) | null>(null)

  // Auto-save workspace state when it changes (debounced, only after hydration)
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    if (!workspaceStateReady.current) return
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      electronApi.save({ workspaceState })
    }, 500)
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [workspaceState])

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

  const [, setLeftWidth] = useState(DEFAULT_RIGHT)
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

  const handleTestConnection = async (): Promise<{ ok: boolean; message: string }> => {
    try { return await electronApi.testConnection() } catch { return { ok: false, message: '连接测试失败' } }
  }

  const handleWorkspaceStateChange = useCallback((nextState: WorkspaceState) => {
    workspaceStateReady.current = true
    setWorkspaceState(nextState)
  }, [])

  const handlePersistenceLoad = useCallback((data: Record<string, unknown>) => {
    if (data.workspaceState && typeof data.workspaceState === 'object') {
      const ws = data.workspaceState as Record<string, unknown>
      if (typeof ws.activeTabId === 'string' && Array.isArray(ws.tabs)) {
        setWorkspaceState(data.workspaceState as WorkspaceState)
      }
    }
  }, [])

  return (
    <PersistenceGate onLoad={handlePersistenceLoad}>
      <WorkspaceProvider initialState={workspaceState} onStateChange={handleWorkspaceStateChange}>
        <PaperWorkspaceBridge setStagesRef={setStagesRef}>
          <StageProvider>
            <StageSyncBridge setStagesRef={setStagesRef} />
            <ExpansionProvider>
              <ExpansionPaperSyncBridge />
              <MemoryProvider>
                <div ref={containerRef} className="app-root">
                  <AppShell
                    fontScale={fontScale}
                    rightCollapsed={rightCollapsed}
                    rightWidth={rightWidth}
                    onCycleFontSize={cycleFontSize}
                    onMouseDownResize={() => handleMouseDown('right')}
                    onOpenSettings={() => setSettingsOpen(true)}
                    onToggleRight={() => setRightCollapsed(!rightCollapsed)}
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
              </MemoryProvider>
            </ExpansionProvider>
          </StageProvider>
        </PaperWorkspaceBridge>
      </WorkspaceProvider>
    </PersistenceGate>
  )
}

export default App
