# Interaction Flow Real-ification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all mock/placeholder data from the frontend, connecting every interaction flow to real backend infrastructure (LLM analysis, diagnosis, job orchestration, memory).

**Architecture:** Four-phase approach — (1) wire stages & diagnosis to real LLM, (2) wire node expansion to real job orchestration with push progress, (3) replace mock algorithm idea cards/feedback/reuse with real IPC, (4) delete all mock files and dead code. Cross-domain communication uses a ref-based sync pattern to bridge PaperContext (above StageProvider) with StageContext.

**Tech Stack:** Electron + React + TypeScript, DeepSeek API via LLM orchestrator, existing Context-based state management

---

## File Structure Map

```
Create:
  src/renderer/src/domains/stages/stageFramework.ts  — static 7-stage definitions

Modify:
  src/renderer/src/domains/stages/StageProvider.tsx   — empty init, real diagnosis, error state
  src/renderer/src/domains/stages/types.ts            — add diagnosisError, retryDiagnosis
  src/renderer/src/domains/paper/PaperProvider.tsx    — expose paperTasks, accept setStagesRef
  src/renderer/src/domains/paper/types.ts             — add paperTasks
  src/renderer/src/domains/paper/usePaperAnalysis.ts  — store paperTasks, call setStagesRef
  src/renderer/src/components/StageDetail.tsx         — error + retry UI
  src/renderer/src/App.tsx                            — create setStagesRef, pass to PaperProvider
  src/main/index.ts                                   — add progress push events
  src/shared/electron-api.ts                          — add ExpansionProgressEvent type + onExpansionProgress
  src/preload/index.ts                                — expose onExpansionProgress
  src/renderer/src/modules/ipc/electronApi.ts         — add onExpansionProgress wrapper
  src/renderer/src/domains/expansion/ExpansionProvider.tsx  — remove mock fallback
  src/renderer/src/domains/expansion/nodeExpansionSessions.ts — real progress, delete mock
  src/renderer/src/components/ExpansionLoadingView.tsx — remove mock references, show real progress
  src/renderer/src/modules/learning/kg4Workbench.ts    — remove mock functions
  src/renderer/src/modules/learning/nodeExpansion.ts   — delete mock data, keep helpers
  src/renderer/src/components/ExpandView.tsx           — use real IPC
  src/renderer/src/modules/learning/report.ts          — simplify

Delete:
  src/renderer/src/mock/stages.ts
  src/renderer/src/modules/diagnosis/diagnose.ts
  src/renderer/src/modules/diagnosis/types.ts
```

---

### Task 1: Create stage framework file

**Files:**
- Create: `src/renderer/src/domains/stages/stageFramework.ts`

- [ ] **Step 1: Write stageFramework.ts**

```ts
import type { Stage } from '../../types'

export interface StageDefinition {
  id: string
  order: number
  name: string
  description: string
}

export const STAGE_DEFINITIONS: StageDefinition[] = [
  {
    id: 'field_positioning',
    order: 1,
    name: '领域定位',
    description: '判断这篇论文属于哪个 AI 子领域，理解该领域的研究目标和与其他领域的区别。'
  },
  {
    id: 'problem_motivation',
    order: 2,
    name: '问题动机',
    description: '用一句话概括论文解决的核心问题，理解作者的研究动机和问题设定。'
  },
  {
    id: 'method_overview',
    order: 3,
    name: '方法主线',
    description: '提炼论文方法的输入、核心模块、处理流程、输出和优化目标，从细节中抽取出方法主线。'
  },
  {
    id: 'formula_algorithm',
    order: 4,
    name: '公式算法',
    description: '理解关键公式中每一项的作用和训练目标，能解释公式为什么对解决问题有效。'
  },
  {
    id: 'experiment_analysis',
    order: 5,
    name: '实验解读',
    description: '区分主实验、消融实验和对比实验，判断每个实验验证了论文的哪个 claim。'
  },
  {
    id: 'contribution_limitation',
    order: 6,
    name: '贡献局限',
    description: '区分已有工作、本文改进和真正贡献，客观评价论文的局限性和适用范围。'
  },
  {
    id: 'transfer_comparison',
    order: 7,
    name: '迁移对比',
    description: '思考该方法能否迁移到其他任务或问题中，判断哪些模块可复用、哪些需要修改。'
  }
]

export function buildStagesFromTasks(tasks: Record<string, string>): Stage[] {
  return STAGE_DEFINITIONS.map((def) => ({
    id: def.id,
    order: def.order,
    name: def.name,
    status: 'not_started' as const,
    mastery: 0,
    description: def.description,
    task: tasks[def.id] ?? `请基于论文内容回答关于「${def.name}」的问题。`
  }))
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/domains/stages/stageFramework.ts
git commit -m "feat(stages): add stageFramework with static definitions and buildStagesFromTasks"
```

---

### Task 2: Refactor StageProvider — empty init, real diagnosis only, error state

**Files:**
- Modify: `src/renderer/src/domains/stages/StageProvider.tsx`
- Modify: `src/renderer/src/domains/stages/types.ts`

