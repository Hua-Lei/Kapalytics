# Lineage-First Node Expansion — Design Document

**Date:** 2026-05-31
**Status:** Approved for implementation
**Scope:** Redesign KG4 node expansion so algorithm/method nodes produce a synthesized method lineage first, with readable paper evidence as drill-down content.

## 1. Goal

The current expansion flow can retrieve papers and produce graph nodes, but the result often feels like a flat list of papers. When LLM output is incomplete, fallback paper nodes use raw abstracts as descriptions, making cards unreadable. Clicking into a result can open an empty `ExpandView` because the current workbench expects `algorithmIdeaCards`, while fallback results may only contain `related_paper` graph nodes.

The new first-phase goal is not just to make paper cards shorter. For algorithm or method nodes, expansion should answer a higher-level research question:

```text
How does this method relate to nearby methods, foundations, variants, improvements, and open next steps?
```

The main product surface should be a synthesized method lineage. Individual retrieved papers remain important, but they are evidence and drill-down material rather than the top-level result.

## 2. Explicit Scope

This design follows a two-phase product direction:

- Phase 1 makes algorithm/method node expansion useful and readable.
- Phase 2 can generalize the strategy model for field, concept, and open-problem nodes.

Phase 1 includes:

- A lightweight model step to classify expansion intent.
- Lineage-oriented retrieval query construction for algorithm/method nodes.
- Parallel per-paper method digestion.
- Cross-paper method lineage synthesis.
- Readable fallback states that never show long abstracts by default and never open empty workbench views.
- A lineage-first UI with paper evidence drill-down.

Phase 1 does not include:

- Full strategy implementations for field, concept, and open-problem expansion.
- Full workspace-session restoration redesign.
- Rewriting paper search providers.
- Forcing every retrieved paper into a complete algorithm idea card.

## 3. Current Implementation Findings

The current expansion path is centered on:

- `src/main/index.ts` `kg4:start-expansion`
- `src/main/retrieval/paperSearch.ts`
- `src/main/llm/orchestrator.ts`
- `src/main/llm/jobPrompts.ts`
- `src/main/kg4/expansionRecord.ts`
- `src/shared/kg4.ts`
- `src/renderer/src/components/ExpansionGraphView.tsx`
- `src/renderer/src/components/ExpandView.tsx`
- `src/renderer/src/components/IdeaCardGrid.tsx`

Current behavior:

```text
node label + search queries
-> searchPapers
-> one KG4 LLM job
-> buildExpansionRecord
-> expansion graph nodes
-> click result and potentially open ExpandView
```

Current failure modes:

- Retrieval query is too generic because it mainly concatenates `nodeLabel` and `searchQueries`.
- KG4 prompt asks for idea cards and expansion nodes, but does not explicitly stage per-paper digestion then cross-paper synthesis.
- `buildExpansionRecord` falls back to `related_paper` nodes using `paper.abstract` as `description`.
- `ExpansionGraphView` renders `node.description` directly, so long English abstracts dominate cards.
- `ExpandView` requires `record.algorithmIdeaCards` and comparison workspace data. If the expansion only has paper nodes, the user sees an incomplete or empty workbench.

## 4. Recommended Approach

Use a modular first-phase architecture instead of a minimal patch or a full strategy engine.

Rejected alternatives:

- Minimal patch: truncating descriptions and adding a detail page would fix readability but keep the flat paper-list product model.
- Full strategy engine: implementing strategy plugins for algorithm, field, concept, and open problem immediately would overfit interfaces before the lineage experience is validated.

Recommended approach:

```text
ExpansionIntentClassifier
-> ExpansionQueryBuilder
-> searchPapers
-> PaperMethodDigestWorker
-> MethodLineageSynthesizer
-> ExpansionRecordAssembler
-> Lineage-first UI
```

This keeps `kg4:start-expansion` as the IPC orchestration entry while moving product logic into focused modules.

