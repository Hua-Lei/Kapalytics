# PDF-Grounded Method Lineage Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `track_method_lineage` expansion synthesize a beginner-friendly method lineage directly from the current PDF's extracted page text, and render inline PDF evidence excerpts in the method lineage UI.

**Architecture:** Keep the existing KG4 expansion IPC entry and persisted `Kg4NodeExpansionRecord`, but add a PDF-grounded lineage context that flows into `synthesize_method_lineage`. Extend the existing `MethodLineageView` shape with optional teaching/evidence sections so old records continue to render, then update the lineage renderer to prefer the richer sections when present.

**Tech Stack:** Electron main/preload IPC, TypeScript shared contracts, existing `pdfjs-dist` extraction, KG4 LLM orchestrator, React 18 renderer, direct `npx tsx` tests, and `npm run typecheck`.

---

## File Structure

- Modify `src/shared/kg4.ts`: add PDF source and evidence reference types; extend `MethodLineageView`, `MethodLineageNode`, `MethodLineageEdge`, and `StartKg4ExpansionParams`; update validators.
- Modify `src/shared/electron-api.ts`: no new IPC channel, but `kg4.startExpansion` uses the extended `StartKg4ExpansionParams`.
- Modify `src/renderer/src/domains/paper/types.ts`: expose `pdfUrl` as part of expansion context source; add `pdfPath` only if the implementation chooses to return it from `usePaperAnalysis`.
- Modify `src/renderer/src/domains/expansion/types.ts`: let `setPaperContext` carry `pdfUrl`, graph nodes, and graph edges.
- Modify `src/renderer/src/domains/expansion/ExpansionPaperSyncBridge.tsx`: pass `pdfUrl`, `graph.nodes`, and `graph.edges` into `setPaperContext`.
- Modify `src/renderer/src/domains/expansion/ExpansionProvider.tsx`: store PDF URL and graph edges in refs; pass `pdfUrl` and local graph neighborhood to `kg4.startExpansion`.
- Create `src/main/kg4/paperSourceContext.ts`: build `PaperSourceContext` and `MethodLineageContext` from extracted PDF pages, anchor node, paper insight, and graph neighborhood.
- Create `src/main/kg4/paperSourceContext.test.ts`: pure tests for page joining, neighborhood shaping, and no-summary PDF context.
- Modify `src/main/llm/jobPrompts.ts`: rewrite the `synthesize_method_lineage` prompt around `methodLineageContext.paperSource`.
- Modify `src/main/llm/orchestrator.ts`: validate optional PDF evidence fields, and require them when the job input contains `methodLineageContext.paperSource`.
- Modify `src/main/llm/orchestrator.test.ts`: assert prompt and validation behavior for PDF-grounded lineage.
- Modify `src/main/index.ts`: when the classified path is `track_method_lineage` and `pdfUrl` exists, extract PDF text and synthesize lineage from `MethodLineageContext`; do not require retrieved paper digests.
- Modify `src/main/kg4/lineageRecord.ts`: keep projecting old `nodes` and `edges`; preserve the richer `methodLineageView` sections unchanged.
- Modify `src/renderer/src/components/MethodLineageView.tsx`: render teaching sections and inline PDF evidence cards before falling back to old node/edge sections.
- Modify `src/renderer/src/components/MethodLineageView.test.tsx`: test "谱系/演进图" plus inline evidence rendering.
- Modify `src/renderer/src/styles/panels.css`: add compact inline evidence card styles.
- Verify with existing tests: `src/main/kg4/lineageRecord.test.ts`, `src/main/llm/orchestrator.test.ts`, `src/renderer/src/components/MethodLineageView.test.tsx`, and `npm run typecheck`.

## Task 1: Shared PDF-Grounded Lineage Contract

**Files:**
- Modify: `src/shared/kg4.ts`

- [ ] **Step 1: Add the failing shared type usage test in `src/main/llm/orchestrator.test.ts`**

Append this assertion block near the existing `lineagePrompt` assertions. It will fail before the prompt and validator understand PDF evidence:

```ts
const pdfGroundedLineageOutput = {
  id: 'lineage-pdf',
  anchorNodeId: 'node-a',
  title: 'PDF grounded lineage',
  summary: 'A lineage grounded in the current paper.',
  problemSetup: {
    beginnerExplanation: 'The paper studies how to adapt a model efficiently.',
    whyThisProblemMatters: 'Efficient adaptation reduces training cost.',
    pdfEvidence: [{
      sourceType: 'current_pdf',
      pageNumber: 2,
      sectionTitle: 'Introduction',
      excerpt: 'We study efficient adaptation for large models.',
      claimSupported: 'The paper problem is efficient adaptation.'
    }]
  },
  conceptBridge: [{
    concept: 'Adapter',
    explanation: 'A small trainable module added to a frozen model.',
    whyNeededForThisLineage: 'Adapters are the baseline family being improved.',
    pdfEvidence: []
  }],
  anchorPosition: {
    summary: 'The current paper is an improvement stage.',
    whatTheCurrentPaperChanges: 'It generates adapter parameters dynamically.',
    whatItInherits: ['Frozen backbone adaptation'],
    whatItDoesNotSolve: ['Full retrieval-backed literature coverage'],
    pdfEvidence: [{
      sourceType: 'current_pdf',
      pageNumber: 4,
      sectionTitle: 'Method',
      excerpt: 'Our method generates adaptation weights conditioned on context.',
      claimSupported: 'The paper changes how adapter weights are produced.'
    }]
  },
  methodComparisons: [{
    methodA: 'Static adapters',
    methodB: 'Context-conditioned adapters',
    keyDifference: 'Static adapters learn fixed parameters; the current method generates them from context.',
    whyItMatters: 'This changes how adaptation responds to inputs.',
    evidence: [{ sourceType: 'model_knowledge', note: 'General adapter background.', confidence: 0.65 }]
  }],
  confidenceAndEvidence: {
    groundedInCurrentPdf: ['Problem statement', 'Current method mechanism'],
    fromModelKnowledge: ['Background adapter lineage'],
    needsFutureRetrieval: ['Representative predecessor papers']
  },
  nodes: [{
    id: 'stage-current',
    label: 'Context-conditioned adapter generation',
    role: 'current_method',
    summary: 'The current paper generates adapter weights dynamically.',
    representativePaperIds: ['paper-main'],
    digestIds: [],
    evidence: [{
      sourceType: 'current_pdf',
      pageNumber: 4,
      excerpt: 'Our method generates adaptation weights conditioned on context.',
      claimSupported: 'Current method mechanism.'
    }]
  }],
  edges: [],
  openQuestions: ['Which predecessor papers should be retrieved next?'],
  readingOrder: [],
  dataCompleteness: 'partial',
  missingDataReasons: ['External retrieval evidence is reserved for a later phase.']
}

assert.equal(
  validateJobOutput(
    makeJob({
      type: 'synthesize_method_lineage',
      paperId: 'paper-main',
      relatedPaperIds: [],
      inputJson: {
        methodLineageContext: {
          paperSource: {
            pdfUrl: 'file:///paper.pdf',
            extractedText: '[Page 1]\\ntext',
            pages: [{ pageNumber: 1, text: 'text' }]
          }
        }
      }
    }),
    pdfGroundedLineageOutput
  ).ok,
  true
)
```

