# Lineage-First Node Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first phase of KG4 node expansion where algorithm/method nodes produce a method lineage map first, while papers become readable evidence drill-downs instead of unreadable abstract cards.

**Architecture:** Keep `kg4:start-expansion` as the IPC entry point, but move expansion logic into focused KG4 modules: intent classification normalization, lineage-oriented query building, per-paper digest normalization, lineage record assembly, and renderer detail surfaces. The implementation is incremental: shared types and pure assemblers first, then orchestration and UI.

**Tech Stack:** Electron main/preload IPC, TypeScript, React 18, existing `node --import tsx`-style direct TS tests via project scripts where available, `npm run typecheck` for final verification.

---

## File Structure

Create or modify these files:

- Modify `src/shared/kg4.ts`: Add Phase 1 KG4 types: `ExpansionIntent`, `ExpansionRetrievalPlan`, `PaperMethodDigest`, `MethodLineageView`, `MethodLineageNode`, `MethodLineageEdge`; extend validators and `Kg4NodeExpansionRecord` with optional lineage fields.
- Modify `src/shared/kg3.ts`: Add KG4 LLM task types `classify_expansion_intent`, `digest_paper_method`, and `synthesize_method_lineage` through `Kg4LLMTaskType` imported from `kg4.ts`.
- Modify `src/shared/electron-api.ts`: Add `classifying`, `digesting`, and `synthesizing` to `ExpansionProgressEvent.step`.
- Create `src/main/kg4/lineageTypes.ts`: Main-process normalization helpers for intent, digests, lineage, and short text.
- Create `src/main/kg4/expansionQuery.ts`: Pure query builder from `ExpansionIntent`, current node, and paper insight to `ExpansionRetrievalPlan`.
- Create `src/main/kg4/lineageRecord.ts`: Pure record assembler that projects lineage/digest/fallback data into `Kg4NodeExpansionRecord` and compatible `expansionGraphNodes`.
- Create `src/main/kg4/lineageRecord.test.ts`: Unit tests for query building, record assembly, fallback behavior, and raw abstract avoidance.
- Modify `src/main/kg4/expansionRecord.ts`: Keep existing legacy builder, but delegate short fallback text helper or leave untouched except for validator compatibility if needed.
- Modify `src/main/llm/jobPrompts.ts`: Add prompts for classification, paper digest, and lineage synthesis.
- Modify `src/main/llm/orchestrator.ts`: Allow per-job model selection using existing `LLMJob.model`; pass selected model to `callLlm` via new request model override.
- Modify `src/main/llm/types.ts`: Add optional `model` override to `LlmRequest` if not present.
- Modify `src/main/llm/client.ts`: Use request model override when building provider body.
- Modify `src/main/index.ts`: Replace inline expansion run with lineage-first pipeline stages while preserving IPC contract and persistence.
- Modify `src/renderer/src/domains/expansion/nodeExpansionSessions.ts`: Add new loading steps and handle progress events.
- Modify `src/renderer/src/components/ExpansionGraphView.tsx`: Render lineage summary, lineage nodes, evidence papers, and fallback digest/paper cards.
- Create `src/renderer/src/components/LineageNodeDetailView.tsx`: Central detail view for a lineage node.
- Create `src/renderer/src/components/EvidencePaperDetailView.tsx`: Central detail view for a retrieved paper/digest evidence item.
- Modify `src/renderer/src/components/ai-panel/ExpansionNodeInspector.tsx`: Open detail views instead of defaulting to `ExpandView`; keep comparison workbench copy gated.
- Modify `src/renderer/src/domains/workspace/types.ts`: Add workspace tab types `lineage_node_detail` and `evidence_paper_detail`.
- Modify the central workspace router file that switches on `WorkspaceTab.type` after locating it with `grep "expand_view" src/renderer/src -n`: route new detail tab types.

## Commands

Use these verification commands unless a task specifies a narrower command:

- Typecheck: `npm run typecheck`
- Existing KG4 record unit test command, if direct TS execution works in this repo: inspect current scripts first; otherwise use `npm run typecheck` as the required verification for compile-time coverage.

## Task 1: Shared KG4 Lineage Types and Validators

**Files:**
- Modify: `src/shared/kg4.ts`
- Modify: `src/shared/kg3.ts`
- Modify: `src/shared/electron-api.ts`

- [ ] **Step 1: Add shared type definitions in `src/shared/kg4.ts`**

Add these exports after `FieldCognitionView` and before `Kg4NodeExpansionRecord`:

```ts
export interface ExpansionIntent {
  kind: 'algorithm_method_lineage' | 'generic_related_papers'
  confidence: number
  queryFocus: string
  rationale: string
  fallbackReason?: string
}

export interface ExpansionRetrievalPlan {
  primaryQuery: string
  searchQueries: string[]
  retrievalGoal: 'same_problem_methods' | 'generic_related_papers'
  maxResults: number
  requireAbstract: boolean
}

export type PaperMethodRelationHint =
  | 'foundation'
  | 'parallel_variant'
  | 'extends'
  | 'improves_limitation'
  | 'application_variant'
  | 'unclear'

export interface PaperMethodDigest {
  id: string
  paperId: string
  paperTitle: string
  methodName?: string
  problemSetting: string
  coreMechanism: string
  claimedImprovement?: string
  limitation?: string
  relationHints: PaperMethodRelationHint[]
  evidenceSummary: string
  confidence: number
  insufficientInformation?: string
}

export type MethodLineageNodeRole =
  | 'current_method'
  | 'foundation_method'
  | 'parallel_variant'
  | 'improvement'
  | 'application_variant'
  | 'open_problem'

export interface MethodLineageNode {
  id: string
  label: string
  role: MethodLineageNodeRole
  summary: string
  representativePaperIds: string[]
  digestIds: string[]
}

export type MethodLineageRelation =
  | 'extends'
  | 'contrasts_with'
  | 'solves_limitation_of'
  | 'shares_assumption_with'
  | 'applies_to_new_context'
  | 'evidence_insufficient'

export interface MethodLineageEdge {
  id: string
  sourceId: string
  targetId: string
  relation: MethodLineageRelation
  explanation: string
  evidencePaperIds: string[]
  confidence: number
}

export interface MethodLineageView {
  id: string
  anchorNodeId: string
  title: string
  summary: string
  nodes: MethodLineageNode[]
  edges: MethodLineageEdge[]
  openQuestions: string[]
  readingOrder: string[]
  dataCompleteness: 'complete' | 'partial' | 'insufficient'
  missingDataReasons: string[]
}
```

- [ ] **Step 2: Extend `Kg4NodeExpansionRecord` in `src/shared/kg4.ts`**

Add optional fields before `dataCompleteness`:

