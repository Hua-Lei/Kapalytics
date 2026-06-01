# Node Expansion Reading Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert node expansion teaching/research views into article-like reading layouts and improve formula rendering for KG4 concept outputs.

**Architecture:** Keep KG4 data contracts unchanged. Add a pure math segmentation helper for `MathText`, refactor two display components to vertical semantic sections, and update CSS/prompt copy in place.

**Tech Stack:** React 18, TypeScript, KaTeX, CSS, existing `npx tsx` test style.

---

## File Structure

- Create `src/renderer/src/components/mathTextSegments.ts`: pure parsing/normalization for math text.
- Create `src/renderer/src/components/mathTextSegments.test.ts`: tests for delimiters and display bare formulas.
- Modify `src/renderer/src/components/MathText.tsx`: use the helper.
- Modify `src/renderer/src/components/ResearchAreaView.tsx`: render article-style vertical sections.
- Modify `src/renderer/src/components/ConceptLearningView.tsx`: render article-style vertical sections.
- Modify `src/renderer/src/styles/panels.css`: replace grid-card styling for concept/research views with reading-note styling while preserving existing class names where practical.
- Modify `src/main/llm/jobPrompts.ts`: tighten formula output instructions.

## Tasks

### Task 1: Math Segmentation Helper

- [ ] Write `mathTextSegments.test.ts` asserting `$...$`, `$$...$$`, `\(...\)`, `\[...\]`, and display bare formulas are parsed.
- [ ] Run `npx tsx "src/renderer/src/components/mathTextSegments.test.ts"` and confirm it fails because the helper is missing.
- [ ] Add `mathTextSegments.ts` with `segmentMathText(text, options)`.
- [ ] Re-run the test and confirm it passes.

### Task 2: Wire MathText

- [ ] Modify `MathText.tsx` to import and use `segmentMathText`.
- [ ] Preserve existing KaTeX render behavior with `throwOnError: false` and `trust: false`.
- [ ] Run `npx tsx "src/renderer/src/components/mathTextSegments.test.ts"` and `npm run typecheck`.

### Task 3: Research Area Reading Layout

- [ ] Modify `ResearchAreaView.tsx` to use a single `.research-area-view__article` flow.
- [ ] Render key problems as numbered or bullet reading points, method families as sections, hot directions as annotated sections, and reading recommendations as compact rows.
- [ ] Update related CSS in `panels.css`.

### Task 4: Concept Teaching Reading Layout

- [ ] Modify `ConceptLearningView.tsx` to use `.concept-learning-view__article` instead of a card grid.
- [ ] Render formulas as integrated formula blocks with variable tables below.
- [ ] Update related CSS in `panels.css`.

### Task 5: Prompt Tightening

- [ ] Modify `src/main/llm/jobPrompts.ts` concept teaching prompt lines so `formula.latex` is KaTeX body only and explanatory text wraps inline formulas in `$...$`.
- [ ] Run `npm run typecheck`.

### Task 6: Verification

- [ ] Run `npx tsx "src/renderer/src/components/mathTextSegments.test.ts"`.
- [ ] Run `npm run typecheck`.
- [ ] Report that visual verification still requires opening the Electron UI.
