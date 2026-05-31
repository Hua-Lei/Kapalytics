# KG4 Token Loading Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Increase KG4 node expansion output budgets and make the expansion loading view more informative while a long-running retrieval/LLM workflow is in progress.

**Architecture:** Keep the change local to the KG4 expansion flow. Backend token limits are adjusted at the existing job creation call sites in `src/main/index.ts`; frontend loading telemetry is derived from the existing `NodeExpansionSession` state without adding new IPC event fields.

**Tech Stack:** Electron main process TypeScript, React 18 renderer components, CSS in `src/renderer/src/styles/panels.css`, existing `tsx` script-style tests and `tsc -b --noEmit`.

---

### Task 1: Increase KG4 Job Token Budgets

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: Change only KG4 expansion job token limits**

Update the three `maxTokens` values inside the `kg4:start-expansion` handler:

```ts
maxTokens: 2000
```

for `classify_expansion_intent`,

```ts
maxTokens: 4000
```

for `digest_paper_method`, and

```ts
maxTokens: 12000
```

for `synthesize_method_lineage`.

- [ ] **Step 2: Verify the diff is scoped**

Run: `git diff -- src/main/index.ts`

Expected: only the three KG4 `maxTokens` values change in this task.

### Task 2: Add Loading Telemetry Helpers

**Files:**
- Modify: `src/renderer/src/components/ExpansionLoadingView.tsx`

- [ ] **Step 1: Add elapsed time formatter**

Add this helper near `STATUS_LABEL`:

```ts
function formatElapsedTime(startedAt: string): string {
  const elapsedMs = Math.max(0, Date.now() - new Date(startedAt).getTime())
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`
}
```

- [ ] **Step 2: Derive current step and digest count**

Inside `ExpansionLoadingView`, after `expansionNodeCount`, add:

```ts
const currentStep = session.steps.find((step) => step.id === session.currentStepId) ?? session.steps.find((step) => step.status === 'running')
const completedStepCount = session.steps.filter((step) => step.status === 'done').length
const digestCount = session.expansionRecord?.paperMethodDigests?.length ?? 0
const elapsedTime = formatElapsedTime(session.createdAt)
```

### Task 3: Improve Loading View UI

**Files:**
- Modify: `src/renderer/src/components/ExpansionLoadingView.tsx`
- Modify: `src/renderer/src/styles/panels.css`

- [ ] **Step 1: Replace the hero copy with current-stage details**

In the hero section, keep the title but replace the paragraph with:

```tsx
<p>{currentStep?.detail ?? '正在调度检索、摘要和谱系生成任务...'}</p>
```

- [ ] **Step 2: Expand the summary cards from three to four cards**

Replace the summary section cards with:

```tsx
<article>
  <span>Current step</span>
  <strong>{currentStep?.label ?? STATUS_LABEL[session.status]}</strong>
</article>
<article>
  <span>Elapsed</span>
  <strong>{elapsedTime}</strong>
</article>
<article>
  <span>Candidate papers</span>
  <strong>{candidateCount}</strong>
</article>
<article>
  <span>Method digests</span>
  <strong>{digestCount}</strong>
</article>
```

- [ ] **Step 3: Add progress note before the step list**

Before `<section className="expansion-step-list" ...>`, add:

```tsx
{session.status === 'loading' && (
  <section className="expansion-loading-progress-note">
    <strong>{completedStepCount}/{session.steps.length} steps completed</strong>
    <p>长输出任务可能需要更久；页面会在检索、摘要和谱系汇总完成后自动切换到结果。</p>
  </section>
)}
```

- [ ] **Step 4: Style the new progress note and responsive summary grid**

In `src/renderer/src/styles/panels.css`, include `.expansion-loading-progress-note` in the shared card selector and add:

```css
.expansion-loading-progress-note {
  padding: 14px;
}

.expansion-loading-progress-note strong {
  color: var(--color-text);
  display: block;
  font-size: 13px;
  margin-bottom: 4px;
}

.expansion-loading-progress-note p {
  color: var(--color-text-muted);
  font-size: 13px;
  line-height: 1.65;
  margin: 0;
}
```

Change `.expansion-loading-summary` grid template to:

```css
grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
```

### Task 4: Verify

**Files:**
- Test: existing tests only

- [ ] **Step 1: Run targeted KG4 and orchestrator tests**

Run: `npx tsx src/main/kg4/lineageRecord.test.ts && npx tsx src/main/llm/orchestrator.test.ts`

Expected: both tests pass. Existing SQLite fallback warning in orchestrator tests is acceptable if the process exits 0.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: `tsc -b --noEmit` exits 0.

- [ ] **Step 3: Inspect final diff**

Run: `git diff -- src/main/index.ts src/renderer/src/components/ExpansionLoadingView.tsx src/renderer/src/styles/panels.css`

Expected: changes are limited to KG4 token budgets and loading UI improvements.

---

## Self-Review

- Spec coverage: covers KG4-only token increase and information-density loading improvement.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: helper names and session properties match existing `NodeExpansionSession` fields.