```ts
  expansionIntent?: ExpansionIntent
  paperMethodDigests?: PaperMethodDigest[]
  methodLineageView?: MethodLineageView
```

- [ ] **Step 3: Extend KG4 LLM task union in `src/shared/kg4.ts`**

Change `Kg4LLMTaskType` to include the new job types:

```ts
export type Kg4LLMTaskType =
  | 'expand_node_retrieve_context'
  | 'classify_expansion_intent'
  | 'digest_paper_method'
  | 'synthesize_method_lineage'
  | 'extract_algorithm_ideas'
  | 'build_field_cognition_map'
  | 'generate_expansion_graph'
  | 'compare_algorithm_ideas'
  | 'generate_reflective_feedback'
  | 'generate_remedial_lesson'
  | 'suggest_graph_fusion'
  | 'generate_optional_transfer_task'
```

- [ ] **Step 4: Add validator helpers in `src/shared/kg4.ts`**

Add constants near existing validator constants:

```ts
const expansionIntentKinds = ['algorithm_method_lineage', 'generic_related_papers'] as const satisfies readonly ExpansionIntent['kind'][]
const retrievalGoals = ['same_problem_methods', 'generic_related_papers'] as const satisfies readonly ExpansionRetrievalPlan['retrievalGoal'][]
const paperMethodRelationHints = ['foundation', 'parallel_variant', 'extends', 'improves_limitation', 'application_variant', 'unclear'] as const satisfies readonly PaperMethodRelationHint[]
const methodLineageNodeRoles = ['current_method', 'foundation_method', 'parallel_variant', 'improvement', 'application_variant', 'open_problem'] as const satisfies readonly MethodLineageNodeRole[]
const methodLineageRelations = ['extends', 'contrasts_with', 'solves_limitation_of', 'shares_assumption_with', 'applies_to_new_context', 'evidence_insufficient'] as const satisfies readonly MethodLineageRelation[]
```

Add validators before `isKg4NodeExpansionRecord`:

```ts
function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function isExpansionIntent(value: unknown): value is ExpansionIntent {
  return (
    isRecordObject(value) &&
    isOneOf(value.kind, expansionIntentKinds) &&
    isNumberInRange(value.confidence, 0, 1) &&
    hasStringProperties(value, ['queryFocus', 'rationale']) &&
    isOptionalString(value.fallbackReason)
  )
}

function isPaperMethodDigest(value: unknown): value is PaperMethodDigest {
  return (
    isRecordObject(value) &&
    hasStringProperties(value, ['id', 'paperId', 'paperTitle', 'problemSetting', 'coreMechanism', 'evidenceSummary']) &&
    isOptionalString(value.methodName) &&
    isOptionalString(value.claimedImprovement) &&
    isOptionalString(value.limitation) &&
    isOptionalString(value.insufficientInformation) &&
    Array.isArray(value.relationHints) &&
    value.relationHints.every((hint) => isOneOf(hint, paperMethodRelationHints)) &&
    isNumberInRange(value.confidence, 0, 1)
  )
}

function isMethodLineageNode(value: unknown): value is MethodLineageNode {
  return (
    isRecordObject(value) &&
    hasStringProperties(value, ['id', 'label', 'summary']) &&
    isOneOf(value.role, methodLineageNodeRoles) &&
    isStringArray(value.representativePaperIds) &&
    isStringArray(value.digestIds)
  )
}

function isMethodLineageEdge(value: unknown): value is MethodLineageEdge {
  return (
    isRecordObject(value) &&
    hasStringProperties(value, ['id', 'sourceId', 'targetId', 'explanation']) &&
    isOneOf(value.relation, methodLineageRelations) &&
    isStringArray(value.evidencePaperIds) &&
    isNumberInRange(value.confidence, 0, 1)
  )
}

function isMethodLineageView(value: unknown): value is MethodLineageView {
  return (
    isRecordObject(value) &&
    hasStringProperties(value, ['id', 'anchorNodeId', 'title', 'summary']) &&
    Array.isArray(value.nodes) &&
    value.nodes.every(isMethodLineageNode) &&
    Array.isArray(value.edges) &&
    value.edges.every(isMethodLineageEdge) &&
    isStringArray(value.openQuestions) &&
    isStringArray(value.readingOrder) &&
    (value.dataCompleteness === 'complete' || value.dataCompleteness === 'partial' || value.dataCompleteness === 'insufficient') &&
    isStringArray(value.missingDataReasons)
  )
}
```

- [ ] **Step 5: Update `isKg4NodeExpansionRecord` in `src/shared/kg4.ts`**

Add these checks before `record.dataCompleteness`:

```ts
    (record.expansionIntent === undefined || isExpansionIntent(record.expansionIntent)) &&
    (record.paperMethodDigests === undefined || (Array.isArray(record.paperMethodDigests) && record.paperMethodDigests.every(isPaperMethodDigest))) &&
    (record.methodLineageView === undefined || isMethodLineageView(record.methodLineageView)) &&
```

- [ ] **Step 6: Update progress step type in `src/shared/electron-api.ts`**

Replace the current `ExpansionProgressEvent.step` union with:

```ts
  step:
    | 'job_created'
    | 'classifying'
    | 'retrieving'
    | 'digesting'
    | 'synthesizing'
    | 'generating'
    | 'persisting'
    | 'done'
    | 'failed'
```

- [ ] **Step 7: Run typecheck and expect current downstream errors only if consumers are not updated yet**

Run: `npm run typecheck`

Expected: It may fail because new progress steps are not handled in renderer session ordering yet. If it fails, continue to Task 2 and Task 8 before final verification.

## Task 2: Pure Query Builder and Record Assembly

**Files:**
- Create: `src/main/kg4/lineageTypes.ts`
- Create: `src/main/kg4/expansionQuery.ts`
- Create: `src/main/kg4/lineageRecord.ts`
- Create: `src/main/kg4/lineageRecord.test.ts`

- [ ] **Step 1: Create failing unit tests in `src/main/kg4/lineageRecord.test.ts`**

```ts
import assert from 'node:assert/strict'
import type { DedupedPaperCandidate } from '../../shared/kg3'
import type { ExpansionIntent, MethodLineageView, PaperMethodDigest } from '../../shared/kg4'
import { buildExpansionRetrievalPlan } from './expansionQuery'
import { assembleLineageExpansionRecord, toShortDisplayText } from './lineageRecord'

function candidate(id: string, title: string, abstract: string): DedupedPaperCandidate {
  return {
    canonicalId: id,
    mergedFrom: [],
    title,
    authors: [],
    sources: ['openalex'],
    externalIds: [],
    bestUrl: `https://example.test/${id}`,
    abstract,
    score: 1
  }
}

