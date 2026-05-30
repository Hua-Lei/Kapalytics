# End-to-End Interaction Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Kapalytics end-to-end flow from paper analysis to node expansion, real retrieval progress, KG4 workbench entry, KG4 expansion record persistence, and same-node record reuse.

**Architecture:** Keep the existing Electron + React workspace architecture. Make `WorkspaceProvider` the single workspace state owner, sync paper context into `ExpansionProvider`, run real retrieval before KG4 LLM expansion in the main process, persist `Kg4NodeExpansionRecord` in a dedicated SQLite/JSON repository path, and restore ready expansion sessions from records by `paperId + nodeId`.

**Tech Stack:** Electron, React 18, TypeScript, better-sqlite3, DeepSeek LLM orchestration, current Context-based renderer state.

---

## File Structure Map

Create:
- `src/main/kg4/expansionRecord.ts` — pure helpers to validate and build `Kg4NodeExpansionRecord` from LLM output and retrieval context.
- `src/renderer/src/domains/expansion/ExpansionPaperSyncBridge.tsx` — sync live paper graph, paper insight, and paper id into `ExpansionProvider`.

Modify:
- `src/shared/kg4.ts` — add `StartKg4ExpansionParams`, `StartKg4ExpansionResult`, `Kg4ExpansionRecordQuery`, and `isKg4NodeExpansionRecord`.
- `src/shared/electron-api.ts` — add `persisting` progress step and KG4 expansion record IPC types.
- `src/shared/kg3.ts` — extend `PaperMemoryRepository` with KG4 expansion record methods.
- `src/main/memory/kg3Repository.ts` — add `kg4_node_expansions` JSON table and file repository support.
- `src/preload/index.ts` — expose new KG4 IPC methods and expanded start params.
- `src/renderer/src/modules/ipc/electronApi.ts` — wrap new KG4 IPC methods.
- `src/main/index.ts` — implement record get/save handlers and real retrieval → LLM → persist expansion pipeline.
- `src/renderer/src/domains/paper/types.ts` — expose `paperId`.
- `src/renderer/src/domains/paper/usePaperAnalysis.ts` — store stable `paperId` in paper context.
- `src/renderer/src/domains/paper/PaperProvider.tsx` — provide `paperId`.
- `src/renderer/src/domains/workspace/WorkspaceProvider.tsx` — accept `initialState` and `onStateChange`.
- `src/renderer/src/App.tsx` — remove unused workspace reducer, load persisted state into `WorkspaceProvider`, add sync bridge.
- `src/renderer/src/domains/expansion/types.ts` — add paper context sync API and richer `startExpansion` return type.
- `src/renderer/src/domains/expansion/nodeExpansionSessions.ts` — add cache session builder, record validation, `persisting` step support.
- `src/renderer/src/domains/expansion/ExpansionProvider.tsx` — use synced paper context, cache lookup, real start params, and early loading session creation.
- `src/renderer/src/components/ai-panel/NodeInspector.tsx` — handle cache/job start states and open loading or graph tabs.
- `src/renderer/src/components/ExpansionLoadingView.tsx` — add `查看 Expansion Graph` action.
- `src/renderer/src/components/ExpandView.tsx` — return to/open expansion graph tab.
- `src/renderer/src/components/CentralWorkspaceRouter.tsx` — sync stage selection to right panel.
- `src/renderer/src/components/ai-panel/StageInspector.tsx` — call `selectStage` when locating central learning area.

Verification:
- `npm run typecheck`
- `npm run build`
- Manual end-to-end checklist in Task 9.

---

### Task 1: Add Shared KG4 Contracts

**Files:**
- Modify: `src/shared/kg4.ts`
- Modify: `src/shared/electron-api.ts`

- [ ] **Step 1: Add shared KG4 request/result/query types and validator**

In `src/shared/kg4.ts`, append these exports after `Kg4NodeLike` and before `normalizeKg4NodeLabel`:

```ts
export interface StartKg4ExpansionParams {
  nodeId: string
  nodeLabel: string
  paperId?: string
  searchQueries?: string[]
  paperInsight?: {
    title?: string
    problem?: string
    method?: string
    contribution?: string
  }
}

export interface StartKg4ExpansionResult {
  sessionId: string
  jobs: Array<{ jobId: string; type: string }>
}

export interface Kg4ExpansionRecordQuery {
  paperId: string
  nodeId: string
}

export function isKg4NodeExpansionRecord(value: unknown): value is Kg4NodeExpansionRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<Kg4NodeExpansionRecord>
  return (
    typeof record.id === 'string' &&
    typeof record.paperId === 'string' &&
    typeof record.nodeId === 'string' &&
    Array.isArray(record.retrievedPaperIds) &&
    Array.isArray(record.algorithmIdeaCards) &&
    Array.isArray(record.expansionGraphNodes) &&
    Array.isArray(record.expansionGraphEdges) &&
    (record.dataCompleteness === 'complete' || record.dataCompleteness === 'partial' || record.dataCompleteness === 'insufficient') &&
    Array.isArray(record.missingDataReasons) &&
    Array.isArray(record.generatedByJobIds) &&
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string'
  )
}
```

- [ ] **Step 2: Update Electron API types**

In `src/shared/electron-api.ts`, change the KG4 import line to:

```ts
import type {
  Kg4ExpansionRecordQuery,
  Kg4NodeExpansionRecord,
  MemoryReuseSuggestion,
  NodeUnderstandingMemory,
  NodeUnderstandingMemoryQuery,
  StartKg4ExpansionParams,
  StartKg4ExpansionResult
} from './kg4'
```