- [ ] **Step 1: Update types.ts to add error + retry fields**

In `src/renderer/src/domains/stages/types.ts`, the context value gets new fields. Read current types.ts first, then replace:

```ts
import type { Stage } from '../../types'
import type { DiagnosisResult } from '../../modules/diagnosis/types'
import type { LearningReport } from '../../modules/learning/report'

export interface StageContextValue {
  stages: Stage[]
  selectedStageId: string | null
  answers: Record<string, string>
  drafts: Record<string, string>
  diagnosisResults: Record<string, DiagnosisResult>
  diagnosedStageIds: Set<string>
  learningReport: LearningReport | null
  diagnosisError: string | null
  diagnosisLoading: boolean

  selectStage: (id: string | null) => void
  enterStage: (id: string) => void
  submitAnswer: (id: string) => Promise<void>
  confirmDiagnosis: (id: string) => void
  retryStage: (id: string) => void
  markNeedsReview: (id: string) => void
  updateDraft: (id: string, value: string) => void
  generateReport: () => void
  retryDiagnosis: () => void
  setStages: React.Dispatch<React.SetStateAction<Stage[]>>
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setDiagnosisResults: React.Dispatch<React.SetStateAction<Record<string, DiagnosisResult>>>
}
```

- [ ] **Step 2: Rewrite StageProvider.tsx**

Read current `StageProvider.tsx` first, then write the new version:

```tsx
import { createContext, useCallback, useState, type ReactNode } from 'react'
import { buildStagesFromTasks } from './stageFramework'
import { electronApi } from '../../modules/ipc/electronApi'
import type { Stage } from '../../types'
import type { DiagnosisResult } from '../../modules/diagnosis/types'
import type { LearningReport } from '../../modules/learning/report'
import type { StageContextValue } from './types'

export const StageContext = createContext<StageContextValue | null>(null)

export function StageProvider({ children }: { children: ReactNode }) {
  const [stages, setStages] = useState<Stage[]>([])
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [diagnosisResults, setDiagnosisResults] = useState<Record<string, DiagnosisResult>>({})
  const [diagnosedStageIds, setDiagnosedStageIds] = useState<Set<string>>(new Set())
  const [learningReport, setLearningReport] = useState<LearningReport | null>(null)
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null)
  const [diagnosisLoading, setDiagnosisLoading] = useState(false)
  const [pendingStageId, setPendingStageId] = useState<string | null>(null)

  const selectStage = useCallback((id: string | null) => setSelectedStageId(id), [])

  const enterStage = useCallback((id: string) => {
    setStages((prev) => prev.map((s) => s.id === id ? { ...s, status: 'in_progress' as const } : s))
    setDiagnosedStageIds((prev) => { const next = new Set(prev); next.delete(id); return next })
    setDiagnosisError(null)
  }, [])

  const submitAnswer = useCallback(async (id: string) => {
    const answer = drafts[id] ?? ''
    setAnswers((prev) => ({ ...prev, [id]: answer }))
    const stage = stages.find((s) => s.id === id)
    if (!stage) return

    setDiagnosisError(null)
    setDiagnosisLoading(true)
    setPendingStageId(id)

    try {
      const result = await electronApi.diagnose({
        stageId: id,
        stageName: stage.name,
        taskDescription: stage.task,
        userAnswer: answer
      })
      setDiagnosisResults((prev) => ({ ...prev, [id]: result }))
      if (!result.isCorrect) {
        setStages((prev) => prev.map((s) => s.id === id ? { ...s, status: 'needs_review' as const } : s))
      }
      setDiagnosedStageIds((prev) => { const next = new Set(prev); next.add(id); return next })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setDiagnosisError(message)
    } finally {
      setDiagnosisLoading(false)
      setPendingStageId(null)
    }
  }, [drafts, stages])

  const retryDiagnosis = useCallback(() => {
    if (pendingStageId) {
      submitAnswer(pendingStageId)
    }
  }, [pendingStageId, submitAnswer])

  const confirmDiagnosis = useCallback((id: string) => {
    setStages((prev) => prev.map((s) =>
      s.id === id ? { ...s, status: 'completed' as const, mastery: Math.min(100, s.mastery + 20) } : s
    ))
    setDiagnosedStageIds((prev) => { const next = new Set(prev); next.delete(id); return next })
    setDiagnosisError(null)
  }, [])

  const retryStage = useCallback((id: string) => {
    setDiagnosedStageIds((prev) => { const next = new Set(prev); next.delete(id); return next })
    setDiagnosisError(null)
  }, [])

  const markNeedsReview = useCallback((id: string) => {
    const answer = drafts[id] ?? ''
    setAnswers((prev) => ({ ...prev, [id]: answer }))
    setStages((prev) => prev.map((s) => s.id === id ? { ...s, status: 'needs_review' as const } : s))
  }, [drafts])

  const updateDraft = useCallback((id: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [id]: value }))
  }, [])

  const generateReport = useCallback(() => {
    const completed = stages.filter((s) => s.status === 'completed')
    const wrongEntries = stages
      .map((s) => ({ stage: s, result: diagnosisResults[s.id] }))
      .filter((e) => e.result && !e.result.isCorrect)

    setLearningReport({
      generatedAt: new Date().toISOString(),
      summary: `当前完成 ${completed.length}/${stages.length} 个阶段。${wrongEntries.length ? `发现 ${wrongEntries.length} 条诊断错误记录。` : ''}`,
      mastered: completed.map((s) => `阶段 ${s.order}：${s.name}`),
      weakPoints: wrongEntries.map(({ stage, result }) => `阶段 ${stage.order} ${stage.name}：${result.errorType}`),
      errorHistory: wrongEntries.map(({ stage, result }) => ({
        stageName: stage.name,
        errorType: result.errorType,
        feedback: result.feedback
      })),
      reviewRecommendations: wrongEntries.map(({ stage, result }) => `针对「${stage.name}」补做：${result.remedialTask}`),
      nextPaperRecommendation: '下一篇论文建议选择同方向但方法不同的工作，用研究问题、方法机制和实验设置做横向比较。'
    })
  }, [stages, diagnosisResults])

  return (
    <StageContext.Provider value={{
      stages, selectedStageId, answers, drafts, diagnosisResults, diagnosedStageIds, learningReport,
      diagnosisError, diagnosisLoading,
      selectStage, enterStage, submitAnswer, confirmDiagnosis, retryStage, markNeedsReview, updateDraft, generateReport,
      retryDiagnosis,
      setStages, setAnswers, setDiagnosisResults
    }}>
      {children}
    </StageContext.Provider>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/domains/stages/StageProvider.tsx src/renderer/src/domains/stages/types.ts
git commit -m "refactor(stages): init empty, real LLM diagnosis only, add error+retry state"
```