const longAbstract = 'This is a very long abstract. '.repeat(80)
const intent: ExpansionIntent = {
  kind: 'algorithm_method_lineage',
  confidence: 0.91,
  queryFocus: 'policy optimization methods for sparse reward reinforcement learning',
  rationale: 'The node describes a concrete algorithmic method.'
}

const digestA: PaperMethodDigest = {
  id: 'digest_a',
  paperId: 'paper-a',
  paperTitle: 'Foundation RL Method',
  methodName: 'Foundation RL',
  problemSetting: 'Sparse reward policy learning.',
  coreMechanism: 'Uses value-guided exploration to stabilize policy updates.',
  claimedImprovement: 'Improves sample efficiency.',
  limitation: 'Requires careful reward shaping.',
  relationHints: ['foundation'],
  evidenceSummary: 'This paper supplies a foundation method for the current node.',
  confidence: 0.84
}

const digestB: PaperMethodDigest = {
  id: 'digest_b',
  paperId: 'paper-b',
  paperTitle: 'Variant RL Method',
  methodName: 'Variant RL',
  problemSetting: 'Sparse reward policy learning.',
  coreMechanism: 'Adds curriculum-guided replay to the foundation method.',
  claimedImprovement: 'Handles harder exploration cases.',
  limitation: 'Adds replay memory overhead.',
  relationHints: ['extends', 'parallel_variant'],
  evidenceSummary: 'This paper provides a variant that extends the foundation method.',
  confidence: 0.79
}

const lineage: MethodLineageView = {
  id: 'lineage_n1',
  anchorNodeId: 'n1',
  title: 'Sparse Reward RL Method Lineage',
  summary: 'Methods evolve from value-guided exploration to curriculum replay variants.',
  nodes: [
    {
      id: 'lineage_foundation',
      label: 'Foundation RL',
      role: 'foundation_method',
      summary: 'A foundation method for stabilizing sparse reward policy learning.',
      representativePaperIds: ['paper-a'],
      digestIds: ['digest_a']
    },
    {
      id: 'lineage_variant',
      label: 'Curriculum Replay Variant',
      role: 'parallel_variant',
      summary: 'A variant that adds curriculum replay to improve exploration.',
      representativePaperIds: ['paper-b'],
      digestIds: ['digest_b']
    }
  ],
  edges: [
    {
      id: 'edge_1',
      sourceId: 'lineage_foundation',
      targetId: 'lineage_variant',
      relation: 'extends',
      explanation: 'The variant extends the foundation method with curriculum replay.',
      evidencePaperIds: ['paper-a', 'paper-b'],
      confidence: 0.76
    }
  ],
  openQuestions: ['Whether curriculum replay improves transfer remains unclear.'],
  readingOrder: ['paper-a', 'paper-b'],
  dataCompleteness: 'partial',
  missingDataReasons: []
}

const retrievalPlan = buildExpansionRetrievalPlan({
  intent,
  node: { id: 'n1', label: 'Sparse Reward RL', searchQueries: ['policy optimization'] },
  paperInsight: { problem: 'sparse reward reinforcement learning', method: 'deep reinforcement learning' }
})

assert.equal(retrievalPlan.retrievalGoal, 'same_problem_methods')
assert.match(retrievalPlan.primaryQuery, /same problem alternative approach/i)
assert.match(retrievalPlan.primaryQuery, /sparse reward/i)

const short = toShortDisplayText(longAbstract, 120)
assert.ok(short.length <= 121)
assert.ok(short.endsWith('…'))

const record = assembleLineageExpansionRecord({
  paperId: 'paper-main',
  nodeId: 'n1',
  jobIds: ['job-lineage'],
  intent,
  retrievedPapers: [candidate('paper-a', 'Foundation RL Method', longAbstract), candidate('paper-b', 'Variant RL Method', longAbstract)],
  paperMethodDigests: [digestA, digestB],
  methodLineageView: lineage
})

assert.equal(record.methodLineageView?.nodes.length, 2)
assert.equal(record.expansionGraphNodes.length, 2)
assert.equal(record.expansionGraphNodes[0].type, 'algorithm_idea')
assert.equal(record.expansionGraphNodes[0].description, lineage.nodes[0].summary)
assert.doesNotMatch(record.expansionGraphNodes.map((node) => node.description).join('\n'), /This is a very long abstract.*This is a very long abstract/)
assert.equal(record.expansionGraphEdges.length, 1)
assert.equal(record.dataCompleteness, 'partial')

const fallback = assembleLineageExpansionRecord({
  paperId: 'paper-main',
  nodeId: 'n1',
  jobIds: ['job-fallback'],
  intent: { kind: 'generic_related_papers', confidence: 0.3, queryFocus: 'related papers', rationale: 'Low confidence' },
  retrievedPapers: [candidate('paper-a', 'Foundation RL Method', longAbstract)],
  paperMethodDigests: []
})

assert.equal(fallback.methodLineageView, undefined)
assert.equal(fallback.expansionGraphNodes[0].type, 'related_paper')
assert.ok(fallback.expansionGraphNodes[0].description.length <= 180)
assert.doesNotEqual(fallback.expansionGraphNodes[0].description, longAbstract)

console.log('lineageRecord tests passed')
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `node --import tsx src/main/kg4/lineageRecord.test.ts`

Expected: FAIL with module-not-found errors for `./expansionQuery` or `./lineageRecord`. If `tsx` is unavailable, run `npm run typecheck` and expect compile errors for missing modules.

- [ ] **Step 3: Create `src/main/kg4/lineageTypes.ts`**

```ts
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []
}

export function clampConfidence(value: unknown, fallback = 0.5): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
}
```

- [ ] **Step 4: Create `src/main/kg4/expansionQuery.ts`**

```ts
import type { ExpansionIntent, ExpansionRetrievalPlan } from '../../shared/kg4'

interface QueryNodeInput {
  id: string
  label: string
  searchQueries?: string[]
}

interface QueryPaperInsightInput {
  title?: string
  problem?: string
  method?: string
  contribution?: string
}

function compactTerms(values: Array<string | undefined>, maxLength = 240): string {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, maxLength)
    .trim()
}

export function buildExpansionRetrievalPlan(params: {
  intent: ExpansionIntent
  node: QueryNodeInput
  paperInsight?: QueryPaperInsightInput
}): ExpansionRetrievalPlan {
  const baseTerms = compactTerms([
    params.node.label,
    params.intent.queryFocus,
    params.paperInsight?.problem,
    params.paperInsight?.method
  ])
  const originalQueries = params.node.searchQueries ?? []

  if (params.intent.kind === 'algorithm_method_lineage') {
    return {
      primaryQuery: compactTerms([
        baseTerms,
        'algorithm method same problem alternative approach foundation variant improvement'
      ], 320),
      searchQueries: [...new Set([...originalQueries, params.intent.queryFocus, params.paperInsight?.problem, params.paperInsight?.method].filter((item): item is string => Boolean(item?.trim())))],
      retrievalGoal: 'same_problem_methods',
      maxResults: 8,
      requireAbstract: true
    }
  }

  return {
    primaryQuery: compactTerms([params.node.label, params.intent.queryFocus, ...originalQueries], 260) || params.node.label,
    searchQueries: [...new Set([...originalQueries, params.intent.queryFocus].filter((item): item is string => Boolean(item?.trim())))],
    retrievalGoal: 'generic_related_papers',
    maxResults: 8,
    requireAbstract: true
  }
}
```

