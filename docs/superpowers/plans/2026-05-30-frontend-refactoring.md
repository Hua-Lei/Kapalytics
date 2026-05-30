# Frontend Architecture Refactoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the frontend from a prop-drilling god-component architecture to a domain-driven architecture with React Context + custom hooks, enforcing max 250 lines per file, max 8 props per component, and zero business logic in components.

**Architecture:** 6 domains (Paper, Stage, Workspace, Expansion, Memory, Persistence) each with Provider + Hook. Components call hooks directly instead of receiving props. App.tsx becomes a thin provider tree (~50 lines). Cross-domain communication via consumer components calling multiple hooks.

**Tech Stack:** React 18 + TypeScript + Electron + Vite. No new dependencies.

---

### Task 1: Create domain types files

**Files:**
- Create: `src/renderer/src/domains/paper/types.ts`
- Create: `src/renderer/src/domains/stages/types.ts`
- Create: `src/renderer/src/domains/expansion/types.ts`
- Create: `src/renderer/src/domains/memory/types.ts`
- Create: `src/renderer/src/domains/persistence/types.ts`

- [ ] **Step 1: Create Paper domain types**

Create `src/renderer/src/domains/paper/types.ts`:
```ts
import type { AnalysisStep, KnowledgeGraph, PaperInsight } from '../../../shared/paper'

export interface PaperState {
  pdfUrl: string | null
  graph: KnowledgeGraph
  paperInsight: PaperInsight | null
  analysisSteps: AnalysisStep[]
  generating: boolean
  genError: string
  genProgress: string
}

export interface PaperActions {
  selectPdf: () => Promise<void>
  analyzePaper: () => Promise<void>
  setGraph: (graph: KnowledgeGraph) => void
  setPaperInsight: (insight: PaperInsight | null) => void
  setPdfUrl: (url: string | null) => void
}

export type PaperContextValue = PaperState & PaperActions
```

- [ ] **Step 2: Create Stage domain types**

Create `src/renderer/src/domains/stages/types.ts`:
```ts
import type { Stage } from '../../types'
import type { DiagnosisResult } from '../../modules/diagnosis/types'
import type { LearningReport } from '../../modules/learning/report'

export interface StageState {
  stages: Stage[]
  selectedStageId: string | null
  answers: Record<string, string>
  drafts: Record<string, string>
  diagnosisResults: Record<string, DiagnosisResult>
  diagnosedStageIds: Set<string>
  learningReport: LearningReport | null
}

export interface StageActions {
  selectStage: (id: string | null) => void
  enterStage: (id: string) => void
  submitAnswer: (id: string) => Promise<void>
  confirmDiagnosis: (id: string) => void
  retryStage: (id: string) => void
  markNeedsReview: (id: string) => void
  updateDraft: (id: string, value: string) => void
  generateReport: () => void
  setStages: React.Dispatch<React.SetStateAction<Stage[]>>
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setDiagnosisResults: React.Dispatch<React.SetStateAction<Record<string, DiagnosisResult>>>
}

export type StageContextValue = StageState & StageActions
```

- [ ] **Step 3: Create Expansion domain types**

Create `src/renderer/src/domains/expansion/types.ts`:
```ts
import type { GraphNode } from '../../../../shared/paper'
import type { ExpansionGraphNode } from '../../../../shared/kg4'
import type { NodeExpansionSession } from '../../modules/workspace/nodeExpansionSessions'

export interface ExpansionState {
  sessions: Record<string, NodeExpansionSession>
}

export interface ExpansionActions {
  startExpansion: (nodeId: string) => void
  selectExpansionNode: (node: ExpansionGraphNode, expansionId: string) => void
  clearExpansionGraph: (sessionId: string) => void
  setSessions: React.Dispatch<React.SetStateAction<Record<string, NodeExpansionSession>>>
}

export type ExpansionContextValue = ExpansionState & ExpansionActions
```

- [ ] **Step 4: Create Memory domain types**

Create `src/renderer/src/domains/memory/types.ts`:
```ts
import type { NodeUnderstandingMemory } from '../../../../shared/kg4'

export interface MemoryState {
  memories: NodeUnderstandingMemory[]
  loading: boolean
}

export interface MemoryActions {
  loadMemories: () => Promise<void>
  saveMemory: (memory: NodeUnderstandingMemory) => Promise<void>
  selectMemory: (memory: NodeUnderstandingMemory) => void
  setMemories: React.Dispatch<React.SetStateAction<NodeUnderstandingMemory[]>>
}

export type MemoryContextValue = MemoryState & MemoryActions
```

- [ ] **Step 5: Create Persistence types**

Create `src/renderer/src/domains/persistence/types.ts`:
```ts
import type { KnowledgeGraph, PaperInsight } from '../../../../shared/paper'
import type { Stage } from '../../types'
import type { DiagnosisResult } from '../../modules/diagnosis/types'
import type { LearningReport } from '../../modules/learning/report'
import type { WorkspaceState } from '../../modules/workspace/types'

export interface SavePayload {
  stages: Stage[]
  answers: Record<string, string>
  diagnosisResults: Record<string, DiagnosisResult>
  learningReport: LearningReport | null
  pdfUrl: string | null
  workspaceState: WorkspaceState
  graph: KnowledgeGraph
  paperInsight: PaperInsight | null
}

export interface PersistenceContextValue {
  hydrated: boolean
  save: (payload: SavePayload) => void
  load: () => Promise<Partial<SavePayload>>
}
```

- [ ] **Step 6: Verify types compile**