---

### Task 3: Wire paper tasks → stages via PaperProvider + App.tsx

**Files:**
- Modify: `src/renderer/src/domains/paper/types.ts`
- Modify: `src/renderer/src/domains/paper/PaperProvider.tsx`
- Modify: `src/renderer/src/domains/paper/usePaperAnalysis.ts`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Add paperTasks to paper types**

In `src/renderer/src/domains/paper/types.ts`, add `paperTasks`:

```ts
import type { AnalysisStep, KnowledgeGraph, PaperInsight } from '../../../../shared/paper'

export interface PaperContextValue {
  pdfUrl: string | null
  graph: KnowledgeGraph
  paperInsight: PaperInsight | null
  paperTasks: Record<string, string> | null
  analysisSteps: AnalysisStep[]
  generating: boolean
  genError: string
  genProgress: string

  selectPdf: () => Promise<void>
  analyzePaper: () => Promise<void>
  setGraph: (graph: KnowledgeGraph) => void
  setPaperInsight: (insight: PaperInsight | null) => void
  setPdfUrl: (url: string | null) => void
}
```

- [ ] **Step 2: Update usePaperAnalysis to store paperTasks**

In `src/renderer/src/domains/paper/usePaperAnalysis.ts`, add `paperTasks` state and store after analysis. Also accept `setStagesRef` instead of `setStages`.

Change the options interface and hook:

```ts
import { useState, useRef } from 'react'
// ... keep existing imports

interface UsePaperAnalysisOptions {
  onAnalysisComplete: () => void
  setSelectedGraphNodeId: (nodeId: string | null) => void
  setStagesRef: React.MutableRefObject<((tasks: Record<string, string>) => void) | null>
}
```

Inside the hook, add:
```ts
const [paperTasks, setPaperTasks] = useState<Record<string, string> | null>(null)
```

In the `analyzePaper` function, after `setPaperInsight(...)`, add:
```ts
setPaperTasks(analysis.tasks)
```

And after the incremental reveal loop, add:
```ts
// Sync tasks to StageProvider
options.setStagesRef.current?.(analysis.tasks)
```

Add `paperTasks` to the return value.

- [ ] **Step 3: Update PaperProvider to expose paperTasks and accept setStagesRef**

```tsx
import { createContext, useEffect, useState, useRef, type ReactNode } from 'react'
import type { PaperContextValue } from './types'
import { usePaperAnalysis } from './usePaperAnalysis'

export const PaperContext = createContext<PaperContextValue | null>(null)

interface PaperProviderProps {
  children: ReactNode
  onAnalysisComplete: () => void
  setStagesRef: React.MutableRefObject<((tasks: Record<string, string>) => void) | null>
}

export function PaperProvider({ children, onAnalysisComplete, setStagesRef }: PaperProviderProps) {
  const {
    analysisSteps, analyzePaper, generating, genError, genProgress,
    graph, paperInsight, pdfUrl, paperTasks, selectPdf, setGraph, setPaperInsight, setPdfUrl
  } = usePaperAnalysis({
    onAnalysisComplete,
    setSelectedGraphNodeId: () => {},
    setStagesRef
  })

  return (
    <PaperContext.Provider value={{
      pdfUrl, graph, paperInsight, paperTasks, analysisSteps, generating, genError, genProgress,
      selectPdf, analyzePaper, setGraph, setPaperInsight, setPdfUrl
    }}>
      {children}
    </PaperContext.Provider>
  )
}
```