- [ ] **Step 5: Create `src/main/kg4/lineageRecord.ts`**

```ts
import { createHash } from 'crypto'
import type { DedupedPaperCandidate } from '../../shared/kg3'
import type {
  ExpansionGraphEdge,
  ExpansionGraphNode,
  ExpansionIntent,
  Kg4NodeExpansionRecord,
  MethodLineageRelation,
  MethodLineageView,
  PaperMethodDigest
} from '../../shared/kg4'
import { isKg4NodeExpansionRecord } from '../../shared/kg4'

function now(): string {
  return new Date().toISOString()
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha1').update(value).digest('hex').slice(0, 16)}`
}

function safeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item'
}

function candidatePaperId(candidate: DedupedPaperCandidate): string {
  return candidate.canonicalId
}

export function toShortDisplayText(value: string | undefined, maxLength = 180): string {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) return '未提供可展示摘要。'
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function relationToExpansionRelation(relation: MethodLineageRelation): ExpansionGraphEdge['relation'] {
  if (relation === 'solves_limitation_of') return 'solves_limitation_of'
  if (relation === 'shares_assumption_with') return 'shares_assumption_with'
  if (relation === 'contrasts_with') return 'contrasts_with'
  return 'extends'
}

function graphNodesFromLineage(lineage: MethodLineageView): ExpansionGraphNode[] {
  return lineage.nodes.map((node) => ({
    id: node.id,
    type: node.role === 'open_problem' ? 'open_problem' : 'algorithm_idea',
    label: node.label,
    description: toShortDisplayText(node.summary, 180),
    sourcePaperIds: node.representativePaperIds,
    isTemporary: true,
    visualStyle: node.role === 'current_method' ? 'highlighted' : 'normal'
  }))
}

function graphEdgesFromLineage(lineage: MethodLineageView): ExpansionGraphEdge[] {
  return lineage.edges.map((edge) => ({
    id: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    relation: relationToExpansionRelation(edge.relation),
    explanation: toShortDisplayText(edge.explanation, 220)
  }))
}

function graphNodesFromDigests(digests: PaperMethodDigest[]): ExpansionGraphNode[] {
  return digests.slice(0, 8).map((digest) => ({
    id: `kg4_digest_${safeId(digest.id)}`,
    type: 'algorithm_idea',
    label: digest.methodName || digest.paperTitle,
    description: toShortDisplayText(digest.coreMechanism || digest.evidenceSummary, 180),
    sourcePaperIds: [digest.paperId],
    isTemporary: true,
    visualStyle: 'normal'
  }))
}

function graphNodesFromPapers(papers: DedupedPaperCandidate[]): ExpansionGraphNode[] {
  return papers.slice(0, 8).map((paper) => ({
    id: `kg4_paper_${safeId(candidatePaperId(paper))}`,
    type: 'related_paper',
    label: paper.title,
    description: toShortDisplayText(paper.abstract || `Retrieved paper related to this node: ${paper.title}`, 180),
    sourcePaperIds: [candidatePaperId(paper)],
    isTemporary: true,
    visualStyle: 'faded'
  }))
}

export function assembleLineageExpansionRecord(params: {
  paperId: string
  nodeId: string
  jobIds: string[]
  intent: ExpansionIntent
  retrievedPapers: DedupedPaperCandidate[]
  paperMethodDigests?: PaperMethodDigest[]
  methodLineageView?: MethodLineageView
  missingDataReasons?: string[]
}): Kg4NodeExpansionRecord {
  const timestamp = now()
  const paperMethodDigests = params.paperMethodDigests ?? []
  const expansionGraphNodes = params.methodLineageView
    ? graphNodesFromLineage(params.methodLineageView)
    : paperMethodDigests.length
      ? graphNodesFromDigests(paperMethodDigests)
      : graphNodesFromPapers(params.retrievedPapers)
  const expansionGraphEdges = params.methodLineageView ? graphEdgesFromLineage(params.methodLineageView) : []
  const missingDataReasons = [
    ...(params.missingDataReasons ?? []),
    ...(params.methodLineageView ? params.methodLineageView.missingDataReasons : []),
    ...(params.methodLineageView || paperMethodDigests.length ? [] : ['No method lineage or method digests were generated; showing short related-paper fallback.'])
  ]
  const dataCompleteness = params.methodLineageView?.dataCompleteness ?? (paperMethodDigests.length >= 2 ? 'partial' : expansionGraphNodes.length ? 'partial' : 'insufficient')

  const record: Kg4NodeExpansionRecord = {
    id: stableId('kg4_expansion', `${params.paperId}:${params.nodeId}:${params.jobIds.join(':')}`),
    paperId: params.paperId,
    nodeId: params.nodeId,
    retrievedPaperIds: params.retrievedPapers.map(candidatePaperId),
    algorithmIdeaCards: [],
    expansionGraphNodes,
    expansionGraphEdges,
    expansionIntent: params.intent,
    paperMethodDigests,
    methodLineageView: params.methodLineageView,
    dataCompleteness,
    missingDataReasons,
    generatedByJobIds: params.jobIds,
    createdAt: timestamp,
    updatedAt: timestamp
  }

  if (!isKg4NodeExpansionRecord(record)) throw new Error('invalid_kg4_lineage_expansion_record')
  return record
}
```

- [ ] **Step 6: Run the new unit test**

Run: `node --import tsx src/main/kg4/lineageRecord.test.ts`

Expected: PASS and output `lineageRecord tests passed`. If `tsx` is unavailable, run `npm run typecheck` and verify these files compile after Task 1.

## Task 3: LLM Prompts and Model Routing

**Files:**
- Modify: `src/main/llm/types.ts`
- Modify: `src/main/llm/client.ts`
- Modify: `src/main/llm/orchestrator.ts`
- Modify: `src/main/llm/jobPrompts.ts`
- Modify: `src/main/llm/orchestrator.test.ts`

- [ ] **Step 1: Add prompt tests in `src/main/llm/orchestrator.test.ts`**

Append:

```ts
const classifyPrompt = systemPromptForJob('classify_expansion_intent')
assert.match(classifyPrompt, /algorithm_method_lineage/i)
assert.match(classifyPrompt, /generic_related_papers/i)

