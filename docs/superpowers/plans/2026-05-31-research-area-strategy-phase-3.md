# Research Area Strategy Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make field and problem nodes produce structured research navigation: overview, key problems, method families, recent hot directions, and recommended reading with quality-aware paper references.

**Architecture:** Follow Phase 2 pattern. Add `ResearchAreaView` type, `synthesize_research_area` LLM job, normalization module, main-process flow for `explore_research_area` path, and `ResearchAreaView` renderer component.

**Tech Stack:** Electron main process, TypeScript, React 18, Node test files, `npx tsx`, `npm run typecheck`.

---

## Task 1: Add Research Area Shared Types

**Files:** `src/shared/kg4.ts`

Add after `ConceptLearningView`:

```ts
export interface ResearchAreaView {
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
  dataCompleteness: 'complete' | 'partial' | 'insufficient'
  missingDataReasons: string[]
}
```

Add `'synthesize_research_area'` to `Kg4LLMTaskType`.

Add `researchAreaView?: ResearchAreaView` to `Kg4NodeExpansionRecord`.

Add validator constants:
```ts
const readingRoles = ['survey', 'foundation', 'recent_hot', 'representative', 'needs_review'] as const
```

Add `isResearchAreaView` validator. Update `isKg4NodeExpansionRecord`.

Run `npm run typecheck`. Commit `feat(expansion): add research area shared types`.

## Task 2: Add LLM Prompt And Validation

**Files:** `src/main/llm/jobPrompts.ts`, `src/main/llm/orchestrator.ts`, `src/main/llm/orchestrator.test.ts`

Add `'synthesize_research_area'` to `KG4_JOB_TYPES`.

Add system prompt:
```
You are a KG4 research area survey worker. Return strict JSON only.
Input: currentNode, retrievedPapers, qualitySignals.
Return ResearchAreaView JSON: id, anchorNodeId, title, overview, keyProblems, methodFamilies, recentHotDirections, recommendedReading, dataCompleteness, missingDataReasons.
overview: 2-3 sentence big-picture summary.
keyProblems: main research bottlenecks this field addresses.
methodFamilies: grouped methods with label, summary, representativePaperIds.
recentHotDirections: recent trends with label, summary, paperIds, confidence (0-1).
recommendedReading: entry-level survey/foundation/recent_hot/representative papers.
role must be survey|foundation|recent_hot|representative|needs_review.
All explanatory text in Chinese.
Every paperId must reference supplied papers. Do not invent papers.
```

Add `validateResearchArea` in orchestrator.ts and wire into `validateJobOutput`.

Add valid/invalid tests in orchestrator.test.ts.

Run tests. Commit `feat(expansion): add synthesize_research_area LLM validation`.

## Task 3: Create Research Area Normalization Module

**Files:** Create `src/main/kg4/researchArea.ts`, `src/main/kg4/researchArea.test.ts`

Export `normalizeResearchAreaView(value, { anchorNodeId }): ResearchAreaView | undefined`.
- Validate required fields (id, title, overview).
- Filter methodFamilies entries with valid label/summary/paperIds.
- Filter recentHotDirections with valid label/summary/paperIds and clamp confidence.
- Filter recommendedReading with valid paperId/reason and allowed role.
- Default dataCompleteness to 'partial'.

Test valid, null, missing overview, invalid confidence clamping.

Run `npx tsx src/main/kg4/researchArea.test.ts`, `npm run typecheck`.
Commit `feat(expansion): normalize research area views`.

## Task 4: Thread Into Expansion Flow

**Files:** `src/main/kg4/lineageRecord.ts`, `src/main/kg4/lineageRecord.test.ts`, `src/main/index.ts`

Add `researchAreaView?: ResearchAreaView` param to `assembleLineageExpansionRecord`. Store in record.

Add test for research area record assembly.

In `index.ts`: after concept teaching branch and before generic fallback, add `explore_research_area` branch:
```ts
if (expansionClassification.recommendedPath === 'explore_research_area' && candidates.length >= 1) {
  // progress: 'surveying'
  // createJob type: 'synthesize_research_area'
  // input: currentNode, retrievedPapers (compact), qualitySignals
  // model: deepseek-v4-pro, maxTokens: 8000
  // normalizeResearchAreaView
  // assembleLineageExpansionRecord with researchAreaView
  // persist, send done progress, return
}
```

Run tests. Commit in two commits: lineageRecord, then index.ts.

## Task 5: Create ResearchAreaView UI

**Files:** Create `src/renderer/src/components/ResearchAreaView.tsx`, modify `ExpansionGraphView.tsx`, `panels.css`

Render sections: Overview, Key Problems (list), Method Families (cards with paper count), Recent Hot Directions (cards with confidence), Recommended Reading (numbered cards with role badge).

Integrate into ExpansionGraphView when `record.researchAreaView` present.

Add light workspace CSS with color-coded left borders per section.

Run `npm run typecheck`. Commit `feat(expansion): render research area view`.

## Task 6: Final Verification

Run all focused tests, typecheck, inspect diff scope.

---

## Self-Review

- All types defined before use.
- Follows Phase 2 established patterns (normalizer, IPC branch, UI component).
- `synthesize_research_area` matches `synthesize_method_lineage` naming convention.
- No Semantic Scholar API calls in this phase.
- All explanatory text in Chinese.
