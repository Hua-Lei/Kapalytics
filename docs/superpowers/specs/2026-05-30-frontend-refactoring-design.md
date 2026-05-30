# Frontend Architecture Refactoring — Design Document

**Date:** 2026-05-30
**Status:** Approved
**Scope:** Full restructure (state layer + component architecture + logic extraction)

## 1. Problem Statement

The current frontend codebase has accumulated significant technical debt after the v4.1-v4.6 workspace redesign:

| Problem | Details |
|---------|---------|
| God component | `App.tsx` (514 lines) manages 8 distinct responsibilities — state, save/load, resize, expansion simulation, stage lifecycle, font scaling, report generation, callback factories |
| Prop drilling hell | `AppShell.tsx` has a 60-property interface. Adding a feature requires touching 4+ files to thread props through |
| Inline components | `AIContextPanel.tsx` contains 5 inspector components defined inline. `CentralWorkspaceRouter.tsx` has 3 inline views |
| No state layer | All state lives in App.tsx. No React Context, no custom hooks, no separation between UI and domain state |
| Scattered logic | A single feature (node expansion) touches 6 files across 3 layers. Async simulation timer lives in App.tsx |
| Bloated files | 6 files over 200 lines, `KnowledgeGraph.tsx` at 606 lines mixing SVG, drag, zoom, expansion, and filtering |

## 2. Design Goals

1. **Clear domain boundaries** — each business concern has its own isolated state domain
2. **No prop drilling** — components call hooks directly for the data they need
3. **Extractable logic** — business logic in hooks, not components; hooks testable independently
4. **Max 250 lines per file** (350 for SVG renderers) — split aggressively
5. **Max 8 data props per component** (excluding HTML attribute passthrough like `className`, `children`, `style`, `aria-*`) — more means the component should use hooks or accept a composed config object
6. **modules/ stays React-free** — pure TypeScript, testable without React

## 3. Architecture Pattern: Custom Hooks + React Context

Each domain follows the same pattern:

```
domains/<name>/
├── <Name>Provider.tsx    ← Context + Provider component (state holder)
├── use<Name>.ts          ← Hook (consumers call this)
├── types.ts              ← Domain-specific types (if needed)
└── <legacy>.ts           ← Existing logic moved from modules/ (optional)
```

### Provider Tree (App.tsx)

```
<PersistenceGate>          ← loads saved state, shows loader until hydrated
  <PaperProvider>          ← graph, pdf, analysis, paperInsight
    <StageProvider>        ← stages, answers, diagnosis
      <ExpansionProvider>  ← expansion sessions
        <MemoryProvider>   ← node understanding memories
          <WorkspaceProvider> ← tabs, selection (outermost — innermost needs it)
            <AppShell />   ← layout only, no props except children
          </WorkspaceProvider>
        </MemoryProvider>
      </ExpansionProvider>
    </StageProvider>
  </PaperProvider>
</PersistenceGate>
```

Provider order: Persistence is outermost (needs to load before anything renders). Workspace is innermost among data providers because it references tabs whose content comes from other domains.

## 4. Domain Specifications

### 4.1 Paper Domain

**State:**
```ts
interface PaperState {
  pdfUrl: string | null
  graph: KnowledgeGraph
  paperInsight: PaperInsight | null
  analysisSteps: AnalysisStep[]
  generating: boolean
  genError: string
  genProgress: string
}
```

**Hook:** `usePaper()` returns `PaperState` + actions:
- `selectPdf()` → opens file dialog, resets graph
- `analyzePaper()` → extracts text, calls LLM, builds graph incrementally
- `setGraph(graph)` / `setPaperInsight(insight)` (for save/load restore)

**Components powered by this domain:**
- `PaperGraphView` → KnowledgeGraph with graph data
- `ArgumentChainView` → paperInsight display
- `MethodMechanismView` → graph.nodes filtered view
- `PdfReaderWorkspace` → pdfUrl + PdfViewer

### 4.2 Stage Learning Domain

**State:**
```ts
interface StageState {
  stages: Stage[]
  selectedStageId: string | null
  answers: Record<string, string>
  drafts: Record<string, string>
  diagnosisResults: Record<string, DiagnosisResult>
  diagnosedStageIds: Set<string>
  learningReport: LearningReport | null
}
```

