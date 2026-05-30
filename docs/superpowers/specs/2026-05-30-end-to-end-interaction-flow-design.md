# End-to-End Interaction Flow Completion — Design Document

**Date:** 2026-05-30
**Status:** Approved for planning
**Scope:** Complete the current Kapalytics interaction flow from paper analysis through node expansion, loading progress, KG4 workbench, database persistence, and record-level recovery.

## 1. Goal

The project already has most of the infrastructure needed for a real workflow: Electron IPC, LLM paper analysis, LLM job orchestration, KG3 persistence, paper search cache, KG4 workbench UI, and progress events. The current failure mode is not lack of components; it is broken connections between them.

This design makes the existing pieces work as one end-to-end flow:

```text
PDF analysis
→ graph and learning stages
→ graph node selection
→ NodeInspector expansion entry
→ real retrieval and LLM node expansion in main
→ renderer loading progress
→ Expansion Graph
→ Expand View
→ feedback and memory save
→ KG4 expansion record persistence
→ later same-node reuse from database
```

The selected product scope is **complete persistence at record level**, not full workspace-session restore. After restart, the app does not restore old expansion tabs. Instead, when the same paper graph and node are available again, clicking the same expandable node can reuse the stored KG4 expansion record and open a ready Expansion Graph without rerunning retrieval or LLM expansion.

## 2. Current Findings

### 2.1 Working Pieces

- Paper analysis already calls real LLM analysis and pushes `llm:progress` to the renderer.
- Stages are generated from LLM paper tasks and no longer initialize from mock stage data.
- Stage diagnosis calls real LLM diagnosis and surfaces errors.
- Workspace shell exists: `TopBar`, `WorkspaceSidebar`, `CentralWorkspaceRouter`, and `AIContextPanel`.
- `ExpansionLoadingView`, `ExpansionGraphView`, `ExpansionNodeInspector`, and `ExpandView` exist.
- `expansion:progress` is exposed through `main`, `preload`, shared API types, and renderer IPC wrapper.
- KG3 memory persists paper records, graph nodes/edges, paper insight, search cache, merged graph memory, LLM jobs, and node understanding memories.
- `ExpandView` already uses real IPC for feedback jobs and KG4 node-understanding memory reuse/save.

### 2.2 Broken Connections

- `App.tsx` owns one workspace reducer for persistence, while `WorkspaceProvider` owns another reducer used by the UI. Persisted workspace state is not the live workspace state.
- `PaperProvider` calls `onAnalysisComplete` on an unused reducer, so paper analysis completion does not activate the visible Paper Graph tab.
- `ExpansionProvider.startExpansion` reads `graphRef.current`, but no live code calls `setGraphNodes`, so the graph node lookup can fail and expansion never starts.
- The graph plus marker is visual only because it is rendered under `pointerEvents="none"`; the reliable expansion entry is the right-panel `NodeInspector`.
- `ExpansionLoadingView` can show ready status, but there is no explicit working transition into an `expansion_graph` tab.
- `ExpandView` back navigation can return to the loading/session tab instead of a true Expansion Graph tab.
- Main process `kg4:start-expansion` creates a single LLM job with only `{ nodeId, nodeLabel }`; it does not actually run paper retrieval first.
- KG4 validation can reject useful LLM output because `relatedPaperIds` is empty.
- KG4 expansion records are currently runtime-only React session data. The database stores node-understanding memories, but not KG4 expansion records as reusable generated expansion results.

## 3. Design Direction

Use a three-layer repair:

1. **UI state and interaction closure**: make workspace state single-sourced, sync current paper graph into expansion state, and provide visible loading-to-graph actions.
2. **Real expansion pipeline**: make `kg4:start-expansion` perform retrieval before LLM generation and push progress that maps to real phases.
3. **KG4 record persistence**: save generated expansion records to the database and reuse them on later same-node expansion attempts.

This is intentionally a connection-focused design. It does not redesign the visual language or create a new workspace model.

## 4. Architecture

### 4.1 State Ownership

`WorkspaceProvider` becomes the only live workspace state owner. `App.tsx` may load and save state, but it does not maintain a separate reducer that UI components do not consume.