Run: `npx tsc --noEmit --pretty`
Expected: clean output (these are new files, no imports yet, should compile)

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/domains/
git commit -m "feat: add domain types for paper, stage, expansion, memory, persistence"
```

---

### Task 2: Create WorkspaceProvider and useWorkspace

**Files:**
- Create: `src/renderer/src/domains/workspace/WorkspaceProvider.tsx`
- Create: `src/renderer/src/domains/workspace/useWorkspace.ts`
- Move: `src/renderer/src/modules/workspace/types.ts` → `src/renderer/src/domains/workspace/types.ts`
- Move: `src/renderer/src/modules/workspace/workspaceReducer.ts` → `src/renderer/src/domains/workspace/workspaceReducer.ts`
- Move: `src/renderer/src/modules/workspace/defaultTabs.ts` → `src/renderer/src/domains/workspace/defaultTabs.ts`
- Modify: `src/renderer/src/App.tsx` — update import paths

- [ ] **Step 1: Move workspace module files to domains/workspace/**

```bash
mkdir -p src/renderer/src/domains/workspace
cp src/renderer/src/modules/workspace/types.ts src/renderer/src/domains/workspace/types.ts
cp src/renderer/src/modules/workspace/workspaceReducer.ts src/renderer/src/domains/workspace/workspaceReducer.ts
cp src/renderer/src/modules/workspace/defaultTabs.ts src/renderer/src/domains/workspace/defaultTabs.ts
```

- [ ] **Step 2: Update import paths in moved files**

In `domains/workspace/workspaceReducer.ts`, update import:
```ts
// Change from: import { defaultWorkspaceTabs } from './defaultTabs'
// Change from: import type { SelectedObject, WorkspaceState, WorkspaceTab } from './types'
// Keep same (relative paths still work since files are co-located)
```

No change needed — relative imports within the same directory still resolve correctly.

- [ ] **Step 3: Create useWorkspace hook**

Create `src/renderer/src/domains/workspace/useWorkspace.ts`:
```ts
import { useContext } from 'react'
import { WorkspaceContext } from './WorkspaceProvider'
import type { WorkspaceContextValue } from './WorkspaceProvider'

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}
```

- [ ] **Step 4: Create WorkspaceProvider**

Create `src/renderer/src/domains/workspace/WorkspaceProvider.tsx`:
```tsx
import { createContext, useCallback, useReducer, type ReactNode } from 'react'
import { initialWorkspaceState, workspaceReducer } from './workspaceReducer'
import type { WorkspaceAction } from './workspaceReducer'
import type { SelectedObject, WorkspaceState, WorkspaceTab } from './types'

export interface WorkspaceContextValue {
  state: WorkspaceState
  activeTab: WorkspaceTab | undefined
  openTab: (tab: WorkspaceTab) => void
  closeTab: (tabId: string) => void
  activateTab: (tabId: string) => void
  selectObject: (obj?: SelectedObject) => void
  updateTabStatus: (tabId: string, status: WorkspaceTab['status']) => void
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, initialWorkspaceState)

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId)

  const openTab = useCallback((tab: WorkspaceTab) => {
    dispatch({ type: 'open_tab', tab })
  }, [])

  const closeTab = useCallback((tabId: string) => {
    dispatch({ type: 'close_tab', tabId })
  }, [])

  const activateTab = useCallback((tabId: string) => {
    dispatch({ type: 'activate_tab', tabId })
  }, [])

  const selectObject = useCallback((obj?: SelectedObject) => {
    dispatch({ type: 'select_object', selectedObject: obj })
  }, [])

  const updateTabStatus = useCallback((tabId: string, status: WorkspaceTab['status']) => {
    dispatch({ type: 'update_tab_status', tabId, status })
  }, [])

  return (
    <WorkspaceContext.Provider value={{ state, activeTab, openTab, closeTab, activateTab, selectObject, updateTabStatus }}>
      {children}
    </WorkspaceContext.Provider>
  )
}
```

- [ ] **Step 5: Update all imports that reference modules/workspace/**

Find and update files referencing `modules/workspace/`:
```bash
grep -rn "modules/workspace" src/renderer/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

Update these imports from `../modules/workspace/types` to `../domains/workspace/types` (or appropriate relative path).

Files to update:
- `src/renderer/src/App.tsx` — change to `./domains/workspace/...`
- `src/renderer/src/components/AppShell.tsx`
- `src/renderer/src/components/WorkspaceSidebar.tsx`
- `src/renderer/src/components/CentralWorkspaceRouter.tsx`
- `src/renderer/src/components/AIContextPanel.tsx`
- `src/renderer/src/components/ExpandView.tsx`
- `src/renderer/src/components/ExpansionGraphView.tsx`
- `src/renderer/src/components/ExpansionLoadingView.tsx`
- `src/renderer/src/components/FieldMemoryView.tsx`

- [ ] **Step 6: Verify typecheck**

Run: `npx tsc --noEmit --pretty`
Expected: clean output, zero errors

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: `✓ built`

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/domains/workspace/
git add -u src/renderer/src/modules/workspace/
git add src/renderer/src/App.tsx src/renderer/src/components/
git commit -m "feat: move workspace module to domains/workspace with Provider + useWorkspace hook"
```

---

### Task 3: Create PaperProvider and usePaper

**Files:**
- Create: `src/renderer/src/domains/paper/PaperProvider.tsx`
- Create: `src/renderer/src/domains/paper/usePaper.ts`
- Create: `src/renderer/src/domains/paper/usePaperAnalysis.ts` (move + refactor from modules/)

- [ ] **Step 1: Move usePaperAnalysis to domains/paper/**

```bash
cp src/renderer/src/modules/paper/usePaperAnalysis.ts src/renderer/src/domains/paper/usePaperAnalysis.ts
```

Update import paths in the copied file to match the new location (adjust relative paths for shared types).

- [ ] **Step 2: Create PaperProvider**

Create `src/renderer/src/domains/paper/PaperProvider.tsx`:
```tsx
import { createContext, useCallback, useState, type ReactNode } from 'react'
import type { AnalysisStep, KnowledgeGraph, PaperInsight } from '../../../../shared/paper'
import { EMPTY_GRAPH, INITIAL_ANALYSIS_STEPS } from '../../modules/paper/analysisState'
import { usePaperAnalysis } from './usePaperAnalysis'
import type { PaperContextValue } from './types'

export const PaperContext = createContext<PaperContextValue | null>(null)

export function PaperProvider({ children, onAnalysisComplete }: { children: ReactNode; onAnalysisComplete: () => void }) {
  const {
    analysisSteps, analyzePaper, generating, genError, genProgress,
    graph, paperInsight, pdfUrl, selectPdf, setGraph, setPaperInsight, setPdfUrl
  } = usePaperAnalysis({
    setStages: () => {}, // Will be wired in Phase 2 via callback
    onAnalysisComplete,
    setSelectedGraphNodeId: () => {} // Will be wired in Phase 2 via callback
  })

  return (
    <PaperContext.Provider value={{
      pdfUrl, graph, paperInsight, analysisSteps, generating, genError, genProgress,
      selectPdf, analyzePaper, setGraph, setPaperInsight, setPdfUrl
    }}>
      {children}
    </PaperContext.Provider>
  )
}
```

- [ ] **Step 3: Create usePaper hook**

Create `src/renderer/src/domains/paper/usePaper.ts`:
```ts
import { useContext } from 'react'
import { PaperContext } from './PaperProvider'
import type { PaperContextValue } from './types'