**Hook:** `useStages()` returns `StageState` + actions:
- `enterStage(id)` / `submitAnswer(id)` / `confirmDiagnosis(id)`
- `retryStage(id)` / `markNeedsReview(id)`
- `updateDraft(id, value)` / `generateReport()`
- `selectStage(id)`

**Components:** `StageLearningView`, `LearningPath`, `StageDetail`

### 4.3 Workspace Domain

**Purpose:** Tab management + selection only. No content data.

**State:**
```ts
interface WorkspaceState {
  tabs: WorkspaceTab[]
  activeTabId: string
  selectedObject?: SelectedObject
}
```

**Hook:** `useWorkspace()` returns `WorkspaceState` + actions:
- `openTab(tab)` / `closeTab(id)` / `activateTab(id)`
- `selectObject(obj?)` / `updateTabStatus(id, status)`
- `activeTab` (derived: `tabs.find(t => t.id === activeTabId)`)

**Components:** `WorkspaceSidebar`, `WorkspaceRouter`

### 4.4 Node Expansion Domain

**Purpose:** Expansion session lifecycle — create, simulate/run steps, complete.

**State:**
```ts
interface ExpansionState {
  sessions: Record<string, NodeExpansionSession>
}
```

**Hook:** `useExpansion()` returns `ExpansionState` + actions:
- `startExpansion(nodeId)` → creates session, starts async step simulation
- `advanceStep(sessionId)` → advance one step (called by timer)
- `completeExpansion(sessionId)` → build expansion record, transition to ready
- `selectExpansionNode(node, expansionId)` → update selection
- `clearExpansionGraph(sessionId)` → remove temporary graph
- `activeSession` (derived from activeTabId via useWorkspace)

**Async simulation:** The hook contains a `useEffect` that, when a session is in `loading` status, sets up a timer that calls `advanceStep()` every 400-700ms until all 7 steps are done, then calls `completeExpansion()`. This replaces the current `runExpansionSimulation()` in App.tsx.

**Components:** `ExpansionLoadingView`, `ExpansionGraphView`, `ExpandView`

### 4.5 Memory Domain

**State:**
```ts
interface MemoryState {
  memories: NodeUnderstandingMemory[]
  loading: boolean
}
```

**Hook:** `useMemories()` returns `MemoryState` + actions:
- `loadMemories()` → calls `electronApi.kg4.listNodeUnderstandingMemories()`
- `saveMemory(memory)` → calls `electronApi.kg4.saveNodeUnderstandingMemory()`
- `selectMemory(id)` → sets selectedObject via useWorkspace

**Components:** `FieldMemoryView`

### 4.6 Persistence (Cross-cutting)

**Not a Provider.** A hook `usePersistence()` that coordinates save/load across domains.

```ts
function usePersistence(deps: {
  stages, answers, diagnosisResults, learningReport, pdfUrl,
  workspaceState, graph, paperInsight, hydrated: boolean
}) {
  // On mount: electronApi.load() → restore each domain
  // On deps change (debounced): electronApi.save(allState)
}
```

Used inside `PersistenceGate` component that:
1. Shows a loading skeleton until `hydrated` is true
2. Calls `usePersistence()` with state from all domains
3. Renders children when ready

## 5. Component Tree (After Refactoring)

```
App.tsx (50 lines — provider tree only)
└── PersistenceGate
    └── AppShell (80 lines — layout grid only)
        ├── TopBar
        ├── WorkspaceSidebar        ← calls useWorkspace()
        ├── WorkspaceRouter         ← calls useWorkspace() for activeTab.type
        │   ├── PaperGraphView      ← calls usePaper()
        │   │   └── KnowledgeGraph  ← receives graph prop only
        │   ├── ArgumentChainView   ← calls usePaper()
        │   ├── MethodMechanismView ← calls usePaper()
        │   ├── PdfReaderWorkspace  ← calls usePaper()
        │   ├── StageLearningView   ← calls useStages()
        │   ├── ExpansionLoadingView ← receives session prop
        │   ├── ExpansionGraphView  ← receives session + graph props
        │   ├── ExpandView          ← receives session + anchorNode props
        │   └── FieldMemoryView     ← calls useMemories()
        └── AIContextPanel (80 lines — switch only)
            ├── EmptyAnalysisPanel  (no PDF loaded)
            ├── NodeInspector       ← receives node prop
            ├── ExpansionNodeInspector ← receives node prop
            ├── StageInspector      ← receives stage prop
            ├── AlgorithmIdeaInspector ← receives card prop
            └── MemoryRecordInspector ← receives memory prop
```

