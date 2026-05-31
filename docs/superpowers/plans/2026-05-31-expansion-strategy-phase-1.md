# Expansion Strategy Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable slice of strategy-based KG4 expansion: richer node classification, paper quality signals, a light workspace route header, improved related-paper cards, and a first upgraded evidence paper detail view.

**Architecture:** Extend the current lineage-first expansion path without rewriting it. Add focused modules for classification normalization, retrieval planning, paper quality annotation, and route-oriented UI rendering, then thread their outputs through the existing `Kg4NodeExpansionRecord`.

**Tech Stack:** Electron main process, TypeScript, React 18, Node test files using `node:assert/strict`, existing KG4 IPC and renderer domains.

---

## File Structure

### Shared Types

- Modify `src/shared/kg4.ts`
  - Add `ExpansionPrimaryType`, `ExpansionPath`, `ExpansionNodeClassification`, `PaperBadge`, `PaperQualitySignal`, `RelatedPaperRecommendation`, and optional fields on `Kg4NodeExpansionRecord`.
  - Update runtime validator `isKg4NodeExpansionRecord` to allow the new optional fields.

### Main Process KG4 Modules

- Create `src/main/kg4/expansionClassification.ts`
  - Normalize LLM classification output into `ExpansionNodeClassification`.
  - Convert legacy `ExpansionIntent` shape to classification where needed.
  - Provide `classificationToLegacyIntent` so existing method-lineage logic can keep working during Phase 1.

- Create `src/main/kg4/expansionClassification.test.ts`
  - Cover concept, method, paper-specific method, low confidence fallback, and legacy intent conversion.

- Modify `src/main/kg4/expansionQuery.ts`
  - Accept `ExpansionNodeClassification` in a new `buildStrategyRetrievalPlan` function.
  - Keep existing `buildExpansionRetrievalPlan` for compatibility.

- Modify `src/main/kg4/lineageRecord.ts`
  - Accept `classification`, `qualitySignals`, and `relatedPaperRecommendations` in `assembleLineageExpansionRecord`.
  - Preserve existing lineage behavior.

- Create `src/main/kg4/paperQuality.ts`
  - Annotate deduped candidates with quality/trend signals and recommendation reasons using current metadata only.
  - Include a small AI venue tier list.
  - Do not call Semantic Scholar API in Phase 1.

- Create `src/main/kg4/paperQuality.test.ts`
  - Cover top venue, recent arXiv needs-review, unknown venue, high citation, survey detection, and recommendation generation.

- Modify `src/main/index.ts`
  - Use the new classifier normalization after the existing `classify_expansion_intent` job.
  - Use strategy-aware retrieval plan.
  - Annotate retrieved papers before assembling records.
  - Store classification and quality signals in the expansion record.

### LLM Prompt And Validation

- Modify `src/main/llm/jobPrompts.ts`
  - Update `classify_expansion_intent` prompt to request the new classification shape.
  - Mention legacy fields are no longer enough.

- Modify `src/main/llm/orchestrator.ts`
  - Update validation for `classify_expansion_intent` to accept the new classification shape.
  - Keep accepting legacy `kind` output during transition, but normalize it downstream.

- Modify `src/main/llm/orchestrator.test.ts`
  - Add validation tests for new classification output and legacy fallback.

### Renderer UI

- Create `src/renderer/src/components/ExpansionRouteHeader.tsx`
  - Render recommended path, primary type, facets, confidence, rationale, ambiguity, and alternative paths.

- Modify `src/renderer/src/components/ExpansionGraphView.tsx`
  - Show `ExpansionRouteHeader` at the top.
  - Replace plain evidence paper list with quality-aware related/evidence cards.
  - Keep the current method lineage display.

- Modify `src/renderer/src/components/EvidencePaperDetailView.tsx`
  - Upgrade to four sections: Why Recommended, Understanding, Evidence & Limits, Read Next.
  - Use digest data when present and fallback related paper recommendation when digest is missing.

- Modify `src/renderer/src/styles/panels.css`
  - Add light-workspace styles for route header, path chips, paper quality badges, and evidence sections.

## Task 1: Add Shared Classification And Quality Types

**Files:**
- Modify: `src/shared/kg4.ts`

- [ ] **Step 1: Add shared type definitions near existing `ExpansionIntent`**

Add the following after the existing `ExpansionIntent` interface:

```ts
export type ExpansionPrimaryType = 'field' | 'problem' | 'concept' | 'method' | 'paper' | 'unknown'

export type ExpansionPath =
  | 'learn_concept'
  | 'track_method_lineage'
  | 'explore_research_area'
  | 'review_related_papers'
  | 'inspect_paper_evidence'

export interface ExpansionNodeClassification {
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

export type PaperBadge =
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

export interface PaperQualitySignal {
  paperId: string
  qualityScore: number
  trendScore: number
  badges: PaperBadge[]
  reasons: string[]
  warnings: string[]
}

export interface RelatedPaperRecommendation {
  paperId: string
  title: string
  year?: number
  venue?: string
  sources: string[]
  citationCount?: number
  qualitySignal?: PaperQualitySignal
  whyRecommended: string
  relevanceSummary: string
  bestUrl?: string
  bestPdfUrl?: string
}
```

- [ ] **Step 2: Extend `Kg4NodeExpansionRecord`**

Add these optional fields to the interface:

```ts
  expansionClassification?: ExpansionNodeClassification
  qualitySignals?: PaperQualitySignal[]
  relatedPaperRecommendations?: RelatedPaperRecommendation[]
```

Keep the existing `expansionIntent?: ExpansionIntent` during Phase 1.

- [ ] **Step 3: Add validator constants**

Near `expansionIntentKinds`, add:

```ts
const expansionPrimaryTypes = ['field', 'problem', 'concept', 'method', 'paper', 'unknown'] as const satisfies readonly ExpansionPrimaryType[]

const expansionPaths = [
  'learn_concept',
  'track_method_lineage',
  'explore_research_area',
  'review_related_papers',
  'inspect_paper_evidence'
] as const satisfies readonly ExpansionPath[]

const paperBadges = [
  'top_venue',
  'strong_venue',
  'highly_cited',
  'recent',
  'recent_hot',
  'survey',
  'benchmark',
  'open_access',
  'local_library',
  'unknown_venue',
  'needs_review'
] as const satisfies readonly PaperBadge[]
```

- [ ] **Step 4: Add validator helpers**

Add these functions near existing validator helpers:

```ts
function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function isExpansionNodeClassification(value: unknown): value is ExpansionNodeClassification {
  if (!isRecordObject(value)) return false
  const ambiguity = value.ambiguity
  return (
    isOneOf(value.primaryType, expansionPrimaryTypes) &&
    isStringArray(value.facets) &&
    isNumberInRange(value.confidence, 0, 1) &&
    typeof value.rationale === 'string' &&
    Boolean(value.rationale.trim()) &&
    isOneOf(value.recommendedPath, expansionPaths) &&
    Array.isArray(value.alternativePaths) &&
    value.alternativePaths.every((path) => isOneOf(path, expansionPaths)) &&
    (
      ambiguity === undefined ||
      (
        isRecordObject(ambiguity) &&
        isOneOf(ambiguity.competingType, expansionPrimaryTypes) &&
        typeof ambiguity.reason === 'string' &&
        Boolean(ambiguity.reason.trim())
      )
    )
  )
}

function isPaperQualitySignal(value: unknown): value is PaperQualitySignal {
  if (!isRecordObject(value)) return false
  return (
    typeof value.paperId === 'string' &&
    Boolean(value.paperId.trim()) &&
    isNumberInRange(value.qualityScore, 0, 1) &&
    isNumberInRange(value.trendScore, 0, 1) &&
    Array.isArray(value.badges) &&
    value.badges.every((badge) => isOneOf(badge, paperBadges)) &&
    isStringArray(value.reasons) &&
    isStringArray(value.warnings)
  )
}

function isRelatedPaperRecommendation(value: unknown): value is RelatedPaperRecommendation {
  if (!isRecordObject(value)) return false
  return (
    typeof value.paperId === 'string' &&
    Boolean(value.paperId.trim()) &&
    typeof value.title === 'string' &&
    Boolean(value.title.trim()) &&
    (value.year === undefined || typeof value.year === 'number') &&
    isOptionalString(value.venue) &&
    isStringArray(value.sources) &&
    (value.citationCount === undefined || typeof value.citationCount === 'number') &&
    (value.qualitySignal === undefined || isPaperQualitySignal(value.qualitySignal)) &&
    typeof value.whyRecommended === 'string' &&
    Boolean(value.whyRecommended.trim()) &&
    typeof value.relevanceSummary === 'string' &&
    Boolean(value.relevanceSummary.trim()) &&
    isOptionalString(value.bestUrl) &&
    isOptionalString(value.bestPdfUrl)
  )
}
```

