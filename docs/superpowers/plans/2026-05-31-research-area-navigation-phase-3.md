# Research Area Navigation Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add research area navigation so field/problem nodes produce structured overviews with key problems, method families, hot directions, and recommended reading.

**Architecture:** Follow the same pattern as Phase 2 concept teaching: new LLM job type `map_research_area`, structured output normalization, IPC branch for `explore_research_area` classification, and a specialized `ResearchAreaView` UI component.

**Tech Stack:** Electron main process, TypeScript, React 18, `node:assert/strict` tests, `npx tsx`, `npm run typecheck`.

---

## File Structure

### Shared Types

- Modify `src/shared/kg4.ts`: `ResearchAreaView` type, `map_research_area` job type, `researchAreaView` record field, validators.

### LLM Prompt And Validation

- Modify `src/main/llm/jobPrompts.ts`: `map_research_area` prompt.
- Modify `src/main/llm/orchestrator.ts`: validation dispatch.
- Modify `src/main/llm/orchestrator.test.ts`: validation tests.

### Main Process

- Create `src/main/kg4/researchArea.ts`: normalization module.
- Create `src/main/kg4/researchArea.test.ts`: normalization tests.
- Modify `src/main/kg4/lineageRecord.ts`: accept `researchAreaView` param.
- Modify `src/main/kg4/lineageRecord.test.ts`: record assembly test.
- Modify `src/main/index.ts`: `explore_research_area` branch in `kg4:start-expansion`.

### Renderer UI

- Create `src/renderer/src/components/ResearchAreaView.tsx`.
- Modify `src/renderer/src/components/ExpansionGraphView.tsx`: render when `researchAreaView` present.
- Modify `src/renderer/src/styles/panels.css`: styles.

---

## Task 1: Add Research Area Shared Types

**Files:** Modify `src/shared/kg4.ts`.

Add `ResearchAreaView` interface:

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
}
```

Add `'map_research_area'` to `Kg4LLMTaskType`.
Add `researchAreaView?: ResearchAreaView` to `Kg4NodeExpansionRecord`.

Add validator constants and `isResearchAreaView` function following the same pattern as `isConceptLearningView`.
Update `isKg4NodeExpansionRecord`.

Run `npm run typecheck`, commit `feat(expansion): add research area shared types`.

## Task 2: Add LLM Prompt And Validation

**Files:** Modify `src/main/llm/jobPrompts.ts`, `orchestrator.ts`, `orchestrator.test.ts`.

Add `'map_research_area'` to `KG4_JOB_TYPES`. Add system prompt:

```ts
  if (type === 'map_research_area') {
    return [
      'You are a KG4 research area mapper. Return strict JSON only.',
      'Input contains currentNode, currentPaperInsight, compact retrievedPapers, and optional qualitySignals.',
      'Return ResearchAreaView JSON: id, anchorNodeId, title, overview, keyProblems, methodFamilies, recentHotDirections, recommendedReading.',
      'overview: concise research landscape summary.',
      'keyProblems: list of core research problems or open challenges.',
      'methodFamilies: groups of related methods, each with label/summary/representativePaperIds.',
      'recentHotDirections: emerging trends, each with label/summary/paperIds/confidence.',
      'recommendedReading: curated reading list, each with paperId/reason/role.',
      'role must be survey|foundation|recent_hot|representative|needs_review.',
      'Every paperId must come from supplied papers.',
      'All explanatory text must be Chinese.',
      'Do not invent paper titles or IDs.'
    ].join(' ')
  }
```

Add `validateResearchArea` function and wire in `validateJobOutput`. Add test assertions in `.test.ts`.

Commit `feat(expansion): add map_research_area LLM prompt and validation`.

## Task 3: Create Research Area Normalization Module

**Files:** Create `src/main/kg4/researchArea.ts` and `.test.ts`.

Export `normalizeResearchAreaView(value, context: { anchorNodeId })` returning `ResearchAreaView | undefined`. Follow same pattern as `normalizeConceptLearningView`:
- Validate required fields (id, title, overview).
- Filter keyProblems to non-empty strings.
- Filter methodFamilies entries with valid label/summary/paperIds.
- Filter recentHotDirections with valid label/summary/confidence check.
- Filter recommendedReading with valid paperId/reason/role.

Test: valid output, null fallback, missing required fields.

Run tests, commit `feat(expansion): normalize research area views`.

## Task 4: Thread Into Expansion Flow

**Files:** Modify `src/main/kg4/lineageRecord.ts`, `.test.ts`, `src/main/index.ts`.

- `lineageRecord.ts`: accept optional `researchAreaView` param, store in record.
- `lineageRecord.test.ts`: add test.
- `index.ts`: add `explore_research_area` branch in `kg4:start-expansion` (after quality annotation, before generic check). Create `map_research_area` job, run, normalize, assemble record. Pattern identical to Phase 2 concept branch.

Verification: `lineageRecord tests passed`, typecheck pass.

## Task 5: Create ResearchAreaView UI

**Files:** Create `src/renderer/src/components/ResearchAreaView.tsx`, modify `ExpansionGraphView.tsx`, `panels.css`.

ResearchAreaView renders:
- Overview card
- Key Problems list
- Method Families (per-family card with representative papers)
- Recent Hot Directions (per-direction card with confidence)
- Recommended Reading (papers with role badges: survey/foundation/hot/representative/review)

Integrate into ExpansionGraphView after ConceptLearningView section.
Styles: light workspace, card-based, color-coded left borders per section.

Commit `feat(expansion): render research area view`.

## Task 6: Final Verification

- All 6 test suites pass: `conceptTeaching, expansionClassification, paperQuality, lineageRecord, orchestrator, researchArea`.
- `npm run typecheck` zero errors.
- Diff scope clean.