export function usePaper(): PaperContextValue {
  const ctx = useContext(PaperContext)
  if (!ctx) throw new Error('usePaper must be used within PaperProvider')
  return ctx
}
```

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit --pretty`
Expected: clean output

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/domains/paper/
git add -u src/renderer/src/modules/paper/
git commit -m "feat: add PaperProvider and usePaper hook"
```

---

### Task 4: Create StageProvider and useStages

**Files:**
- Create: `src/renderer/src/domains/stages/StageProvider.tsx`
- Create: `src/renderer/src/domains/stages/useStages.ts`

- [ ] **Step 1: Create StageProvider**

Create `src/renderer/src/domains/stages/StageProvider.tsx`:
```tsx
import { createContext, useCallback, useState, type ReactNode } from 'react'
import { mockStages } from '../../mock/stages'
import { diagnose } from '../../modules/diagnosis/diagnose'
import { electronApi } from '../../modules/ipc/electronApi'
import { generateLearningReport } from '../../modules/learning/report'
import type { Stage } from '../../types'
import type { DiagnosisResult } from '../../modules/diagnosis/types'
import type { LearningReport } from '../../modules/learning/report'
import type { StageContextValue } from './types'

export const StageContext = createContext<StageContextValue | null>(null)

export function StageProvider({ children }: { children: ReactNode }) {
  const [stages, setStages] = useState<Stage[]>(mockStages)
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [diagnosisResults, setDiagnosisResults] = useState<Record<string, DiagnosisResult>>({})
  const [diagnosedStageIds, setDiagnosedStageIds] = useState<Set<string>>(new Set())
  const [learningReport, setLearningReport] = useState<LearningReport | null>(null)

  const selectStage = useCallback((id: string | null) => setSelectedStageId(id), [])

  const enterStage = useCallback((id: string) => {
    setStages((prev) => prev.map((s) => s.id === id ? { ...s, status: 'in_progress' as const } : s))
    setDiagnosedStageIds((prev) => { const next = new Set(prev); next.delete(id); return next })
  }, [])

  const submitAnswer = useCallback(async (id: string) => {
    const answer = drafts[id] ?? ''
    setAnswers((prev) => ({ ...prev, [id]: answer }))
    const stage = stages.find((s) => s.id === id)!
    let result: DiagnosisResult
    try {
      const hasKey = await electronApi.hasKey()
      result = hasKey
        ? await electronApi.diagnose({ stageId: id, stageName: stage.name, taskDescription: stage.task, userAnswer: answer })
        : diagnose(id, answer)
    } catch {
      result = diagnose(id, answer)
    }
    setDiagnosisResults((prev) => ({ ...prev, [id]: result }))
    if (!result.isCorrect) {
      setStages((prev) => prev.map((s) => s.id === id ? { ...s, status: 'needs_review' as const } : s))
    }
    setDiagnosedStageIds((prev) => { const next = new Set(prev); next.add(id); return next })
  }, [drafts, stages])

  const confirmDiagnosis = useCallback((id: string) => {
    setStages((prev) => prev.map((s) =>
      s.id === id ? { ...s, status: 'completed' as const, mastery: Math.min(100, s.mastery + 20) } : s
    ))
    setDiagnosedStageIds((prev) => { const next = new Set(prev); next.delete(id); return next })
  }, [])

  const retryStage = useCallback((id: string) => {
    setDiagnosedStageIds((prev) => { const next = new Set(prev); next.delete(id); return next })
  }, [])

  const markNeedsReview = useCallback((id: string) => {
    const answer = drafts[id] ?? ''
    setAnswers((prev) => ({ ...prev, [id]: answer }))
    const result = diagnose(id, answer)
    setDiagnosisResults((prev) => ({ ...prev, [id]: result }))
    setStages((prev) => prev.map((s) => s.id === id ? { ...s, status: 'needs_review' as const } : s))
  }, [drafts])

  const updateDraft = useCallback((id: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [id]: value }))
  }, [])

  const generateReport = useCallback(() => {
    setLearningReport(generateLearningReport(stages, diagnosisResults, answers))
  }, [stages, diagnosisResults, answers])

  return (
    <StageContext.Provider value={{
      stages, selectedStageId, answers, drafts, diagnosisResults, diagnosedStageIds, learningReport,
      selectStage, enterStage, submitAnswer, confirmDiagnosis, retryStage, markNeedsReview, updateDraft, generateReport,
      setStages, setAnswers, setDiagnosisResults
    }}>
      {children}
    </StageContext.Provider>
  )
}
```

- [ ] **Step 2: Create useStages hook**

Create `src/renderer/src/domains/stages/useStages.ts`:
```ts
import { useContext } from 'react'
import { StageContext } from './StageProvider'
import type { StageContextValue } from './types'