## 5. Architecture

### 5.1 ExpansionIntentClassifier

Purpose: decide whether the selected node should attempt method lineage generation.

Input:

```ts
interface ExpansionIntentInput {
  currentNode: {
    id: string
    label: string
    type?: string
    description?: string
    searchQueries?: string[]
  }
  currentPaperInsight?: {
    title?: string
    problem?: string
    method?: string
    contribution?: string
  }
}
```

Output:

```ts
interface ExpansionIntent {
  kind: 'algorithm_method_lineage' | 'generic_related_papers'
  confidence: number
  queryFocus: string
  rationale: string
  fallbackReason?: string
}
```

Model choice: small fast model, such as `deepseek-v4-flash`, because this is a low-risk classification and query-focus task.

Failure behavior:

- If classification fails, use `generic_related_papers`.
- If confidence is low, use `generic_related_papers`.
- If the node appears to be field, concept, or open-problem oriented, Phase 1 uses `generic_related_papers` instead of pretending it can produce a method lineage.

### 5.2 ExpansionQueryBuilder

Purpose: build retrieval queries from the intent, not only from the node label.

For `algorithm_method_lineage`, generate a query targeting methods around the same or similar problem:

```ts
interface ExpansionRetrievalPlan {
  primaryQuery: string
  searchQueries: string[]
  retrievalGoal: 'same_problem_methods' | 'generic_related_papers'
  maxResults: number
  requireAbstract: boolean
}
```

Algorithm/method query shape:

```text
<node label> algorithm method same problem alternative approach
<paper problem terms>
<paper method terms>
```

This should bias retrieval toward:

- Foundation methods.
- Parallel variants.
- Later improvements.
- Application variants using similar mechanisms.

For `generic_related_papers`, use a conservative related-paper query and do not attempt lineage synthesis.

### 5.3 PaperMethodDigestWorker

Purpose: digest each retrieved paper into structured lineage material.

This is the key change from a flat paper-card model. Each retrieved paper is processed independently, preferably in parallel, into a compact method digest. The digest is not the final UI; it is raw material for cross-paper synthesis.

Output:

```ts
interface PaperMethodDigest {
  id: string
  paperId: string
  paperTitle: string
  methodName?: string
  problemSetting: string
  coreMechanism: string
  claimedImprovement?: string
  limitation?: string
  relationHints: Array<
    | 'foundation'
    | 'parallel_variant'
    | 'extends'
    | 'improves_limitation'
    | 'application_variant'
    | 'unclear'
  >
  evidenceSummary: string
  confidence: number
  insufficientInformation?: string
}
```

Model choice:

- Use the small fast model for all candidate digests in Phase 1.
- Let the pro model correct and synthesize across the digests in the lineage step.
- A later optimization can re-run pro digestion for high-value or low-confidence papers.

Concurrency:

- Run digest jobs independently.
- Limit concurrent digest jobs to a small number, such as 3, to avoid API pressure.
- A failed digest does not fail the whole expansion.

Length rules:

- `problemSetting`, `coreMechanism`, `claimedImprovement`, `limitation`, and `evidenceSummary` must be short.
- Raw abstracts are allowed as model input but not as default UI text.

### 5.4 MethodLineageSynthesizer

Purpose: synthesize multiple paper digests into a method lineage.

This step uses the pro model because it requires cross-paper reasoning and hierarchy construction.

Output:

```ts
interface MethodLineageView {
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

interface MethodLineageNode {
  id: string
  label: string
  role:
    | 'current_method'
    | 'foundation_method'
    | 'parallel_variant'
    | 'improvement'
    | 'application_variant'
    | 'open_problem'
  summary: string
  representativePaperIds: string[]
  digestIds: string[]
}

interface MethodLineageEdge {
  id: string
  sourceId: string
  targetId: string
  relation:
    | 'extends'
    | 'contrasts_with'
    | 'solves_limitation_of'
    | 'shares_assumption_with'
    | 'applies_to_new_context'
    | 'evidence_insufficient'
  explanation: string
  evidencePaperIds: string[]
  confidence: number
}
```