const digestPrompt = systemPromptForJob('digest_paper_method')
assert.match(digestPrompt, /PaperMethodDigest/i)
assert.match(digestPrompt, /relationHints/i)

const lineagePrompt = systemPromptForJob('synthesize_method_lineage')
assert.match(lineagePrompt, /MethodLineageView/i)
assert.match(lineagePrompt, /evidencePaperIds/i)
```

- [ ] **Step 2: Run prompt test and verify failure**

Run: `node --import tsx src/main/llm/orchestrator.test.ts`

Expected: FAIL because prompt strings do not yet include the new schema names.

- [ ] **Step 3: Add optional model override to `src/main/llm/types.ts`**

Locate `LlmRequest` and add:

```ts
  model?: 'deepseek-v4-flash' | 'deepseek-v4-pro' | 'deepseek-chat' | 'deepseek-reasoner'
```

- [ ] **Step 4: Use model override in `src/main/llm/client.ts`**

Replace:

```ts
  const body = provider.buildBody(request, provider.model)
```

with:

```ts
  const body = provider.buildBody(request, request.model ?? provider.model)
```

- [ ] **Step 5: Allow model selection in `src/main/llm/orchestrator.ts`**

In `createJob` params, add:

```ts
    model?: LLMJob['model']
```

Change cache key model segment from hard-coded `'deepseek-chat'` to:

```ts
    const model = params.model ?? 'deepseek-v4-pro'
    const cacheKey = [params.type, PROMPT_VERSION, model, inputHash, params.nodeId, params.paperId, ...(params.relatedPaperIds ?? [])]
```

Change job field:

```ts
      model,
```

Change `executeJob` call to pass the job model:

```ts
    model: job.model,
```

- [ ] **Step 6: Add new KG4 job types to `src/main/llm/jobPrompts.ts`**

Add the three new types to `KG4_JOB_TYPES`:

```ts
  'classify_expansion_intent',
  'digest_paper_method',
  'synthesize_method_lineage',
```

Add specific prompt branches before the generic KG4 branch:

```ts
  if (type === 'classify_expansion_intent') {
    return [
      'You are a KG4 expansion intent classifier. Return strict JSON only.',
      'Classify whether currentNode should produce algorithm_method_lineage or generic_related_papers.',
      'Return fields: kind, confidence, queryFocus, rationale, and optional fallbackReason.',
      'Use algorithm_method_lineage only for concrete algorithms, methods, mechanisms, or model components.',
      'Use generic_related_papers for fields, concepts, broad topics, open problems, or low confidence.'
    ].join(' ')
  }
  if (type === 'digest_paper_method') {
    return [
      'You are a KG4 paper method digest worker. Return strict JSON only.',
      'Input contains currentNode, currentPaperInsight, and one retrievedPaper.',
      'Return a PaperMethodDigest with paperId, paperTitle, methodName, problemSetting, coreMechanism, claimedImprovement, limitation, relationHints, evidenceSummary, confidence, and optional insufficientInformation.',
      'Keep each text field short. Do not copy the full abstract.',
      'Every paperId must be the supplied retrievedPaper id.'
    ].join(' ')
  }
  if (type === 'synthesize_method_lineage') {
    return [
      'You are a KG4 method lineage synthesizer. Return strict JSON only.',
      'Input contains currentNode, currentPaperInsight, retrievedPapers, and paperMethodDigests.',
      'Return a MethodLineageView with nodes, edges, openQuestions, readingOrder, dataCompleteness, and missingDataReasons.',
      'Lineage nodes represent methods or method roles, not paper cards.',
      'Every representativePaperIds, digestIds, and evidencePaperIds item must come from the supplied inputs.',
      'Mark uncertain relationships as evidence_insufficient instead of inventing evidence.'
    ].join(' ')
  }
```

- [ ] **Step 7: Run prompt test**

Run: `node --import tsx src/main/llm/orchestrator.test.ts`

Expected: PASS and output `orchestrator tests passed`.

## Task 4: Main Expansion Pipeline Orchestration

**Files:**
- Modify: `src/main/index.ts`
- Use: `src/main/kg4/expansionQuery.ts`
- Use: `src/main/kg4/lineageRecord.ts`
- Use: `src/main/kg4/lineageTypes.ts`

- [ ] **Step 1: Add imports to `src/main/index.ts`**

Add:

```ts
import type { ExpansionIntent, MethodLineageView, PaperMethodDigest } from '../shared/kg4'
import { buildExpansionRetrievalPlan } from './kg4/expansionQuery'
import { assembleLineageExpansionRecord } from './kg4/lineageRecord'
```

- [ ] **Step 2: Add local normalization helpers in `src/main/index.ts` near `registerIpcHandlers` helpers**

```ts
function normalizeExpansionIntent(value: unknown): ExpansionIntent {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const kind = record.kind === 'algorithm_method_lineage' ? 'algorithm_method_lineage' : 'generic_related_papers'
  return {
    kind,
    confidence: typeof record.confidence === 'number' ? Math.max(0, Math.min(1, record.confidence)) : 0.3,
    queryFocus: typeof record.queryFocus === 'string' && record.queryFocus.trim() ? record.queryFocus.trim() : 'related papers',
    rationale: typeof record.rationale === 'string' && record.rationale.trim() ? record.rationale.trim() : 'Classifier did not provide a rationale.',
    fallbackReason: typeof record.fallbackReason === 'string' ? record.fallbackReason : undefined
  }
}

function normalizePaperMethodDigest(value: unknown, fallback: { id: string; paperTitle: string }): PaperMethodDigest | null {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const paperId = typeof record.paperId === 'string' && record.paperId.trim() ? record.paperId.trim() : fallback.id
  const paperTitle = typeof record.paperTitle === 'string' && record.paperTitle.trim() ? record.paperTitle.trim() : fallback.paperTitle
  const problemSetting = typeof record.problemSetting === 'string' && record.problemSetting.trim() ? record.problemSetting.trim() : undefined
  const coreMechanism = typeof record.coreMechanism === 'string' && record.coreMechanism.trim() ? record.coreMechanism.trim() : undefined
  const evidenceSummary = typeof record.evidenceSummary === 'string' && record.evidenceSummary.trim() ? record.evidenceSummary.trim() : undefined
  if (!paperId || !paperTitle || !problemSetting || !coreMechanism || !evidenceSummary) return null
  const relationHints = Array.isArray(record.relationHints)
    ? record.relationHints.filter((hint): hint is PaperMethodDigest['relationHints'][number] =>
        hint === 'foundation' || hint === 'parallel_variant' || hint === 'extends' || hint === 'improves_limitation' || hint === 'application_variant' || hint === 'unclear')
    : ['unclear' as const]
  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : `digest_${paperId.replace(/[^a-z0-9]+/gi, '_')}`,
    paperId,
    paperTitle,
    methodName: typeof record.methodName === 'string' ? record.methodName : undefined,
    problemSetting,
    coreMechanism,
    claimedImprovement: typeof record.claimedImprovement === 'string' ? record.claimedImprovement : undefined,
    limitation: typeof record.limitation === 'string' ? record.limitation : undefined,
    relationHints,
    evidenceSummary,
    confidence: typeof record.confidence === 'number' ? Math.max(0, Math.min(1, record.confidence)) : 0.5,
    insufficientInformation: typeof record.insufficientInformation === 'string' ? record.insufficientInformation : undefined
  }
}