export function useStages(): StageContextValue {
  const ctx = useContext(StageContext)
  if (!ctx) throw new Error('useStages must be used within StageProvider')
  return ctx
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit --pretty`
Expected: clean output

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/domains/stages/
git commit -m "feat: add StageProvider and useStages hook"
```

---

### Task 5: Create ExpansionProvider + MemoryProvider + PersistenceGate

**Files:**
- Create: `src/renderer/src/domains/expansion/ExpansionProvider.tsx`
- Create: `src/renderer/src/domains/expansion/useExpansion.ts`
- Move: `src/renderer/src/modules/workspace/nodeExpansionSessions.ts` → `src/renderer/src/domains/expansion/nodeExpansionSessions.ts`
- Create: `src/renderer/src/domains/memory/MemoryProvider.tsx`
- Create: `src/renderer/src/domains/memory/useMemories.ts`
- Create: `src/renderer/src/domains/persistence/PersistenceGate.tsx`
- Create: `src/renderer/src/domains/persistence/usePersistence.ts`

- [ ] **Step 1: Create ExpansionProvider**

Create `src/renderer/src/domains/expansion/ExpansionProvider.tsx`:
```tsx
import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { GraphNode, PaperInsight } from '../../../../shared/paper'
import type { ExpansionGraphNode } from '../../../../shared/kg4'
import { createNodeExpansionSession, advanceExpansionStep, type NodeExpansionSession } from './nodeExpansionSessions'
import type { ExpansionContextValue } from './types'

export const ExpansionContext = createContext<ExpansionContextValue | null>(null)

export function ExpansionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Record<string, NodeExpansionSession>>({})
  const graphRef = useRef<GraphNode[]>([])
  const paperInsightRef = useRef<PaperInsight | null>(null)

  // These refs are set by the consumer (via PaperProvider data)
  const setGraphNodes = useCallback((nodes: GraphNode[]) => { graphRef.current = nodes }, [])
  const setPaperInsightRef = useCallback((pi: PaperInsight | null) => { paperInsightRef.current = pi }, [])

  const startExpansion = useCallback((nodeId: string) => {
    const node = graphRef.current.find((n) => n.id === nodeId)
    if (!node) return
    const session = createNodeExpansionSession(node, paperInsightRef.current)
    setSessions((prev) => ({ ...prev, [session.id]: session }))
    return session.id
  }, [])

  const selectExpansionNode = useCallback((node: ExpansionGraphNode, expansionId: string) => {
    setSessions((prev) => {
      const s = prev[expansionId]
      if (!s) return prev
      return { ...prev, [expansionId]: { ...s, selectedExpansionNodeId: node.id, updatedAt: new Date().toISOString() } }
    })
  }, [])

  const clearExpansionGraph = useCallback((sessionId: string) => {
    setSessions((prev) => {
      const s = prev[sessionId]
      if (!s) return prev
      return { ...prev, [sessionId]: { ...s, expansionGraph: undefined, selectedExpansionNodeId: undefined, updatedAt: new Date().toISOString() } }
    })
  }, [])

  return (
    <ExpansionContext.Provider value={{ sessions, setSessions, startExpansion, selectExpansionNode, clearExpansionGraph, setGraphNodes, setPaperInsightRef }}>
      {children}
    </ExpansionContext.Provider>
  )
}
```

- [ ] **Step 2: Create useExpansion hook**

Create `src/renderer/src/domains/expansion/useExpansion.ts`:
```ts
import { useContext } from 'react'
import { ExpansionContext } from './ExpansionProvider'
import type { ExpansionContextValue } from './types'

export function useExpansion(): ExpansionContextValue {
  const ctx = useContext(ExpansionContext)
  if (!ctx) throw new Error('useExpansion must be used within ExpansionProvider')
  return ctx
}
```

- [ ] **Step 3: Copy nodeExpansionSessions to domains/expansion/**

```bash
cp src/renderer/src/modules/workspace/nodeExpansionSessions.ts src/renderer/src/domains/expansion/nodeExpansionSessions.ts
```

Update import paths in the copied file for the kg4Workbench reference (adjust relative paths from `../learning/kg4Workbench` to `../../modules/learning/kg4Workbench`).

- [ ] **Step 4: Create MemoryProvider**

Create `src/renderer/src/domains/memory/MemoryProvider.tsx`:
```tsx
import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { electronApi } from '../../modules/ipc/electronApi'
import type { NodeUnderstandingMemory } from '../../../../shared/kg4'
import type { MemoryContextValue } from './types'

export const MemoryContext = createContext<MemoryContextValue | null>(null)

export function MemoryProvider({ children }: { children: ReactNode }) {
  const [memories, setMemories] = useState<NodeUnderstandingMemory[]>([])
  const [loading, setLoading] = useState(false)

  const loadMemories = useCallback(async () => {
    setLoading(true)
    try {
      const result = await electronApi.kg4.listNodeUnderstandingMemories({ limit: 100 })
      setMemories(result)
    } catch {
      setMemories([])
    } finally {
      setLoading(false)
    }
  }, [])

  const saveMemory = useCallback(async (memory: NodeUnderstandingMemory) => {
    await electronApi.kg4.saveNodeUnderstandingMemory(memory)
    await loadMemories() // refresh
  }, [loadMemories])

  const selectMemory = useCallback((memory: NodeUnderstandingMemory) => {
    // The consumer component (FieldMemoryView) calls both useMemories() and useWorkspace()
    // and wires them: selectMemory(memory) then useWorkspace().selectObject({type:'memory_record', id: memory.id})
  }, [])

  useEffect(() => { loadMemories() }, [loadMemories])

  return (
    <MemoryContext.Provider value={{ memories, loading, loadMemories, saveMemory, selectMemory, setMemories }}>
      {children}
    </MemoryContext.Provider>
  )
}
```

- [ ] **Step 5: Create useMemories hook**

Create `src/renderer/src/domains/memory/useMemories.ts`:
```ts
import { useContext } from 'react'
import { MemoryContext } from './MemoryProvider'
import type { MemoryContextValue } from './types'

export function useMemories(): MemoryContextValue {
  const ctx = useContext(MemoryContext)
  if (!ctx) throw new Error('useMemories must be used within MemoryProvider')
  return ctx
}
```

- [ ] **Step 6: Create PersistenceGate**

Create `src/renderer/src/domains/persistence/PersistenceGate.tsx`:
```tsx
import { useEffect, useState, type ReactNode } from 'react'
import { electronApi } from '../../modules/ipc/electronApi'
import { initialWorkspaceState } from '../workspace/workspaceReducer'
import type { WorkspaceState } from '../workspace/types'

interface PersistenceGateProps {
  children: ReactNode
  onLoad: (data: Record<string, unknown>) => void
}

export function PersistenceGate({ children, onLoad }: PersistenceGateProps) {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    electronApi.load()
      .then((saved) => {
        if (saved && typeof saved === 'object') {
          onLoad(saved as Record<string, unknown>)
        }
      })
      .catch(() => {})
      .finally(() => setHydrated(true))
  }, [])

  if (!hydrated) {
    return (
      <div className="app-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="workspace-placeholder-view" style={{ textAlign: 'center' }}>
          <h2>Kapalytics</h2>
          <p>Loading saved state...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
```

- [ ] **Step 7: Create usePersistence hook**

Create `src/renderer/src/domains/persistence/usePersistence.ts`:
```ts
import { useEffect, useRef } from 'react'
import { electronApi } from '../../modules/ipc/electronApi'
import type { SavePayload } from './types'

export function usePersistence(payload: SavePayload, hydrated: boolean) {
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!hydrated) return
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      electronApi.save(payload)
    }, 500)
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [payload, hydrated])
}
```

- [ ] **Step 8: Verify typecheck**

Run: `npx tsc --noEmit --pretty`
Expected: clean output

- [ ] **Step 9: Commit**

```bash
git add src/renderer/src/domains/expansion/ src/renderer/src/domains/memory/ src/renderer/src/domains/persistence/
git commit -m "feat: add ExpansionProvider, MemoryProvider, PersistenceGate, and usePersistence hook"
```

---

### Task 6: Rewire App.tsx to use provider tree

**Files:**
- Modify: `src/renderer/src/App.tsx` — replace all state with provider tree
- Modify: `src/renderer/src/main.tsx` — wrap with providers

- [ ] **Step 1: Rewrite main.tsx to wrap with providers**

Read current `src/renderer/src/main.tsx`, then replace with:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/layout.css'
import './styles/panels.css'
import './styles/graph.css'
import './styles/learning.css'
import './styles/pdf.css'
import './styles/controls.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

The providers are now in App.tsx, not main.tsx.

- [ ] **Step 2: Rewrite App.tsx — Phase 1 minimal version**

At this stage, App.tsx becomes the provider tree wrapper. The old state is still inside the providers but App.tsx itself shrinks dramatically.

```tsx
import { useCallback, useMemo, useState } from 'react'
import AppShell from './components/shell/AppShell'
import SettingsModal from './components/shared/SettingsModal'
import { PersistenceGate } from './domains/persistence/PersistenceGate'
import { PaperProvider } from './domains/paper/PaperProvider'
import { StageProvider } from './domains/stages/StageProvider'
import { ExpansionProvider } from './domains/expansion/ExpansionProvider'
import { MemoryProvider } from './domains/memory/MemoryProvider'
import { WorkspaceProvider } from './domains/workspace/WorkspaceProvider'

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const handleLoad = useCallback((_data: Record<string, unknown>) => {
    // Will restore state in Phase 2
  }, [])

  return (
    <PersistenceGate onLoad={handleLoad}>
      <PaperProvider onAnalysisComplete={() => {}}>
        <StageProvider>
          <ExpansionProvider>
            <MemoryProvider>
              <WorkspaceProvider>
                <AppShell onOpenSettings={() => setSettingsOpen(true)} />
                <SettingsModal
                  open={settingsOpen}
                  onClose={() => setSettingsOpen(false)}
                />
              </WorkspaceProvider>
            </MemoryProvider>
          </ExpansionProvider>
        </StageProvider>
      </PaperProvider>
    </PersistenceGate>
  )
}

export default App
```

- [ ] **Step 3: Update AppShell to accept minimal props**

`AppShell` now only needs layout-related props. It calls hooks internally for data.

Create `src/renderer/src/components/shell/AppShell.tsx` (move existing, then strip):
```tsx
import TopBar from './TopBar'
import WorkspaceSidebar from './WorkspaceSidebar'
import WorkspaceRouter from '../workspace/WorkspaceRouter'
import AIContextPanel from '../ai-panel/AIContextPanel'
import { useWorkspace } from '../../domains/workspace/useWorkspace'

interface AppShellProps {
  onOpenSettings: () => void
}

function AppShell({ onOpenSettings }: AppShellProps) {
  const { state, activeTab } = useWorkspace()

  return (
    <div className="app-container workspace-shell">
      <TopBar activeTab={activeTab} onOpenSettings={onOpenSettings} />
      <div className="workspace-main" style={{ gridTemplateColumns: `190px minmax(0, 1fr) minmax(260px, 340px)` }}>
        <WorkspaceSidebar />
        <WorkspaceRouter />
        <AIContextPanel />
      </div>
    </div>
  )
}

export default AppShell
```

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit --pretty`
Expected: clean output (may have warnings about unused old code — that's fine for now)

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: `✓ built`

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/App.tsx src/renderer/src/main.tsx
git add src/renderer/src/components/shell/
git commit -m "refactor: rewire App.tsx to provider tree, simplify AppShell to 4 props"
```

---

### Task 7: Update TopBar and WorkspaceSidebar to use hooks

**Files:**
- Modify: `src/renderer/src/components/shell/TopBar.tsx` — use useWorkspace, usePaper
- Modify: `src/renderer/src/components/shell/WorkspaceSidebar.tsx` — use useWorkspace

- [ ] **Step 1: Update TopBar to use hooks instead of props**

Move existing TopBar to `components/shell/` and update:
```tsx
import { useWorkspace } from '../../domains/workspace/useWorkspace'
import { usePaper } from '../../domains/paper/usePaper'

interface TopBarProps {
  onOpenSettings: () => void
}

function TopBar({ onOpenSettings }: TopBarProps) {
  const { activeTab } = useWorkspace()
  const { pdfUrl, graph } = usePaper()
  const hasPdf = Boolean(pdfUrl)
  const hasGraph = graph.nodes.length > 0

  return (
    <header className="workspace-topbar">
      <div className="workspace-topbar__brand">
        <span className="workspace-topbar__logo">Kapalytics</span>
        <span className="workspace-topbar__subtitle">Multi-workspace research desk</span>
      </div>
      <div className="workspace-topbar__current">
        <span>Workspace</span>
        <strong>{activeTab?.title ?? 'Paper Graph'}</strong>
      </div>
      <div className="workspace-topbar__status">
        <span className={`status-pill ${hasPdf ? 'status-pill--ready' : ''}`}>{hasPdf ? 'PDF 已载入' : '等待 PDF'}</span>
        <span className={`status-pill ${hasGraph ? 'status-pill--ready' : ''}`}>{hasGraph ? '图谱已生成' : '未分析'}</span>
        <button className="header-btn header-btn--settings" onClick={onOpenSettings} title="设置">设置</button>
      </div>
    </header>
  )
}

export default TopBar
```

- [ ] **Step 2: Update WorkspaceSidebar to use hooks**

Move to `components/shell/` and update:
```tsx
import { useWorkspace } from '../../domains/workspace/useWorkspace'

const WORKSPACE_DESCRIPTIONS: Record<string, string> = { /* same as before */ }