- [ ] **Step 5: Update `isKg4NodeExpansionRecord` optional field validation**

In `isKg4NodeExpansionRecord`, add these optional checks next to the existing optional field checks:

```ts
  if (value.expansionClassification !== undefined && !isExpansionNodeClassification(value.expansionClassification)) return false
  if (value.qualitySignals !== undefined && (!Array.isArray(value.qualitySignals) || !value.qualitySignals.every(isPaperQualitySignal))) return false
  if (value.relatedPaperRecommendations !== undefined && (!Array.isArray(value.relatedPaperRecommendations) || !value.relatedPaperRecommendations.every(isRelatedPaperRecommendation))) return false
```

- [ ] **Step 6: Run typecheck and observe any type errors**

Run: `npm run typecheck`

Expected: It may fail because the new fields are not yet populated anywhere. Fix only errors directly caused by this task before continuing.

- [ ] **Step 7: Commit**

```bash
git add src/shared/kg4.ts
git commit -m "feat(expansion): add strategy classification types"
```

## Task 2: Add Classification Normalization Module

**Files:**
- Create: `src/main/kg4/expansionClassification.ts`
- Create: `src/main/kg4/expansionClassification.test.ts`

- [ ] **Step 1: Write the failing classification tests**

Create `src/main/kg4/expansionClassification.test.ts`:

```ts
import assert from 'node:assert/strict'
import { classificationToLegacyIntent, normalizeExpansionClassification } from './expansionClassification'

const concept = normalizeExpansionClassification({
  primaryType: 'concept',
  facets: ['method_component', 'parameter_efficient_finetuning'],
  confidence: 0.91,
  rationale: 'LoRA is a reusable mechanism with a clear mathematical definition.',
  recommendedPath: 'learn_concept',
  alternativePaths: ['track_method_lineage', 'review_related_papers']
}, { nodeLabel: 'LoRA' })

assert.equal(concept.primaryType, 'concept')
assert.equal(concept.recommendedPath, 'learn_concept')
assert.deepEqual(concept.facets, ['method_component', 'parameter_efficient_finetuning'])

const paperSpecificMethod = normalizeExpansionClassification({
  primaryType: 'method',
  facets: ['paper_specific', 'context_distillation'],
  confidence: 0.86,
  rationale: 'The node is a specific method title, not a broad field.',
  recommendedPath: 'track_method_lineage',
  alternativePaths: ['learn_concept', 'inspect_paper_evidence']
}, { nodeLabel: 'Meta-Learned Context Distillation for LLMs' })

assert.equal(paperSpecificMethod.primaryType, 'method')
assert.ok(paperSpecificMethod.facets.includes('paper_specific'))
assert.equal(classificationToLegacyIntent(paperSpecificMethod).kind, 'algorithm_method_lineage')

const lowConfidence = normalizeExpansionClassification({
  primaryType: 'method',
  facets: [],
  confidence: 0.34,
  rationale: 'Weak signal.',
  recommendedPath: 'track_method_lineage',
  alternativePaths: []
}, { nodeLabel: 'Unclear Node' })

assert.equal(lowConfidence.primaryType, 'unknown')
assert.equal(lowConfidence.recommendedPath, 'review_related_papers')
assert.equal(lowConfidence.ambiguity?.competingType, 'method')

const legacyLineage = normalizeExpansionClassification({
  kind: 'algorithm_method_lineage',
  confidence: 0.84,
  queryFocus: 'hypernetwork meta-learning',
  rationale: 'The node describes a concrete algorithmic method.'
}, { nodeLabel: 'Hypernetwork' })

assert.equal(legacyLineage.primaryType, 'method')
assert.equal(legacyLineage.recommendedPath, 'track_method_lineage')
assert.equal(classificationToLegacyIntent(legacyLineage).queryFocus, 'Hypernetwork')

const malformed = normalizeExpansionClassification(null, { nodeLabel: 'Unknown Thing' })
assert.equal(malformed.primaryType, 'unknown')
assert.equal(malformed.recommendedPath, 'review_related_papers')

console.log('expansionClassification tests passed')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx src/main/kg4/expansionClassification.test.ts`

Expected: FAIL because `expansionClassification.ts` does not exist.

- [ ] **Step 3: Add minimal implementation**

Create `src/main/kg4/expansionClassification.ts`:

```ts
import type { ExpansionIntent, ExpansionNodeClassification, ExpansionPath, ExpansionPrimaryType } from '../../shared/kg4'

const PRIMARY_TYPES = new Set<ExpansionPrimaryType>(['field', 'problem', 'concept', 'method', 'paper', 'unknown'])
const PATHS = new Set<ExpansionPath>([
  'learn_concept',
  'track_method_lineage',
  'explore_research_area',
  'review_related_papers',
  'inspect_paper_evidence'
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim()) : []
}

function readConfidence(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
}

function defaultPathForType(primaryType: ExpansionPrimaryType): ExpansionPath {
  if (primaryType === 'concept') return 'learn_concept'
  if (primaryType === 'method') return 'track_method_lineage'
  if (primaryType === 'field' || primaryType === 'problem') return 'explore_research_area'
  if (primaryType === 'paper') return 'inspect_paper_evidence'
  return 'review_related_papers'
}

function alternativesForPath(path: ExpansionPath): ExpansionPath[] {
  return ['learn_concept', 'track_method_lineage', 'explore_research_area', 'review_related_papers', 'inspect_paper_evidence'].filter((item) => item !== path) as ExpansionPath[]
}

function fallbackClassification(nodeLabel: string): ExpansionNodeClassification {
  return {
    primaryType: 'unknown',
    facets: [],
    confidence: 0.3,
    rationale: `无法稳定判断「${nodeLabel}」的节点类型，先展示相关论文并保留其他路径入口。`,
    recommendedPath: 'review_related_papers',
    alternativePaths: ['learn_concept', 'track_method_lineage', 'explore_research_area']
  }
}

function fromLegacyIntent(record: Record<string, unknown>, nodeLabel: string): ExpansionNodeClassification | null {
  if (record.kind !== 'algorithm_method_lineage' && record.kind !== 'generic_related_papers') return null
  const confidence = readConfidence(record.confidence, record.kind === 'algorithm_method_lineage' ? 0.7 : 0.35)
  if (record.kind === 'algorithm_method_lineage' && confidence >= 0.6) {
    return {
      primaryType: 'method',
      facets: [],
      confidence,
      rationale: readString(record.rationale) ?? `「${nodeLabel}」被判断为可生成方法谱系的算法或方法节点。`,
      recommendedPath: 'track_method_lineage',
      alternativePaths: ['learn_concept', 'review_related_papers']
    }
  }
  return {
    ...fallbackClassification(nodeLabel),
    confidence,
    rationale: readString(record.rationale) ?? `「${nodeLabel}」未被稳定判断为方法节点。`
  }
}

export function normalizeExpansionClassification(value: unknown, context: { nodeLabel: string }): ExpansionNodeClassification {
  if (!isRecord(value)) return fallbackClassification(context.nodeLabel)
  const legacy = fromLegacyIntent(value, context.nodeLabel)
  if (legacy) return legacy

  const rawPrimaryType = readString(value.primaryType) as ExpansionPrimaryType | undefined
  const rawRecommendedPath = readString(value.recommendedPath) as ExpansionPath | undefined
  const confidence = readConfidence(value.confidence, 0.3)
  const validPrimaryType = rawPrimaryType && PRIMARY_TYPES.has(rawPrimaryType) ? rawPrimaryType : 'unknown'
  const primaryType = confidence < 0.5 ? 'unknown' : validPrimaryType
  const recommendedPath = primaryType === 'unknown'
    ? 'review_related_papers'
    : rawRecommendedPath && PATHS.has(rawRecommendedPath)
      ? rawRecommendedPath
      : defaultPathForType(primaryType)
  const facets = [...new Set(readStringArray(value.facets))]
  const alternatives = readStringArray(value.alternativePaths).filter((path): path is ExpansionPath => PATHS.has(path as ExpansionPath) && path !== recommendedPath)
  const rationale = readString(value.rationale) ?? fallbackClassification(context.nodeLabel).rationale

  return {
    primaryType,
    facets,
    confidence,
    rationale,
    recommendedPath,
    alternativePaths: alternatives.length ? alternatives : alternativesForPath(recommendedPath).slice(0, 3),
    ambiguity: primaryType === 'unknown' && validPrimaryType !== 'unknown'
      ? { competingType: validPrimaryType, reason: '分类置信度低，未直接采用模型建议类型。' }
      : undefined
  }
}

export function classificationToLegacyIntent(classification: ExpansionNodeClassification): ExpansionIntent {
  if (classification.recommendedPath === 'track_method_lineage' && classification.primaryType === 'method' && classification.confidence >= 0.5) {
    return {
      kind: 'algorithm_method_lineage',
      confidence: classification.confidence,
      queryFocus: classification.facets.includes('paper_specific') ? classification.rationale : 'method lineage',
      rationale: classification.rationale
    }
  }
  return {
    kind: 'generic_related_papers',
    confidence: classification.confidence,
    queryFocus: 'related papers',
    rationale: classification.rationale,
    fallbackReason: classification.primaryType === 'unknown' ? '分类置信度低，降级为相关论文展开。' : undefined
  }
}
```

- [ ] **Step 4: Fix `classificationToLegacyIntent` query focus behavior**

The test expects legacy lineage `queryFocus` to be the node label. Update the function signature and method branch:

```ts
export function classificationToLegacyIntent(classification: ExpansionNodeClassification, nodeLabel = 'method lineage'): ExpansionIntent {
  if (classification.recommendedPath === 'track_method_lineage' && classification.primaryType === 'method' && classification.confidence >= 0.5) {
    return {
      kind: 'algorithm_method_lineage',
      confidence: classification.confidence,
      queryFocus: nodeLabel,
      rationale: classification.rationale
    }
  }
```

Update the test assertion call:

```ts
assert.equal(classificationToLegacyIntent(legacyLineage, 'Hypernetwork').queryFocus, 'Hypernetwork')
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx tsx src/main/kg4/expansionClassification.test.ts`

Expected: PASS and prints `expansionClassification tests passed`.

- [ ] **Step 6: Commit**

```bash
git add src/main/kg4/expansionClassification.ts src/main/kg4/expansionClassification.test.ts
git commit -m "feat(expansion): normalize node classification"
```

## Task 3: Add Paper Quality Annotation

**Files:**
- Create: `src/main/kg4/paperQuality.ts`
- Create: `src/main/kg4/paperQuality.test.ts`

- [ ] **Step 1: Write the failing quality tests**

Create `src/main/kg4/paperQuality.test.ts`:

```ts
import assert from 'node:assert/strict'
import type { DedupedPaperCandidate, PaperSearchResult } from '../../shared/kg3'
import { annotatePaperQuality, buildRelatedPaperRecommendations } from './paperQuality'

function result(overrides: Partial<PaperSearchResult>): PaperSearchResult {
  return {
    id: overrides.id ?? 'r1',
    provider: overrides.provider ?? 'openalex',
    source: overrides.source ?? 'openalex',
    externalId: overrides.externalId ?? 'ext1',
    url: overrides.url ?? 'https://example.test/paper',
    title: overrides.title ?? 'Paper',
    authors: overrides.authors ?? [],
    year: overrides.year,
    venue: overrides.venue,
    abstract: overrides.abstract,
    citedByCount: overrides.citedByCount,
    topicTags: overrides.topicTags ?? [],
    raw: overrides.raw ?? {},
    fetchedAt: overrides.fetchedAt ?? new Date('2026-05-31T00:00:00.000Z').toISOString(),
    pdfUrl: overrides.pdfUrl,
    doi: overrides.doi,
    arxivId: overrides.arxivId,
    semanticScholarPaperId: overrides.semanticScholarPaperId,
    openAlexId: overrides.openAlexId,
    corpusId: overrides.corpusId,
    referenceIds: overrides.referenceIds
  }
}

function candidate(id: string, title: string, mergedFrom: PaperSearchResult[]): DedupedPaperCandidate {
  return {
    canonicalId: id,
    mergedFrom,
    title,
    authors: [],
    year: mergedFrom[0]?.year,
    sources: mergedFrom.map((item) => item.source),
    externalIds: [],
    bestUrl: 'https://example.test/paper',
    bestPdfUrl: mergedFrom.find((item) => item.pdfUrl)?.pdfUrl,
    abstract: mergedFrom[0]?.abstract,
    score: 0.8
  }
}

const topVenue = candidate('paper-top', 'LoRA: Low-Rank Adaptation of Large Language Models', [result({ venue: 'ICLR', year: 2022, citedByCount: 6500, abstract: 'LoRA adapts large language models with low rank updates.' })])
const recentArxiv = candidate('paper-recent', 'A Very New Context Distillation Method', [result({ provider: 'arxiv', source: 'arxiv', venue: undefined, year: 2026, citedByCount: 0, abstract: 'A new context distillation method.' })])
const survey = candidate('paper-survey', 'A Survey of Parameter Efficient Fine-Tuning', [result({ venue: 'arXiv', year: 2024, citedByCount: 80, abstract: 'This survey reviews parameter efficient fine-tuning methods.' })])

const signals = annotatePaperQuality([topVenue, recentArxiv, survey], { nowYear: 2026 })
const topSignal = signals.find((item) => item.paperId === 'paper-top')
assert.ok(topSignal?.badges.includes('top_venue'))
assert.ok(topSignal?.badges.includes('highly_cited'))
assert.ok((topSignal?.qualityScore ?? 0) > 0.8)

const recentSignal = signals.find((item) => item.paperId === 'paper-recent')
assert.ok(recentSignal?.badges.includes('recent'))
assert.ok(recentSignal?.badges.includes('unknown_venue'))
assert.ok(recentSignal?.badges.includes('needs_review'))
assert.ok((recentSignal?.trendScore ?? 0) > (recentSignal?.qualityScore ?? 0))

const surveySignal = signals.find((item) => item.paperId === 'paper-survey')
assert.ok(surveySignal?.badges.includes('survey'))

const recommendations = buildRelatedPaperRecommendations([topVenue, recentArxiv], signals)
assert.equal(recommendations[0].paperId, 'paper-top')
assert.match(recommendations[0].whyRecommended, /Top venue|高引用|代表性/)
assert.ok(recommendations[0].qualitySignal)

console.log('paperQuality tests passed')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx src/main/kg4/paperQuality.test.ts`