function normalizeMethodLineageView(value: unknown): MethodLineageView | undefined {
  return value && typeof value === 'object' ? value as MethodLineageView : undefined
}
```

- [ ] **Step 3: Replace expansion run stages in `kg4:start-expansion`**

Inside `runExpansion`, after `job_created`, insert classification before retrieval:

```ts
        mainWindow.webContents.send('expansion:progress', {
          sessionId,
          jobId,
          step: 'classifying',
          message: '正在判断展开意图...'
        })

        const classifyJob = await llmTaskOrchestrator.createJob({
          type: 'classify_expansion_intent',
          input: {
            currentNode: {
              id: params.nodeId,
              label: params.nodeLabel,
              searchQueries: params.searchQueries ?? []
            },
            currentPaperInsight: params.paperInsight
          },
          nodeId: params.nodeId,
          paperId: params.paperId,
          sessionId,
          model: 'deepseek-v4-flash',
          maxTokens: 1200,
          temperature: 0.1
        })
        jobId = classifyJob.id
        const classifyResult = await llmTaskOrchestrator.runJob(classifyJob.id)
        const intent = normalizeExpansionIntent(classifyResult.status === 'succeeded' || classifyResult.status === 'cache_hit' ? classifyResult.resultJson : undefined)
        const retrievalPlan = buildExpansionRetrievalPlan({
          intent,
          node: { id: params.nodeId, label: params.nodeLabel, searchQueries: params.searchQueries ?? [] },
          paperInsight: params.paperInsight
        })
```

Then change `searchPapers` input to use `retrievalPlan`:

```ts
        const { candidates, providerStatus } = await searchPapers({
          query: retrievalPlan.primaryQuery,
          nodeId: params.nodeId,
          paperId: params.paperId,
          searchQueries: retrievalPlan.searchQueries,
          maxResults: retrievalPlan.maxResults,
          requireAbstract: retrievalPlan.requireAbstract
        })
```

- [ ] **Step 4: Add generic fallback branch after retrieval**

After `relatedPaperIds` logging, before old `expand_node_retrieve_context` job creation, add:

```ts
        if (intent.kind === 'generic_related_papers' || candidates.length < 2) {
          mainWindow.webContents.send('expansion:progress', { sessionId, jobId, step: 'generating', message: '正在生成可读的相关论文结果...' })
          const record = assembleLineageExpansionRecord({
            paperId: params.paperId ?? 'current-paper',
            nodeId: params.nodeId,
            jobIds: [jobId].filter(Boolean),
            intent,
            retrievedPapers: candidates,
            paperMethodDigests: [],
            missingDataReasons: candidates.length < 2 ? ['可用论文不足，未生成方法谱系。'] : []
          })
          mainWindow.webContents.send('expansion:progress', { sessionId, jobId, step: 'persisting', message: '正在保存展开结果...' })
          await paperMemoryRepository.saveKg4ExpansionRecord(record)
          mainWindow.webContents.send('expansion:progress', { sessionId, jobId, step: 'done', message: '展开完成', result: record })
          return
        }
```

- [ ] **Step 5: Replace old single KG4 LLM job with digest and synthesize jobs**

Remove or bypass the existing `expand_node_retrieve_context` job block and insert:

```ts
        mainWindow.webContents.send('expansion:progress', {
          sessionId,
          jobId,
          step: 'digesting',
          message: '正在并行消化相关论文的方法信息...'
        })

        const digestResults = await Promise.all(candidates.map(async (paper) => {
          const digestJob = await llmTaskOrchestrator.createJob({
            type: 'digest_paper_method',
            input: {
              currentNode: { id: params.nodeId, label: params.nodeLabel, searchQueries: params.searchQueries ?? [] },
              currentPaperInsight: params.paperInsight,
              retrievedPaper: paper
            },
            nodeId: params.nodeId,
            paperId: params.paperId,
            relatedPaperIds: [candidatePaperId(paper)],
            sessionId,
            model: 'deepseek-v4-flash',
            maxTokens: 1800,
            temperature: 0.1
          })
          const result = await llmTaskOrchestrator.runJob(digestJob.id)
          if (result.status !== 'succeeded' && result.status !== 'cache_hit') return null
          return normalizePaperMethodDigest(result.resultJson, { id: candidatePaperId(paper), paperTitle: paper.title })
        }))
        const paperMethodDigests = digestResults.filter((digest): digest is PaperMethodDigest => Boolean(digest))

        if (paperMethodDigests.length < 2) {
          const record = assembleLineageExpansionRecord({
            paperId: params.paperId ?? 'current-paper',
            nodeId: params.nodeId,
            jobIds: [jobId].filter(Boolean),
            intent,
            retrievedPapers: candidates,
            paperMethodDigests,
            missingDataReasons: ['可用方法摘要少于 2 个，未生成方法谱系。']
          })
          mainWindow.webContents.send('expansion:progress', { sessionId, jobId, step: 'persisting', message: '正在保存展开结果...' })
          await paperMemoryRepository.saveKg4ExpansionRecord(record)
          mainWindow.webContents.send('expansion:progress', { sessionId, jobId, step: 'done', message: '展开完成', result: record })
          return
        }

        mainWindow.webContents.send('expansion:progress', {
          sessionId,
          jobId,
          step: 'synthesizing',
          message: '正在汇总生成方法谱系...'
        })
        const lineageJob = await llmTaskOrchestrator.createJob({
          type: 'synthesize_method_lineage',
          input: {
            currentNode: { id: params.nodeId, label: params.nodeLabel, searchQueries: params.searchQueries ?? [] },
            currentPaperInsight: params.paperInsight,
            retrievedPapers: candidates,
            paperMethodDigests
          },
          nodeId: params.nodeId,
          paperId: params.paperId,
          relatedPaperIds,
          sessionId,
          model: 'deepseek-v4-pro',
          maxTokens: 6000,
          temperature: 0.1
        })
        jobId = lineageJob.id
        const lineageResult = await llmTaskOrchestrator.runJob(lineageJob.id)
        const methodLineageView = lineageResult.status === 'succeeded' || lineageResult.status === 'cache_hit'
          ? normalizeMethodLineageView(lineageResult.resultJson)
          : undefined

        mainWindow.webContents.send('expansion:progress', { sessionId, jobId, step: 'generating', message: '正在生成扩展图谱...' })
        const record = assembleLineageExpansionRecord({
          paperId: params.paperId ?? 'current-paper',
          nodeId: params.nodeId,
          jobIds: [classifyJob.id, lineageJob.id],
          intent,
          retrievedPapers: candidates,
          paperMethodDigests,
          methodLineageView,
          missingDataReasons: methodLineageView ? [] : ['方法谱系汇总失败，展示论文方法摘要。']
        })