function WorkspaceSidebar() {
  const { state, activateTab, closeTab } = useWorkspace()
  const coreTabs = state.tabs.filter((t) => !t.closable)
  const sessionTabs = state.tabs.filter((t) => t.closable)

  return (/* same JSX as before, using activateTab/closeTab from hook */)
}

export default WorkspaceSidebar
```

- [ ] **Step 3: Verify typecheck + build**

Run: `npx tsc --noEmit --pretty && npm run build`
Expected: clean + `✓ built`

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/shell/
git commit -m "refactor: update TopBar and WorkspaceSidebar to use hooks, no prop drilling"
```

---

### Task 8: Create WorkspaceRouter and update workspace views

**Files:**
- Create: `src/renderer/src/components/workspace/WorkspaceRouter.tsx`
- Create: `src/renderer/src/components/workspace/PaperGraphView.tsx`
- Create: `src/renderer/src/components/workspace/StageLearningView.tsx`
- Modify: `src/renderer/src/components/AIContextPanel.tsx` → `src/renderer/src/components/ai-panel/AIContextPanel.tsx`

- [ ] **Step 1: Create WorkspaceRouter**

Create `src/renderer/src/components/workspace/WorkspaceRouter.tsx`:
```tsx
import { useWorkspace } from '../../domains/workspace/useWorkspace'
import PaperGraphView from './PaperGraphView'
import ArgumentChainView from './ArgumentChainView'
import MethodMechanismView from './MethodMechanismView'
import PdfReaderWorkspace from './PdfReaderWorkspace'
import StageLearningView from './StageLearningView'
import FieldMemoryView from './FieldMemoryView'
import ExpansionLoadingView from './expansion/ExpansionLoadingView'
import ExpansionGraphView from './expansion/ExpansionGraphView'
import ExpandView from './expansion/ExpandView'

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
      </div>
    </main>
  )
}

export default WorkspaceRouter
```