## 6. Cross-Domain Communication

Domains do NOT import each other's state. A component needing data from two domains calls both hooks:

```tsx
function PaperGraphView() {
  const { graph, paperInsight } = usePaper()
  const { selectedObject, selectObject } = useWorkspace()
  // ...
}
```

Cross-domain triggers are handled by the **consumer component** that calls both hooks:

```tsx
// Example: PaperGraphView handles "analysis complete → show graph"
function PaperGraphView() {
  const { graph, paperInsight, generating } = usePaper()
  const { activeTabId, activateTab } = useWorkspace()

  useEffect(() => {
    if (!generating && graph.nodes.length > 0 && activeTabId !== 'paper_graph') {
      activateTab('paper_graph')
    }
  }, [generating, graph.nodes.length])
  // ...
}
```

This pattern keeps domains independent. No domain imports another domain's internals.

## 7. Files to Delete

| File | Reason |
|------|--------|
| `AppHeader.tsx` | Replaced by TopBar.tsx |
| `PdfPanel.tsx` | Replaced by PdfReaderWorkspace.tsx |
| `AnalysisPanel.tsx` | Merged into AIContextPanel empty state |
| `DiagnosisView.tsx` | Merged into StageDetail |
| `LearningReportPanel.tsx` | Merged into StageLearningView |
| `PdfJsViewer.tsx` | Unused (PdfViewer wraps it directly) |

Already deleted in previous cleanup: `CenterPanel.tsx`, `RightLearningPanel.tsx`, `NodeDetailPanel.tsx`

## 8. Files to Split

| Current (lines) | Split into |
|-----------------|------------|
| `App.tsx` (514) | `App.tsx` (50) + 6 domain providers + `PersistenceGate` |
| `AppShell.tsx` (234) | `AppShell.tsx` (80) — hooks replace prop drilling |
| `KnowledgeGraph.tsx` (606) | `KnowledgeGraph.tsx` (350 SVG core) + `useGraphDrag.ts` + `useGraphZoom.ts` + `GraphNodes.tsx` + `ExpansionLayer.tsx` |
| `AIContextPanel.tsx` (269) | `AIContextPanel.tsx` (80 switch) + 5 inspector files + `EmptyAnalysisPanel.tsx` |
| `ExpandView.tsx` (272) | `ExpandView.tsx` (shell) + `IdeaCardGrid.tsx` + `ComparisonTable.tsx` + `FeedbackPanel.tsx` + `MemorySavePanel.tsx` |
| `CentralWorkspaceRouter.tsx` (161) | `WorkspaceRouter.tsx` (simpler, uses hooks) + `StageLearningView.tsx` + `PaperGraphView.tsx` |

## 9. New Folder Structure

