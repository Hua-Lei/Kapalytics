# Expansion Strategy Knowledge Exploration Design

**Date:** 2026-05-31
**Status:** Draft for user review
**Scope:** Upgrade KG4 node expansion from related-paper retrieval into a modular knowledge exploration experience with learning and research paths.

## 1. Goal

Kapalytics should not feel like an automatic related-paper finder. Node expansion should help users understand AI knowledge and research structure. The next version should introduce a modular expansion strategy layer that can:

- Classify whether a node is mainly a field, problem, concept, method, paper, or unknown object.
- Recommend a default exploration path while keeping alternative paths visible.
- Surface paper quality, recency, venue, source, and recommendation reasons.
- Provide specialized concept teaching views for nodes such as LoRA and Context Distillation.
- Preserve and extend the current method lineage flow for algorithm and method nodes.
- Upgrade paper detail from a thin method snapshot into a structured evidence reading page.

The guiding product model is:

```text
User expands node
-> system classifies node and recommends a path
-> user lands directly in the recommended path
-> top bar explains classification and offers alternate paths
```

## 2. Product Experience

Use two explicit paths behind one unified expansion workspace:

- **Learning Track**: for concepts and conceptual method components. It answers: what is this, why does it matter, how does it work, and how should I reason about it?
- **Research Track**: for methods, problems, fields, and paper-specific directions. It answers: what should I read, what is high quality, what is recent, and how do methods evolve?

The UI should not ask the user to choose from scratch every time. It should default into the system-recommended path, then explain the recommendation and offer switches.

| Primary Type | Default Path | Secondary Paths |
| --- | --- | --- |
| `concept` | Learn This Concept | Related Papers, Method Lineage if applicable |
| `method` | Track Method Lineage | Learn Core Concepts, Paper Evidence |
| `problem` | Explore Methods & Hot Directions | Learn Concepts, Representative Papers |
| `field` | Research Map & Hot Papers | Key Concepts, Method Families |
| `paper` | Inspect Paper Evidence | Related Concepts, Method Lineage if applicable |
| `unknown` | Related Papers with explanation | User can switch manually |

Examples:

| Node | Classification | Default |
| --- | --- | --- |
| `LoRA` | `primaryType: concept`, `facets: [method_component, parameter_efficient_finetuning]` | Teaching page |
| `Context Distillation` | `primaryType: concept`, `facets: [training_strategy, distillation]` | Teaching page |
| `Meta-Learned Context Distillation for LLMs` | `primaryType: method`, `facets: [paper_specific, context_distillation]` | Method lineage or paper-specific method analysis |
| `LLM Alignment` | `primaryType: field` or `problem`, depending on graph context | Research navigation |

Every expansion workspace should show a route header:

```text
Recommended: Learn This Concept
Reason: This node names a reusable mechanism rather than a broad field or one paper-specific method.
Confidence: 0.84
Other paths: Method Lineage | Related Papers | Research Area
```

This makes imperfect classification inspectable instead of invisible.

## 3. Node Classification Model

Use a single primary type plus auxiliary facets. Do not use multiple competing primary types.

```ts
type ExpansionPrimaryType =
  | 'field'
  | 'problem'
  | 'concept'
  | 'method'
  | 'paper'
  | 'unknown'

type ExpansionPath =
  | 'learn_concept'
  | 'track_method_lineage'
  | 'explore_research_area'
  | 'review_related_papers'
  | 'inspect_paper_evidence'

interface ExpansionNodeClassification {
  primaryType: ExpansionPrimaryType
  facets: string[]
  confidence: number
  rationale: string
  recommendedPath: ExpansionPath
  alternativePaths: ExpansionPath[]
  ambiguity?: {
    competingType: ExpansionPrimaryType
    reason: string
  }
}
```

The classifier should use more than the label:

```text
currentNode.label
currentNode.nodeType
currentNode.description
currentNode.roleInPaper
currentNode.searchQueries
current paper title / problem / method / contribution
neighbor graph nodes and edges when available
retrieval hints when available
```

Classification heuristics:

| Signal | Likely Type |
| --- | --- |
| Broad area containing many tasks, methods, and concepts | `field` |
| Bottleneck, challenge, task, desideratum, or evaluation target | `problem` |
| Reusable term with definitional or mathematical teaching content | `concept` |
| Concrete technique, algorithm, training recipe, architecture module | `method` |
| Exact bibliographic object or paper title | `paper` |
| Low-confidence or conflicting evidence | `unknown` |

Useful facets include:

| Facet | Use |
| --- | --- |
| `paper_specific` | Avoid treating a paper-title method as a field |
| `method_component` | LoRA-like concepts that are also technical modules |
| `training_strategy` | Distillation, RLHF, context distillation |
| `parameter_efficient_finetuning` | Improve retrieval and explanation style |
| `survey` | Change paper-quality treatment |
| `recent_hot` | Trigger trend-oriented cards |
| `math_heavy` | Emphasize formulas and variables |
| `application_area` | Identify applied field context |

The existing `ExpansionIntent` currently supports only `algorithm_method_lineage` and `generic_related_papers`. It should evolve into `ExpansionNodeClassification`. The current method lineage behavior remains one route behind `recommendedPath: 'track_method_lineage'`.

## 4. Paper Quality And Trend Layer

Paper quality should be a shared module used by all strategies. It should not be only a UI badge.

Use separate quality and trend scores:

```ts
interface PaperQualitySignal {
  paperId: string
  qualityScore: number
  trendScore: number
  badges: PaperBadge[]
  reasons: string[]
  warnings: string[]
}

type PaperBadge =
  | 'top_venue'
  | 'strong_venue'
  | 'highly_cited'
  | 'recent'
  | 'recent_hot'
  | 'survey'
  | 'benchmark'
  | 'open_access'
  | 'local_library'
  | 'unknown_venue'
  | 'needs_review'
```

`qualityScore` answers whether the paper deserves priority. `trendScore` answers whether the paper represents a recent direction. These must remain separate because classic high-citation papers and recent hot papers have different value.

| Paper Type | Quality | Trend | Display |
| --- | ---: | ---: | --- |
| Classic top-venue high-citation paper | High | Medium or low | Representative paper / foundation |
| Recent arXiv hot paper | Medium | High | Recent Hot / Needs Review |
| Workshop or unknown venue | Medium-low | Depends on metadata | Clear labels, not hidden by default |
| Local library paper | Medium or high | Depends | Local Library / Evidence |
| Survey | Medium or high | Medium | Preferred learning entry |

Use a mixed signal model:

```text
built-in AI/ML venue tier
+ Semantic Scholar metadata
+ OpenAlex metadata
+ arXiv/open access/source metadata
+ local library reading state
+ query relevance score
```

The built-in venue tier is a strong positive signal, not the only quality judge. Unknown venue should produce `unknown_venue`, not an automatic low-quality judgment.

Initial venue tier coverage:

```text
ML: NeurIPS, ICML, ICLR
NLP: ACL, EMNLP, NAACL, COLING
CV: CVPR, ICCV, ECCV
IR/Web/Data: SIGIR, WWW, KDD, WSDM
AI General: AAAI, IJCAI
```

Use Semantic Scholar as a high-value metadata source, not just a search provider. Before implementation, inspect current Semantic Scholar API documentation for stable fields such as citation counts, influential citations, publication venue, fields of study, external IDs, open access PDF, references, citations, batch lookup support, API key behavior, and rate limits.

Recommended module seam:

```text
PaperMetadataEnricher
  -> SemanticScholarMetadataAdapter
  -> OpenAlexMetadataAdapter
  -> LocalLibraryMetadataAdapter

PaperQualityAnnotator
PaperRankingPolicy
```

Retrieval ranking should become:

```text
Raw provider results
-> dedupe
-> relevance scoring
-> quality/trend annotation
-> strategy-specific ranking
```

Strategy-specific ranking:

| Strategy | Ranking Bias |
| --- | --- |
| `learn_concept` | Survey, classic high-quality, definitional papers |
| `track_method_lineage` | Foundation, variants, improvements, useful year span |
| `explore_research_area` | High quality, recent hot papers, surveys |
| `review_related_papers` | Relevance first, quality as support |
| `inspect_paper_evidence` | Evidence relation to current node first |

Paper cards should show:

```text
Title
Venue / Year / Citation / Source
Quality badges
Why recommended
Short relevance summary
Actions: View Detail / Open PDF / Use as seed
```

## 5. Strategy Modules And Data Flow

Move node expansion to strategy routing:

```text
kg4:start-expansion
-> ExpansionNodeClassifier
-> ExpansionStrategyRouter
-> selected ExpansionStrategy
-> RetrievalPlanBuilder
-> searchPapers
-> PaperQualityAnnotator
-> strategy-specific analysis
-> ExpansionRecordAssembler
-> specialized renderer view
```

Core strategy interface:

```ts
interface ExpansionStrategy {
  id: ExpansionPath
  canHandle(classification: ExpansionNodeClassification): boolean
  buildRetrievalPlan(input: ExpansionStrategyInput): ExpansionRetrievalPlan
  analyze(input: ExpansionStrategyAnalysisInput): Promise<ExpansionStrategyOutput>
}
```