```

Keep the existing persisting and done sends after `record` is built.

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`

Expected: It may still fail because renderer progress steps and views are not updated yet. Continue to Task 5 and Task 6 before final verification.

## Task 5: Renderer Session Progress and Lineage-First Graph View

**Files:**
- Modify: `src/renderer/src/domains/expansion/nodeExpansionSessions.ts`
- Modify: `src/renderer/src/components/ExpansionGraphView.tsx`

- [ ] **Step 1: Update expansion loading steps in `nodeExpansionSessions.ts`**

Replace `EXPANSION_STEPS` with:

```ts
export const EXPANSION_STEPS: NodeExpansionStep[] = [
  { id: 'job_created', label: '创建展开任务', status: 'pending', detail: '正在准备展开任务...' },
  { id: 'classifying', label: '判断展开意图', status: 'pending', detail: '判断是否适合生成方法谱系...' },
  { id: 'retrieving', label: '检索相关论文', status: 'pending', detail: '检索本地和外部论文源...' },
  { id: 'digesting', label: '消化论文方法', status: 'pending', detail: '并行提取每篇论文的方法摘要...' },
  { id: 'synthesizing', label: '汇总方法谱系', status: 'pending', detail: '跨论文归纳方法演进关系...' },
  { id: 'generating', label: '生成扩展图谱', status: 'pending', detail: '构建临时扩展节点和边...' },
  { id: 'persisting', label: '保存展开结果', status: 'pending', detail: '写入本地数据库...' },
  { id: 'done', label: '完成', status: 'pending', detail: '展开结果已就绪' }
]
```

Replace `stepOrder` with:

```ts
  const stepOrder = ['job_created', 'classifying', 'retrieving', 'digesting', 'synthesizing', 'generating', 'persisting', 'done'] as const
```

- [ ] **Step 2: Update `ExpansionGraphView.tsx` to display lineage summary**

After `const selectedExpansionNodeId = ...`, add:

```ts
  const record = session?.expansionRecord
  const lineage = record?.methodLineageView
  const digests = record?.paperMethodDigests ?? []
```

Replace toolbar paragraph:

```tsx
          <p>{lineage ? lineage.summary : '浅色节点是 temporary expansion nodes。点击节点查看详情，不直接打开对比工作台。'}</p>
```

Before `expansion-node-list`, add:

```tsx
      {lineage && (
        <section className="kg4-field-view">
          <span className="node-expansion__label">Method Lineage</span>
          <strong>{lineage.title}</strong>
          <p>{lineage.summary}</p>
          {lineage.readingOrder.length > 0 && <p>推荐阅读顺序：{lineage.readingOrder.join(' → ')}</p>}
          {lineage.openQuestions.length > 0 && (
            <div className="kg4-family-list">
              {lineage.openQuestions.map((question) => <span key={question}>{question}</span>)}
            </div>
          )}
        </section>
      )}
```

In the node list, replace `<p>{node.description}</p>` with:

```tsx
            <p>{node.description.length > 220 ? `${node.description.slice(0, 219)}…` : node.description}</p>
```

After `expansion-edge-list`, add evidence digest section:

```tsx
      {digests.length > 0 && (
        <section className="expansion-edge-list">
          <span className="eyebrow">Evidence Papers</span>
          {digests.map((digest) => (
            <article key={digest.id}>
              <strong>{digest.methodName || digest.paperTitle}</strong>
              <span>{digest.relationHints.join(', ')}</span>
              <p>{digest.evidenceSummary}</p>
            </article>
          ))}
        </section>
      )}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: It may still fail if workspace detail routes are not added yet. Continue to Task 6.

## Task 6: Detail Views and Workspace Routing

**Files:**
- Modify: `src/renderer/src/domains/workspace/types.ts`
- Create: `src/renderer/src/components/LineageNodeDetailView.tsx`
- Create: `src/renderer/src/components/EvidencePaperDetailView.tsx`
- Modify: `src/renderer/src/components/ai-panel/ExpansionNodeInspector.tsx`
- Modify: central workspace router file found by `grep "expand_view" src/renderer/src -n`

- [ ] **Step 1: Extend workspace tab types in `workspace/types.ts`**

Add to `WorkspaceTabType` union:

```ts
  | 'lineage_node_detail'
  | 'evidence_paper_detail'
```

- [ ] **Step 2: Create `LineageNodeDetailView.tsx`**

```tsx
import { useExpansion } from '../domains/expansion/useExpansion'
import { useWorkspace } from '../domains/workspace/useWorkspace'

function LineageNodeDetailView() {
  const { activeTab, openTab } = useWorkspace()
  const { sessions } = useExpansion()
  const session = activeTab?.expansionId ? sessions[activeTab.expansionId] : undefined
  const lineage = session?.expansionRecord?.methodLineageView
  const node = lineage?.nodes.find((item) => item.id === activeTab?.nodeId)

  if (!session || !lineage || !node) {
    return (
      <div className="workspace-placeholder-view">
        <span className="eyebrow">Lineage Node</span>
        <h3>找不到方法谱系节点</h3>
        <p>请从 Expansion Graph 重新选择一个方法谱系节点。</p>
      </div>
    )
  }

  const openCompareWorkbench = () => {
    openTab({
      id: `expand_view_${session.id}_${node.id}`,
      type: 'expand_view',
      title: `Compare: ${node.label}`,
      nodeId: node.id,
      anchorNodeId: session.nodeId,
      expansionId: session.id,
      closable: true,
      status: session.expansionRecord?.algorithmIdeaCards.length ? 'ready' : 'empty'
    })
  }

  return (
    <div className="expand-view kg4-workbench">
      <section className="expand-view__hero">
        <div>
          <span className="eyebrow">Lineage Node Detail</span>
          <h3>{node.label}</h3>
          <p>{node.summary}</p>
        </div>
        <button className="stage-btn stage-btn--secondary" onClick={openCompareWorkbench}>进入对比工作台</button>
      </section>
      <div className="kg4-field-view">
        <span className="node-expansion__label">Role</span>
        <strong>{node.role}</strong>
        <p>代表论文：{node.representativePaperIds.length ? node.representativePaperIds.join(', ') : '暂无代表论文'}</p>
        <p>Digest：{node.digestIds.length ? node.digestIds.join(', ') : '暂无 digest 关联'}</p>
      </div>
      <section className="expansion-edge-list">
        <span className="eyebrow">Related Lineage Edges</span>
        {lineage.edges.filter((edge) => edge.sourceId === node.id || edge.targetId === node.id).map((edge) => (
          <article key={edge.id}>
            <strong>{edge.sourceId} → {edge.targetId}</strong>
            <span>{edge.relation} · {Math.round(edge.confidence * 100)}%</span>
            <p>{edge.explanation}</p>
          </article>
        ))}
      </section>
    </div>
  )
}