Change `ExpansionProgressEvent.step` to include `persisting`:

```ts
step: 'job_created' | 'retrieving' | 'analyzing' | 'generating' | 'persisting' | 'done' | 'failed'
```

Replace the current `kg4.startExpansion` line with this block:

```ts
    getExpansionRecord: (params: Kg4ExpansionRecordQuery) => Promise<Kg4NodeExpansionRecord | null>
    saveExpansionRecord: (record: Kg4NodeExpansionRecord) => Promise<{ ok: boolean }>
    startExpansion: (params: StartKg4ExpansionParams) => Promise<StartKg4ExpansionResult>
```

The final `kg4` section must contain, in order:

```ts
  kg4: {
    saveNodeUnderstandingMemory: (record: NodeUnderstandingMemory) => Promise<{ ok: boolean }>
    listNodeUnderstandingMemories: (query?: NodeUnderstandingMemoryQuery) => Promise<NodeUnderstandingMemory[]>
    findReusableNodeMemories: (params: {
      nodeId: string
      topicTags?: string[]
      methodFamilyTags?: string[]
      limit?: number
    }) => Promise<MemoryReuseSuggestion[]>
    getExpansionRecord: (params: Kg4ExpansionRecordQuery) => Promise<Kg4NodeExpansionRecord | null>
    saveExpansionRecord: (record: Kg4NodeExpansionRecord) => Promise<{ ok: boolean }>
    startExpansion: (params: StartKg4ExpansionParams) => Promise<StartKg4ExpansionResult>
    onExpansionProgress: (cb: (event: ExpansionProgressEvent) => void) => () => void
    getJobStatus: (jobId: string) => Promise<{ status: string; progressStep?: string; progressMessage?: string; errorMessage?: string }>
    cancelJob: (jobId: string) => Promise<void>
  }
```

- [ ] **Step 3: Run typecheck to verify expected failures are contract consumers**

Run: `npm run typecheck`

Expected: TypeScript fails because repository, preload, renderer IPC, and main process do not implement the new API methods yet. The errors must mention missing `getExpansionRecord`, missing `saveExpansionRecord`, or incompatible `startExpansion` params.

- [ ] **Step 4: Commit shared contracts**

```bash
git add src/shared/kg4.ts src/shared/electron-api.ts
git commit -m "feat(kg4): add expansion record ipc contracts"
```

---

### Task 2: Persist KG4 Expansion Records

**Files:**
- Modify: `src/shared/kg3.ts`
- Modify: `src/main/memory/kg3Repository.ts`

- [ ] **Step 1: Extend repository interface**

In `src/shared/kg3.ts`, change the import from `./kg4` to include `Kg4NodeExpansionRecord`:

```ts
import type { Kg4LLMTaskType, Kg4NodeExpansionRecord, NodeUnderstandingMemory } from './kg4'
```

In `PaperMemoryRepository`, insert these methods after `saveNodeExpansion`:

```ts
  saveKg4ExpansionRecord(record: Kg4NodeExpansionRecord): Promise<void>
  getKg4ExpansionRecord(paperId: string, nodeId: string): Promise<Kg4NodeExpansionRecord | null>
```

- [ ] **Step 2: Update repository imports and table union**

In `src/main/memory/kg3Repository.ts`, change the KG4 import to:

```ts
import type { Kg4NodeExpansionRecord, MemoryReuseSuggestion, NodeUnderstandingMemory, NodeUnderstandingMemoryQuery } from '../../shared/kg4'
```

Add `'kg4_node_expansions'` to `JsonTableName` after `'node_expansions'`:

```ts
  | 'node_expansions'
  | 'kg4_node_expansions'
```

Add it to `JSON_TABLES` after `'node_expansions'`:

```ts
  'node_expansions',
  'kg4_node_expansions',
```

Do not add it to `SNAPSHOT_KEYS`; KG4 records are exposed through dedicated repository methods instead of the KG3 snapshot.

- [ ] **Step 3: Implement file repository methods**

Add this helper near `readSnapshot`:

```ts
type FileStoreWithKg4Expansions = Kg3MemorySnapshot & { kg4NodeExpansions?: Kg4NodeExpansionRecord[] }

function readFileStore(path: string): FileStoreWithKg4Expansions {
  try {
    if (!existsSync(path)) return { ...EMPTY_SNAPSHOT, kg4NodeExpansions: [] }
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<FileStoreWithKg4Expansions>
    return { ...EMPTY_SNAPSHOT, kg4NodeExpansions: [], ...parsed }
  } catch {
    return { ...EMPTY_SNAPSHOT, kg4NodeExpansions: [] }
  }
}
```

In `FilePaperMemoryRepository`, add these methods after `saveNodeExpansion`:

```ts
  async saveKg4ExpansionRecord(record: Kg4NodeExpansionRecord): Promise<void> {
    const store = readFileStore(this.path)
    store.kg4NodeExpansions = upsertById(store.kg4NodeExpansions ?? [], { ...record, updatedAt: now() })
    writeSnapshot(this.path, store)
  }

  async getKg4ExpansionRecord(paperId: string, nodeId: string): Promise<Kg4NodeExpansionRecord | null> {
    const store = readFileStore(this.path)
    return (store.kg4NodeExpansions ?? []).find((record) => record.paperId === paperId && record.nodeId === nodeId) ?? null
  }
```

- [ ] **Step 4: Implement SQLite repository methods and table**

In `SqlitePaperMemoryRepository`, add these methods after `saveNodeExpansion`:

```ts
  async saveKg4ExpansionRecord(record: Kg4NodeExpansionRecord): Promise<void> {
    this.upsertJson('kg4_node_expansions', { ...record, updatedAt: now() }, { paperId: record.paperId, nodeId: record.nodeId })
  }

  async getKg4ExpansionRecord(paperId: string, nodeId: string): Promise<Kg4NodeExpansionRecord | null> {
    const row = this.db
      .prepare('SELECT json FROM kg4_node_expansions WHERE paper_id = ? AND node_id = ? ORDER BY updated_at DESC LIMIT 1')
      .get(paperId, nodeId) as JsonRow | undefined
    return row ? JSON.parse(row.json) as Kg4NodeExpansionRecord : null
  }
```

In `initialize()`, add the table after `node_expansions`:

```sql
      CREATE TABLE IF NOT EXISTS kg4_node_expansions (id TEXT PRIMARY KEY, paper_id TEXT NOT NULL, node_id TEXT NOT NULL, json TEXT NOT NULL, created_at TEXT, updated_at TEXT);
```

Add the index after `idx_diagnoses_node_id`:

```sql
      CREATE INDEX IF NOT EXISTS idx_kg4_node_expansions_lookup ON kg4_node_expansions(paper_id, node_id, updated_at);
```

In `insertStatementForTable`, add:

```ts
    case 'kg4_node_expansions':
      return db.prepare('INSERT OR REPLACE INTO kg4_node_expansions (id, paper_id, node_id, json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
```

In `paramsForTable`, add:

```ts
    case 'kg4_node_expansions':
      return [record.id, indexes.paperId ?? null, indexes.nodeId ?? null, json, record.createdAt ?? null, record.updatedAt ?? null]
```

- [ ] **Step 5: Run typecheck to verify remaining failures move to IPC/main/renderer**

Run: `npm run typecheck`

Expected: repository interface errors are gone. Remaining errors are missing Electron API implementation or `ExpansionProgressEvent.step` exhaustiveness.

- [ ] **Step 6: Commit persistence layer**

```bash
git add src/shared/kg3.ts src/main/memory/kg3Repository.ts
git commit -m "feat(kg4): persist expansion records"
```

---

### Task 3: Wire KG4 IPC Bridge

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/modules/ipc/electronApi.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Update preload imports**

In `src/preload/index.ts`, replace the KG4 import with:

```ts
import type {
  Kg4ExpansionRecordQuery,
  Kg4NodeExpansionRecord,
  MemoryReuseSuggestion,
  NodeUnderstandingMemory,
  NodeUnderstandingMemoryQuery,
  StartKg4ExpansionParams,
  StartKg4ExpansionResult
} from '../shared/kg4'
```

- [ ] **Step 2: Expose expansion record IPC in preload**

In the exposed `kg4` object, insert before `startExpansion`:

```ts
    getExpansionRecord: (params: Kg4ExpansionRecordQuery): Promise<Kg4NodeExpansionRecord | null> =>
      ipcRenderer.invoke('kg4:get-expansion-record', params),
    saveExpansionRecord: (record: Kg4NodeExpansionRecord): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('kg4:save-expansion-record', record),
```

Replace the current `startExpansion` signature with:

```ts
    startExpansion: (params: StartKg4ExpansionParams): Promise<StartKg4ExpansionResult> =>
      ipcRenderer.invoke('kg4:start-expansion', params),
```

- [ ] **Step 3: Add renderer IPC wrappers**

In `src/renderer/src/modules/ipc/electronApi.ts`, inside `kg4`, insert before `startExpansion`:

```ts
    getExpansionRecord: (params: Parameters<ElectronApi['kg4']['getExpansionRecord']>[0]) =>
      getApi()?.kg4?.getExpansionRecord?.(params) ?? Promise.resolve(null),
    saveExpansionRecord: (record: Parameters<ElectronApi['kg4']['saveExpansionRecord']>[0]) =>
      getApi()?.kg4?.saveExpansionRecord?.(record) ?? Promise.resolve({ ok: false }),
```

- [ ] **Step 4: Add main IPC record handlers**

In `src/main/index.ts`, add KG4 imports near existing shared imports:

```ts
import type { Kg4ExpansionRecordQuery, Kg4NodeExpansionRecord } from '../shared/kg4'
import { isKg4NodeExpansionRecord } from '../shared/kg4'
```

Add these handlers after `kg4:find-reusable-node-memories` and before `kg4:start-expansion`:

```ts
  ipcMain.handle('kg4:get-expansion-record', async (_e, params: Kg4ExpansionRecordQuery) => {
    const record = await paperMemoryRepository.getKg4ExpansionRecord(params.paperId, params.nodeId)
    return record && isKg4NodeExpansionRecord(record) ? record : null
  })

  ipcMain.handle('kg4:save-expansion-record', async (_e, record: Kg4NodeExpansionRecord) => {
    if (!isKg4NodeExpansionRecord(record)) throw new Error('invalid_kg4_expansion_record')
    await paperMemoryRepository.saveKg4ExpansionRecord(record)
    return { ok: true }
  })
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`

Expected: IPC bridge errors for new methods are gone. Remaining errors relate to expanded `startExpansion` params or `persisting` progress handling.

- [ ] **Step 6: Commit IPC bridge**

```bash
git add src/preload/index.ts src/renderer/src/modules/ipc/electronApi.ts src/main/index.ts
git commit -m "feat(kg4): expose expansion record ipc"
```

---

### Task 4: Build Real Main-Process Expansion Pipeline