Expected: FAIL because `paperQuality.ts` does not exist.

- [ ] **Step 3: Add implementation**

Create `src/main/kg4/paperQuality.ts`:

```ts
import type { DedupedPaperCandidate, PaperSearchResult } from '../../shared/kg3'
import type { PaperBadge, PaperQualitySignal, RelatedPaperRecommendation } from '../../shared/kg4'

const TOP_VENUES = new Set(['neurips', 'nips', 'icml', 'iclr', 'acl', 'emnlp', 'naacl', 'coling', 'cvpr', 'iccv', 'eccv', 'sigir', 'www', 'kdd', 'wsdm', 'aaai', 'ijcai'])
const STRONG_VENUES = new Set(['aistats', 'uai', 'colt', 'icassp', 'interspeech', 'recsys', 'cikm'])

function normalizeVenue(value: string | undefined): string {
  return value?.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() ?? ''
}

function bestCitationCount(candidate: DedupedPaperCandidate): number | undefined {
  const counts = candidate.mergedFrom.map((item) => item.citedByCount).filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
  return counts.length ? Math.max(...counts) : undefined
}

function bestVenue(candidate: DedupedPaperCandidate): string | undefined {
  return candidate.mergedFrom.map((item) => item.venue).find((venue): venue is string => Boolean(venue?.trim()))
}

function hasOpenAccess(candidate: DedupedPaperCandidate): boolean {
  return Boolean(candidate.bestPdfUrl || candidate.mergedFrom.some((item) => item.pdfUrl))
}

function isSurvey(candidate: DedupedPaperCandidate): boolean {
  const text = [candidate.title, candidate.abstract, ...candidate.mergedFrom.flatMap((item) => [item.title, item.abstract, ...item.topicTags])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return /\bsurvey\b|review of|综述/.test(text)
}

function addBadge(badges: PaperBadge[], badge: PaperBadge): void {
  if (!badges.includes(badge)) badges.push(badge)
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))))
}

function recommendationReason(signal: PaperQualitySignal): string {
  const parts: string[] = []
  if (signal.badges.includes('top_venue')) parts.push('Top venue')
  if (signal.badges.includes('strong_venue')) parts.push('strong venue')
  if (signal.badges.includes('highly_cited')) parts.push('高引用')
  if (signal.badges.includes('survey')) parts.push('适合作为综述入口')
  if (signal.badges.includes('recent')) parts.push('近期论文')
  if (!parts.length) parts.push('与当前节点相关')
  return `${parts.join(' / ')}，可作为当前节点的代表性参考。`
}

function citationCountFromRecommendation(candidate: DedupedPaperCandidate): number | undefined {
  return bestCitationCount(candidate)
}

export function annotatePaperQuality(candidates: DedupedPaperCandidate[], options: { nowYear?: number } = {}): PaperQualitySignal[] {
  const nowYear = options.nowYear ?? new Date().getFullYear()
  return candidates.map((candidate) => {
    const venue = bestVenue(candidate)
    const normalizedVenue = normalizeVenue(venue)
    const citationCount = bestCitationCount(candidate)
    const year = candidate.year ?? candidate.mergedFrom.find((item) => item.year)?.year
    const badges: PaperBadge[] = []
    const reasons: string[] = []
    const warnings: string[] = []
    let qualityScore = 0.35 + candidate.score * 0.25
    let trendScore = 0.1

    if (candidate.sources.includes('local_library')) {
      addBadge(badges, 'local_library')
      qualityScore += 0.1
      reasons.push('已在本地库中出现。')
    }

    if (TOP_VENUES.has(normalizedVenue)) {
      addBadge(badges, 'top_venue')
      qualityScore += 0.25
      reasons.push(`发表在核心 AI/ML venue: ${venue}.`)
    } else if (STRONG_VENUES.has(normalizedVenue)) {
      addBadge(badges, 'strong_venue')
      qualityScore += 0.16
      reasons.push(`发表在较强相关 venue: ${venue}.`)
    } else if (!normalizedVenue || normalizedVenue === 'arxiv') {
      addBadge(badges, 'unknown_venue')
      warnings.push('缺少可确认的正式发表 venue。')
    }

    if (typeof citationCount === 'number') {
      const citationBoost = Math.min(0.22, citationCount / 5000)
      qualityScore += citationBoost
      if (citationCount >= 500) {
        addBadge(badges, 'highly_cited')
        reasons.push(`引用数较高: ${citationCount}.`)
      }
    }

    if (typeof year === 'number') {
      const age = nowYear - year
      if (age <= 2) {
        addBadge(badges, 'recent')
        trendScore += 0.45
        reasons.push(`发表于 ${year}，属于近期论文。`)
      }
      if (age <= 1 && (citationCount ?? 0) >= 50) {
        addBadge(badges, 'recent_hot')
        trendScore += 0.25
      }
    }

    if (isSurvey(candidate)) {
      addBadge(badges, 'survey')
      qualityScore += 0.08
      reasons.push('标题或摘要显示这是一篇综述，适合作为学习入口。')
    }

    if (hasOpenAccess(candidate)) {
      addBadge(badges, 'open_access')
      qualityScore += 0.03
    }

    if (badges.includes('recent') && badges.includes('unknown_venue') && (citationCount ?? 0) < 50) {
      addBadge(badges, 'needs_review')
      warnings.push('近期论文且缺少 venue 或引用支撑，需要阅读原文确认质量。')
    }

    return {
      paperId: candidate.canonicalId,
      qualityScore: clamp(qualityScore),
      trendScore: clamp(trendScore),
      badges,
      reasons: reasons.length ? reasons : ['与检索查询相关。'],
      warnings
    }
  })
}

export function buildRelatedPaperRecommendations(candidates: DedupedPaperCandidate[], signals: PaperQualitySignal[]): RelatedPaperRecommendation[] {
  const signalById = new Map(signals.map((signal) => [signal.paperId, signal]))
  return candidates.map((candidate) => {
    const signal = signalById.get(candidate.canonicalId)
    return {
      paperId: candidate.canonicalId,
      title: candidate.title,
      year: candidate.year,
      venue: bestVenue(candidate),
      sources: candidate.sources,
      citationCount: citationCountFromRecommendation(candidate),
      qualitySignal: signal,
      whyRecommended: signal ? recommendationReason(signal) : '与当前节点相关。',
      relevanceSummary: candidate.abstract ? candidate.abstract.replace(/\s+/g, ' ').trim().slice(0, 180) : `与当前节点相关的论文：${candidate.title}`,
      bestUrl: candidate.bestUrl,
      bestPdfUrl: candidate.bestPdfUrl
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx src/main/kg4/paperQuality.test.ts`

Expected: PASS and prints `paperQuality tests passed`.

- [ ] **Step 5: Commit**

```bash
git add src/main/kg4/paperQuality.ts src/main/kg4/paperQuality.test.ts
git commit -m "feat(expansion): annotate paper quality signals"
```

## Task 4: Thread Classification And Quality Through Expansion Records

