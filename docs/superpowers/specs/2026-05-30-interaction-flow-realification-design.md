# Interaction Flow Real-ification — Design Document

**Date:** 2026-05-30
**Status:** In Review
**Scope:** Remove all mock/placeholder data, connect all interaction flows to real infrastructure

## 1. Problem Statement

The project has a complete backend infrastructure (LLM orchestrator, IPC bridge, paper analysis, job queue) but the frontend still uses mock/placeholder data in critical paths:

| Problem | Details |
|---------|---------|
| Stages always start from mock | `mock/stages.ts` provides 7 hardcoded Transformer stages as initial state; LLM-generated tasks only patch the `task` field |
| Diagnosis is keyword-based | `modules/diagnosis/diagnose.ts` uses local keyword matching; real LLM `aiDiagnose` exists but is only reached via fallback |
| Node expansion uses mock papers | 6 hardcoded PEFT papers in `nodeExpansion.ts`; real `kg4:start-expansion` IPC exists but silently falls back to mock |
| Expansion progress is simulated | `advanceExpansionStep` runs a fake 7-step timer; real job status tracking via `kg4:get-job-status` is unused |
| Feedback is regex-based | `generateLocalFeedback` checks string length and keyword presence instead of calling LLM |
| Reuse suggestions are local | `buildLocalReuseSuggestions` computes matches locally instead of using `kg4:findReusableNodeMemories` |
| Learning report is local stats | `generateLearningReport` aggregates local state; should be derived from real LLM diagnosis results |

## 2. Design Goals

1. **Zero mock data** — delete all mock/placeholder files and logic
2. **Error transparency** — LLM failures show clear errors with retry buttons, never silently fall back
3. **Real progress tracking** — expansion sessions track real job progress via backend push events
4. **Stage framework preserved** — 7 learning stages keep their names/descriptions/order; only `task` is LLM-generated per paper
5. **Minimal backend changes** — add progress push events only; orchestrator and IPC are already well-structured

## 3. Interaction Flow Map (Before → After)

### 3.1 Paper Upload → Analysis → Stages

```
BEFORE:
  selectPdf → extractPdfText (real) → llm:analyze-paper (real) → graph + tasks
  But: stages initialized from mock/stages.ts, tasks only patch .task field

AFTER:
  selectPdf → extractPdfText (real) → llm:analyze-paper (real) → graph + tasks
  stages = buildStagesFromAnalysis(analysis.tasks)
  No mock initial state. If no paper loaded → show empty state with "upload PDF" CTA.
```

**Files changed:**
- `src/renderer/src/domains/stages/StageProvider.tsx` — init `useState<Stage[]>([])`, build stages from LLM analysis
- `src/renderer/src/domains/paper/usePaperAnalysis.ts` — after successful analysis, call `setStages(buildStages(analysis.tasks))`
- DELETE `src/renderer/src/mock/stages.ts`

**Stage framework (kept as static definition):**
```ts
// New file: src/renderer/src/domains/stages/stageFramework.ts
export const STAGE_FRAMEWORK = [
  { id: 'field_positioning', order: 1, name: '领域定位', description: '...' },
  { id: 'problem_motivation', order: 2, name: '问题动机', description: '...' },
  // ... 7 stages total
]
```

### 3.2 Stage Diagnosis

```
BEFORE:
  submitAnswer → try { llm:diagnose (real) } catch { diagnose() (keyword match) }

AFTER:
  submitAnswer → llm:diagnose (real)
  On error → show ErrorBanner with retry button
  No local keyword fallback
```

**Files changed:**
- `src/renderer/src/domains/stages/StageProvider.tsx` — remove catch fallback, add error state + retry
- `src/renderer/src/components/StageDetail.tsx` — add error display + retry button
- DELETE `src/renderer/src/modules/diagnosis/diagnose.ts`
- DELETE `src/renderer/src/modules/diagnosis/types.ts` (types already in shared)

### 3.3 Node Expansion