- [ ] **Step 2: Run the failing validation test**

Run: `npx tsx src/main/llm/orchestrator.test.ts`

Expected: FAIL because `problemSetup`, `anchorPosition`, `methodComparisons`, and `evidence` are not accepted or required yet.

- [ ] **Step 3: Add evidence/source types in `src/shared/kg4.ts` after `PaperMethodDigest`**

```ts
export interface PaperSourcePageContext {
  pageNumber: number
  text: string
}

export interface PaperSourceSectionContext {
  title: string
  text: string
  pageRange?: string
}

export interface PaperSourceContext {
  pdfUrl: string
  extractedText: string
  pages: PaperSourcePageContext[]
  sections?: PaperSourceSectionContext[]
}

export interface PdfEvidenceRef {
  sourceType: 'current_pdf'
  pageNumber?: number
  sectionTitle?: string
  excerpt: string
  claimSupported: string
}

export interface ModelKnowledgeEvidenceRef {
  sourceType: 'model_knowledge'
  note: string
  confidence: number
}

export interface FutureRetrievalEvidenceRef {
  sourceType: 'future_retrieval_needed'
  reason: string
}

export type MethodLineageEvidenceRef = PdfEvidenceRef | ModelKnowledgeEvidenceRef | FutureRetrievalEvidenceRef
```

- [ ] **Step 4: Extend `MethodLineageNode`, `MethodLineageEdge`, and `MethodLineageView` in `src/shared/kg4.ts`**

Keep all existing required fields. Add only optional fields so persisted records stay compatible:

```ts
export interface MethodLineageNode {
  id: string
  label: string
  role: MethodLineageNodeRole
  summary: string
  representativePaperIds: string[]
  digestIds: string[]
  evidence?: MethodLineageEvidenceRef[]
}

export interface MethodLineageEdge {
  id: string
  sourceId: string
  targetId: string
  relation: MethodLineageRelation
  explanation: string
  evidencePaperIds: string[]
  confidence: number
  evidence?: MethodLineageEvidenceRef[]
}

export interface MethodLineageView {
  id: string
  anchorNodeId: string
  title: string
  summary: string
  problemSetup?: {
    beginnerExplanation: string
    whyThisProblemMatters: string
    pdfEvidence: PdfEvidenceRef[]
  }
  conceptBridge?: Array<{
    concept: string
    explanation: string
    whyNeededForThisLineage: string
    pdfEvidence?: PdfEvidenceRef[]
  }>
  anchorPosition?: {
    summary: string
    whatTheCurrentPaperChanges: string
    whatItInherits: string[]
    whatItDoesNotSolve: string[]
    pdfEvidence: PdfEvidenceRef[]
  }
  methodComparisons?: Array<{
    methodA: string
    methodB: string
    keyDifference: string
    whyItMatters: string
    evidence: MethodLineageEvidenceRef[]
  }>
  confidenceAndEvidence?: {
    groundedInCurrentPdf: string[]
    fromModelKnowledge: string[]
    needsFutureRetrieval: string[]
  }
  nodes: MethodLineageNode[]
  edges: MethodLineageEdge[]
  openQuestions: string[]
  readingOrder: string[]
  dataCompleteness: 'complete' | 'partial' | 'insufficient'
  missingDataReasons: string[]
}
```

- [ ] **Step 5: Add `pdfUrl` and graph neighborhood to `StartKg4ExpansionParams` in `src/shared/kg4.ts`**

```ts
export interface Kg4GraphNeighborhoodInput {
  nodes: Array<{
    id: string
    label: string
    type?: string
    description?: string
  }>
  edges: Array<{
    sourceId: string
    targetId: string
    label?: string
  }>
}

export interface StartKg4ExpansionParams {
  sessionId?: string
  nodeId: string
  nodeLabel: string
  nodeType?: NodeType
  expansionType?: GraphNode['expansionType']
  paperId?: string
  pdfUrl?: string
  graphNeighborhood?: Kg4GraphNeighborhoodInput
  searchQueries?: string[]
  forceRefresh?: boolean
  paperInsight?: {
    title?: string
    problem?: string
    method?: string
    contribution?: string
  }
}
```

- [ ] **Step 6: Update shared validators in `src/shared/kg4.ts`**

Add helpers near the existing lineage validators:

```ts
function isPdfEvidenceRef(value: unknown): value is PdfEvidenceRef {
  return (
    isRecordObject(value) &&
    value.sourceType === 'current_pdf' &&
    typeof value.excerpt === 'string' &&
    Boolean(value.excerpt.trim()) &&
    typeof value.claimSupported === 'string' &&
    Boolean(value.claimSupported.trim()) &&
    (value.pageNumber === undefined || (typeof value.pageNumber === 'number' && Number.isInteger(value.pageNumber) && value.pageNumber > 0)) &&
    isOptionalString(value.sectionTitle)
  )
}

function isModelKnowledgeEvidenceRef(value: unknown): value is ModelKnowledgeEvidenceRef {
  return (
    isRecordObject(value) &&
    value.sourceType === 'model_knowledge' &&
    typeof value.note === 'string' &&
    Boolean(value.note.trim()) &&
    isNumberInRange(value.confidence, 0, 1)
  )
}

function isFutureRetrievalEvidenceRef(value: unknown): value is FutureRetrievalEvidenceRef {
  return (
    isRecordObject(value) &&
    value.sourceType === 'future_retrieval_needed' &&
    typeof value.reason === 'string' &&
    Boolean(value.reason.trim())
  )
}

function isMethodLineageEvidenceRef(value: unknown): value is MethodLineageEvidenceRef {
  return isPdfEvidenceRef(value) || isModelKnowledgeEvidenceRef(value) || isFutureRetrievalEvidenceRef(value)
}
```