First implementation should support four strategies:

| Strategy | Purpose | Current Project Fit |
| --- | --- | --- |
| `ConceptLearningStrategy` | Teach concepts such as LoRA and Context Distillation | New |
| `MethodLineageStrategy` | Method evolution and lineage | Wrap existing lineage-first flow |
| `ResearchAreaStrategy` | Field/problem overview, hot directions, recommended reading | New lightweight version |
| `RelatedPapersStrategy` | Low-confidence or fallback related papers | Replace generic fallback |

`MethodLineageStrategy` should reuse current jobs and data:

```text
digest_paper_method
synthesize_method_lineage
paperMethodDigests
methodLineageView
```

`ConceptLearningStrategy` output:

```ts
interface ConceptLearningView {
  id: string
  anchorNodeId: string
  title: string
  quickExplanation: {
    intuition: string
    problemSolved: string
    coreMechanism: string
    whenToUse: string
  }
  formalExplanation: {
    definition: string
    formulas: Array<{
      latex: string
      explanation: string
      variables: Array<{ symbol: string; meaning: string }>
    }>
    assumptions: string[]
  }
  misconceptions: Array<{
    misconception: string
    correction: string
  }>
  relationMap: Array<{
    label: string
    relation: 'prerequisite' | 'similar' | 'contrasts_with' | 'used_by' | 'variant'
    explanation: string
  }>
  representativePaperIds: string[]
  recentPaperIds: string[]
  dataCompleteness: 'complete' | 'partial' | 'insufficient'
  missingDataReasons: string[]
}
```

`ResearchAreaStrategy` first-version output:

```ts
interface ResearchAreaView {
  id: string
  anchorNodeId: string
  title: string
  overview: string
  keyProblems: string[]
  methodFamilies: Array<{
    label: string
    summary: string
    representativePaperIds: string[]
  }>
  recentHotDirections: Array<{
    label: string
    summary: string
    paperIds: string[]
    confidence: number
  }>
  recommendedReading: Array<{
    paperId: string
    reason: string
    role: 'survey' | 'foundation' | 'recent_hot' | 'representative' | 'needs_review'
  }>
}
```

Extend `Kg4NodeExpansionRecord` incrementally:

```ts
interface Kg4NodeExpansionRecord {
  expansionClassification?: ExpansionNodeClassification
  qualitySignals?: PaperQualitySignal[]
  conceptLearningView?: ConceptLearningView
  researchAreaView?: ResearchAreaView
  methodLineageView?: MethodLineageView
  paperMethodDigests?: PaperMethodDigest[]
}
```

Key module responsibilities:

| Module | Responsibility |
| --- | --- |
| `ExpansionNodeClassifier` | Decide what the node is and explain the decision |
| `ExpansionStrategyRouter` | Pick default and available paths |
| `RetrievalPlanBuilder` | Build strategy-aware retrieval queries |
| `PaperQualityAnnotator` | Merge metadata and produce quality/trend signals |
| `ExpansionStrategy` implementations | Run path-specific analysis |
| `ExpansionRecordAssembler` | Normalize output, apply fallback, maintain data completeness |

The main architectural rule is: classification, retrieval, quality, analysis, assembly, and rendering stay separate.

## 6. UI Integration

The visual direction is **light workspace first**. Keep the current light UI direction instead of switching to a dark research dashboard. Professionalism should come from hierarchy, structure, evidence, and paper-quality signals, not from a dark theme.

Recommended UI structure:

```text
ExpansionWorkspaceView
  -> ExpansionRouteHeader
  -> ExpansionPathTabs
  -> ConceptLearningView
  -> MethodLineageWorkspace
  -> ResearchAreaView
  -> RelatedPapersView
  -> EvidencePaperDetailView
```

### 6.1 ExpansionRouteHeader

Shows:

```text
Recommended path
Classification rationale
Confidence
Alternative path switches
Ambiguity warning when present
```

### 6.2 ConceptLearningView

For LoRA and Context Distillation:

```text
Quick Understanding
-> one-sentence definition
-> problem solved
-> core intuition
-> when to use

Formal View
-> formulas
-> variable explanations
-> assumptions
-> paper connection

Misconceptions
-> common misunderstanding
-> correction

Relation Map
-> prerequisites
-> similar concepts
-> contrasts
-> methods using this concept

Papers
-> representative papers
-> recent related papers
```

Use the existing `MathText` / KaTeX capability. Do not add a new math rendering dependency.

### 6.3 MethodLineageWorkspace

Reuse and improve the current lineage-first UI:

```text
Lineage Summary
-> Evolution Graph
-> Reading Order
-> Evidence Papers
-> Open Questions
```