Implementation shape:

```ts
<WorkspaceProvider initialState={restoredWorkspaceState} onStateChange={saveWorkspaceState}>
  <AppShell />
</WorkspaceProvider>
```

`WorkspaceProvider` keeps the existing reducer and helpers:

- `openTab`
- `closeTab`
- `activateTab`
- `selectObject`
- `updateTabStatus`

`App.tsx` remains responsible for settings, font scaling, panel resizing, and loading/saving app state.

### 4.2 Paper Session to Expansion Sync

The expansion domain needs the current graph, paper insight, and paper id. This should be explicit rather than depending on stale refs.

Add a small bridge under both `PaperProvider` and `ExpansionProvider`:

```tsx
function ExpansionPaperSyncBridge() {
  const { graph, paperInsight, paperId } = usePaper()
  const { setPaperContext } = useExpansion()

  useEffect(() => {
    setPaperContext({ graphNodes: graph.nodes, paperInsight, paperId })
  }, [graph.nodes, paperInsight, paperId, setPaperContext])

  return null
}
```

If the current `PaperContext` does not expose `paperId`, add it to the paper domain and derive it consistently from PDF URL/path using the existing `makeLocalPaperId` logic.

### 4.3 Expansion Runtime Sessions

`ExpansionProvider` continues to manage transient UI sessions:

```ts
interface NodeExpansionSession {
  id: string
  nodeId: string
  nodeLabel: string
  paperId?: string
  status: 'loading' | 'ready' | 'failed' | 'empty'
  currentStepId?: string
  steps: NodeExpansionStep[]
  expansionGraph?: Kg4ExpansionGraphLayer
  expansionRecord?: Kg4NodeExpansionRecord
  selectedExpansionNodeId?: string
  usesMockData: false
  errorMessage?: string
  persistenceError?: string
  createdAt: string
  updatedAt: string
}
```

Runtime sessions are not the source of long-term truth. They are UI projections of either an in-flight job or a persisted KG4 expansion record.

## 5. Database Design

### 5.1 Existing Database Roles

The database remains responsible for:

- KG3 paper records and graph memory.
- Search result cache in `paper_search_results`.
- Merged long-term graph memory.
- LLM job records.
- KG4 node-understanding memories created after user feedback.

### 5.2 New KG4 Expansion Record Persistence

Persist `Kg4NodeExpansionRecord` as the generated expansion result for a paper node.

Record contents:

- `id`
- `paperId`
- `nodeId`
- `retrievedPaperIds`
- `algorithmIdeaCards`
- `expansionGraphNodes`
- `expansionGraphEdges`
- `fieldCognitionView`
- `dataCompleteness`
- `missingDataReasons`
- `generatedByJobIds`
- `createdAt`
- `updatedAt`

Use `paperId + nodeId` as the main lookup key. `id` remains the primary record id.

Preferred storage: reuse the existing `node_expansions` table JSON column if it can safely store `Kg4NodeExpansionRecord`. This avoids a schema migration. If type conflicts with existing KG3 `NodeExpansionRecord` are too risky during implementation, add a separate `kg4_node_expansions` table with the same indexed columns: `id`, `paper_id`, `node_id`, `json`, `created_at`, `updated_at`.

The implementation plan should inspect current repository types before choosing reuse versus a new table. The default recommendation is minimal schema change if type safety remains clear.

### 5.3 IPC Contract

Add KG4 expansion record IPC methods:

```ts
kg4: {
  getExpansionRecord(params: { paperId: string; nodeId: string }): Promise<Kg4NodeExpansionRecord | null>
  saveExpansionRecord(record: Kg4NodeExpansionRecord): Promise<void>
  listExpansionRecordsByPaper?(paperId: string): Promise<Kg4NodeExpansionRecord[]>
}
```

`listExpansionRecordsByPaper` is optional for the core flow. It is useful for future field memory screens, but not required for same-node reuse.

Expose the methods through:

- `src/shared/electron-api.ts`
- `src/preload/index.ts`
- `src/renderer/src/modules/ipc/electronApi.ts`
- `src/main/index.ts`