The synthesizer should answer:

- Which methods are likely foundations?
- Which methods are parallel variants?
- Which methods appear to address limitations of earlier ones?
- Where does the current node sit in the map?
- Which relationships are speculative or under-evidenced?
- Which 2-3 methods should the user compare first?

### 5.5 ExpansionRecordAssembler

Purpose: build a persisted KG4 expansion record from all pipeline outputs.

Extend `Kg4NodeExpansionRecord` with optional lineage fields:

```ts
interface Kg4NodeExpansionRecord {
  // existing fields remain
  retrievedPaperIds: string[]
  algorithmIdeaCards: AlgorithmIdeaCard[]
  expansionGraphNodes: ExpansionGraphNode[]
  expansionGraphEdges: ExpansionGraphEdge[]
  fieldCognitionView?: FieldCognitionView
  dataCompleteness: 'complete' | 'partial' | 'insufficient'
  missingDataReasons: string[]

  // new Phase 1 fields
  expansionIntent?: ExpansionIntent
  paperMethodDigests?: PaperMethodDigest[]
  methodLineageView?: MethodLineageView
}
```

Projection rules:

- If `methodLineageView` exists, project lineage nodes into `expansionGraphNodes` for existing graph rendering.
- Lineage method roles should become `algorithm_idea` graph nodes unless a better existing type applies.
- If lineage synthesis fails but paper digests exist, project digest-based method cards as readable nodes with short summaries.
- If digests do not exist, project retrieved papers into short `related_paper` nodes.
- Never use raw abstracts as `ExpansionGraphNode.description`.

### 5.6 UI Components

The renderer should become lineage-first for records that contain `methodLineageView`.

Primary surface:

```text
ExpansionGraphView
-> shows lineage summary
-> shows method lineage graph/map
-> shows lineage node list
-> shows evidence papers and reading order
```

Drill-down surfaces:

```text
LineageNodeDetailView
-> method or stage title
-> role in lineage
-> short summary
-> representative papers
-> relation to current node
-> add to comparison

EvidencePaperDetailView
-> paper title
-> short evidence summary
-> location in lineage
-> why worth reading
-> source links / PDF if available
-> add to comparison
```

Existing `ExpandView` should be re-scoped:

- It remains the comparison and understanding workbench.
- It opens only after the user selects 2-3 methods, idea cards, or evidence-backed lineage nodes.
- It is not the default destination for clicking any expansion node.

## 6. End-to-End Flow

The main process pipeline should be:

```text
kg4:start-expansion
1. send job_created
2. classify expansion intent with small model
3. build retrieval plan
4. send retrieving
5. call searchPapers
6. if generic intent, build readable related-paper result and finish
7. send digesting
8. digest retrieved papers in parallel with small model
9. if fewer than 2 usable digests, build readable digest/paper fallback and finish
10. send synthesizing
11. synthesize method lineage with pro model
12. send generating
13. assemble KG4 expansion record
14. send persisting
15. save record
16. send done with record
```

Progress steps should include the new stages:

```ts
type ExpansionProgressStep =
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

## 7. LLM Job and Model Routing

Introduce explicit model routing without rewriting the whole orchestrator into a model platform.

Phase 1 model roles:

- Small fast model: intent classification, per-paper method digestion, short evidence compression.
- Pro model: method lineage synthesis and later comparison/feedback tasks.

Minimal interface:

```ts
type LlmModelRole = 'fast' | 'pro'