- [ ] **Step 4: Update App.tsx to wire setStagesRef**

In `App.tsx`, create a ref and a component that syncs stages:

```tsx
import { useRef } from 'react'
// ... existing imports

function App() {
  // ... existing state

  // Ref-based bridge: PaperProvider (outer) → StageProvider (inner)
  const setStagesRef = useRef<((tasks: Record<string, string>) => void) | null>(null)

  return (
    <PersistenceGate onLoad={() => {}}>
      <PaperProvider
        onAnalysisComplete={() => dispatchWorkspace({ type: 'activate_tab', tabId: 'paper_graph' })}
        setStagesRef={setStagesRef}
      >
        <StageProvider>
          <StageSyncBridge setStagesRef={setStagesRef} />
          <ExpansionProvider>
            {/* ... rest unchanged */}
          </ExpansionProvider>
        </StageProvider>
      </PaperProvider>
    </PersistenceGate>
  )
}

// Bridge component: sits inside StageProvider, sets the ref
import { buildStagesFromTasks } from './domains/stages/stageFramework'
import { useStages } from './domains/stages/useStages'

function StageSyncBridge({ setStagesRef }: { setStagesRef: React.MutableRefObject<((tasks: Record<string, string>) => void) | null> }) {
  const { setStages } = useStages()
  setStagesRef.current = (tasks: Record<string, string>) => {
    setStages(buildStagesFromTasks(tasks))
  }
  return null
}
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/domains/paper/types.ts src/renderer/src/domains/paper/PaperProvider.tsx src/renderer/src/domains/paper/usePaperAnalysis.ts src/renderer/src/domains/paper/usePaper.ts src/renderer/src/App.tsx
git commit -m "feat(paper): wire LLM-generated tasks to StageProvider via setStagesRef bridge"
```

---

### Task 4: Add error + retry UI to StageDetail

**Files:**
- Modify: `src/renderer/src/components/StageDetail.tsx`

- [ ] **Step 1: Add diagnosisError and retryDiagnosis props**

Add these to the `StageDetailProps` interface:
```ts
diagnosisError: string | null
diagnosisLoading: boolean
onRetryDiagnosis: () => void
```

- [ ] **Step 2: Add error banner in the submit area**

After the `<textarea>` and before the submit button, add:

```tsx
{diagnosisError && (
  <div className="diagnosis-banner diagnosis-banner--fail" style={{ marginTop: 12 }}>
    <span className="diagnosis-icon">!</span>
    <div>
      <div className="diagnosis-title">诊断失败</div>
      <p className="diagnosis-text">{diagnosisError}</p>
    </div>
    <button
      className="stage-btn stage-btn--primary"
      onClick={onRetryDiagnosis}
      disabled={diagnosisLoading}
    >
      {diagnosisLoading ? '重试中...' : '重试'}
    </button>
  </div>
)}
```

- [ ] **Step 3: Update the submit button to show loading state**

```tsx
<button
  className="stage-btn stage-btn--primary"
  disabled={!draft.trim() || diagnosisLoading}
  onClick={onSubmitAnswer}
>
  {diagnosisLoading ? '诊断中...' : '提交答案'}
</button>
```

- [ ] **Step 4: Update CentralWorkspaceRouter to pass new props**

In `src/renderer/src/components/CentralWorkspaceRouter.tsx`, in `StageLearningWorkspace`, destructure the new fields from `useStages()`:

```tsx
const { ..., diagnosisError, diagnosisLoading, retryDiagnosis } = useStages()
```

And pass them to `StageDetail`:
```tsx
<StageDetail
  // ... existing props
  diagnosisError={diagnosisError}
  diagnosisLoading={diagnosisLoading}
  onRetryDiagnosis={retryDiagnosis}
/>
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/StageDetail.tsx src/renderer/src/components/CentralWorkspaceRouter.tsx
git commit -m "feat(stages): add error display and retry button for diagnosis failures"
```

---

### Task 5: Delete mock files (stages + diagnosis)

**Files:**
- Delete: `src/renderer/src/mock/stages.ts`
- Delete: `src/renderer/src/modules/diagnosis/diagnose.ts`
- Delete: `src/renderer/src/modules/diagnosis/types.ts` (if it exists and is unused elsewhere)

- [ ] **Step 1: Check what imports diagnose.ts**

```bash
grep -r "from.*diagnosis/diagnose" src/ --include="*.ts" --include="*.tsx"
grep -r "from.*diagnosis/types" src/ --include="*.ts" --include="*.tsx"
grep -r "from.*mock/stages" src/ --include="*.ts" --include="*.tsx"
```

- [ ] **Step 2: Remove all imports of deleted files, then delete**