export default LineageNodeDetailView
```

- [ ] **Step 3: Create `EvidencePaperDetailView.tsx`**

```tsx
import { useExpansion } from '../domains/expansion/useExpansion'
import { useWorkspace } from '../domains/workspace/useWorkspace'

function EvidencePaperDetailView() {
  const { activeTab } = useWorkspace()
  const { sessions } = useExpansion()
  const session = activeTab?.expansionId ? sessions[activeTab.expansionId] : undefined
  const digest = session?.expansionRecord?.paperMethodDigests?.find((item) => item.paperId === activeTab?.nodeId || item.id === activeTab?.nodeId)

  if (!session || !digest) {
    return (
      <div className="workspace-placeholder-view">
        <span className="eyebrow">Evidence Paper</span>
        <h3>找不到证据论文详情</h3>
        <p>请从 Expansion Graph 的 Evidence Papers 区域重新选择。</p>
      </div>
    )
  }

  return (
    <div className="expand-view kg4-workbench">
      <section className="expand-view__hero">
        <div>
          <span className="eyebrow">Evidence Paper Detail</span>
          <h3>{digest.paperTitle}</h3>
          <p>{digest.evidenceSummary}</p>
        </div>
      </section>
      <div className="kg4-field-view">
        <span className="node-expansion__label">Method Digest</span>
        <strong>{digest.methodName || '未明确方法名'}</strong>
        <p><b>问题：</b>{digest.problemSetting}</p>
        <p><b>机制：</b>{digest.coreMechanism}</p>
        {digest.claimedImprovement && <p><b>改进：</b>{digest.claimedImprovement}</p>}
        {digest.limitation && <p><b>局限：</b>{digest.limitation}</p>}
        <p><b>关系线索：</b>{digest.relationHints.join(', ')}</p>
      </div>
    </div>
  )
}

export default EvidencePaperDetailView
```

- [ ] **Step 4: Update `ExpansionNodeInspector.tsx` to open lineage detail**

Replace `handleOpenExpandView` with:

```tsx
  const handleOpenDetailView = () => {
    openTab({
      id: `lineage_detail_${expansionId}_${node.id}`,
      type: node.type === 'related_paper' ? 'evidence_paper_detail' : 'lineage_node_detail',
      title: node.label,
      nodeId: node.sourcePaperIds[0] ?? node.id,
      anchorNodeId: session?.nodeId,
      expansionId,
      closable: true,
      status: 'ready'
    })
  }
```

Replace button/action text:

```tsx
        <button className="stage-btn stage-btn--primary" onClick={handleOpenDetailView}>查看详情</button>
        <p>先查看方法谱系或证据论文详情；选择足够方法后再进入对比工作台。</p>
```

- [ ] **Step 5: Update central workspace router**

Find router with: `grep "expand_view" src/renderer/src -n`

In the router component, import:

```tsx
import LineageNodeDetailView from './LineageNodeDetailView'
import EvidencePaperDetailView from './EvidencePaperDetailView'
```

Add cases beside `expand_view`:

```tsx
  if (activeTab.type === 'lineage_node_detail') return <LineageNodeDetailView />
  if (activeTab.type === 'evidence_paper_detail') return <EvidencePaperDetailView />
```

Adjust import paths if the router lives outside `components/`.

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`

Expected: PASS or actionable TypeScript errors only from import path mismatches. Fix import paths and rerun until PASS.

## Task 7: Final Verification and Documentation Status

**Files:**
- Modify: `docs/superpowers/specs/2026-05-31-lineage-first-node-expansion-design.md`

- [ ] **Step 1: Update spec status**

Change line 4 from:

```md
**Status:** Draft for user review
```

to:

```md
**Status:** Approved for implementation
```

- [ ] **Step 2: Run focused tests**

Run: `node --import tsx src/main/kg4/lineageRecord.test.ts`

Expected: PASS with `lineageRecord tests passed`.

Run: `node --import tsx src/main/llm/orchestrator.test.ts`

Expected: PASS with `orchestrator tests passed`.

- [ ] **Step 3: Run full typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 4: Review changed files**

Run: `git diff -- docs/superpowers/specs/2026-05-31-lineage-first-node-expansion-design.md docs/superpowers/plans/2026-05-31-lineage-first-node-expansion.md src/shared/kg4.ts src/shared/kg3.ts src/shared/electron-api.ts src/main/kg4 src/main/llm src/main/index.ts src/renderer/src/domains/expansion src/renderer/src/domains/workspace src/renderer/src/components`

Expected: Diff only contains lineage-first expansion changes. Do not revert unrelated worktree changes.

## Self-Review Checklist

Spec coverage:

- Intent classification is covered by Task 1 types, Task 3 prompts/model routing, and Task 4 orchestration.
- Lineage-oriented retrieval is covered by Task 2 query builder and Task 4 usage.
- Parallel per-paper digestion is covered by Task 3 digest prompt and Task 4 digest jobs.
- Cross-paper synthesis is covered by Task 3 lineage prompt and Task 4 synthesis job.
- Record assembly and fallback no-raw-abstract behavior are covered by Task 2 tests and implementation.
- Renderer lineage-first display and detail drill-down are covered by Tasks 5 and 6.
- Progress steps are covered by Tasks 1 and 5.
- Verification is covered by Task 7.

Placeholder scan:

- The plan intentionally contains no `TBD`, `TODO`, or `implement later` steps.
- Code blocks define concrete types, functions, and UI components.

Type consistency:

- New shared types are `ExpansionIntent`, `ExpansionRetrievalPlan`, `PaperMethodDigest`, and `MethodLineageView`.
- New record fields are `expansionIntent`, `paperMethodDigests`, and `methodLineageView`.
- New progress steps are `classifying`, `digesting`, and `synthesizing`.
- New tab types are `lineage_node_detail` and `evidence_paper_detail`.