**Files:**
- Create: `src/main/kg4/expansionRecord.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Create KG4 expansion record helper**

Create `src/main/kg4/expansionRecord.ts`:

```ts
import { createHash } from 'crypto'
import type { DedupedPaperCandidate } from '../../shared/kg3'
import type {
  AlgorithmIdeaCard,
  ExpansionGraphEdge,
  ExpansionGraphNode,
  FieldCognitionView,
  Kg4NodeExpansionRecord
} from '../../shared/kg4'
import { isKg4NodeExpansionRecord } from '../../shared/kg4'

function now(): string {
  return new Date().toISOString()
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha1').update(value).digest('hex').slice(0, 16)}`
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function asCompleteness(value: unknown, fallback: Kg4NodeExpansionRecord['dataCompleteness']): Kg4NodeExpansionRecord['dataCompleteness'] {
  return value === 'complete' || value === 'partial' || value === 'insufficient' ? value : fallback
}

export function candidatePaperId(candidate: DedupedPaperCandidate): string {
  return candidate.canonicalId
}

export function buildExpansionRecord(params: {
  paperId: string
  nodeId: string
  jobId: string
  retrievedPapers: DedupedPaperCandidate[]
  llmOutput: unknown
}): Kg4NodeExpansionRecord {
  const output = params.llmOutput && typeof params.llmOutput === 'object'
    ? params.llmOutput as Record<string, unknown>
    : {}
  const timestamp = now()
  const retrievedPaperIds = asArray<string>(output.retrievedPaperIds).length
    ? asArray<string>(output.retrievedPaperIds)
    : params.retrievedPapers.map(candidatePaperId)

  const record: Kg4NodeExpansionRecord = {
    id: stableId('kg4_expansion', `${params.paperId}:${params.nodeId}:${params.jobId}`),
    paperId: params.paperId,
    nodeId: params.nodeId,
    retrievedPaperIds,
    algorithmIdeaCards: asArray<AlgorithmIdeaCard>(output.algorithmIdeaCards),
    expansionGraphNodes: asArray<ExpansionGraphNode>(output.expansionGraphNodes),
    expansionGraphEdges: asArray<ExpansionGraphEdge>(output.expansionGraphEdges),
    fieldCognitionView: output.fieldCognitionView as FieldCognitionView | undefined,
    dataCompleteness: asCompleteness(output.dataCompleteness, retrievedPaperIds.length ? 'partial' : 'insufficient'),
    missingDataReasons: asArray<string>(output.missingDataReasons),
    generatedByJobIds: [params.jobId],
    createdAt: timestamp,
    updatedAt: timestamp
  }

  if (!isKg4NodeExpansionRecord(record)) throw new Error('invalid_kg4_expansion_record')
  return record
}
```

- [ ] **Step 2: Update main imports**

In `src/main/index.ts`, extend imports:

```ts
import type { Kg4ExpansionRecordQuery, Kg4NodeExpansionRecord, StartKg4ExpansionParams } from '../shared/kg4'
import { isKg4NodeExpansionRecord } from '../shared/kg4'
import { buildExpansionRecord, candidatePaperId } from './kg4/expansionRecord'
```

- [ ] **Step 3: Replace `kg4:start-expansion` handler**

Replace the entire existing `ipcMain.handle('kg4:start-expansion', ...)` block with:

```ts
  ipcMain.handle('kg4:start-expansion', async (_e, params: StartKg4ExpansionParams) => {
    const sessionId = `expansion_${params.nodeId}_${Date.now()}`
    const searchQuery = [params.nodeLabel, ...(params.searchQueries ?? [])].filter(Boolean).join(' ')

    mainWindow.webContents.send('expansion:progress', {
      sessionId,
      jobId: '',
      step: 'job_created',
      message: '正在准备检索任务...'
    })

    ;(async () => {
      let jobId = ''
      try {
        mainWindow.webContents.send('expansion:progress', {
          sessionId,
          jobId,
          step: 'retrieving',
          message: '正在检索相关论文...'
        })

        const { candidates, providerStatus } = await searchPapers({
          query: searchQuery || params.nodeLabel,
          nodeId: params.nodeId,
          paperId: params.paperId,
          searchQueries: params.searchQueries,
          maxResults: 8,
          requireAbstract: true
        })
        const relatedPaperIds = candidates.map(candidatePaperId)

        const job = await llmTaskOrchestrator.createJob({
          type: 'expand_node_retrieve_context',
          input: {
            currentNode: {
              id: params.nodeId,
              label: params.nodeLabel,
              searchQueries: params.searchQueries ?? []
            },
            currentPaperInsight: params.paperInsight,
            retrievedPapers: candidates,
            providerStatus
          },
          nodeId: params.nodeId,
          paperId: params.paperId,
          relatedPaperIds,
          sessionId
        })
        jobId = job.id

        mainWindow.webContents.send('expansion:progress', {
          sessionId,
          jobId,
          step: 'analyzing',
          message: '正在分析算法思想...'
        })

        const result = await llmTaskOrchestrator.runJob(job.id)
        if (result.status !== 'succeeded' && result.status !== 'cache_hit') {
          throw new Error(result.errorMessage || '展开任务失败')
        }

        mainWindow.webContents.send('expansion:progress', {
          sessionId,
          jobId,
          step: 'generating',
          message: '正在生成扩展图谱...'
        })

        const record = buildExpansionRecord({
          paperId: params.paperId ?? 'current-paper',
          nodeId: params.nodeId,
          jobId,
          retrievedPapers: candidates,
          llmOutput: result.resultJson
        })

        mainWindow.webContents.send('expansion:progress', {
          sessionId,
          jobId,
          step: 'persisting',
          message: '正在保存展开结果...'
        })
        await paperMemoryRepository.saveKg4ExpansionRecord(record)

        mainWindow.webContents.send('expansion:progress', {
          sessionId,
          jobId,
          step: 'done',
          message: '展开完成',
          result: record
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        mainWindow.webContents.send('expansion:progress', {
          sessionId,
          jobId,
          step: 'failed',
          message,
          error: message
        })
      }
    })()

    return { sessionId, jobs: [] }
  })
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: main-process `startExpansion` errors are gone. Remaining errors are in renderer expansion session/progress handling.

- [ ] **Step 5: Commit main pipeline**

```bash
git add src/main/kg4/expansionRecord.ts src/main/index.ts
git commit -m "feat(kg4): run real expansion retrieval pipeline"
```

---

### Task 5: Make Workspace State Single-Sourced

**Files:**
- Modify: `src/renderer/src/domains/workspace/WorkspaceProvider.tsx`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Update WorkspaceProvider props and state change callback**

Replace `WorkspaceProvider` in `src/renderer/src/domains/workspace/WorkspaceProvider.tsx` with:

```tsx
import { createContext, useCallback, useEffect, useReducer, type ReactNode } from 'react'
import { initialWorkspaceState, workspaceReducer } from './workspaceReducer'
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

export function WorkspaceProvider({
  children,
  initialState = initialWorkspaceState,
  onStateChange
}: {
  children: ReactNode
  initialState?: WorkspaceState
  onStateChange?: (state: WorkspaceState) => void
}) {
  const [state, dispatch] = useReducer(workspaceReducer, initialState)

  useEffect(() => {
    onStateChange?.(state)
  }, [onStateChange, state])

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

- [ ] **Step 2: Remove unused reducer from App**

In `src/renderer/src/App.tsx`, change the first import to remove `useReducer`:

```ts
import { useState, useCallback, useEffect, useRef } from 'react'
```

Change workspace imports to:

```ts
import { initialWorkspaceState } from './domains/workspace/workspaceReducer'
import type { WorkspaceState } from './domains/workspace/types'
```

Remove this line:

```ts
  const [workspaceState, dispatchWorkspace] = useReducer(workspaceReducer, initialWorkspaceState)
```

Add this state in its place:

```ts
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>(initialWorkspaceState)
```

In the load effect, replace `dispatchWorkspace({ type: 'restore_state', state: data.workspaceState as WorkspaceState })` with:

```ts
              setWorkspaceState(data.workspaceState as WorkspaceState)
```

Add this callback before `return`:

```ts
  const handleWorkspaceStateChange = useCallback((nextState: WorkspaceState) => {
    setWorkspaceState(nextState)
  }, [])
```

Change `PaperProvider` prop:

```tsx
      <PaperProvider onAnalysisComplete={() => {}} setStagesRef={setStagesRef}>
```

Change `WorkspaceProvider` usage:

```tsx
              <WorkspaceProvider initialState={workspaceState} onStateChange={handleWorkspaceStateChange}>
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: App workspace reducer errors are gone.

- [ ] **Step 4: Commit workspace state fix**

```bash
git add src/renderer/src/domains/workspace/WorkspaceProvider.tsx src/renderer/src/App.tsx
git commit -m "fix(workspace): persist live workspace state"
```

---

### Task 6: Expose Paper Context to Expansion Domain

**Files:**
- Modify: `src/renderer/src/domains/paper/types.ts`
- Modify: `src/renderer/src/domains/paper/usePaperAnalysis.ts`
- Modify: `src/renderer/src/domains/paper/PaperProvider.tsx`
- Create: `src/renderer/src/domains/expansion/ExpansionPaperSyncBridge.tsx`
- Modify: `src/renderer/src/domains/expansion/types.ts`
- Modify: `src/renderer/src/domains/expansion/ExpansionProvider.tsx`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Add paperId to paper context types**

In `src/renderer/src/domains/paper/types.ts`, add `paperId` after `pdfUrl`:

```ts
  paperId: string | null
```

- [ ] **Step 2: Store paperId in usePaperAnalysis**

In `usePaperAnalysis`, add state after `pdfPath`:

```ts
  const [paperId, setPaperId] = useState<string | null>(null)
```

In `selectPdf`, after `setPdfPath(selected.filePath)`, add:

```ts
    setPaperId(makeLocalPaperId(selected.fileUrl))
```

In `analyzePaper`, replace:

```ts
        const paperId = makeLocalPaperId(pdfUrl)
```

with:

```ts
        const activePaperId = paperId ?? makeLocalPaperId(pdfUrl)
```

Then replace every use of that local `paperId` in the save/fuse block with `activePaperId`:

```ts
          paperId: activePaperId,
```

```ts
        }).then(() => electronApi.kg3.fusePaperGraph(activePaperId)).catch((err) => {
```

Return `paperId` in the returned object after `pdfUrl`:

```ts
    paperId,
```

- [ ] **Step 3: Provide paperId from PaperProvider**

In `PaperProvider.tsx`, include `paperId` in the destructuring:

```ts
    graph, paperId, paperInsight, pdfUrl, selectPdf, setGraph, setPaperInsight, setPdfUrl
```

Add it to the context value after `pdfUrl`:

```ts
      pdfUrl, paperId, graph, paperInsight, analysisSteps, generating, genError, genProgress,
```

- [ ] **Step 4: Add expansion paper context types**

In `src/renderer/src/domains/expansion/types.ts`, add imports:

```ts
import type { GraphNode, PaperInsight } from '../../../../shared/paper'
```

Replace the existing `setGraphNodes` and `setPaperInsightRef` action lines with:

```ts
  setPaperContext: (context: { graphNodes: GraphNode[]; paperInsight: PaperInsight | null; paperId: string | null }) => void
```

- [ ] **Step 5: Create ExpansionPaperSyncBridge**

Create `src/renderer/src/domains/expansion/ExpansionPaperSyncBridge.tsx`:

```tsx
import { useEffect } from 'react'
import { usePaper } from '../paper/usePaper'
import { useExpansion } from './useExpansion'

export function ExpansionPaperSyncBridge() {
  const { graph, paperId, paperInsight } = usePaper()
  const { setPaperContext } = useExpansion()

  useEffect(() => {
    setPaperContext({ graphNodes: graph.nodes, paperInsight, paperId })
  }, [graph.nodes, paperId, paperInsight, setPaperContext])

  return null
}
```

- [ ] **Step 6: Update ExpansionProvider paper context refs**

In `ExpansionProvider.tsx`, replace refs:

```ts
  const graphRef = useRef<GraphNode[]>([])
  const paperInsightRef = useRef<PaperInsight | null>(null)
  const paperIdRef = useRef<string | null>(null)
```

Replace `setGraphNodes` and `setPaperInsightRef` callbacks with:

```ts
  const setPaperContext = useCallback((context: { graphNodes: GraphNode[]; paperInsight: PaperInsight | null; paperId: string | null }) => {
    graphRef.current = context.graphNodes
    paperInsightRef.current = context.paperInsight
    paperIdRef.current = context.paperId
  }, [])
```

Change the provider value at the bottom to:

```tsx
    <ExpansionContext.Provider value={{ sessions, setSessions, startExpansion, selectExpansionNode, clearExpansionGraph, setPaperContext }}>
```

- [ ] **Step 7: Mount sync bridge in App**

In `src/renderer/src/App.tsx`, add import:

```ts
import { ExpansionPaperSyncBridge } from './domains/expansion/ExpansionPaperSyncBridge'
```

Inside `<ExpansionProvider>`, before `<MemoryProvider>`, add:

```tsx
            <ExpansionPaperSyncBridge />
```

- [ ] **Step 8: Run typecheck**

Run: `npm run typecheck`

Expected: paper context and expansion context type errors are gone. Remaining errors relate to `startExpansion` return type and session progress.

- [ ] **Step 9: Commit paper-expansion sync**

```bash
git add src/renderer/src/domains/paper/types.ts src/renderer/src/domains/paper/usePaperAnalysis.ts src/renderer/src/domains/paper/PaperProvider.tsx src/renderer/src/domains/expansion/ExpansionPaperSyncBridge.tsx src/renderer/src/domains/expansion/types.ts src/renderer/src/domains/expansion/ExpansionProvider.tsx src/renderer/src/App.tsx
git commit -m "fix(expansion): sync paper context into expansion provider"
```

---

### Task 7: Restore Expansion Sessions from Cache and Handle Real Progress

**Files:**
- Modify: `src/renderer/src/domains/expansion/nodeExpansionSessions.ts`
- Modify: `src/renderer/src/domains/expansion/types.ts`
- Modify: `src/renderer/src/domains/expansion/ExpansionProvider.tsx`

- [ ] **Step 1: Add start result type and cache session helper**

In `src/renderer/src/domains/expansion/types.ts`, add:

```ts
export interface StartExpansionUiResult {
  sessionId: string
  status: 'loading' | 'ready-from-cache'
}
```

Change `startExpansion` in `ExpansionActions` to:

```ts
  startExpansion: (nodeId: string) => Promise<StartExpansionUiResult | undefined>
```

In `src/renderer/src/domains/expansion/nodeExpansionSessions.ts`, add import:

```ts
import type { GraphNode } from '../../../../shared/paper'
```

Add this constant after interfaces:

```ts
export const EXPANSION_STEPS: NodeExpansionStep[] = [
  { id: 'job_created', label: '创建检索任务', status: 'pending', detail: '正在准备检索任务...' },
  { id: 'retrieving', label: '检索相关论文', status: 'pending', detail: '检索本地和外部论文源...' },
  { id: 'analyzing', label: '分析算法思想', status: 'pending', detail: 'LLM 抽取和对比算法思想...' },
  { id: 'generating', label: '生成扩展图谱', status: 'pending', detail: '构建临时扩展节点和边...' },
  { id: 'persisting', label: '保存展开结果', status: 'pending', detail: '写入本地数据库...' },
  { id: 'done', label: '完成', status: 'pending', detail: '展开结果已就绪' }
]
```

Add this helper:

```ts
export function createReadySessionFromRecord(record: Kg4NodeExpansionRecord, node: GraphNode): NodeExpansionSession {
  const now = new Date().toISOString()
  return {
    id: `expansion_${record.nodeId}_${Date.now()}`,
    nodeId: record.nodeId,
    nodeLabel: node.label,
    paperId: record.paperId,
    status: 'ready',
    currentStepId: 'done',
    steps: EXPANSION_STEPS.map((step) => ({ ...step, status: 'done' as const })),
    expansionGraph: {
      anchorNodeId: record.nodeId,
      nodes: record.expansionGraphNodes,
      edges: record.expansionGraphEdges
    },
    expansionRecord: record,
    usesMockData: false,
    createdAt: now,
    updatedAt: now
  }
}
```

- [ ] **Step 2: Update progress step order and done payload**

In `updateSessionFromJobProgress`, change `stepOrder` to:

```ts
  const stepOrder = ['job_created', 'retrieving', 'analyzing', 'generating', 'persisting', 'done'] as const
```

Replace the `event.step === 'done'` block with:

```ts
  if (event.step === 'done') {
    const record = event.result as Kg4NodeExpansionRecord | undefined
    const expansionGraph: Kg4ExpansionGraphLayer | undefined = record ? {
      anchorNodeId: session.nodeId,
      nodes: record.expansionGraphNodes,
      edges: record.expansionGraphEdges
    } : undefined

    return {
      ...session,
      status: record ? 'ready' : 'empty',
      currentStepId: 'done',
      steps: steps.map((step) => step.id === 'done' ? { ...step, status: 'done' as const, detail: event.message } : step),
      expansionGraph,
      expansionRecord: record,
      errorMessage: record ? undefined : '展开任务完成，但没有返回可展示的 KG4 expansion record。',
      updatedAt: now
    }
  }
```

- [ ] **Step 3: Replace ExpansionProvider startExpansion**

In `ExpansionProvider.tsx`, import helpers:

```ts
import { createReadySessionFromRecord, EXPANSION_STEPS, updateSessionFromJobProgress } from '../../domains/expansion/nodeExpansionSessions'
```

Replace `startExpansion` with:

```ts
  const startExpansion = useCallback(async (nodeId: string) => {
    const node = graphRef.current.find((n) => n.id === nodeId)
    if (!node) return undefined
    const paperId = paperIdRef.current

    if (paperId) {
      const cached = await electronApi.kg4.getExpansionRecord({ paperId, nodeId: node.id })
      if (cached) {
        const session = createReadySessionFromRecord(cached, node)
        setSessions((prev) => ({ ...prev, [session.id]: session }))
        return { sessionId: session.id, status: 'ready-from-cache' as const }
      }
    }

    const now = new Date().toISOString()
    const sessionId = `expansion_${node.id}_${Date.now()}`
    const session: NodeExpansionSession = {
      id: sessionId,
      nodeId: node.id,
      nodeLabel: node.label,
      paperId: paperId ?? undefined,
      status: 'loading',
      currentStepId: 'job_created',
      steps: EXPANSION_STEPS.map((step) => step.id === 'job_created' ? { ...step, status: 'running' as const } : step),
      usesMockData: false,
      createdAt: now,
      updatedAt: now
    }
    setSessions((prev) => ({ ...prev, [session.id]: session }))

    const result = await electronApi.kg4.startExpansion({
      nodeId: node.id,
      nodeLabel: node.label,
      paperId: paperId ?? undefined,
      searchQueries: node.searchQueries ?? [],
      paperInsight: paperInsightRef.current ? {
        title: paperInsightRef.current.title,
        problem: paperInsightRef.current.problem,
        method: paperInsightRef.current.method,
        contribution: paperInsightRef.current.contribution
      } : undefined
    })

    if (result.sessionId !== sessionId) {
      setSessions((prev) => {
        const existing = prev[sessionId]
        if (!existing) return prev
        const { [sessionId]: _removed, ...rest } = prev
        return { ...rest, [result.sessionId]: { ...existing, id: result.sessionId, updatedAt: new Date().toISOString() } }
      })
      return { sessionId: result.sessionId, status: 'loading' as const }
    }

    return { sessionId, status: 'loading' as const }
  }, [])
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: expansion provider and session typing errors are gone.

- [ ] **Step 5: Commit expansion session cache/progress**

```bash
git add src/renderer/src/domains/expansion/nodeExpansionSessions.ts src/renderer/src/domains/expansion/types.ts src/renderer/src/domains/expansion/ExpansionProvider.tsx
git commit -m "feat(expansion): restore sessions from kg4 records"
```

---

### Task 8: Complete UI Navigation and Selection Wiring

**Files:**
- Modify: `src/renderer/src/components/ai-panel/NodeInspector.tsx`
- Modify: `src/renderer/src/components/ExpansionLoadingView.tsx`
- Modify: `src/renderer/src/components/ExpandView.tsx`
- Modify: `src/renderer/src/components/CentralWorkspaceRouter.tsx`
- Modify: `src/renderer/src/components/ai-panel/StageInspector.tsx`

- [ ] **Step 1: Update NodeInspector open behavior**

In `NodeInspector.tsx`, change workspace destructuring:

```ts
  const { openTab } = useWorkspace()
```

Keep `openTab`; replace `requestExpansion` with:

```ts
  const requestExpansion = async () => {
    setExpansionRequested(true)
    try {
      const result = await startExpansion(node.id)
      if (!result) return
      openTab({
        id: result.status === 'ready-from-cache' ? `expansion_graph_${result.sessionId}` : result.sessionId,
        type: result.status === 'ready-from-cache' ? 'expansion_graph' : 'node_expansion_loading',
        title: result.status === 'ready-from-cache' ? `Expansion Graph: ${node.label}` : `Expand: ${node.label}`,
        nodeId: node.id,
        expansionId: result.sessionId,
        closable: true,
        status: result.status === 'ready-from-cache' ? 'ready' : 'loading'
      })
    } finally {
      setExpansionRequested(false)
    }
  }
```

Change the button to disable while starting:

```tsx
          <button className="stage-btn stage-btn--primary" onClick={requestExpansion} disabled={expansionRequested}>展开该方向</button>
```

- [ ] **Step 2: Add Expansion Graph action to loading view**

In `ExpansionLoadingView.tsx`, change workspace destructuring:

```ts
  const { activeTab, openTab } = useWorkspace()
```

Add this function before return:

```ts
  const openExpansionGraph = () => {
    openTab({
      id: `expansion_graph_${session.id}`,
      type: 'expansion_graph',
      title: `Expansion Graph: ${session.nodeLabel}`,
      nodeId: session.nodeId,
      expansionId: session.id,
      closable: true,
      status: 'ready'
    })
  }
```

Replace the ready note section with:

```tsx
      {session.status === 'ready' && (
        <section className="expansion-loading-note">
          <strong>展开完成</strong>
          <p>可以进入 Expansion Graph View 查看扩展图谱。</p>
          <button className="stage-btn stage-btn--primary" onClick={openExpansionGraph}>查看 Expansion Graph</button>
        </section>
      )}
```

- [ ] **Step 3: Fix ExpandView back navigation**

In `ExpandView.tsx`, find the back button handler that activates `session.id`. Replace it with a helper:

```ts
  const openExpansionGraph = () => {
    openTab({
      id: `expansion_graph_${session.id}`,
      type: 'expansion_graph',
      title: `Expansion Graph: ${session.nodeLabel}`,
      nodeId: session.nodeId,
      expansionId: session.id,
      closable: true,
      status: 'ready'
    })
  }
```

Use `onClick={openExpansionGraph}` for the “返回 Expansion Graph” button. If the file currently only destructures `activateTab`, change the workspace destructuring to include `openTab`.

- [ ] **Step 4: Sync central stage selection to AI panel**

In `CentralWorkspaceRouter.tsx`, change `StageLearningWorkspace` to import workspace context by adding inside function:

```ts
  const { selectObject } = useWorkspace()
```

Add handler:

```ts
  const handleSelectStage = (stageId: string) => {
    selectStage(stageId)
    selectObject({ type: 'learning_stage', id: stageId })
  }
```

Change `LearningPath` prop:

```tsx
        <LearningPath stages={stages} selectedStageId={selectedStageId} onSelectStage={handleSelectStage} />
```

- [ ] **Step 5: Make StageInspector select the central stage**

In `StageInspector.tsx`, add import:

```ts
import { useStages } from '../../domains/stages/useStages'
```

Inside component, add:

```ts
  const { selectStage } = useStages()
```

Update `handleOpenStageLearning`:

```ts
  const handleOpenStageLearning = () => {
    selectStage(stage.id)
    activateTab('stage_learning')
    selectObject({ type: 'learning_stage', id: stage.id })
  }
```

- [ ] **Step 6: Run typecheck and build**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: Commit UI flow completion**

```bash
git add src/renderer/src/components/ai-panel/NodeInspector.tsx src/renderer/src/components/ExpansionLoadingView.tsx src/renderer/src/components/ExpandView.tsx src/renderer/src/components/CentralWorkspaceRouter.tsx src/renderer/src/components/ai-panel/StageInspector.tsx
git commit -m "fix(ui): complete expansion navigation flow"
```

---

### Task 9: Verify End-to-End Behavior

**Files:**
- No source edits expected.

- [ ] **Step 1: Run final automated verification**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 2: Launch the app**

Run: `npm run dev`

Expected: Electron window opens without renderer crash.

- [ ] **Step 3: Verify paper analysis flow**

Manual checks:
- Select a PDF.
- Run analysis.
- Confirm the visible workspace is Paper Graph after analysis.
- Confirm graph nodes appear.
- Confirm Stage Learning has 7 stages.

- [ ] **Step 4: Verify node expansion flow**

Manual checks:
- Click an expandable graph node.
- Confirm `NodeInspector` appears in the right panel.
- Click `展开该方向`.
- Confirm a loading tab opens.
- Confirm loading timeline reaches `retrieving`, `analyzing`, `generating`, `persisting`, and `done` or a visible error state.
- On success, click `查看 Expansion Graph`.
- Confirm Expansion Graph tab opens and temporary nodes are visible.
- Click a temporary node.
- Confirm `ExpansionNodeInspector` appears in the right panel.
- Click `进入 Expand View`.
- Confirm full KG4 workbench opens.

- [ ] **Step 5: Verify KG4 record reuse**

Manual checks:
- Return to Paper Graph.
- Click the same graph node.
- Click `展开该方向` again.
- Confirm Expansion Graph opens directly from cache without waiting for the full loading timeline.

- [ ] **Step 6: Verify record-level recovery after restart**

Manual checks:
- Stop the app.
- Start the app again.
- Load or analyze the same paper so the same graph node exists.
- Click the same expandable node.
- Click `展开该方向`.
- Confirm Expansion Graph opens from persisted KG4 expansion record.

- [ ] **Step 7: Commit verification notes if docs changed**

If no files changed during verification, do not commit.

If a small verification note is added to docs, commit it:

```bash
git add docs/superpowers/plans/2026-05-30-end-to-end-interaction-flow.md
git commit -m "docs: record end-to-end verification steps"
```

---

## Self-Review

Spec coverage:
- Single workspace state source: Task 5.
- Paper graph sync into expansion provider: Task 6.
- Real retrieval before LLM expansion: Task 4.
- Progress phases including persistence: Tasks 1, 4, 7, 8.
- KG4 expansion record persistence: Tasks 2 and 3.
- Same-node record reuse: Task 7 and Task 9.
- Loading-to-graph navigation: Task 8.
- ExpandView back navigation: Task 8.
- Stage/right-panel sync: Task 8.

Placeholder scan:
- The plan contains no `TBD`, no `TODO`, and no steps that ask the implementer to invent missing behavior.

Type consistency:
- `StartKg4ExpansionParams`, `StartKg4ExpansionResult`, `Kg4ExpansionRecordQuery`, and `Kg4NodeExpansionRecord` are introduced in Task 1 and used consistently in Tasks 3, 4, and 7.
- `persisting` is introduced in Task 1 and handled in Tasks 4 and 7.
- `setPaperContext` replaces `setGraphNodes` and `setPaperInsightRef` consistently in Tasks 6 and 7.