Then update `isMethodLineageNode` and `isMethodLineageEdge`:

```ts
    (value.evidence === undefined ||
      (Array.isArray(value.evidence) && value.evidence.every(isMethodLineageEvidenceRef)))
```

Add a `isMethodLineageProblemSetup`, `isMethodLineageAnchorPosition`, and `isMethodComparison` helper, then add these checks inside `isMethodLineageView`:

```ts
    (value.problemSetup === undefined || isMethodLineageProblemSetup(value.problemSetup)) &&
    (value.conceptBridge === undefined ||
      (Array.isArray(value.conceptBridge) &&
        value.conceptBridge.every((item) =>
          isRecordObject(item) &&
          typeof item.concept === 'string' &&
          Boolean(item.concept.trim()) &&
          typeof item.explanation === 'string' &&
          Boolean(item.explanation.trim()) &&
          typeof item.whyNeededForThisLineage === 'string' &&
          Boolean(item.whyNeededForThisLineage.trim()) &&
          (item.pdfEvidence === undefined || (Array.isArray(item.pdfEvidence) && item.pdfEvidence.every(isPdfEvidenceRef)))
        ))) &&
    (value.anchorPosition === undefined || isMethodLineageAnchorPosition(value.anchorPosition)) &&
    (value.methodComparisons === undefined ||
      (Array.isArray(value.methodComparisons) && value.methodComparisons.every(isMethodComparison))) &&
    (value.confidenceAndEvidence === undefined ||
      (isRecordObject(value.confidenceAndEvidence) &&
        isStringArray(value.confidenceAndEvidence.groundedInCurrentPdf) &&
        isStringArray(value.confidenceAndEvidence.fromModelKnowledge) &&
        isStringArray(value.confidenceAndEvidence.needsFutureRetrieval))) &&
```

- [ ] **Step 7: Run the validation test again**

Run: `npx tsx src/main/llm/orchestrator.test.ts`

Expected: It still fails until Task 4 updates orchestrator validation. Continue to Task 2.

## Task 2: Pass PDF URL and Graph Neighborhood Into Expansion

**Files:**
- Modify: `src/renderer/src/domains/expansion/types.ts`
- Modify: `src/renderer/src/domains/expansion/ExpansionPaperSyncBridge.tsx`
- Modify: `src/renderer/src/domains/expansion/ExpansionProvider.tsx`

- [ ] **Step 1: Update `ExpansionContextValue` context shape in `src/renderer/src/domains/expansion/types.ts`**

Replace `setPaperContext` with:

```ts
  setPaperContext: (context: {
    graphNodes: GraphNode[]
    graphEdges: Array<{ id: string; sourceId: string; targetId: string; label?: string; directed: boolean }>
    paperInsight: PaperInsight | null
    paperId: string | null
    pdfUrl: string | null
  }) => void
```

- [ ] **Step 2: Update `ExpansionPaperSyncBridge.tsx`**

Replace the existing effect body with:

```tsx
export function ExpansionPaperSyncBridge() {
  const { graph, paperId, paperInsight, pdfUrl } = usePaper()
  const { setPaperContext } = useExpansion()

  useEffect(() => {
    setPaperContext({ graphNodes: graph.nodes, graphEdges: graph.edges, paperInsight, paperId, pdfUrl })
  }, [graph.nodes, graph.edges, paperId, paperInsight, pdfUrl, setPaperContext])

  return null
}
```

- [ ] **Step 3: Update refs in `ExpansionProvider.tsx`**

Add refs beside `graphRef`:

```tsx
  const graphEdgesRef = useRef<Array<{ id: string; sourceId: string; targetId: string; label?: string; directed: boolean }>>([])
  const pdfUrlRef = useRef<string | null>(null)
```

Replace `setPaperContext` with:

```tsx
  const setPaperContext = useCallback((context: {
    graphNodes: GraphNode[]
    graphEdges: Array<{ id: string; sourceId: string; targetId: string; label?: string; directed: boolean }>
    paperInsight: PaperInsight | null
    paperId: string | null
    pdfUrl: string | null
  }) => {
    graphRef.current = context.graphNodes
    graphEdgesRef.current = context.graphEdges
    paperInsightRef.current = context.paperInsight
    paperIdRef.current = context.paperId
    pdfUrlRef.current = context.pdfUrl
  }, [])
```

- [ ] **Step 4: Add a local neighborhood builder in `ExpansionProvider.tsx`**

Place this helper above `ExpansionProvider`:

```tsx
function buildLocalGraphNeighborhood(
  nodeId: string,
  nodes: GraphNode[],
  edges: Array<{ sourceId: string; targetId: string; label?: string }>
) {
  const connectedNodeIds = new Set<string>([nodeId])
  edges.forEach((edge) => {
    if (edge.sourceId === nodeId) connectedNodeIds.add(edge.targetId)
    if (edge.targetId === nodeId) connectedNodeIds.add(edge.sourceId)
  })
  return {
    nodes: nodes
      .filter((node) => connectedNodeIds.has(node.id))
      .slice(0, 12)
      .map((node) => ({
        id: node.id,
        label: node.label,
        type: node.type,
        description: node.description
      })),
    edges: edges
      .filter((edge) => connectedNodeIds.has(edge.sourceId) && connectedNodeIds.has(edge.targetId))
      .slice(0, 18)
      .map((edge) => ({ sourceId: edge.sourceId, targetId: edge.targetId, label: edge.label }))
  }
}
```

- [ ] **Step 5: Pass `pdfUrl` and `graphNeighborhood` to `kg4.startExpansion`**

Inside `startExpansion`, before the IPC call, add:

```tsx
    const graphNeighborhood = buildLocalGraphNeighborhood(node.id, graphRef.current, graphEdgesRef.current)
```

Then add these fields to `electronApi.kg4.startExpansion({ ... })`:

```tsx
      pdfUrl: pdfUrlRef.current ?? undefined,
      graphNeighborhood,
```

- [ ] **Step 6: Run typecheck to catch context shape consumers**

Run: `npm run typecheck`

Expected: It may fail because shared types and main code are not complete until Tasks 3-5. Fix only misspelled imports in these three renderer files before moving on.

## Task 3: Build PDF Source Context in Main

**Files:**
- Create: `src/main/kg4/paperSourceContext.ts`
- Create: `src/main/kg4/paperSourceContext.test.ts`

- [ ] **Step 1: Write the failing test in `src/main/kg4/paperSourceContext.test.ts`**

```ts
import assert from 'node:assert/strict'
import type { ExtractedPaperContent } from '../../shared/paper'
import { buildMethodLineageContext, buildPaperSourceContext } from './paperSourceContext'

const content: ExtractedPaperContent = {
  pages: [
    { page: 1, text: 'Abstract text. We study efficient adaptation.' },
    { page: 2, text: 'Method text. Our method generates adapter weights.' }
  ],
  formulaCandidates: []
}

const source = buildPaperSourceContext('file:///paper.pdf', content)
assert.equal(source.pdfUrl, 'file:///paper.pdf')
assert.equal(source.pages.length, 2)
assert.equal(source.pages[0].pageNumber, 1)
assert.match(source.extractedText, /\[Page 1\]/)
assert.match(source.extractedText, /Our method generates adapter weights/)

const context = buildMethodLineageContext({
  anchor: {
    nodeId: 'n1',
    label: 'Generated Adapters',
    type: 'method',
    expansionType: 'method_evolution',
    description: 'A method node.'
  },
  paperSource: source,
  paperInsight: {
    title: 'Generated Adapters',
    problem: 'Efficient adaptation',
    method: 'Generated adapter weights',
    contribution: 'Context-conditioned adaptation'
  },
  graphNeighborhood: {
    nodes: [{ id: 'n1', label: 'Generated Adapters', type: 'method', description: 'A method node.' }],
    edges: []
  }
})

assert.equal(context.readerIntent, 'novice_paper_anchored_lineage')
assert.equal(context.paperSource.extractedText, source.extractedText)
assert.equal(context.localGraphNeighborhood.nodes[0].id, 'n1')
assert.deepEqual(context.evidenceSlots, [])

console.log('paperSourceContext tests passed')
```

- [ ] **Step 2: Run the failing test**

Run: `npx tsx src/main/kg4/paperSourceContext.test.ts`

Expected: FAIL with module-not-found for `./paperSourceContext`.

- [ ] **Step 3: Create `src/main/kg4/paperSourceContext.ts`**

```ts
import type { ExtractedPaperContent } from '../../shared/paper'
import type { Kg4GraphNeighborhoodInput, PaperSourceContext } from '../../shared/kg4'
import type { GraphNode } from '../../shared/paper'

export interface MethodLineageContextInput {
  anchor: {
    nodeId: string
    label: string
    type?: string
    expansionType?: GraphNode['expansionType']
    description?: string
    classificationRationale?: string
  }
  paperSource: PaperSourceContext
  paperInsight?: {
    title?: string
    problem?: string
    method?: string
    contribution?: string
  }
  graphNeighborhood?: Kg4GraphNeighborhoodInput
}

export interface MethodLineageContext {
  anchor: MethodLineageContextInput['anchor']
  paperSource: PaperSourceContext
  paperInsight?: MethodLineageContextInput['paperInsight']
  localGraphNeighborhood: Kg4GraphNeighborhoodInput
  evidenceSlots: []
  readerIntent: 'novice_paper_anchored_lineage'
}

export function buildPaperSourceContext(pdfUrl: string, content: ExtractedPaperContent): PaperSourceContext {
  const pages = content.pages.map((page) => ({
    pageNumber: page.page,
    text: page.text
  }))
  return {
    pdfUrl,
    pages,
    extractedText: pages.map((page) => `[Page ${page.pageNumber}]\n${page.text}`).join('\n\n')
  }
}

export function buildMethodLineageContext(input: MethodLineageContextInput): MethodLineageContext {
  return {
    anchor: input.anchor,
    paperSource: input.paperSource,
    paperInsight: input.paperInsight,
    localGraphNeighborhood: input.graphNeighborhood ?? { nodes: [], edges: [] },
    evidenceSlots: [],
    readerIntent: 'novice_paper_anchored_lineage'
  }
}
```

- [ ] **Step 4: Run the new test**

Run: `npx tsx src/main/kg4/paperSourceContext.test.ts`

Expected: PASS with `paperSourceContext tests passed`.

## Task 4: Prompt and Validation for PDF Evidence

**Files:**
- Modify: `src/main/llm/jobPrompts.ts`
- Modify: `src/main/llm/orchestrator.ts`
- Modify: `src/main/llm/orchestrator.test.ts`

- [ ] **Step 1: Update the `synthesize_method_lineage` prompt in `jobPrompts.ts`**

Replace the current `if (type === 'synthesize_method_lineage')` return block with:

```ts
  if (type === 'synthesize_method_lineage') {
    return [
      'You are a KG4 PDF-grounded method lineage synthesizer. Return strict JSON only.',
      'Input contains methodLineageContext with anchor, paperSource, paperInsight, localGraphNeighborhood, evidenceSlots, and readerIntent.',
      'paperSource.extractedText is the primary source for the current paper. Use it directly; do not ask for an intermediate summary.',
      'Return one MethodLineageView JSON object with existing fields id, anchorNodeId, title, summary, nodes, edges, openQuestions, readingOrder, dataCompleteness, missingDataReasons.',
      'Also return problemSetup, conceptBridge, anchorPosition, methodComparisons, and confidenceAndEvidence.',
      'problemSetup must explain the research problem for a beginner and include pdfEvidence excerpts from current_pdf.',
      'anchorPosition must explain where the current paper sits in the lineage and include pdfEvidence excerpts from current_pdf.',
      'methodComparisons must compare concrete methods and every comparison must include evidence items.',
      'Evidence sourceType must be current_pdf, model_knowledge, or future_retrieval_needed.',
      'Use current_pdf only when an excerpt comes from paperSource pages. Include pageNumber when the page is known.',
      'Use model_knowledge for general field background that is not directly stated in the PDF.',
      'Use future_retrieval_needed when a claim would require external paper retrieval.',
      'Nodes keep fields id, label, role, summary, representativePaperIds, digestIds, and optional evidence.',
      'Edges keep fields id, sourceId, targetId, relation, explanation, evidencePaperIds, confidence, and optional evidence.',
      'role must be current_method, foundation_method, parallel_variant, improvement, application_variant, or open_problem.',
      'relation must be extends, contrasts_with, solves_limitation_of, shares_assumption_with, applies_to_new_context, or evidence_insufficient.',
      'representativePaperIds, digestIds, evidencePaperIds, and readingOrder may be empty arrays when no retrieved papers or digests are supplied.',
      'All explanatory text fields must be Chinese. Keep PDF excerpts short and faithful.'
    ].join(' ')
  }
```

- [ ] **Step 2: Update prompt assertions in `orchestrator.test.ts`**

Change the `lineagePrompt` assertions to:

```ts
const lineagePrompt = systemPromptForJob('synthesize_method_lineage')
assert.match(lineagePrompt, /PDF-grounded method lineage/i)
assert.match(lineagePrompt, /methodLineageContext/i)
assert.match(lineagePrompt, /paperSource\.extractedText/i)
assert.match(lineagePrompt, /problemSetup/i)
assert.match(lineagePrompt, /anchorPosition/i)
assert.match(lineagePrompt, /current_pdf/i)
assert.match(lineagePrompt, /model_knowledge/i)
assert.match(lineagePrompt, /future_retrieval_needed/i)
```

- [ ] **Step 3: Add validator helpers in `orchestrator.ts`**

Place these helpers above `validateMethodLineageView`:

```ts
function hasPdfGroundingInput(input: unknown): boolean {
  return isRecord(input) && isRecord(input.methodLineageContext) && isRecord(input.methodLineageContext.paperSource)
}

function validatePdfEvidenceRef(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`)
    return
  }
  if (value.sourceType !== 'current_pdf') errors.push(`${path}.sourceType must be current_pdf`)
  if (!isNonEmptyString(value.excerpt)) errors.push(`${path}.excerpt must be a non-empty string`)
  if (!isNonEmptyString(value.claimSupported)) errors.push(`${path}.claimSupported must be a non-empty string`)
  if (value.pageNumber !== undefined && (!(typeof value.pageNumber === 'number') || !Number.isInteger(value.pageNumber) || value.pageNumber <= 0)) {
    errors.push(`${path}.pageNumber must be a positive integer when present`)
  }
  if (value.sectionTitle !== undefined && typeof value.sectionTitle !== 'string') errors.push(`${path}.sectionTitle must be a string when present`)
}

function validateEvidenceRef(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`)
    return
  }
  if (value.sourceType === 'current_pdf') {
    validatePdfEvidenceRef(value, path, errors)
    return
  }
  if (value.sourceType === 'model_knowledge') {
    if (!isNonEmptyString(value.note)) errors.push(`${path}.note must be a non-empty string`)
    if (!isNumberInRange(value.confidence, 0, 1)) errors.push(`${path}.confidence must be a number between 0 and 1`)
    return
  }
  if (value.sourceType === 'future_retrieval_needed') {
    if (!isNonEmptyString(value.reason)) errors.push(`${path}.reason must be a non-empty string`)
    return
  }
  errors.push(`${path}.sourceType must be current_pdf, model_knowledge, or future_retrieval_needed`)
}

function validateEvidenceArray(value: unknown, path: string, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`)
    return
  }
  value.forEach((item, index) => validateEvidenceRef(item, `${path}[${index}]`, errors))
}
```

- [ ] **Step 4: Require PDF sections when input contains `methodLineageContext.paperSource`**

Change the call site in `validateJobOutput`:

```ts
      validateMethodLineageView(
        output,
        [...job.relatedPaperIds, ...(job.paperId ? [job.paperId] : [])],
        allowedDigestIds(job.inputJson),
        { requirePdfGrounding: hasPdfGroundingInput(job.inputJson) }
      )