- [ ] **Step 2: Create PaperGraphView**

Create `src/renderer/src/components/workspace/PaperGraphView.tsx`:
```tsx
import { usePaper } from '../../domains/paper/usePaper'
import { useWorkspace } from '../../domains/workspace/useWorkspace'
import KnowledgeGraph from './KnowledgeGraph'

function PaperGraphView() {
  const { graph, paperInsight } = usePaper()
  const { state } = useWorkspace()
  const selectedNodeId = state.selectedObject?.type === 'graph_node' ? state.selectedObject.id : null

  if (graph.nodes.length === 0) {
    return (
      <div className="graph-empty-state">
        <span className="eyebrow">Knowledge Map</span>
        <h2>上传并分析论文后生成理解地图</h2>
        <p>核心概念、方法、公式、实验和局限会在这里组成可交互图谱。</p>
      </div>
    )
  }

  return (
    <KnowledgeGraph
      graph={graph}
      paperInsight={paperInsight}
      selectedNodeId={selectedNodeId}
      view="argument"
    />
  )
}

export default PaperGraphView
```

- [ ] **Step 3: Create StageLearningView**

Create `src/renderer/src/components/workspace/StageLearningView.tsx`:
```tsx
import { useStages } from '../../domains/stages/useStages'
import LearningPath from '../shared/LearningPath'
import StageDetail from '../shared/StageDetail'

function StageLearningView() {
  const {
    stages, selectedStageId, selectStage, answers, diagnosedStageIds,
    diagnosisResults, drafts, enterStage, submitAnswer, confirmDiagnosis,
    retryStage, markNeedsReview, updateDraft
  } = useStages()

  const selectedStage = stages.find((s) => s.id === selectedStageId) ?? null

  return (
    <div className="stage-learning-workspace">
      <div className="stage-learning-workspace__path">
        <LearningPath stages={stages} selectedStageId={selectedStageId} onSelectStage={selectStage} />
      </div>
      <div className="stage-learning-workspace__detail">
        {selectedStage ? (
          <StageDetail
            answer={answers[selectedStage.id] ?? ''}
            diagnosed={diagnosedStageIds.has(selectedStage.id)}
            diagnosisResult={diagnosisResults[selectedStage.id]}
            draft={drafts[selectedStage.id] ?? ''}
            stage={selectedStage}
            onConfirmDiagnosis={() => confirmDiagnosis(selectedStage.id)}
            onEnterStage={() => enterStage(selectedStage.id)}
            onMarkNeedsReview={() => markNeedsReview(selectedStage.id)}
            onRetryStage={() => retryStage(selectedStage.id)}
            onSubmitAnswer={() => submitAnswer(selectedStage.id)}
            onUpdateDraft={(v) => updateDraft(selectedStage.id, v)}
          />
        ) : (
          <div className="workspace-placeholder-view">
            <h3>选择一个阶段开始学习</h3>
            <p>阶段作答和诊断位于中央 Stage Learning Workspace。</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default StageLearningView
```

- [ ] **Step 4: Update views that now get data from hooks**

Each of these files now imports its domain hook instead of receiving props:
- `PdfReaderWorkspace.tsx` — calls `usePaper()` for pdfUrl
- `ArgumentChainView.tsx` — calls `usePaper()` for paperInsight
- `MethodMechanismView.tsx` — calls `usePaper()` for graph.nodes
- `FieldMemoryView.tsx` — calls `useMemories()` and `useWorkspace()`