**Files:**
- Modify: `src/main/kg4/expansionQuery.ts`
- Modify: `src/main/kg4/lineageRecord.ts`
- Modify: `src/main/kg4/lineageRecord.test.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Add tests for strategy retrieval and record fields**

Modify `src/main/kg4/lineageRecord.test.ts` imports:

```ts
import type { ExpansionIntent, ExpansionNodeClassification, MethodLineageView, PaperMethodDigest, PaperQualitySignal } from '../../shared/kg4'
import { buildExpansionRetrievalPlan, buildStrategyRetrievalPlan } from './expansionQuery'
```

Add after the existing `retrievalPlan` assertions:

```ts
const conceptClassification: ExpansionNodeClassification = {
  primaryType: 'concept',
  facets: ['method_component', 'parameter_efficient_finetuning'],
  confidence: 0.9,
  rationale: 'LoRA is a reusable concept.',
  recommendedPath: 'learn_concept',
  alternativePaths: ['track_method_lineage', 'review_related_papers']
}

const conceptRetrievalPlan = buildStrategyRetrievalPlan({
  classification: conceptClassification,
  node: { id: 'n-lora', label: 'LoRA', searchQueries: ['low rank adaptation'] }
})

assert.equal(conceptRetrievalPlan.retrievalGoal, 'concept_learning_papers')
assert.match(conceptRetrievalPlan.primaryQuery, /LoRA|low rank adaptation/)
assert.ok(conceptRetrievalPlan.searchQueries.some((query) => /survey|tutorial|foundation/i.test(query)))
```

Add before the final `console.log`:

```ts
const qualitySignals: PaperQualitySignal[] = [
  {
    paperId: 'paper-a',
    qualityScore: 0.92,
    trendScore: 0.2,
    badges: ['top_venue', 'highly_cited'],
    reasons: ['Top venue.'],
    warnings: []
  }
]

const enrichedRecord = assembleLineageExpansionRecord({
  paperId: 'paper-main',
  nodeId: 'n1',
  jobIds: ['job-enriched'],
  intent,
  classification: conceptClassification,
  retrievedPapers: [candidate('paper-a', 'Foundation RL Method', longAbstract)],
  qualitySignals,
  relatedPaperRecommendations: [
    {
      paperId: 'paper-a',
      title: 'Foundation RL Method',
      sources: ['openalex'],
      qualitySignal: qualitySignals[0],
      whyRecommended: 'Top venue / 高引用，可作为代表性参考。',
      relevanceSummary: 'A foundation method.',
      bestUrl: 'https://example.test/paper-a'
    }
  ]
})

assert.equal(enrichedRecord.expansionClassification?.primaryType, 'concept')
assert.equal(enrichedRecord.qualitySignals?.[0].paperId, 'paper-a')
assert.equal(enrichedRecord.relatedPaperRecommendations?.[0].whyRecommended, 'Top venue / 高引用，可作为代表性参考。')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx src/main/kg4/lineageRecord.test.ts`

Expected: FAIL because `buildStrategyRetrievalPlan` and new assembler params do not exist.

- [ ] **Step 3: Extend retrieval goal type**

Modify `ExpansionRetrievalPlan` in `src/shared/kg4.ts`:

```ts
  retrievalGoal:
    | 'same_problem_methods'
    | 'generic_related_papers'
    | 'concept_learning_papers'
    | 'research_area_papers'
    | 'paper_evidence'
```

- [ ] **Step 4: Add strategy retrieval builder**

In `src/main/kg4/expansionQuery.ts`, update imports:

```ts
import type { ExpansionIntent, ExpansionNodeClassification, ExpansionRetrievalPlan } from '../../shared/kg4'
```

Append:

```ts
export function buildStrategyRetrievalPlan(params: {
  classification: ExpansionNodeClassification
  node: { id: string; label: string; searchQueries?: string[] }
}): ExpansionRetrievalPlan {
  const searchQueries = params.node.searchQueries?.filter((query) => query.trim()).map((query) => query.trim()) ?? []
  const uniqueQueries = (queries: string[]): string[] => [...new Set(queries.map((query) => query.trim()).filter(Boolean))]
  const baseQueries = uniqueQueries([...searchQueries, params.node.label])

  if (params.classification.recommendedPath === 'learn_concept') {
    const queries = uniqueQueries([
      ...baseQueries,
      `${params.node.label} survey tutorial foundation`,
      `${params.node.label} mathematical formulation`
    ])
    return {
      primaryQuery: queries[0] ?? `${params.node.label} survey tutorial foundation`,
      searchQueries: queries,
      retrievalGoal: 'concept_learning_papers',
      maxResults: 8,
      requireAbstract: true
    }
  }

  if (params.classification.recommendedPath === 'explore_research_area') {
    const queries = uniqueQueries([...baseQueries, `${params.node.label} survey recent advances`, `${params.node.label} benchmark methods`])
    return {
      primaryQuery: queries[0] ?? `${params.node.label} recent advances`,
      searchQueries: queries,
      retrievalGoal: 'research_area_papers',
      maxResults: 10,
      requireAbstract: true
    }
  }

  if (params.classification.recommendedPath === 'inspect_paper_evidence') {
    const queries = uniqueQueries([...baseQueries, `${params.node.label} method evidence`])
    return {
      primaryQuery: queries[0] ?? `${params.node.label} method evidence`,
      searchQueries: queries,
      retrievalGoal: 'paper_evidence',
      maxResults: 6,
      requireAbstract: true
    }
  }

  if (params.classification.recommendedPath === 'track_method_lineage') {
    return buildExpansionRetrievalPlan({
      intent: {
        kind: 'algorithm_method_lineage',
        confidence: params.classification.confidence,
        queryFocus: params.node.label,
        rationale: params.classification.rationale
      },
      node: params.node
    })
  }

  return buildExpansionRetrievalPlan({
    intent: {
      kind: 'generic_related_papers',
      confidence: params.classification.confidence,
      queryFocus: 'related papers',
      rationale: params.classification.rationale
    },
    node: params.node
  })
}
```

- [ ] **Step 5: Extend record assembler params**

Modify `src/main/kg4/lineageRecord.ts` imports:

```ts
  ExpansionNodeClassification,
  PaperQualitySignal,
  RelatedPaperRecommendation,
```

Add optional params to `assembleLineageExpansionRecord`:

```ts
  classification?: ExpansionNodeClassification
  qualitySignals?: PaperQualitySignal[]
  relatedPaperRecommendations?: RelatedPaperRecommendation[]
```

Add fields into `record` after `expansionIntent`:

```ts
    expansionClassification: params.classification,
    qualitySignals: params.qualitySignals,
    relatedPaperRecommendations: params.relatedPaperRecommendations,
```

- [ ] **Step 6: Run lineage test to verify it passes**

Run: `npx tsx src/main/kg4/lineageRecord.test.ts`

Expected: PASS and prints `lineageRecord tests passed`.

- [ ] **Step 7: Update `src/main/index.ts` imports**

Add:

```ts
import { classificationToLegacyIntent, normalizeExpansionClassification } from './kg4/expansionClassification'
import { buildRelatedPaperRecommendations, annotatePaperQuality } from './kg4/paperQuality'
```

Change existing import:

```ts
import { buildExpansionRetrievalPlan, buildStrategyRetrievalPlan } from './kg4/expansionQuery'
```

- [ ] **Step 8: Replace classification and retrieval block in `kg4:start-expansion`**

Replace lines that compute `expansionIntent` and `retrievalPlan` with:

```ts
        const expansionClassification = normalizeExpansionClassification(
          classifyResult.status === 'succeeded' || classifyResult.status === 'cache_hit' ? classifyResult.resultJson : undefined,
          { nodeLabel: params.nodeLabel }
        )
        const expansionIntent = classificationToLegacyIntent(expansionClassification, params.nodeLabel)
        const retrievalPlan = buildStrategyRetrievalPlan({
          classification: expansionClassification,
          node: {
            id: params.nodeId,
            label: params.nodeLabel,
            searchQueries: params.searchQueries ?? []
          }
        })