Paper evidence should visibly attach to lineage nodes, not appear as an unrelated bottom list.

### 6.4 ResearchAreaView

For field/problem nodes:

```text
Overview
-> Key Problems
-> Method Families
-> Recent Hot Directions
-> Recommended Reading
```

The first version can be structured sections and cards. It does not need a complex generated field graph.

### 6.5 RelatedPapersView

This is the fallback view, but it must not become long abstract cards. Each card should show venue, year, citation, source, badges, recommendation reason, and short relevance summary.

### 6.6 EvidencePaperDetailView

Upgrade from `Method Snapshot` to four sections:

```text
Why Recommended
-> why this paper appears under the current node
-> value for current concept/method/field
-> quality and trend badges

Understanding
-> method or concept explanation
-> formula or mechanism
-> relation to current node

Evidence & Limits
-> what came from abstract or metadata
-> what requires reading the original paper
-> limitations and uncertainty

Read Next
-> prerequisites
-> follow-up improvements
-> similar methods
-> recent hot papers
```

## 7. Implementation Phases

### Phase 1: Classification, Quality Signals, Light Workspace

Goal: solve unclear node types, opaque paper quality, and flat paper-list expansion.

Includes:

```text
ExpansionNodeClassifier
ExpansionStrategyRouter
PaperQualityAnnotator
ExpansionRouteHeader
RelatedPapersView upgrade
EvidencePaperDetailView first upgrade
```

Phase 1 can create placeholders for concept and research strategies without full deep LLM generation. It should make classification, recommendation reasons, quality badges, and better paper detail visible first.

### Phase 2: Core Concept Teaching Strategy

Goal: make LoRA and Context Distillation nodes useful as teaching pages.

Includes:

```text
ConceptLearningStrategy
ConceptLearningView
formula and variable explanation
misconception correction
representative papers
recent paper entry
```

### Phase 3: Field/Problem Research Navigation

Goal: make field and problem nodes more useful than generic related papers.

Includes:

```text
ResearchAreaStrategy
ResearchAreaView
keyProblems
methodFamilies
recentHotDirections
recommendedReading
```

### Phase 4: Semantic Scholar Metadata Enrichment

Goal: make quality and trend signals more reliable.

Includes:

```text
SemanticScholarMetadataAdapter
OpenAlexMetadataAdapter fallback
metadata enrichment cache
influential citation and publication venue signals
quality reason generation
```

Implementation must inspect current Semantic Scholar API docs before coding this phase.

## 8. Testing Strategy

Use three test layers.

### 8.1 Pure Function Tests

Cover:

- Classification normalization.
- Venue tier matching.
- Badge generation.
- Quality and trend score rules.
- Strategy-specific ranking policies.
- Unknown venue and missing citation behavior.

### 8.2 LLM Output Validation Tests

Extend existing orchestrator validation to ensure:

- New view outputs only reference supplied paper IDs.
- Concept formulas are structurally valid fields, not free-form blobs.
- Representative and recent paper IDs are drawn from retrieved candidates.
- Research area recommended reading uses valid IDs.
- Low-confidence outputs include missing data reasons.

### 8.3 UI State Tests Or Manual Verification

Cover:

- Low-confidence classification.
- Ambiguous type with competing type explanation.
- Missing venue.
- Missing citation count.
- Semantic Scholar failure.
- Only arXiv results.
- Only fallback related-paper results.
- Evidence detail with no digest.

## 9. Acceptance Criteria

- `LoRA` defaults to `Learn This Concept`.
- `Context Distillation` defaults to `Learn This Concept`.
- `Meta-Learned Context Distillation for LLMs` is not classified as a field.
- Method nodes still generate method lineage.
- Field/problem nodes show research navigation structure rather than only a related-paper list.
- Paper cards show venue, year, citation, source, badges, and why recommended.
- Unknown venue is labeled, not treated as automatic low quality.
- Recent arXiv papers can be labeled `recent` or `recent_hot`, but should include `needs_review` when quality evidence is weak.
- Paper detail is more than `Method Snapshot`; it contains recommendation reason, understanding, evidence limits, and read-next sections.
- The visual direction remains a light workspace.

## 10. Explicit Non-Goals

Do not include in the first implementation cycle:

- Full course-like learning system.
- Long-term user mastery recommendation.
- Complex generated field graph.
- Full visual redesign or dark-mode conversion.
- Complete citation graph traversal.
- Automatic hiding of papers labeled low quality or unknown.
- Full strategy support for datasets, benchmarks, or evaluation metrics.

These are plausible future extensions, but the immediate goal is to turn node expansion into a classified, quality-aware, specialized knowledge exploration workflow.