```
BEFORE:
  startExpansion → createRealExpansionSession → catch → createNodeExpansionSession (mock)
  Loading: advanceExpansionStep timer (fake 7 steps)
  Data: buildKg4ExpansionRecord → buildKg4MockIdeaCards (mock papers)

AFTER:
  startExpansion → kg4:start-expansion (real job) → poll job status
  Loading: listen to expansion:progress events → update step states
  Data: buildKg4ExpansionRecord from real job result JSON
  On error → show error + retry button
```

**Files changed:**
- `src/renderer/src/domains/expansion/ExpansionProvider.tsx` — remove try-catch mock fallback
- `src/renderer/src/domains/expansion/nodeExpansionSessions.ts` — remove `createNodeExpansionSession`, `advanceExpansionStep`, `remainingSteps`; add `updateSessionFromJobProgress`
- `src/renderer/src/modules/learning/kg4Workbench.ts` — remove `buildKg4MockIdeaCards`; `buildKg4ExpansionRecord` takes real job result
- `src/renderer/src/modules/learning/nodeExpansion.ts` — delete `mockRelatedPapers` and all mock builder functions; keep only type re-exports if needed
- `src/main/index.ts` — add progress push in `kg4:start-expansion` handler
- `src/preload/index.ts` — add `onExpansionProgress` listener
- `src/shared/electron-api.ts` — add `onExpansionProgress` to `ElectronApi` type

### 3.4 Algorithm Idea Workbench (Expand View)

```
BEFORE:
  Idea cards: buildKg4MockIdeaCards (local mock matching)
  Feedback: generateLocalFeedback (regex)
  Reuse: buildLocalReuseSuggestions (local computation)

AFTER:
  Idea cards: from real expansion record (populated by LLM job result)
  Feedback: kg3:create-llm-job + kg3:run-llm-job for feedback generation
  Reuse: kg4:findReusableNodeMemories (real IPC)
```

**Files changed:**
- `src/renderer/src/components/ExpandView.tsx` — use real IPC for feedback and reuse suggestions
- `src/renderer/src/modules/learning/kg4Workbench.ts` — delete `generateLocalFeedback`, `buildLocalReuseSuggestions`
- `src/renderer/src/modules/learning/report.ts` — delete `generateLearningReport` (report generated from real diagnosis data)

### 3.5 Progress Push Events

**Key nodes (not every step):**
```
job_created    → "正在准备检索..."
retrieving     → "正在检索相关论文..."
analyzing      → "正在分析算法思想..."
generating     → "正在生成扩展图谱..."
done           → { result }
failed         → { error }
```

**Implementation:**
```
Main process (main/index.ts):
  kg4:start-expansion → enqueueJob → runJob
  In runJob: after each key phase, webContents.send('expansion:progress', payload)

Preload (preload/index.ts):
  onExpansionProgress: (cb) => { ipcRenderer.on('expansion:progress', handler); return unsubscribe }

Frontend (nodeExpansionSessions.ts):
  updateSessionFromJobProgress(session, payload) → update steps status, transition to ready on done
```

## 4. Error Handling Pattern

All components use the same pattern:

```tsx
// State
const [error, setError] = useState<string | null>(null)
const [retrying, setRetrying] = useState(false)

// Action
const handleAction = async () => {
  setError(null)
  try {
    await realApiCall()
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e))
  }
}

// Retry
const handleRetry = async () => {
  setRetrying(true)
  try {
    await handleAction()
  } finally {
    setRetrying(false)
  }
}

// UI
{error && (
  <div className="error-banner">
    <p>{error}</p>
    <button onClick={handleRetry} disabled={retrying}>
      {retrying ? '重试中...' : '重试'}
    </button>
  </div>
)}
```

No component silently falls back to mock data. Every LLM failure surface has explicit error + retry.

## 5. Files to Delete

| File | Reason |
|------|--------|
| `src/renderer/src/mock/stages.ts` | Stages built from LLM analysis tasks |
| `src/renderer/src/modules/diagnosis/diagnose.ts` | Replaced by real LLM `aiDiagnose` |
| `src/renderer/src/modules/diagnosis/types.ts` | Types already in `shared/electron-api.ts` |