```

- [ ] **Step 9: Annotate quality after retrieval**

After `const relatedPaperIds = candidates.map(candidatePaperId)`, add:

```ts
        const qualitySignals = annotatePaperQuality(candidates)
        const relatedPaperRecommendations = buildRelatedPaperRecommendations(candidates, qualitySignals)
```

- [ ] **Step 10: Pass new fields into every `assembleLineageExpansionRecord` call**

For each call in `src/main/index.ts`, add:

```ts
            classification: expansionClassification,
            qualitySignals,
            relatedPaperRecommendations,
```

- [ ] **Step 11: Run typecheck**

Run: `npm run typecheck`

Expected: PASS. If it fails, fix only type errors introduced by Tasks 1-4.

- [ ] **Step 12: Commit**

```bash
git add src/shared/kg4.ts src/main/kg4/expansionQuery.ts src/main/kg4/lineageRecord.ts src/main/kg4/lineageRecord.test.ts src/main/index.ts
git commit -m "feat(expansion): persist classification and quality signals"
```

## Task 5: Update LLM Prompt And Validation

**Files:**
- Modify: `src/main/llm/jobPrompts.ts`
- Modify: `src/main/llm/orchestrator.ts`
- Modify: `src/main/llm/orchestrator.test.ts`

- [ ] **Step 1: Add validation tests**

In `src/main/llm/orchestrator.test.ts`, add tests near existing expansion intent validation tests:

```ts
const classificationJob = {
  ...baseJob,
  type: 'classify_expansion_intent' as const,
  relatedPaperIds: []
}

assert.equal(orchestrator.validateJobOutput(classificationJob, {
  primaryType: 'concept',
  facets: ['method_component'],
  confidence: 0.88,
  rationale: 'LoRA is a reusable concept with mathematical structure.',
  recommendedPath: 'learn_concept',
  alternativePaths: ['track_method_lineage', 'review_related_papers']
}).ok, true)

assert.equal(orchestrator.validateJobOutput(classificationJob, {
  primaryType: 'concept',
  confidence: 0.88,
  rationale: 'Missing fields.',
  recommendedPath: 'learn_concept'
}).ok, false)

assert.equal(orchestrator.validateJobOutput(classificationJob, {
  kind: 'algorithm_method_lineage',
  confidence: 0.82,
  queryFocus: 'Hypernetwork',
  rationale: 'Legacy output remains accepted during migration.'
}).ok, true)
```

If the test file does not have `baseJob` or `orchestrator` in scope, create the equivalent from existing nearby tests rather than inventing a new harness.

- [ ] **Step 2: Run validation test to verify it fails**

Run: `npx tsx src/main/llm/orchestrator.test.ts`

Expected: FAIL because new classification shape is not accepted yet.

- [ ] **Step 3: Update classifier prompt**

In `src/main/llm/jobPrompts.ts`, replace the `classify_expansion_intent` prompt with:

```ts
    return [
      'You are a KG4 expansion node classifier. Return strict JSON only.',
      'Classify currentNode with primaryType, facets, confidence, rationale, recommendedPath, alternativePaths, and optional ambiguity.',
      'primaryType must be one of field, problem, concept, method, paper, unknown.',
      'recommendedPath and alternativePaths must use learn_concept, track_method_lineage, explore_research_area, review_related_papers, or inspect_paper_evidence.',
      'Use concept for reusable terms with definitions, formulas, or teachable mechanisms such as LoRA or Context Distillation.',
      'Use method for concrete algorithms, training recipes, architecture modules, or paper-specific method names.',
      'Use field for broad research areas and problem for bottlenecks, tasks, or desiderata.',
      'Add facets such as paper_specific, method_component, training_strategy, parameter_efficient_finetuning, survey, recent_hot, math_heavy, or application_area when useful.',
      'Do not classify a paper-title-like method as field merely because it contains many words.',
      'All explanatory text fields must be Chinese (中文).'
    ].join(' ')
```

- [ ] **Step 4: Update validation constants in `orchestrator.ts`**

Add near the existing constants:

```ts
const EXPANSION_PRIMARY_TYPES = ['field', 'problem', 'concept', 'method', 'paper', 'unknown'] as const
const EXPANSION_PATHS = ['learn_concept', 'track_method_lineage', 'explore_research_area', 'review_related_papers', 'inspect_paper_evidence'] as const
```

- [ ] **Step 5: Update `validateExpansionIntent`**

Replace `validateExpansionIntent` with:

```ts
function validateExpansionIntent(output: unknown): ReferencedPaperValidationResult {
  const errors: string[] = []
  if (!isRecord(output)) return schemaErrors('classify_expansion_intent output must be an object')

  if (output.kind !== undefined) {
    if (!isOneOf(output.kind, EXPANSION_INTENT_KINDS)) errors.push('classify_expansion_intent.kind must be algorithm_method_lineage or generic_related_papers')
    if (!isNumberInRange(output.confidence, 0, 1)) errors.push('classify_expansion_intent.confidence must be a number between 0 and 1')
    if (!isNonEmptyString(output.queryFocus)) errors.push('classify_expansion_intent.queryFocus must be a non-empty string')
    if (!isNonEmptyString(output.rationale)) errors.push('classify_expansion_intent.rationale must be a non-empty string')
    if (output.fallbackReason !== undefined && output.fallbackReason !== null && typeof output.fallbackReason !== 'string') errors.push('classify_expansion_intent.fallbackReason must be a string when present')
    return schemaErrors(...errors)
  }

  if (!isOneOf(output.primaryType, EXPANSION_PRIMARY_TYPES)) errors.push('classify_expansion_intent.primaryType must be a supported primary type')
  if (!Array.isArray(output.facets) || !output.facets.every((facet) => typeof facet === 'string')) errors.push('classify_expansion_intent.facets must be a string array')
  if (!isNumberInRange(output.confidence, 0, 1)) errors.push('classify_expansion_intent.confidence must be a number between 0 and 1')
  if (!isNonEmptyString(output.rationale)) errors.push('classify_expansion_intent.rationale must be a non-empty string')
  if (!isOneOf(output.recommendedPath, EXPANSION_PATHS)) errors.push('classify_expansion_intent.recommendedPath must be a supported path')
  if (!Array.isArray(output.alternativePaths) || !output.alternativePaths.every((path) => isOneOf(path, EXPANSION_PATHS))) errors.push('classify_expansion_intent.alternativePaths must be supported paths')
  if (output.ambiguity !== undefined && output.ambiguity !== null) {
    if (!isRecord(output.ambiguity)) {
      errors.push('classify_expansion_intent.ambiguity must be an object when present')
    } else {
      if (!isOneOf(output.ambiguity.competingType, EXPANSION_PRIMARY_TYPES)) errors.push('classify_expansion_intent.ambiguity.competingType must be a supported primary type')
      if (!isNonEmptyString(output.ambiguity.reason)) errors.push('classify_expansion_intent.ambiguity.reason must be a non-empty string')
    }
  }
  return schemaErrors(...errors)
}
```

- [ ] **Step 6: Run validation tests**

Run: `npx tsx src/main/llm/orchestrator.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/main/llm/jobPrompts.ts src/main/llm/orchestrator.ts src/main/llm/orchestrator.test.ts
git commit -m "feat(expansion): validate strategy classification output"
```

## Task 6: Add Expansion Route Header UI

**Files:**
- Create: `src/renderer/src/components/ExpansionRouteHeader.tsx`
- Modify: `src/renderer/src/components/ExpansionGraphView.tsx`
- Modify: `src/renderer/src/styles/panels.css`

- [ ] **Step 1: Create route header component**

Create `src/renderer/src/components/ExpansionRouteHeader.tsx`:

```tsx
import type { ExpansionNodeClassification, ExpansionPath, ExpansionPrimaryType } from '../../../shared/kg4'