- [ ] **Step 5: Move AIContextPanel to ai-panel/**

```bash
mkdir -p src/renderer/src/components/ai-panel
```

Next task will extract inspectors from it. For now, just move it and update imports.

- [ ] **Step 6: Verify typecheck + build**

Run: `npx tsc --noEmit --pretty && npm run build`
Expected: clean + `✓ built`

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/workspace/ src/renderer/src/components/ai-panel/
git commit -m "refactor: create WorkspaceRouter, PaperGraphView, StageLearningView; move AIContextPanel"
```

---

### Task 9: Extract inspectors from AIContextPanel

**Files:**
- Create: `src/renderer/src/components/ai-panel/NodeInspector.tsx`
- Create: `src/renderer/src/components/ai-panel/ExpansionNodeInspector.tsx`
- Create: `src/renderer/src/components/ai-panel/StageInspector.tsx`
- Create: `src/renderer/src/components/ai-panel/AlgorithmIdeaInspector.tsx`
- Create: `src/renderer/src/components/ai-panel/MemoryRecordInspector.tsx`
- Create: `src/renderer/src/components/ai-panel/EmptyContextPanel.tsx`
- Modify: `src/renderer/src/components/ai-panel/AIContextPanel.tsx` — delete inline components, import from files

- [ ] **Step 1: Extract NodeInspector**

Cut the `NodeInspector` function from AIContextPanel.tsx (lines 62-92) into its own file `src/renderer/src/components/ai-panel/NodeInspector.tsx`. It receives `node: GraphNode` and `onOpenNodeExpansion: (id: string) => void` as props.

- [ ] **Step 2: Extract ExpansionNodeInspector**

Cut the `ExpansionNodeInspector` function into `src/renderer/src/components/ai-panel/ExpansionNodeInspector.tsx`.

- [ ] **Step 3: Extract StageInspector**

Cut the `StageInspector` function into `src/renderer/src/components/ai-panel/StageInspector.tsx`.

- [ ] **Step 4: Extract AlgorithmIdeaInspector**

Cut the `AlgorithmIdeaInspector` function into `src/renderer/src/components/ai-panel/AlgorithmIdeaInspector.tsx`.

- [ ] **Step 5: Extract MemoryRecordInspector**

Cut the `MemoryRecordInspector` function into `src/renderer/src/components/ai-panel/MemoryRecordInspector.tsx`.

- [ ] **Step 6: Extract EmptyContextPanel**

Cut the `EmptyContextPanel` function into `src/renderer/src/components/ai-panel/EmptyContextPanel.tsx`.

- [ ] **Step 7: Update AIContextPanel to import extracted components**

Now AIContextPanel.tsx should be ~80 lines — just imports + the type-based switch statement. No component function definitions remain except `AIContextPanel` itself.

- [ ] **Step 8: Verify typecheck + build**

Run: `npx tsc --noEmit --pretty && npm run build`
Expected: clean + `✓ built`

- [ ] **Step 9: Commit**

```bash
git add src/renderer/src/components/ai-panel/
git commit -m "refactor: extract 5 inspectors + EmptyContextPanel from AIContextPanel"
```

---

### Task 10: Wire cross-domain communication and expansion flow

**Files:**
- Modify: `src/renderer/src/App.tsx` — pass callbacks to providers
- Modify: `src/renderer/src/domains/expansion/ExpansionProvider.tsx` — add async simulation
- Modify: `src/renderer/src/components/ai-panel/NodeInspector.tsx` — use expansion hook

- [ ] **Step 1: Add async simulation to ExpansionProvider**

In `ExpansionProvider.tsx`, add a useEffect that watches for sessions in `loading` status and advances steps:

```tsx
useEffect(() => {
  const loadingSessions = Object.values(sessions).filter((s) => s.status === 'loading')
  if (!loadingSessions.length) return

  const timers = loadingSessions.map((session) => {
    return setInterval(() => {
      setSessions((prev) => {
        const current = prev[session.id]
        if (!current || current.status !== 'loading') return prev
        const advanced = advanceExpansionStep(current, graphRef.current.find(n => n.id === current.nodeId)!, paperInsightRef.current)
        return { ...prev, [session.id]: advanced }
      })
    }, 450)
  })

  return () => timers.forEach(clearInterval)
}, [sessions])
```

- [ ] **Step 2: Wire onAnalysisComplete in App.tsx**

Update the `PaperProvider` call in App.tsx:
```tsx
const { activateTab } = useWorkspace() // App must also be inside WorkspaceProvider... 

// Actually, App.tsx can't call useWorkspace() because it's OUTSIDE WorkspaceProvider.
// Solution: create a small inner component that IS inside the providers.
```

Create `src/renderer/src/components/AppContent.tsx`:
```tsx
import { useWorkspace } from '../domains/workspace/useWorkspace'
import AppShell from './shell/AppShell'
import SettingsModal from './shared/SettingsModal'

function AppContent() {
  return <AppShell />
}

// Wire cross-domain triggers inside hooks
```

Refactor: App.tsx renders providers, AppContent (inside providers) renders AppShell and wires cross-domain callbacks.

- [ ] **Step 3: Update usePaperAnalysis to use activateTab from workspace**

`PaperProvider` receives an `onAnalysisComplete` callback. In App.tsx's inner component, pass:
```tsx
<PaperProvider onAnalysisComplete={() => activateTab('paper_graph')}>
```

- [ ] **Step 4: Wire expansion tab opening**

When `startExpansion` is called, the ExpansionProvider creates the session. The Workspace domain needs to open a tab. Do this in the component that triggers expansion:

In `NodeInspector.tsx`:
```tsx
function NodeInspector({ node }: { node: GraphNode }) {
  const { startExpansion } = useExpansion()
  const { openTab, activateTab } = useWorkspace()
  
  const handleExpand = () => {
    const sessionId = startExpansion(node.id)
    if (!sessionId) return
    openTab({
      id: sessionId,
      type: 'node_expansion_loading',
      title: `Expand: ${node.label}`,
      nodeId: node.id,
      expansionId: sessionId,
      closable: true,
      status: 'loading'
    })
  }
  // ...
}
```

- [ ] **Step 5: Wire expansion completion → tab type switch**

In ExpansionProvider, when a session transitions to `ready`, automatically update the tab type. This can be done in the `setSessions` call or via a useEffect:

```tsx
// In the simulation timer's setSessions callback
if (advanced.status === 'ready') {
  // Need to update tab type — but ExpansionProvider doesn't have access to Workspace
  // Solution: the consumer component (where both hooks are called) handles this
}
```

The `ExpansionGraphView` component handles this by watching for ready sessions and calling `openTab` with the new type.

- [ ] **Step 6: Verify typecheck + build**

Run: `npx tsc --noEmit --pretty && npm run build`
Expected: clean + `✓ built`

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/App.tsx src/renderer/src/components/
git add src/renderer/src/domains/expansion/ExpansionProvider.tsx
git commit -m "feat: wire cross-domain communication - expansion flow, analysis completion"
```

---

### Task 11: Split KnowledgeGraph.tsx

**Files:**
- Create: `src/renderer/src/components/workspace/useGraphDrag.ts`
- Create: `src/renderer/src/components/workspace/useGraphZoom.ts`
- Create: `src/renderer/src/components/workspace/GraphNodes.tsx`
- Create: `src/renderer/src/components/workspace/ExpansionLayer.tsx`
- Modify: `src/renderer/src/components/workspace/KnowledgeGraph.tsx` — use extracted modules

- [ ] **Step 1: Extract useGraphDrag hook**

Create `src/renderer/src/components/workspace/useGraphDrag.ts`:
```ts
import { useRef, useCallback, useState } from 'react'

interface DragState {
  type: 'node' | 'pan' | null
  nodeId?: string
  startX: number; startY: number
  startPosX: number; startPosY: number
  moved: boolean
}

const DRAG_THRESHOLD = 3

export function useGraphDrag(onNodeSelect: (nodeId: string) => void, scale: number) {
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map())
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<DragState>({ type: null, startX: 0, startY: 0, startPosX: 0, startPosY: 0, moved: false })

  // ... extract from KnowledgeGraph.tsx
  // handleNodeMouseDown, handleSvgMouseDown, handleMouseMove, handleMouseUp

  return { positions, setPositions, offset, setOffset, handleNodeMouseDown: /* ... */, handleSvgMouseDown: /* ... */, handleMouseMove: /* ... */, handleMouseUp: /* ... */, isDragging: /* ... */ }
}
```

- [ ] **Step 2: Extract useGraphZoom hook**

Create `src/renderer/src/components/workspace/useGraphZoom.ts`:
```ts
import { useState, useCallback, useRef } from 'react'