interface LlmTaskModelSelection {
  role: LlmModelRole
  model: string
  reason: string
}
```

The current orchestrator can accept optional model selection fields while keeping existing defaults for old jobs.

New KG4 job types should be added or mapped:

- `classify_expansion_intent`
- `digest_paper_method`
- `synthesize_method_lineage`

Validation still matters:

- Outputs may only reference supplied `paperId`s.
- Lineage node evidence must reference retrieved papers or the current paper.
- If evidence is insufficient, output should mark the relationship as uncertain rather than invent claims.

## 8. Error Handling and Degradation

Every path must produce either a readable result or a clear empty state.

Rules:

- Classification failure: use `generic_related_papers`.
- Retrieval empty: show an empty state with provider statuses and suggested query refinement.
- Some digest jobs fail: continue with successful digests.
- Fewer than 2 usable digests: do not synthesize a lineage; show readable digest or paper details.
- Lineage synthesis failure: show digest-based method cards and explain that the lineage could not be synthesized.
- Idea cards missing: do not open an empty comparison workbench.
- Long abstracts: keep collapsed or hidden by default.
- Persistence failure: keep the runtime session visible and mark `persistenceError`.

Data completeness should reflect the strongest successful stage:

- `complete`: enough digests and a synthesized lineage with evidence.
- `partial`: digests exist but lineage is incomplete or some providers/jobs failed.
- `insufficient`: retrieval or digestion did not provide enough evidence.

## 9. Testing Strategy

Unit tests:

- Intent classification output normalization and fallback.
- Query builder for `algorithm_method_lineage` and `generic_related_papers`.
- Digest output normalization and validation.
- Lineage output normalization and evidence validation.
- Record assembly projection from lineage to `expansionGraphNodes`.
- Fallback projection avoids raw abstracts and truncates UI text.

Integration tests:

- `kg4:start-expansion` with mocked retrieval and mocked LLM jobs produces a lineage record.
- Digest partial failure still produces a partial record.
- Low-confidence classifier result produces generic related-paper record.
- Lineage synthesis failure produces digest fallback, not failed/empty workbench.

Renderer tests where feasible:

- `ExpansionGraphView` renders lineage summary when `methodLineageView` exists.
- Result cards display short summaries, not raw abstracts.
- Clicking a lineage node opens detail content instead of empty `ExpandView`.
- Compare workbench entry is gated behind selecting enough methods or idea cards.

## 10. Migration and Compatibility

Existing persisted KG4 records may not contain `expansionIntent`, `paperMethodDigests`, or `methodLineageView`.

Compatibility behavior:

- If `methodLineageView` is absent, render existing `expansionGraphNodes`.
- If nodes are `related_paper`, use the new readable detail path when possible.
- Existing `algorithmIdeaCards` remain valid for `ExpandView`.
- Record validators should treat new fields as optional.

No schema migration is required if KG4 expansion records are stored as JSON. If the current repository storage validates exact shapes, update validation to allow optional Phase 1 fields.

## 11. Success Criteria

The first implementation is successful when:

- Expanding an algorithm/method node no longer produces a flat unreadable abstract list as the main result.
- The top-level expansion view presents a synthesized method lineage when at least two usable paper digests exist.
- Retrieved papers are visible as evidence and drill-downs, not the main hierarchy.
- Clicking an expansion result always opens readable content.
- `ExpandView` is only used when comparison material exists.
- Small model tasks are limited to classification and per-paper digestion.
- Pro model tasks are reserved for cross-paper synthesis and deeper analysis.
- The system degrades to readable related-paper or digest cards instead of empty pages.

## 12. Open Follow-Up for Phase 2

Phase 2 can extend the same boundaries into additional expansion strategies:

- Field node expansion: research problems, barriers, attempts, and subfields.
- Concept node expansion: closely related concepts, prerequisites, examples, and misconceptions.
- Open-problem node expansion: attempted solutions, known blockers, evaluation gaps, and promising directions.

Those strategies should reuse the same pattern:

```text
intent -> query plan -> per-source digest -> cross-source synthesis -> evidence drill-down
```

but should not be implemented until the algorithm/method lineage experience is validated.