const TYPE_LABELS: Record<ExpansionPrimaryType, string> = {
  field: '领域',
  problem: '研究问题',
  concept: '核心概念',
  method: '算法/方法',
  paper: '论文证据',
  unknown: '未确定'
}

const PATH_LABELS: Record<ExpansionPath, string> = {
  learn_concept: '理解这个概念',
  track_method_lineage: '追踪方法谱系',
  explore_research_area: '探索研究方向',
  review_related_papers: '查看相关论文',
  inspect_paper_evidence: '检查论文证据'
}

function formatConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`
}

function fallbackClassification(nodeLabel: string): ExpansionNodeClassification {
  return {
    primaryType: 'unknown',
    facets: [],
    confidence: 0.3,
    rationale: `暂无「${nodeLabel}」的节点分类结果，先展示相关论文和可用证据。`,
    recommendedPath: 'review_related_papers',
    alternativePaths: ['learn_concept', 'track_method_lineage', 'explore_research_area']
  }
}

export function ExpansionRouteHeader({ classification, nodeLabel }: { classification?: ExpansionNodeClassification; nodeLabel: string }) {
  const resolved = classification ?? fallbackClassification(nodeLabel)

  return (
    <section className="expansion-route-header">
      <div className="expansion-route-header__main">
        <span className="eyebrow">Recommended Path</span>
        <h4>{PATH_LABELS[resolved.recommendedPath]}</h4>
        <p>{resolved.rationale}</p>
      </div>
      <div className="expansion-route-header__meta">
        <span className="expansion-route-header__type">{TYPE_LABELS[resolved.primaryType]}</span>
        <span className="expansion-route-header__confidence">Confidence {formatConfidence(resolved.confidence)}</span>
      </div>
      {resolved.facets.length ? (
        <div className="expansion-route-header__chips">
          {resolved.facets.map((facet) => <span key={facet}>{facet}</span>)}
        </div>
      ) : null}
      {resolved.alternativePaths.length ? (
        <div className="expansion-route-header__paths">
          <strong>Other paths</strong>
          {resolved.alternativePaths.map((path) => <span key={path}>{PATH_LABELS[path]}</span>)}
        </div>
      ) : null}
      {resolved.ambiguity ? (
        <p className="expansion-route-header__ambiguity">可能也像「{TYPE_LABELS[resolved.ambiguity.competingType]}」：{resolved.ambiguity.reason}</p>
      ) : null}
    </section>
  )
}
```

- [ ] **Step 2: Render route header in `ExpansionGraphView`**

Add import:

```tsx
import { ExpansionRouteHeader } from './ExpansionRouteHeader'
```

Add below toolbar section:

```tsx
      <ExpansionRouteHeader classification={record?.expansionClassification} nodeLabel={session.nodeLabel} />
```

- [ ] **Step 3: Add light workspace styles**

Append to `src/renderer/src/styles/panels.css`:

```css
.expansion-route-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  padding: 16px;
  border: 1px solid #dbe3ef;
  border-radius: 18px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fbff 100%);
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.08);
}

.expansion-route-header__main h4 {
  margin: 4px 0 6px;
  color: #0f172a;
}

.expansion-route-header__main p,
.expansion-route-header__ambiguity {
  margin: 0;
  color: #475569;
  line-height: 1.6;
}

.expansion-route-header__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.expansion-route-header__type,
.expansion-route-header__confidence,
.expansion-route-header__chips span,
.expansion-route-header__paths span {
  border-radius: 999px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 700;
}

.expansion-route-header__type {
  background: #e0f2fe;
  color: #075985;
}

.expansion-route-header__confidence {
  background: #ecfdf5;
  color: #047857;
}

.expansion-route-header__chips,
.expansion-route-header__paths {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.expansion-route-header__chips span {
  background: #f1f5f9;
  color: #334155;
}

.expansion-route-header__paths strong {
  color: #64748b;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.expansion-route-header__paths span {
  background: #fff7ed;
  color: #9a3412;
}

.expansion-route-header__ambiguity {
  grid-column: 1 / -1;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fffbeb;
  color: #92400e;
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/ExpansionRouteHeader.tsx src/renderer/src/components/ExpansionGraphView.tsx src/renderer/src/styles/panels.css
git commit -m "feat(expansion): show recommended route header"
```

## Task 7: Upgrade Related Paper Cards And Evidence Detail

**Files:**
- Modify: `src/renderer/src/components/ExpansionGraphView.tsx`
- Modify: `src/renderer/src/components/EvidencePaperDetailView.tsx`
- Modify: `src/renderer/src/styles/panels.css`

- [ ] **Step 1: Add quality helpers to `ExpansionGraphView`**

Add helper functions above component:

```tsx
function formatBadges(badges: string[]) {
  return badges.map((badge) => badge.replace(/_/g, ' ')).join(' / ')
}

function citationLabel(value: number | undefined) {
  return typeof value === 'number' ? `${value} citations` : 'citation unknown'
}
```

- [ ] **Step 2: Replace Evidence Papers section**

In `ExpansionGraphView`, replace the final `{digests.length ? ... : null}` evidence section with:

```tsx
      {record?.relatedPaperRecommendations?.length ? (
        <section className="expansion-paper-list">
          <span className="eyebrow">Quality-Aware Papers</span>
          {record.relatedPaperRecommendations.slice(0, 6).map((paper) => (
            <article className="expansion-paper-card" key={paper.paperId}>
              <div>
                <strong>{paper.title}</strong>
                <p>{paper.whyRecommended}</p>
              </div>
              <div className="expansion-paper-card__meta">
                <span>{paper.venue ?? 'Unknown venue'}</span>
                <span>{paper.year ?? 'Year unknown'}</span>
                <span>{citationLabel(paper.citationCount)}</span>
              </div>
              {paper.qualitySignal?.badges.length ? (
                <div className="expansion-paper-card__badges">
                  {paper.qualitySignal.badges.map((badge) => <span key={badge}>{badge.replace(/_/g, ' ')}</span>)}
                </div>
              ) : null}
              <p className="expansion-paper-card__summary">{truncateDescription(paper.relevanceSummary, 170)}</p>
            </article>
          ))}
        </section>
      ) : digests.length ? (
        <section className="expansion-edge-list">
          <span className="eyebrow">Evidence Papers</span>
          {visibleDigests.map((digest) => (
            <article key={digest.id}>
              <strong>{digest.methodName || digest.paperTitle}</strong>
              <span>{formatRelationHints(digest.relationHints)}</span>
              <p>{truncateDescription(digest.evidenceSummary, 170)}</p>
            </article>
          ))}
        </section>
      ) : null}
```

Remove `formatBadges` if unused after editing.

- [ ] **Step 3: Upgrade `EvidencePaperDetailView`**

Replace the digest return block with:

```tsx
  const recommendation = session.expansionRecord?.relatedPaperRecommendations?.find(
    (item) => item.paperId === digest.paperId
  )

  return (
    <div className="expand-view kg4-workbench evidence-paper-detail">
      <section className="expand-view__hero">
        <div>
          <span className="eyebrow">Evidence Paper Detail</span>
          <h3>{digest.paperTitle}</h3>
          <p>{recommendation?.whyRecommended ?? digest.evidenceSummary}</p>
        </div>
      </section>

      <section className="evidence-detail-grid">
        <article>
          <span className="node-expansion__label">Why Recommended</span>
          <p>{recommendation?.whyRecommended ?? '这篇论文被当前节点的方法摘要引用。'}</p>
          {recommendation?.qualitySignal?.badges.length ? <p><strong>Badges</strong>: {recommendation.qualitySignal.badges.join(', ')}</p> : null}
        </article>
        <article>
          <span className="node-expansion__label">Understanding</span>
          {digest.methodName ? <p><strong>Method</strong>: {digest.methodName}</p> : null}
          <p><strong>Problem Setting</strong>: {digest.problemSetting}</p>
          <p><strong>Core Mechanism</strong>: {digest.coreMechanism}</p>
          {digest.claimedImprovement ? <p><strong>Claimed Improvement</strong>: {digest.claimedImprovement}</p> : null}
        </article>
        <article>
          <span className="node-expansion__label">Evidence & Limits</span>
          <p>{digest.evidenceSummary}</p>
          {digest.limitation ? <p><strong>Limitation</strong>: {digest.limitation}</p> : null}
          {digest.insufficientInformation ? <p><strong>Missing</strong>: {digest.insufficientInformation}</p> : null}
        </article>
        <article>
          <span className="node-expansion__label">Read Next</span>
          <p><strong>Relation Hints</strong>: {digest.relationHints.length ? digest.relationHints.join(', ') : '暂无'}</p>
          <p>可以回到方法谱系查看它对应的 foundation、variant 或 improvement 位置。</p>
        </article>
      </section>
    </div>
  )
```

- [ ] **Step 4: Upgrade related-node fallback detail**

Inside the `if (!digest && relatedNode)` branch, before return, add:

```tsx
    const recommendation = session.expansionRecord?.relatedPaperRecommendations?.find(
      (item) => item.paperId === activeTab?.nodeId || relatedNode.sourcePaperIds.includes(item.paperId)
    )
```

Replace that branch's content with a four-section layout using `recommendation`:

```tsx
        <section className="evidence-detail-grid">
          <article>
            <span className="node-expansion__label">Why Recommended</span>
            <p>{recommendation?.whyRecommended ?? '这篇论文与当前展开节点相关。'}</p>
          </article>
          <article>
            <span className="node-expansion__label">Understanding</span>
            <p>{recommendation?.relevanceSummary ?? relatedNode.description}</p>
          </article>
          <article>
            <span className="node-expansion__label">Evidence & Limits</span>
            <p>当前只有检索元数据或摘要级信息，具体实验结论需要打开原文确认。</p>
          </article>
          <article>
            <span className="node-expansion__label">Read Next</span>
            <p><strong>Source Paper IDs</strong>: {relatedNode.sourcePaperIds.length ? relatedNode.sourcePaperIds.join(', ') : '暂无'}</p>
          </article>
        </section>
```

- [ ] **Step 5: Add styles**

Append to `src/renderer/src/styles/panels.css`:

```css
.expansion-paper-list {
  display: grid;
  gap: 12px;
}

.expansion-paper-card {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
}

.expansion-paper-card strong {
  color: #0f172a;
}

.expansion-paper-card p {
  margin: 4px 0 0;
  color: #475569;
  line-height: 1.55;
}

.expansion-paper-card__meta,
.expansion-paper-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.expansion-paper-card__meta span,
.expansion-paper-card__badges span {
  border-radius: 999px;
  padding: 4px 9px;
  font-size: 12px;
  font-weight: 700;
}

.expansion-paper-card__meta span {
  background: #f8fafc;
  color: #475569;
}

.expansion-paper-card__badges span {
  background: #eef2ff;
  color: #3730a3;
}

.expansion-paper-card__summary {
  padding-top: 8px;
  border-top: 1px solid #eef2f7;
}

.evidence-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
}

.evidence-detail-grid article {
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
}

.evidence-detail-grid p {
  color: #475569;
  line-height: 1.6;
}
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/ExpansionGraphView.tsx src/renderer/src/components/EvidencePaperDetailView.tsx src/renderer/src/styles/panels.css
git commit -m "feat(expansion): show quality-aware paper details"
```

## Task 8: Final Verification

**Files:**
- Verify all files touched in Tasks 1-7.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npx tsx src/main/kg4/expansionClassification.test.ts
npx tsx src/main/kg4/paperQuality.test.ts
npx tsx src/main/kg4/lineageRecord.test.ts
npx tsx src/main/llm/orchestrator.test.ts
```

Expected: all print their pass messages and exit 0.

- [ ] **Step 2: Run full typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Inspect diff for intended scope**

Run: `git diff --stat`

Expected: changes limited to KG4 shared types, KG4 main modules/tests, LLM prompt/validation, expansion UI components, and `panels.css`.

- [ ] **Step 4: Manual smoke test in app**

Run: `npm run dev`

Manual checks:

- Expand a method-like node and confirm the lineage flow still appears.
- Expand a concept-like node such as `LoRA` if available and confirm the route header recommends concept learning or falls back with visible rationale.
- Confirm paper cards show venue/year/citation/badges/recommendation reasons when metadata exists.
- Open an evidence paper detail and confirm it has Why Recommended, Understanding, Evidence & Limits, and Read Next sections.

- [ ] **Step 5: Commit any final fixes**

If verification required fixes, stage only the files changed by this plan:

```bash
git add src/shared/kg4.ts \
  src/main/kg4/expansionClassification.ts \
  src/main/kg4/expansionClassification.test.ts \
  src/main/kg4/paperQuality.ts \
  src/main/kg4/paperQuality.test.ts \
  src/main/kg4/expansionQuery.ts \
  src/main/kg4/lineageRecord.ts \
  src/main/kg4/lineageRecord.test.ts \
  src/main/index.ts \
  src/main/llm/jobPrompts.ts \
  src/main/llm/orchestrator.ts \
  src/main/llm/orchestrator.test.ts \
  src/renderer/src/components/ExpansionRouteHeader.tsx \
  src/renderer/src/components/ExpansionGraphView.tsx \
  src/renderer/src/components/EvidencePaperDetailView.tsx \
  src/renderer/src/styles/panels.css
git commit -m "fix(expansion): polish strategy phase one"
```

If no fixes were needed, do not create an empty commit.

## Self-Review

Spec coverage:

- Classification model: covered by Tasks 1, 2, 4, and 5.
- Paper quality and trend layer, without Semantic Scholar API calls: covered by Task 3 and threaded by Task 4.
- Route header and light workspace direction: covered by Task 6.
- Related paper card upgrade: covered by Task 7.
- Evidence paper detail upgrade: covered by Task 7.
- Preserve current method lineage behavior: covered by Task 4 focused lineage tests and Task 8 smoke test.

Intentional gaps for later phases:

- Full `ConceptLearningStrategy` and `ConceptLearningView` are Phase 2.
- Full `ResearchAreaStrategy` and `ResearchAreaView` are Phase 3.
- Semantic Scholar metadata enrichment is Phase 4 and requires fresh API documentation review before implementation.
- Full dark/light theme redesign is explicitly out of scope; Phase 1 stays with light workspace styling.

Placeholder scan:

- No `TBD`, `TODO`, or unspecified implementation steps are present.
- Each task lists exact files, commands, and expected outcomes.

Type consistency:

- `ExpansionNodeClassification`, `PaperQualitySignal`, and `RelatedPaperRecommendation` are introduced in shared types before use.
- `buildStrategyRetrievalPlan` returns the extended `ExpansionRetrievalPlan.retrievalGoal` values.
- `assembleLineageExpansionRecord` remains backward-compatible because new params are optional.