```
src/renderer/src/
├── domains/                     ← NEW: domain logic
│   ├── paper/
│   │   ├── PaperProvider.tsx
│   │   ├── usePaper.ts
│   │   └── usePaperAnalysis.ts  (moved from modules/)
│   ├── workspace/
│   │   ├── WorkspaceProvider.tsx
│   │   ├── useWorkspace.ts
│   │   ├── types.ts
│   │   ├── workspaceReducer.ts
│   │   └── defaultTabs.ts
│   ├── stages/
│   │   ├── StageProvider.tsx
│   │   └── useStages.ts
│   ├── expansion/
│   │   ├── ExpansionProvider.tsx
│   │   ├── useExpansion.ts
│   │   ├── types.ts
│   │   └── nodeExpansionSessions.ts
│   ├── memory/
│   │   ├── MemoryProvider.tsx
│   │   └── useMemories.ts
│   └── persistence/
│       ├── PersistenceGate.tsx
│       └── usePersistence.ts
│
├── components/
│   ├── shell/                   ← Layout components
│   │   ├── AppShell.tsx
│   │   ├── TopBar.tsx
│   │   └── WorkspaceSidebar.tsx
│   ├── workspace/               ← Workspace tab content
│   │   ├── WorkspaceRouter.tsx
│   │   ├── PaperGraphView.tsx
│   │   ├── KnowledgeGraph.tsx
│   │   ├── ArgumentChainView.tsx
│   │   ├── MethodMechanismView.tsx
│   │   ├── PdfReaderWorkspace.tsx
│   │   ├── StageLearningView.tsx
│   │   ├── FieldMemoryView.tsx
│   │   └── expansion/
│   │       ├── ExpansionLoadingView.tsx
│   │       ├── ExpansionGraphView.tsx
│   │       └── ExpandView.tsx
│   ├── ai-panel/                ← Right panel inspectors
│   │   ├── AIContextPanel.tsx
│   │   ├── EmptyAnalysisPanel.tsx
│   │   ├── NodeInspector.tsx
│   │   ├── ExpansionNodeInspector.tsx
│   │   ├── StageInspector.tsx
│   │   ├── AlgorithmIdeaInspector.tsx
│   │   └── MemoryRecordInspector.tsx
│   └── shared/                  ← Shared UI components
│       ├── MathText.tsx
│       ├── PdfViewer.tsx
│       ├── SettingsModal.tsx
│       ├── StageDetail.tsx
│       ├── LearningPath.tsx
│       ├── ErrorBoundary.tsx
│       └── ...
│
├── App.tsx                      ← Provider tree only (~50 lines)
├── main.tsx
└── modules/                     ← Pure logic (no React, unchanged)
    ├── diagnosis/
    ├── graph/
    ├── ipc/electronApi.ts
    └── learning/
```

## 10. Implementation Phases

### Phase 1: Create domain infrastructure (no behavior change)
- Create `domains/` folder structure
- Create types files for each domain
- Create Provider + Hook shell for each domain (with initial state only)
- Wrap App.tsx with provider tree
- Verify app still runs unchanged

### Phase 2: Migrate state from App.tsx into domains
- Move Paper state (graph, pdf, analysis) into PaperProvider
- Move Stage state into StageProvider
- Move Workspace state (already in reducer) into WorkspaceProvider
- Move Expansion state into ExpansionProvider
- Move Memory state into MemoryProvider
- Create PersistenceGate with usePersistence
- Update components to use hooks instead of props
- Delete migrated state from App.tsx

### Phase 3: Extract inline components
- Extract 5 inspectors from AIContextPanel → components/ai-panel/
- Extract StageLearningView from WorkspaceRouter
- Extract PaperGraphView
- Extract EmptyAnalysisPanel
- Delete AnalysisPanel.tsx, DiagnosisView.tsx, LearningReportPanel.tsx

### Phase 4: Split large files
- Split KnowledgeGraph.tsx (useGraphDrag, useGraphZoom, GraphNodes, ExpansionLayer)
- Split ExpandView.tsx (IdeaCardGrid, ComparisonTable, FeedbackPanel, MemorySavePanel)
- Delete AppHeader.tsx, PdfPanel.tsx, PdfJsViewer.tsx

### Phase 5: Clean up
- Remove all remaining prop drilling (max 8 props per component)
- Enforce file size limits (max 250 lines)
- Remove dead code
- Final typecheck + build verification

## 11. Not In Scope

- Redesigning the main process LLM orchestrator (it's already well-structured)
- Building the IPC bridge for KG4 real jobs (separate feature, additive change in electronApi/preload/main)
- Adding real retrieval API integration
- Changing the visual design or UX
- Adding new features
- Backend/data layer changes

## 12. Success Criteria

1. `App.tsx` is under 60 lines — just a provider tree
2. No component has more than 8 props
3. No file exceeds 250 lines (except SVG renderers at 350)
4. Every business logic concern lives in a hook, not a component
5. Adding a new workspace view requires: 1 new component file + 1 route entry in WorkspaceRouter
6. All existing functionality preserved (upload PDF, analyze, graph, stage learning, diagnosis, node expansion, field memory)
7. `npm run typecheck` and `npm run build` pass with zero errors