export function useGraphZoom() {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement>(null)

  const handleWheel = useCallback((e: React.WheelEvent) => {
    // ... wheel zoom logic from KnowledgeGraph
  }, [scale])

  const resetView = useCallback(() => {
    setScale(1); setOffset({ x: 0, y: 0 })
  }, [])

  return { scale, setScale, offset, setOffset, svgRef, handleWheel, resetView }
}
```

- [ ] **Step 3: Extract GraphNodes component**

Create `src/renderer/src/components/workspace/GraphNodes.tsx`:
```tsx
// The 7 renderNode functions (field, concept, problem, method, formula, experiment, limitation)
// Each as its own exported component: FieldNode, ConceptNode, etc.

export function renderNode(node: GraphNode, pos: {x:number,y:number}, selected: boolean, onClick: () => void, onMouseDown: (e: React.MouseEvent) => void) {
  // ... switch on node.type, return SVG groups
}
```

- [ ] **Step 4: Extract ExpansionLayer component**

Create `src/renderer/src/components/workspace/ExpansionLayer.tsx`:
```tsx
// Expansion node rendering, edge rendering, position calculation
```

- [ ] **Step 5: Update KnowledgeGraph to use extracted modules**

Now `KnowledgeGraph.tsx` is ~350 lines: SVG container + defs + compose GraphNodes + ExpansionLayer + graph-legend + reset button. All drag/zoom logic comes from hooks.

- [ ] **Step 6: Verify typecheck + build**

Run: `npx tsc --noEmit --pretty && npm run build`
Expected: clean + `✓ built`

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/workspace/
git commit -m "refactor: split KnowledgeGraph into useGraphDrag, useGraphZoom, GraphNodes, ExpansionLayer"
```

---

### Task 12: Split ExpandView.tsx

**Files:**
- Create: `src/renderer/src/components/workspace/expansion/IdeaCardGrid.tsx`
- Create: `src/renderer/src/components/workspace/expansion/ComparisonTable.tsx`
- Create: `src/renderer/src/components/workspace/expansion/FeedbackPanel.tsx`
- Create: `src/renderer/src/components/workspace/expansion/MemorySavePanel.tsx`
- Modify: `src/renderer/src/components/workspace/expansion/ExpandView.tsx` — compose sub-components

- [ ] **Step 1: Extract IdeaCardGrid**

Cut `Kg4IdeaCardGrid` function into `IdeaCardGrid.tsx`.

- [ ] **Step 2: Extract ComparisonTable**

Cut `Kg4ComparisonTable` into `ComparisonTable.tsx`.

- [ ] **Step 3: Extract FeedbackPanel**

Cut `Kg4FeedbackView` into `FeedbackPanel.tsx`.

- [ ] **Step 4: Extract MemorySavePanel**

Cut the memory save section (lines 253-259 in current ExpandView) into `MemorySavePanel.tsx`.

- [ ] **Step 5: Update ExpandView to compose**

Now `ExpandView.tsx` is ~100 lines: hero section + compose IdeaCardGrid + ComparisonTable + FeedbackPanel + MemorySavePanel. Each sub-component receives only the props it needs.

- [ ] **Step 6: Verify typecheck + build**

Run: `npx tsc --noEmit --pretty && npm run build`
Expected: clean + `✓ built`

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/workspace/expansion/
git commit -m "refactor: split ExpandView into IdeaCardGrid, ComparisonTable, FeedbackPanel, MemorySavePanel"
```

---

### Task 13: Delete legacy files and clean up

**Files:**
- Delete: `src/renderer/src/components/AppHeader.tsx`
- Delete: `src/renderer/src/components/PdfPanel.tsx`
- Delete: `src/renderer/src/components/AnalysisPanel.tsx`
- Delete: `src/renderer/src/components/DiagnosisView.tsx`
- Delete: `src/renderer/src/components/LearningReportPanel.tsx`
- Delete: `src/renderer/src/components/PdfJsViewer.tsx`
- Delete: `src/renderer/src/modules/workspace/` (moved to domains)
- Delete: `src/renderer/src/modules/paper/usePaperAnalysis.ts` (moved to domains)
- Modify: Remove any remaining imports referencing deleted files

- [ ] **Step 1: Delete files**

```bash
rm src/renderer/src/components/AppHeader.tsx
rm src/renderer/src/components/PdfPanel.tsx
rm src/renderer/src/components/AnalysisPanel.tsx
rm src/renderer/src/components/DiagnosisView.tsx
rm src/renderer/src/components/LearningReportPanel.tsx
rm src/renderer/src/components/PdfJsViewer.tsx
rm -rf src/renderer/src/modules/workspace/
rm src/renderer/src/modules/paper/usePaperAnalysis.ts
```

- [ ] **Step 2: Fix any broken imports**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Fix any remaining import errors by updating paths or removing references.

- [ ] **Step 3: Verify typecheck + build**

Run: `npx tsc --noEmit --pretty && npm run build`
Expected: clean + `✓ built`

- [ ] **Step 4: Check file sizes against limits**

```bash
wc -l src/renderer/src/domains/**/*.tsx src/renderer/src/domains/**/*.ts src/renderer/src/components/**/*.tsx 2>/dev/null | sort -rn | head -20
```

Identify any files over 250 lines (or 350 for SVG renderers). Split if needed.

- [ ] **Step 5: Commit**

```bash
git add -u
git add src/renderer/src/
git commit -m "chore: delete legacy files, clean up imports"
```

---

### Task 14: Final verification

**Files:** All

- [ ] **Step 1: Full typecheck**

Run: `npm run typecheck`
Expected: `EXIT_CODE=0`, zero errors

- [ ] **Step 2: Full production build**

Run: `npm run build`
Expected: `✓ built`

- [ ] **Step 3: Verify App.tsx line count**

Run: `wc -l src/renderer/src/App.tsx`
Expected: under 60 lines

- [ ] **Step 4: Verify all components meet prop limit**

Run: `grep -c "interface.*Props" src/renderer/src/components/**/*.tsx`
Manually verify no component has more than 8 data props.

- [ ] **Step 5: Verify no business logic in components**

Spot-check: grep for `useState|useEffect|useCallback|async|await` in component files — each should delegate to a hook.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: final verification - all checks pass"
```