```bash
rm src/renderer/src/mock/stages.ts
rm src/renderer/src/modules/diagnosis/diagnose.ts
# Only delete types.ts if NOT imported by other files:
rm src/renderer/src/modules/diagnosis/types.ts
```

Note: `DiagnosisResult` is imported from `modules/diagnosis/types` in several places. Since `DiagnosisResult` is also defined in `shared/electron-api.ts`, update all imports to use the shared type:

In `StageProvider.tsx`, `StageDetail.tsx`, and `types.ts`:
```ts
// Change:
import type { DiagnosisResult } from '../modules/diagnosis/types'
// To:
import type { DiagnosisResult } from '../../../../shared/electron-api'
```

- [ ] **Step 3: Commit**

```bash
git rm src/renderer/src/mock/stages.ts
git rm src/renderer/src/modules/diagnosis/diagnose.ts
git rm src/renderer/src/modules/diagnosis/types.ts
# Add any import fixes
git add -u
git commit -m "chore: delete mock stages, local diagnosis; use shared DiagnosisResult type"
```

---

### Task 6: Add expansion progress push events to main process

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/shared/electron-api.ts`

- [ ] **Step 1: Define progress event types in shared/electron-api.ts**

Add to the file:

```ts
export interface ExpansionProgressEvent {
  sessionId: string
  jobId: string
  step: 'job_created' | 'retrieving' | 'analyzing' | 'generating' | 'done' | 'failed'
  message: string
  result?: unknown  // only present when step === 'done'
  error?: string    // only present when step === 'failed'
}
```

And add to `ElectronApi`:
```ts
kg4: {
  // ... existing
  onExpansionProgress: (cb: (event: ExpansionProgressEvent) => void) => () => void
}
```

- [ ] **Step 2: Add progress push in main/index.ts kg4:start-expansion handler**

Replace the existing `kg4:start-expansion` handler with one that runs the job and pushes progress:

```ts
ipcMain.handle('kg4:start-expansion', async (_e, params: { nodeId: string; nodeLabel: string; paperId?: string }) => {
  const sessionId = `expansion_${params.nodeId}_${Date.now()}`
  const job = await llmTaskOrchestrator.createJob({
    type: 'expand_node_retrieve_context',
    input: { nodeId: params.nodeId, nodeLabel: params.nodeLabel },
    nodeId: params.nodeId,
    paperId: params.paperId,
    sessionId
  })

  // Push: job created
  mainWindow.webContents.send('expansion:progress', {
    sessionId, jobId: job.id,
    step: 'job_created',
    message: '正在准备检索任务...'
  })

  // Run job asynchronously, pushing progress at key nodes
  ;(async () => {
    try {
      // Phase 1: retrieving
      mainWindow.webContents.send('expansion:progress', {
        sessionId, jobId: job.id,
        step: 'retrieving',
        message: '正在检索相关论文...'
      })

      const result = await llmTaskOrchestrator.runJob(job.id)

      if (result.status === 'succeeded') {
        // Phase: analyzing
        mainWindow.webContents.send('expansion:progress', {
          sessionId, jobId: job.id,
          step: 'analyzing',
          message: '正在分析算法思想...'
        })

        // Phase: generating
        mainWindow.webContents.send('expansion:progress', {
          sessionId, jobId: job.id,
          step: 'generating',
          message: '正在生成扩展图谱...'
        })

        // Done
        mainWindow.webContents.send('expansion:progress', {
          sessionId, jobId: job.id,
          step: 'done',
          message: '展开完成',
          result: result.resultJson
        })
      } else {
        mainWindow.webContents.send('expansion:progress', {
          sessionId, jobId: job.id,
          step: 'failed',
          message: result.errorMessage || '展开任务失败',
          error: result.errorMessage
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      mainWindow.webContents.send('expansion:progress', {
        sessionId, jobId: job.id,
        step: 'failed',
        message,
        error: message
      })
    }
  })()

  return { sessionId, jobs: [{ jobId: job.id, type: job.type }] }
})
```

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts src/shared/electron-api.ts
git commit -m "feat(expansion): add backend progress push events at key job nodes"
```

---

### Task 7: Add onExpansionProgress to preload and renderer IPC

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/modules/ipc/electronApi.ts`

- [ ] **Step 1: Add listener in preload/index.ts**

In the `kg4` section of the exposed API:

```ts
onExpansionProgress: (cb: (event: import('../../shared/electron-api').ExpansionProgressEvent) => void) => {
  const handler = (_e: unknown, event: import('../../shared/electron-api').ExpansionProgressEvent) => cb(event)
  ipcRenderer.on('expansion:progress', handler)
  return () => { ipcRenderer.removeListener('expansion:progress', handler) }
}
```

- [ ] **Step 2: Add wrapper in modules/ipc/electronApi.ts**

In the `kg4` section:

```ts
onExpansionProgress: (cb: (event: import('../../../../shared/electron-api').ExpansionProgressEvent) => void) =>
  getApi()?.kg4?.onExpansionProgress?.(cb)
```

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.ts src/renderer/src/modules/ipc/electronApi.ts
git commit -m "feat(expansion): add onExpansionProgress to preload bridge and renderer IPC"
```

---

### Task 8: Refactor ExpansionProvider — remove mock fallback

**Files:**
- Modify: `src/renderer/src/domains/expansion/ExpansionProvider.tsx`

- [ ] **Step 1: Rewrite startExpansion without mock fallback**

Replace the `startExpansion` callback:

```tsx
const startExpansion = useCallback(async (nodeId: string): Promise<string | undefined> => {
  const node = graphRef.current.find((n) => n.id === nodeId)
  if (!node) return undefined

  const timestamp = new Date().toISOString()
  const result = await electronApi.kg4.startExpansion({
    nodeId: node.id,
    nodeLabel: node.label,
    paperId: undefined
  })

  const session: NodeExpansionSession = {
    id: result.sessionId,
    nodeId: node.id,
    nodeLabel: node.label,
    status: 'loading',
    currentStepId: 'job_created',
    steps: [
      { id: 'job_created', label: '创建检索任务', status: 'running', detail: '正在准备检索任务...' },
      { id: 'retrieving', label: '检索相关论文', status: 'pending', detail: '检索本地和外部论文源...' },
      { id: 'analyzing', label: '分析算法思想', status: 'pending', detail: 'LLM 抽取和对比算法思想...' },
      { id: 'generating', label: '生成扩展图谱', status: 'pending', detail: '构建临时扩展节点和边...' },
      { id: 'done', label: '完成', status: 'pending', detail: '展开结果已就绪' }
    ],
    usesMockData: false,
    createdAt: timestamp,
    updatedAt: timestamp
  }

  setSessions((prev) => ({ ...prev, [session.id]: session }))

  // Listen for progress events
  const unsubscribe = electronApi.kg4.onExpansionProgress?.((event) => {
    if (event.sessionId !== session.id) return
    setSessions((prev) => {
      const s = prev[session.id]
      if (!s) return prev
      const updated = updateSessionFromJobProgress(s, event)
      return { ...prev, [session.id]: updated }
    })
  })

  return session.id
}, [])
```

- [ ] **Step 2: Remove unused imports**

Remove `createNodeExpansionSession` and `createRealExpansionSession` imports. Add `electronApi` import.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/domains/expansion/ExpansionProvider.tsx
git commit -m "refactor(expansion): remove mock fallback, use real IPC + progress events"
```

---

### Task 9: Refactor nodeExpansionSessions — remove mock, add progress handler

**Files:**
- Modify: `src/renderer/src/domains/expansion/nodeExpansionSessions.ts`

- [ ] **Step 1: Delete mock functions, add updateSessionFromJobProgress**

Delete: `createNodeExpansionSession`, `createRealExpansionSession`, `advanceExpansionStep`, `remainingSteps`, `STEP_DEFINITIONS`, `makeLoadingSteps`, `makeCompletedSteps`, `makeFailedSteps`, `makeEmptySteps`, `safeId`, `buildExpansionGraph`.

Keep: `NodeExpansionSession`, `NodeExpansionStep`, `NodeExpansionStatus`, `NodeExpansionStepStatus` type exports.

Add the new function:

```ts
import type { ExpansionProgressEvent } from '../../../../shared/electron-api'
import type { Kg4ExpansionGraphLayer } from '../../../../shared/kg4'

export function updateSessionFromJobProgress(
  session: NodeExpansionSession,
  event: ExpansionProgressEvent
): NodeExpansionSession {
  const now = new Date().toISOString()
  const stepOrder = ['job_created', 'retrieving', 'analyzing', 'generating', 'done'] as const

  const currentIndex = stepOrder.indexOf(event.step as (typeof stepOrder)[number])
  const steps = session.steps.map((step) => {
    const stepIndex = stepOrder.indexOf(step.id as (typeof stepOrder)[number])
    if (stepIndex < currentIndex) return { ...step, status: 'done' as const }
    if (stepIndex === currentIndex) {
      if (event.step === 'failed') return { ...step, status: 'failed' as const, detail: event.error || event.message }
      return { ...step, status: 'running' as const, detail: event.message }
    }
    return { ...step }
  })

  if (event.step === 'failed') {
    return {
      ...session,
      status: 'failed',
      currentStepId: event.step,
      steps,
      errorMessage: event.error || event.message,
      updatedAt: now
    }
  }

  if (event.step === 'done') {
    const result = event.result as { expansionGraphNodes?: unknown[]; expansionGraphEdges?: unknown[]; algorithmIdeaCards?: unknown[] } | undefined
    const expansionGraph: Kg4ExpansionGraphLayer | undefined = result?.expansionGraphNodes ? {
      anchorNodeId: session.nodeId,
      nodes: result.expansionGraphNodes as Kg4ExpansionGraphLayer['nodes'],
      edges: (result.expansionGraphEdges || []) as Kg4ExpansionGraphLayer['edges']
    } : undefined

    return {
      ...session,
      status: 'ready',
      currentStepId: 'done',
      steps,
      expansionGraph,
      expansionRecord: result ? {
        id: `kg4_expansion_${session.nodeId}`,
        paperId: 'current-paper',
        nodeId: session.nodeId,
        retrievedPaperIds: [],
        algorithmIdeaCards: (result.algorithmIdeaCards || []) as Kg4ExpansionGraphLayer['nodes'],
        expansionGraphNodes: (result.expansionGraphNodes || []) as Kg4ExpansionGraphLayer['nodes'],
        expansionGraphEdges: (result.expansionGraphEdges || []) as Kg4ExpansionGraphLayer['edges'],
        fieldCognitionView: result as never,
        dataCompleteness: 'partial',
        missingDataReasons: [],
        generatedByJobIds: [event.jobId],
        createdAt: session.createdAt,
        updatedAt: now
      } : undefined,
      updatedAt: now
    }
  }

  return {
    ...session,
    currentStepId: event.step,
    steps,
    updatedAt: now
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/domains/expansion/nodeExpansionSessions.ts
git commit -m "refactor(expansion): replace mock session logic with real job progress handler"
```

---

### Task 10: Update ExpansionLoadingView — remove mock references

**Files:**
- Modify: `src/renderer/src/components/ExpansionLoadingView.tsx`

- [ ] **Step 1: Remove mock labeling, use real status text**

Change the data source line from:
```tsx
<p>当前数据源：mock/dev fixture。后续将接入真实检索 API 和 LLM 任务。</p>
```
To:
```tsx
<p>通过 LLM 任务检索和分析相关论文，生成可展开的算法思想图谱。</p>
```

Change the provider label logic:
```tsx
<article>
  <span>Provider</span>
  <strong>{session.usesMockData ? 'mock fixture' : 'DeepSeek + local retrieval'}</strong>
</article>
```

Change the "Fixture 已准备完成" text to:
```tsx
<strong>展开完成</strong>
<p>可以切换到 Expansion Graph View 查看扩展图谱。</p>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/components/ExpansionLoadingView.tsx
git commit -m "refactor(expansion): remove mock data references from loading view"
```

---

### Task 11: Remove mock functions from kg4Workbench.ts

**Files:**
- Modify: `src/renderer/src/modules/learning/kg4Workbench.ts`

- [ ] **Step 1: Delete mock functions**

Delete these functions:
- `buildKg4MockIdeaCards` (lines 36-72)
- `tokenize` helper (if only used by mock functions — check usage)
- `relationForIndex` helper
- `generateLocalFeedback` (lines 230-274)
- `buildLocalReuseSuggestions` (lines 313-337)

Keep:
- `buildKg4ExpansionRecord` — refactor to work without mock, accept idea cards directly
- `buildFieldCognitionView` — keep as is (works on idea cards)
- `buildComparisonWorkspace` — keep as is
- `buildNodeUnderstandingMemory` — keep as is
- `safeId` and `now` helpers
- `COMPARISON_DIMENSIONS`

- [ ] **Step 2: Refactor buildKg4ExpansionRecord to not depend on mock**

Change the signature:
```ts
export function buildKg4ExpansionRecord(
  node: GraphNode,
  ideaCards: AlgorithmIdeaCard[],
  expansionGraphNodes: ExpansionGraphNode[],
  expansionGraphEdges: ExpansionGraphEdge[],
  paperInsight: PaperInsight | null
): Kg4NodeExpansionRecord {
```

Instead of calling `buildKg4MockIdeaCards(node)`, use the passed-in `ideaCards` directly.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/modules/learning/kg4Workbench.ts
git commit -m "refactor(kg4): remove mock idea cards, feedback, and reuse functions"
```

---

### Task 12: Clean up nodeExpansion.ts — delete mock data

**Files:**
- Modify: `src/renderer/src/modules/learning/nodeExpansion.ts`

- [ ] **Step 1: Delete mock data and mock-specific functions**

Delete:
- `mockRelatedPapers` array
- `matchRelatedPapers` function
- `inferCurrentBranchId` function
- `expandNode` function
- Functions that depend on mock data: `buildOverview`, `buildDirectionMap`, `buildMethodLineage`, `buildSharpComparisonRows`, `buildTransferTask`, `buildComparisonWorkspace`, `buildComparisonWorkspaceForPaper`
- `ADAPTATION_STAGE_LABEL` and `LINEAGE_LABEL` constants (used only by mock functions)
- `stageLabel` helper
- `tokenize` helper (if only used here)

Keep only what's still needed:
- Type re-exports if any
- `safeId` if not defined elsewhere

- [ ] **Step 2: Check for imports of deleted exports**

```bash
grep -r "from.*learning/nodeExpansion" src/ --include="*.ts" --include="*.tsx"
```

Update any remaining imports. The `ExpandView.tsx` imports from `kg4Workbench.ts` directly (not from `nodeExpansion.ts`), so it should be safe.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/modules/learning/nodeExpansion.ts
git commit -m "refactor(kg4): delete mock related papers and expansion builder functions"
```

---

### Task 13: Update ExpandView to use real IPC for feedback and reuse

**Files:**
- Modify: `src/renderer/src/components/ExpandView.tsx`

- [ ] **Step 1: Replace local feedback with LLM job**

Remove import of `generateLocalFeedback`. Instead, use `electronApi.kg3.createLlmJob` + `electronApi.kg3.runLlmJob`:

```tsx
const requestFeedback = async () => {
  if (!anchorNode || !workspace) return
  setFeedbackLoading(true)
  try {
    const job = await electronApi.kg3.createLlmJob({
      type: 'generate_reflective_feedback',
      input: {
        node: { id: anchorNode.id, label: anchorNode.label },
        selectedIdeaCardIds: workspace.selectedIdeaCardIds,
        userReflection: reflection
      },
      nodeId: anchorNode.id
    })
    const result = await electronApi.kg3.runLlmJob(job.id)
    if (result.status === 'succeeded' && result.resultJson) {
      setFeedback(result.resultJson as Kg4Feedback)
      const fb = result.resultJson as { suggestedUnderstandingNote?: string }
      setNoteDraft(fb.suggestedUnderstandingNote ?? reflection)
    } else {
      setFeedbackError(result.errorMessage || '反馈生成失败')
    }
  } catch (err) {
    setFeedbackError(err instanceof Error ? err.message : '反馈生成失败')
  } finally {
    setFeedbackLoading(false)
  }
}
```

Add state:
```tsx
const [feedbackLoading, setFeedbackLoading] = useState(false)
const [feedbackError, setFeedbackError] = useState<string | null>(null)
```

- [ ] **Step 2: Replace local reuse suggestions with real IPC**

```tsx
useEffect(() => {
  if (!anchorNode) return
  electronApi.kg4.findReusableNodeMemories({
    nodeId: anchorNode.id,
    topicTags: anchorNode.searchQueries,
    limit: 5
  })
    .then(setReuseSuggestions)
    .catch(() => setReuseSuggestions([]))
}, [anchorNode?.id, session?.id])
```

Remove imports of `buildLocalReuseSuggestions` and `generateLocalFeedback`.

- [ ] **Step 3: Add error display for feedback**

After the feedback button:
```tsx
{feedbackError && (
  <div className="diagnosis-banner diagnosis-banner--fail">
    <span className="diagnosis-icon">!</span>
    <p>{feedbackError}</p>
    <button onClick={requestFeedback} disabled={feedbackLoading}>重试</button>
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/ExpandView.tsx
git commit -m "feat(expand): use real LLM jobs for feedback and real IPC for memory reuse"
```

---

### Task 14: Final cleanup — imports, dead code, typecheck, build

**Files:**
- All remaining files with stale imports

- [ ] **Step 1: Remove remaining references to deleted files**

```bash
grep -r "mock/stages\|diagnosis/diagnose\|diagnosis/types\|buildKg4MockIdeaCards\|generateLocalFeedback\|buildLocalReuseSuggestions\|mockRelatedPapers\|createNodeExpansionSession\|createRealExpansionSession\|advanceExpansionStep\|remainingSteps" src/ --include="*.ts" --include="*.tsx"
```

Fix any remaining imports.

- [ ] **Step 2: Run typecheck**

```bash
cd /home/hanglei/coding/Kapalytics && npx tsc --noEmit 2>&1 | head -80
```

Expected: zero errors (or only pre-existing errors unrelated to our changes).

- [ ] **Step 3: Run build**

```bash
cd /home/hanglei/coding/Kapalytics && npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 4: Final commit**

```bash
git add -u
git commit -m "chore: final cleanup - remove all mock references and dead code

All interaction flows now use real infrastructure:
- Stages: built from LLM analysis tasks
- Diagnosis: real LLM via DeepSeek
- Node expansion: real job orchestration with push progress
- Algorithm ideas: from real job results
- Feedback: LLM-generated
- Memory reuse: real IPC to kg4:findReusableNodeMemories

Deleted files: mock/stages.ts, modules/diagnosis/diagnose.ts, modules/diagnosis/types.ts"
```

---

### Task 15: End-to-end verification

- [ ] **Step 1: Start the app and verify the flow**

```bash
cd /home/hanglei/coding/Kapalytics && npm run dev
```

Verify:
1. App starts with empty stage list (no paper loaded)
2. Upload a PDF → LLM analyzes → 7 stages appear with paper-specific tasks
3. Enter a stage, write answer, submit → LLM diagnosis runs (loading state shown)
4. If diagnosis fails → error message + retry button
5. Click expandable node → expansion tab opens → progress steps show
6. Progress events arrive from backend → steps update in real-time
7. On completion → expansion graph view available
8. Enter Expand View → algorithm idea cards from real job results
9. Request feedback → LLM job runs → feedback displayed

- [ ] **Step 2: Verify no mock references remain**

```bash
grep -r "mock\|fixture\|占位\|placeholder" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".git"
```

Expected: zero results (or only unrelated comments).