```

Update the function signature:

```ts
function validateMethodLineageView(
  output: unknown,
  allowedPaperIds: string[],
  allowedDigestIdsSet: Set<string>,
  options: { requirePdfGrounding?: boolean } = {}
): ReferencedPaperValidationResult {
```

Inside `validateMethodLineageView`, after existing required field checks, add:

```ts
  if (options.requirePdfGrounding) {
    const problemSetup = isRecord(output) ? output.problemSetup : undefined
    if (!isRecord(problemSetup)) {
      errors.push('synthesize_method_lineage.problemSetup must be an object for PDF-grounded lineage')
    } else {
      if (!isNonEmptyString(problemSetup.beginnerExplanation)) errors.push('synthesize_method_lineage.problemSetup.beginnerExplanation must be a non-empty string')
      if (!isNonEmptyString(problemSetup.whyThisProblemMatters)) errors.push('synthesize_method_lineage.problemSetup.whyThisProblemMatters must be a non-empty string')
      if (!Array.isArray(problemSetup.pdfEvidence) || !problemSetup.pdfEvidence.length) errors.push('synthesize_method_lineage.problemSetup.pdfEvidence must contain at least one PDF evidence item')
      ;(Array.isArray(problemSetup.pdfEvidence) ? problemSetup.pdfEvidence : []).forEach((item, index) => validatePdfEvidenceRef(item, `synthesize_method_lineage.problemSetup.pdfEvidence[${index}]`, errors))
    }

    const anchorPosition = isRecord(output) ? output.anchorPosition : undefined
    if (!isRecord(anchorPosition)) {
      errors.push('synthesize_method_lineage.anchorPosition must be an object for PDF-grounded lineage')
    } else {
      if (!isNonEmptyString(anchorPosition.summary)) errors.push('synthesize_method_lineage.anchorPosition.summary must be a non-empty string')
      if (!isNonEmptyString(anchorPosition.whatTheCurrentPaperChanges)) errors.push('synthesize_method_lineage.anchorPosition.whatTheCurrentPaperChanges must be a non-empty string')
      if (!isStringArray(anchorPosition.whatItInherits)) errors.push('synthesize_method_lineage.anchorPosition.whatItInherits must be a string array')
      if (!isStringArray(anchorPosition.whatItDoesNotSolve)) errors.push('synthesize_method_lineage.anchorPosition.whatItDoesNotSolve must be a string array')
      if (!Array.isArray(anchorPosition.pdfEvidence) || !anchorPosition.pdfEvidence.length) errors.push('synthesize_method_lineage.anchorPosition.pdfEvidence must contain at least one PDF evidence item')
      ;(Array.isArray(anchorPosition.pdfEvidence) ? anchorPosition.pdfEvidence : []).forEach((item, index) => validatePdfEvidenceRef(item, `synthesize_method_lineage.anchorPosition.pdfEvidence[${index}]`, errors))
    }
  }

  const methodComparisons = isRecord(output) ? output.methodComparisons : undefined
  if (methodComparisons !== undefined) {
    if (!Array.isArray(methodComparisons)) errors.push('synthesize_method_lineage.methodComparisons must be an array')
    ;(Array.isArray(methodComparisons) ? methodComparisons : []).forEach((comparison, index) => {
      if (!isRecord(comparison)) {
        errors.push(`synthesize_method_lineage.methodComparisons[${index}] must be an object`)
        return
      }
      if (!isNonEmptyString(comparison.methodA)) errors.push(`synthesize_method_lineage.methodComparisons[${index}].methodA must be a non-empty string`)
      if (!isNonEmptyString(comparison.methodB)) errors.push(`synthesize_method_lineage.methodComparisons[${index}].methodB must be a non-empty string`)
      if (!isNonEmptyString(comparison.keyDifference)) errors.push(`synthesize_method_lineage.methodComparisons[${index}].keyDifference must be a non-empty string`)
      if (!isNonEmptyString(comparison.whyItMatters)) errors.push(`synthesize_method_lineage.methodComparisons[${index}].whyItMatters must be a non-empty string`)
      validateEvidenceArray(comparison.evidence, `synthesize_method_lineage.methodComparisons[${index}].evidence`, errors)
    })
  }
```

- [ ] **Step 5: Allow empty paper/digest arrays for PDF-grounded lineage**

In `validateMethodLineageNode`, keep `representativePaperIds` and `digestIds` arrays required, but keep the existing validation loop valid for empty arrays. Add optional node evidence validation:

```ts
  if (node.evidence !== undefined) validateEvidenceArray(node.evidence, `synthesize_method_lineage.nodes[${index}].evidence`, errors)
```

In `validateMethodLineageEdge`, add:

```ts
  if (edge.evidence !== undefined) validateEvidenceArray(edge.evidence, `synthesize_method_lineage.edges[${index}].evidence`, errors)
```

- [ ] **Step 6: Run orchestrator tests**

Run: `npx tsx src/main/llm/orchestrator.test.ts`

Expected: PASS with the existing final console message.

## Task 5: Route Method Lineage Through PDF Context in Main

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: Import PDF context helpers**

Add near the existing KG4 imports:

```ts
import { buildMethodLineageContext, buildPaperSourceContext } from './kg4/paperSourceContext'
```

- [ ] **Step 2: Add a helper to create PDF-grounded lineage in `src/main/index.ts`**

Place this helper near `currentExpansionNodeInput`:

```ts
function shouldUsePdfGroundedLineage(classification: ExpansionNodeClassification | undefined, legacyIntent: ExpansionIntent): boolean {
  return classification?.recommendedPath === 'track_method_lineage' || legacyIntent.kind === 'algorithm_method_lineage'
}
```

- [ ] **Step 3: Insert PDF-grounded branch after classification succeeds**

Inside `kg4:start-expansion`, after `expansionClassification` and `expansionIntent` have been normalized, insert this branch before the retrieval/digest path:

```ts
        if (shouldUsePdfGroundedLineage(expansionClassification, expansionIntent) && params.pdfUrl) {
          mainWindow.webContents.send('expansion:progress', {
            sessionId,
            jobId,
            step: 'synthesizing',
            message: '正在基于 PDF 原文生成方法谱系...'
          })

          const extractedPaper = await extractPdfContent(params.pdfUrl)
          const paperSource = buildPaperSourceContext(params.pdfUrl, extractedPaper)
          const methodLineageContext = buildMethodLineageContext({
            anchor: {
              nodeId: params.nodeId,
              label: params.nodeLabel,
              type: params.nodeType,
              expansionType: params.expansionType,
              classificationRationale: expansionClassification?.rationale ?? expansionIntent.rationale
            },
            paperSource,
            paperInsight: params.paperInsight,
            graphNeighborhood: params.graphNeighborhood
          })

          const lineageJob = await llmTaskOrchestrator.createJob({
            type: 'synthesize_method_lineage',
            input: {
              requestNonce: params.forceRefresh ? Date.now() : undefined,
              methodLineageContext
            },
            nodeId: params.nodeId,
            paperId: params.paperId,
            relatedPaperIds: [],
            sessionId,
            model: 'deepseek-v4-pro',
            maxTokens: KG4_EXPANSION_TOKEN_BUDGETS.synthesizeMethodLineage,
            temperature: 0.1
          })
          jobId = lineageJob.id

          let lineageResult = await llmTaskOrchestrator.runJob(lineageJob.id)
          if (lineageResult.status === 'queued' || lineageResult.status === 'running') {
            lineageResult = await waitForJobTerminalState(lineageJob.id)
          }
          const methodLineageView = normalizeMethodLineageView(
            lineageResult.status === 'succeeded' || lineageResult.status === 'cache_hit' ? lineageResult.resultJson : undefined
          )

          mainWindow.webContents.send('expansion:progress', {
            sessionId,
            jobId,
            step: 'generating',
            message: '正在生成谱系/演进图...'
          })

          const record = assembleLineageExpansionRecord({
            paperId: params.paperId ?? 'current-paper',
            nodeId: params.nodeId,
            jobIds: [classifyJob.id, lineageJob.id],
            intent: expansionIntent,
            retrievedPapers: [],
            paperMethodDigests: [],
            methodLineageView,
            classification: expansionClassification,
            missingDataReasons: methodLineageView ? [] : ['PDF-grounded method lineage synthesis failed.']
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
          return
        }
```

- [ ] **Step 4: Add a missing-PDF fallback message**

If the branch is skipped because `params.pdfUrl` is missing, keep the existing retrieval path. Add this log before retrieval begins:

```ts
        if (shouldUsePdfGroundedLineage(expansionClassification, expansionIntent) && !params.pdfUrl) {
          logBackend('kg4_pdf_grounded_lineage_missing_pdf', { sessionId, nodeId: params.nodeId, paperId: params.paperId })
        }
```

- [ ] **Step 5: Run main tests**

Run: `npx tsx src/main/kg4/paperSourceContext.test.ts`

Expected: PASS with `paperSourceContext tests passed`.

Run: `npx tsx src/main/llm/orchestrator.test.ts`

Expected: PASS with the existing orchestrator console output.

## Task 6: Render Teaching Sections With Inline PDF Evidence

**Files:**
- Modify: `src/renderer/src/components/MethodLineageView.tsx`
- Modify: `src/renderer/src/components/MethodLineageView.test.tsx`
- Modify: `src/renderer/src/styles/panels.css`

- [ ] **Step 1: Expand the renderer test first**

In `MethodLineageView.test.tsx`, add `problemSetup`, `anchorPosition`, and `methodComparisons` to the fixture:

```ts
  problemSetup: {
    beginnerExplanation: '这篇论文要解决高效适配问题。',
    whyThisProblemMatters: '高效适配能降低训练成本。',
    pdfEvidence: [{
      sourceType: 'current_pdf',
      pageNumber: 2,
      sectionTitle: 'Introduction',
      excerpt: 'We study efficient adaptation.',
      claimSupported: '论文问题是高效适配。'
    }]
  },
  anchorPosition: {
    summary: '当前论文位于动态适配器生成这一步。',
    whatTheCurrentPaperChanges: '它根据上下文生成适配器权重。',
    whatItInherits: ['冻结主干模型'],
    whatItDoesNotSolve: ['完整外部文献谱系'],
    pdfEvidence: [{
      sourceType: 'current_pdf',
      pageNumber: 4,
      sectionTitle: 'Method',
      excerpt: 'Our method generates adaptation weights.',
      claimSupported: '本文方法机制。'
    }]
  },
  methodComparisons: [{
    methodA: 'Static adapters',
    methodB: 'Generated adapters',
    keyDifference: '一个固定学习参数，一个按上下文生成参数。',
    whyItMatters: '这决定了方法是否能随输入变化。',
    evidence: [{ sourceType: 'model_knowledge', note: 'Adapter background.', confidence: 0.7 }]
  }],
  confidenceAndEvidence: {
    groundedInCurrentPdf: ['问题定义', '本文方法'],
    fromModelKnowledge: ['适配器背景'],
    needsFutureRetrieval: ['代表性前作']
  },
```

Add assertions:

```ts
assert.match(html, /PDF 原文证据/)
assert.match(html, /We study efficient adaptation/)
assert.match(html, /Page 2/)
assert.match(html, /当前论文位于动态适配器生成这一步/)
assert.match(html, /Static adapters/)
assert.match(html, /model_knowledge/)
```

- [ ] **Step 2: Run the failing renderer test**

Run: `npx tsx --tsconfig tsconfig.web.json src/renderer/src/components/MethodLineageView.test.tsx`

Expected: FAIL because the component does not render the new sections yet.

- [ ] **Step 3: Add evidence helpers in `MethodLineageView.tsx`**

Add imports and helpers after `ROLE_LABELS`:

```tsx
import type { MethodLineageEvidenceRef, PdfEvidenceRef } from '../../../shared/kg4'

function PdfEvidenceCard({ evidence }: { evidence: PdfEvidenceRef }) {
  return (
    <aside className="method-lineage-evidence-card">
      <span>{evidence.sectionTitle ? `${evidence.sectionTitle} · Page ${evidence.pageNumber ?? '?'}` : `Page ${evidence.pageNumber ?? '?'}`}</span>
      <blockquote>{evidence.excerpt}</blockquote>
      <p>{evidence.claimSupported}</p>
    </aside>
  )
}

function EvidenceItem({ evidence }: { evidence: MethodLineageEvidenceRef }) {
  if (evidence.sourceType === 'current_pdf') return <PdfEvidenceCard evidence={evidence} />
  if (evidence.sourceType === 'model_knowledge') {
    return (
      <aside className="method-lineage-evidence-card method-lineage-evidence-card--soft">
        <span>model_knowledge · {Math.round(evidence.confidence * 100)}%</span>
        <p>{evidence.note}</p>
      </aside>
    )
  }
  return (
    <aside className="method-lineage-evidence-card method-lineage-evidence-card--soft">
      <span>future_retrieval_needed</span>
      <p>{evidence.reason}</p>
    </aside>
  )
}
```

- [ ] **Step 4: Render problem setup and anchor position before reading order**

Inside `<section className="method-lineage-view ...">`, after the summary section, add:

```tsx
      {lineage.problemSetup ? (
        <section className="method-lineage-section method-lineage-section--summary">
          <h4>问题背景</h4>
          <p><MathText text={lineage.problemSetup.beginnerExplanation} /></p>
          <p><MathText text={lineage.problemSetup.whyThisProblemMatters} /></p>
          {lineage.problemSetup.pdfEvidence.length ? (
            <div className="method-lineage-evidence-list">
              <span className="eyebrow">PDF 原文证据</span>
              {lineage.problemSetup.pdfEvidence.map((evidence, index) => <PdfEvidenceCard evidence={evidence} key={`${evidence.pageNumber ?? 'p'}-${index}`} />)}
            </div>
          ) : null}
        </section>
      ) : null}

      {lineage.anchorPosition ? (
        <section className="method-lineage-section method-lineage-section--nodes">
          <h4>当前论文的位置</h4>
          <p><MathText text={lineage.anchorPosition.summary} /></p>
          <p><MathText text={lineage.anchorPosition.whatTheCurrentPaperChanges} /></p>
          {lineage.anchorPosition.whatItInherits.length ? (
            <ul>{lineage.anchorPosition.whatItInherits.map((item) => <li key={item}><MathText text={item} /></li>)}</ul>
          ) : null}
          {lineage.anchorPosition.whatItDoesNotSolve.length ? (
            <ul>{lineage.anchorPosition.whatItDoesNotSolve.map((item) => <li key={item}><MathText text={item} /></li>)}</ul>
          ) : null}
          {lineage.anchorPosition.pdfEvidence.length ? (
            <div className="method-lineage-evidence-list">
              <span className="eyebrow">PDF 原文证据</span>
              {lineage.anchorPosition.pdfEvidence.map((evidence, index) => <PdfEvidenceCard evidence={evidence} key={`${evidence.pageNumber ?? 'p'}-${index}`} />)}
            </div>
          ) : null}
        </section>
      ) : null}
```

- [ ] **Step 5: Render method comparisons and evidence confidence**

Before the open questions section, add:

```tsx
      {lineage.methodComparisons?.length ? (
        <section className="method-lineage-section method-lineage-section--edges">
          <h4>关键方法对比</h4>
          <div className="method-lineage-edge-list">
            {lineage.methodComparisons.map((comparison) => (
              <article className="method-lineage-edge" key={`${comparison.methodA}-${comparison.methodB}`}>
                <strong>{comparison.methodA} {'->'} {comparison.methodB}</strong>
                <p><MathText text={comparison.keyDifference} /></p>
                <p><MathText text={comparison.whyItMatters} /></p>
                {comparison.evidence.length ? (
                  <div className="method-lineage-evidence-list">
                    {comparison.evidence.map((evidence, index) => <EvidenceItem evidence={evidence} key={index} />)}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {lineage.confidenceAndEvidence ? (
        <section className="method-lineage-section method-lineage-section--questions">
          <h4>证据边界</h4>
          <p>PDF: {lineage.confidenceAndEvidence.groundedInCurrentPdf.join(' / ') || '无'}</p>
          <p>Model: {lineage.confidenceAndEvidence.fromModelKnowledge.join(' / ') || '无'}</p>
          <p>Retrieval: {lineage.confidenceAndEvidence.needsFutureRetrieval.join(' / ') || '无'}</p>
        </section>
      ) : null}
```

- [ ] **Step 6: Add CSS to `src/renderer/src/styles/panels.css`**

Append near the existing `.method-lineage-*` rules:

```css
.method-lineage-evidence-list {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.method-lineage-evidence-card {
  border-left: 3px solid #f59e0b;
  background: #fff7ed;
  border-radius: 6px;
  padding: 10px 12px;
}

.method-lineage-evidence-card--soft {
  border-left-color: #94a3b8;
  background: #f8fafc;
}

.method-lineage-evidence-card span {
  display: block;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 6px;
}

.method-lineage-evidence-card blockquote {
  margin: 0 0 6px;
  color: #111827;
  font-size: 13px;
  line-height: 1.55;
}

.method-lineage-evidence-card p {
  margin: 0;
}
```

- [ ] **Step 7: Run renderer test**

Run: `npx tsx --tsconfig tsconfig.web.json src/renderer/src/components/MethodLineageView.test.tsx`

Expected: PASS with `MethodLineageView tests passed`.

## Task 7: Final Verification

**Files:**
- Verify only; no required file edits.

- [ ] **Step 1: Run focused PDF context test**

Run: `npx tsx src/main/kg4/paperSourceContext.test.ts`

Expected: PASS with `paperSourceContext tests passed`.

- [ ] **Step 2: Run LLM prompt and validation test**

Run: `npx tsx src/main/llm/orchestrator.test.ts`

Expected: PASS with the existing orchestrator console output.

- [ ] **Step 3: Run lineage record test**

Run: `npx tsx src/main/kg4/lineageRecord.test.ts`

Expected: PASS with `lineageRecord tests passed`.

- [ ] **Step 4: Run renderer lineage view test**

Run: `npx tsx --tsconfig tsconfig.web.json src/renderer/src/components/MethodLineageView.test.tsx`

Expected: PASS with `MethodLineageView tests passed`.

- [ ] **Step 5: Run full typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Review the diff without reverting unrelated work**

Run: `git diff -- src/shared/kg4.ts src/shared/electron-api.ts src/renderer/src/domains/expansion src/renderer/src/components/MethodLineageView.tsx src/renderer/src/components/MethodLineageView.test.tsx src/renderer/src/styles/panels.css src/main/kg4/paperSourceContext.ts src/main/kg4/paperSourceContext.test.ts src/main/llm/jobPrompts.ts src/main/llm/orchestrator.ts src/main/llm/orchestrator.test.ts src/main/index.ts docs/superpowers/plans/2026-06-01-pdf-grounded-method-lineage-expansion.md`

Expected: Diff contains only PDF-grounded method lineage changes plus this plan. Do not stage or commit `.agents`, `.claude`, or unrelated existing source changes unless the user explicitly requests it.

## Self-Review Checklist

Spec coverage:

- PDF source as primary context is covered by Tasks 2, 3, and 5.
- No token fallback strategy is introduced.
- No two-stage PDF summary pass is introduced.
- DeepSeek raw PDF upload is not assumed; the plan uses existing extracted page text.
- Inline PDF evidence UI is covered by Task 6.
- "谱系/演进图" remains in `MethodLineageView`; Task 6 extends rather than replaces it.
- Existing records remain compatible because the new `MethodLineageView` fields are optional.
- Missing PDF source degrades to the existing retrieval path and emits a backend log.

Placeholder scan:

- This plan avoids placeholder markers and deferred-implementation language.
- Every code-changing step names the exact file and includes concrete code.
- Every test step includes the exact command and expected result.

Type consistency:

- The plan uses `PaperSourceContext`, `PdfEvidenceRef`, `MethodLineageEvidenceRef`, and `Kg4GraphNeighborhoodInput` consistently.
- The renderer receives `pdfUrl` through `ExpansionPaperSyncBridge` and `ExpansionProvider`, then sends it as `StartKg4ExpansionParams.pdfUrl`.
- The main process sends a single `synthesize_method_lineage` job with `methodLineageContext`; retrieved papers and digests are no longer required for the PDF-grounded branch.