## 6. Main Process Expansion Pipeline

### 6.1 Input

Expand `kg4:start-expansion` params:

```ts
interface StartExpansionParams {
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
```

### 6.2 Progress Phases

Use progress events that correspond to real work:

```text
job_created → task accepted and session/job ids known
retrieving   → searchPapers is running or completed
analyzing    → LLM is analyzing retrieved candidates
generating   → output is being transformed into expansion graph/record
persisting   → record is being saved
done         → saved record is ready
failed       → terminal error
```

Add `persisting` to `ExpansionProgressEvent.step` and renderer loading steps.

### 6.3 Retrieval and LLM Input

`kg4:start-expansion` should:

1. Send `job_created`.
2. Build a `PaperSearchQuery` from node search queries, node label, and paper insight.
3. Send `retrieving` and call `searchPapers(query)`.
4. Extract candidate paper ids and compact paper summaries.
5. Create the KG4 LLM job with `relatedPaperIds` populated from retrieved candidates.
6. Send `analyzing` and run the LLM job.
7. Send `generating` and convert validated output to `Kg4NodeExpansionRecord`.
8. Send `persisting` and save the record.
9. Send `done` with the saved record in the payload.

If retrieval returns no candidates, the job may still produce a partial record only if the LLM prompt explicitly marks `dataCompleteness: 'insufficient'` or `partial` and includes `missingDataReasons`. Otherwise return `empty` or `failed` with a visible message.

### 6.4 Error Handling

- Retrieval failure sends `failed` with error details. Do not silently continue with mock data.
- LLM failure sends `failed` and does not save a record.
- Record conversion/validation failure sends `failed` and does not save a record.
- Persistence failure should leave the current runtime session visible if a valid result exists, with `persistenceError` set. The user can continue in the current session but will not get same-node reuse until save succeeds.

## 7. Renderer Interaction Flow

### 7.1 Entry Display

The reliable entry is:

```text
Paper Graph node click
→ workspace selectedObject = { type: 'graph_node', id }
→ AIContextPanel renders NodeInspector
→ NodeInspector shows 展开该方向 when canExpandGraphNode(node) is true
```

The graph plus marker may remain as a visual affordance. If implementation is small, make it clickable and dispatch the same selection/expansion behavior. It is not required for the core flow because the right-panel entry must work.

### 7.2 Start Expansion

`NodeInspector` calls `startExpansion(node.id)` and handles:

- checking cache
- starting job
- opening tab
- showing local error if start fails

`ExpansionProvider.startExpansion` sequence:

1. Resolve current node from synced paper context.
2. If `paperId` exists, call `kg4:getExpansionRecord({ paperId, nodeId })`.
3. If a valid record exists, create a ready session from record and return `{ sessionId, status: 'ready-from-cache' }`.
4. If no record exists, create a loading session immediately, then call `kg4:startExpansion`.
5. Store or reconcile returned job/session id.

Creating the loading session before the main process sends progress prevents early `job_created` events from being dropped. If main still owns the session id, renderer can create a temporary local id and replace it once `kg4:startExpansion` returns, or main can return session id before starting async work. The implementation plan should choose the least invasive option.

### 7.3 Loading UI

`ExpansionLoadingView` displays real progress steps:

- preparing task
- retrieving related papers
- analyzing algorithm ideas
- generating expansion graph
- saving expansion record
- complete

When `session.status === 'ready'`, show a primary action:

```text
查看 Expansion Graph
```

The button opens or activates an `expansion_graph` tab:

```ts
{
  id: `expansion_graph_${session.id}`,
  type: 'expansion_graph',
  title: `Expansion Graph: ${session.nodeLabel}`,
  nodeId: session.nodeId,
  expansionId: session.id,
  closable: true,
  status: 'ready'
}
```

Do not rely on text saying the user can switch views when no view exists.

### 7.4 Expansion Graph and Expand View

`ExpansionGraphView` reads the active tab expansion id, finds the session, and renders:

- original paper graph
- anchor node highlighted
- temporary expansion layer
- clickable temporary expansion nodes