## 6. Files to Significantly Modify

| File | Changes |
|------|---------|
| `src/renderer/src/domains/stages/StageProvider.tsx` | Init empty, build from LLM, remove fallback, add error state |
| `src/renderer/src/domains/expansion/ExpansionProvider.tsx` | Remove mock fallback from `startExpansion` |
| `src/renderer/src/domains/expansion/nodeExpansionSessions.ts` | Remove mock session creation + step simulation; add job progress handling |
| `src/renderer/src/modules/learning/kg4Workbench.ts` | Remove `buildKg4MockIdeaCards`, `generateLocalFeedback`, `buildLocalReuseSuggestions`; refactor `buildKg4ExpansionRecord` to take real job result |
| `src/renderer/src/modules/learning/nodeExpansion.ts` | Delete `mockRelatedPapers` and all mock functions; keep shared helpers |
| `src/renderer/src/modules/learning/report.ts` | Simplify — report derived from real diagnosis only |
| `src/renderer/src/components/ExpandView.tsx` | Use real IPC for feedback + reuse suggestions |
| `src/renderer/src/components/StageDetail.tsx` | Add error display + retry button |
| `src/main/index.ts` | Add progress push events in expansion handler |
| `src/preload/index.ts` | Add `onExpansionProgress` to exposed API |
| `src/shared/electron-api.ts` | Add progress event types |
| `src/renderer/src/modules/ipc/electronApi.ts` | Add `onExpansionProgress` wrapper |

## 7. New Files

| File | Purpose |
|------|---------|
| `src/renderer/src/domains/stages/stageFramework.ts` | Static 7-stage framework (name, description, order) separate from per-paper tasks |

## 8. Not In Scope

- Adding new LLM job types (existing orchestrator types are sufficient)
- Adding real external paper retrieval APIs (arXiv, Semantic Scholar)
- Changing the graph fusion algorithm
- Redesigning the UI layout
- Adding new features
- Modifying the LLM prompt schemas

## 9. Implementation Order

### Phase 1: Stages & Diagnosis (core learning loop)
1. Create `stageFramework.ts`
2. Refactor `StageProvider.tsx`: empty init, build from LLM, remove fallback
3. Update `usePaperAnalysis.ts`: build stages from analysis.tasks
4. Add error + retry to `StageDetail.tsx`
5. Delete `mock/stages.ts`, `modules/diagnosis/diagnose.ts`

### Phase 2: Expansion real-ification
6. Add progress push events to `main/index.ts`
7. Add `onExpansionProgress` to preload + shared types
8. Refactor `ExpansionProvider.tsx`: remove mock fallback
9. Refactor `nodeExpansionSessions.ts`: remove mock, add progress handling
10. Update `ExpansionLoadingView.tsx`: use real progress

### Phase 3: Expand View real data
11. Remove `buildKg4MockIdeaCards`, `generateLocalFeedback`, `buildLocalReuseSuggestions`
12. Refactor `buildKg4ExpansionRecord` to use real job results
13. Update `ExpandView.tsx` to use real IPC for feedback + reuse
14. Delete unused mock functions in `nodeExpansion.ts`

### Phase 4: Cleanup
15. Remove `generateLearningReport` local logic
16. Delete remaining mock references
17. Run typecheck + build
18. Verify all flows end-to-end

## 10. Success Criteria

1. `mock/stages.ts` is deleted; stages are empty until a paper is analyzed
2. Uploading and analyzing a PDF populates all 7 stages with paper-specific tasks
3. Stage diagnosis always calls LLM; errors show retry button
4. Node expansion creates real LLM jobs via IPC; loading view shows real progress
5. Algorithm idea cards come from real job results, not mock matching
6. Feedback generation calls LLM, not regex
7. Memory reuse uses `kg4:findReusableNodeMemories`, not local matching
8. Zero imports from deleted mock files
9. `npm run typecheck` and `npm run build` pass with zero errors
10. All existing UI layouts preserved; only data sources changed