Clicking an expansion node updates right-panel selection:

```ts
selectObject({ type: 'expansion_node', id: expansionNodeId, expansionId })
```

`ExpansionNodeInspector` opens `expand_view`.

`ExpandView` reads the session expansion record and shows:

- field cognition view
- algorithm idea cards
- selected card tray
- comparison table
- reflection input
- real feedback generation
- memory save panel

Back navigation from `ExpandView` should open or activate the corresponding `expansion_graph_${session.id}` tab, not the loading tab.

### 7.5 Stage and AI Panel Selection Sync

As a small connection fix, selecting a learning stage in `LearningPath` should also set:

```ts
selectObject({ type: 'learning_stage', id: stageId })
```

`StageInspector`'s central-location action should activate `stage_learning` and call `selectStage(stage.id)`. This keeps the central workspace and right panel aligned.

## 8. Record-Level Recovery Behavior

After app restart:

- Do not restore old expansion tabs.
- Do not restore active workspace to an old expansion page.
- Once the user has loaded or analyzed the same paper graph, selecting the same expandable node shows the same NodeInspector entry.
- Clicking expansion checks the database by `paperId + nodeId`.
- If a valid `Kg4NodeExpansionRecord` exists, renderer creates a ready session and opens Expansion Graph immediately.
- If no valid record exists, renderer starts the normal real retrieval and LLM pipeline.

If the paper graph is not loaded, there is no node to click and no recovery UI. That is intentional for this scope.

## 9. Validation Rules

Before using a persisted KG4 record, validate:

- `paperId` matches current paper id.
- `nodeId` matches selected graph node id.
- `expansionGraphNodes` is an array.
- `expansionGraphEdges` is an array.
- `algorithmIdeaCards` is an array.
- `fieldCognitionView` exists or `dataCompleteness` explains why it is missing.

Invalid records are treated as cache misses and should not crash the UI.

## 10. Testing and Verification

### 10.1 Automated Verification

Run:

```bash
npm run typecheck
npm run build
```

### 10.2 Manual End-to-End Verification

Verify:

1. Uploading a PDF and running analysis produces a graph and 7 learning stages.
2. Analysis completion activates the visible Paper Graph workspace.
3. Clicking a graph node selects it and shows `NodeInspector` in the right panel.
4. Expandable nodes show the `展开该方向` entry.
5. Clicking the entry opens a loading workspace tab.
6. Loading timeline updates through real main-process progress events.
7. Completion shows `查看 Expansion Graph`.
8. Clicking that action opens an Expansion Graph tab.
9. Clicking an expansion node shows `ExpansionNodeInspector`.
10. Clicking `进入 Expand View` opens the full KG4 workbench.
11. Feedback generation uses the real LLM job path.
12. Saving memory writes a KG4 node-understanding memory.
13. Completing expansion saves a KG4 expansion record to the database.
14. Re-clicking the same node reuses the DB record and opens a ready Expansion Graph without rerunning expansion.
15. After restart, once the same paper graph is loaded, re-clicking the same node reuses the DB record.

## 11. Out of Scope

- Restoring old expansion tabs or active workspace after restart.
- Cloud sync or multi-device persistence.
- Full UI redesign or new visual language.
- Replacing the existing workspace shell.
- Changing stage framework semantics.
- Persisting every transient runtime session state.
- Adding a full external retrieval provider beyond the existing `searchPapers` provider abstraction.

## 12. Success Criteria

- There is one live workspace state source consumed by the UI and persistence code.
- Paper graph nodes are available to `ExpansionProvider.startExpansion`.
- `NodeInspector` expansion entry reliably starts or restores expansion.
- Loading view reflects real main-process progress and has a working route into Expansion Graph.
- Main expansion pipeline uses real retrieval before LLM generation.
- KG4 validation receives non-empty `relatedPaperIds` when retrieval returns candidates.
- KG4 expansion records are saved and can be read by `paperId + nodeId`.
- Same-node reuse works without rerunning LLM expansion.
- No mock fallback is introduced.
- Typecheck and build pass.
