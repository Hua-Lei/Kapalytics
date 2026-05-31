# Concept Learning Strategy Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the concept teaching path so nodes like LoRA and Context Distillation produce layered teaching content: quick intuition, formal math, misconceptions, relation maps, and representative/recent paper connections.

**Architecture:** Extend the Phase 1 strategy pipeline with a new `teach_concept` LLM job type, a `ConceptLearningView` data model, a main-process concept teaching flow triggered by `learn_concept` classification, and a new `ConceptLearningView` renderer component with KaTeX formula rendering.

**Tech Stack:** Electron main process, TypeScript, React 18 with KaTeX via existing `MathText`, Node test files using `node:assert/strict`, `npx tsx` for focused tests, `npm run typecheck` for compilation.

---

## File Structure

### Shared Types

- Modify `src/shared/kg4.ts`
  - Add `ConceptLearningView` interface.
  - Add `teach_concept` to `Kg4LLMTaskType`.
  - Add `conceptLearningView?: ConceptLearningView` to `Kg4NodeExpansionRecord`.
  - Add runtime validator `isConceptLearningView`.

### LLM Prompt And Validation

- Modify `src/main/llm/jobPrompts.ts`
  - Add `teach_concept` system prompt.
  - Register `teach_concept` in `KG4_JOB_TYPES` set.

- Modify `src/main/llm/orchestrator.ts`
  - Add `teach_concept` validation in `validateJobOutput`.

- Modify `src/main/llm/orchestrator.test.ts`
  - Add validation tests for `teach_concept` output.

### Main Process

- Modify `src/main/index.ts`
  - In `kg4:start-expansion`, after classification, when `recommendedPath === 'learn_concept'`:
    - Run retrieval, annotate quality, build recommendations.
    - Run `teach_concept` LLM job with retrieved papers, quality signals, node info.
    - Build expansion record with `conceptLearningView`.
  - This adds a new branch before or alongside the existing `expansionIntent.kind === 'generic_related_papers'` check.

- Create `src/main/kg4/conceptTeaching.ts`
  - Function `buildConceptTeachingInput(params)` to construct LLM input.
  - Function `normalizeConceptLearningView(raw, { nodeId, anchorNodeId })` to validate and normalize LLM output.
  - Utility for compacting retrieved papers into concept-teaching input format.

- Create `src/main/kg4/conceptTeaching.test.ts`
  - Test normalization of valid and malformed concept learning output.
  - Test input construction includes paper IDs from retrieval.

- Modify `src/main/kg4/lineageRecord.test.ts`
  - Add tests for record assembly with `conceptLearningView`.

### Renderer UI

- Create `src/renderer/src/components/ConceptLearningView.tsx`
  - Render layered teaching page: Quick Understanding, Formal View (formulas via `MathText`), Misconceptions, Relation Map, Papers.

- Modify `src/renderer/src/components/ExpansionGraphView.tsx`
  - When `record.conceptLearningView` is present, render `ConceptLearningView` instead of or in addition to the expansion graph.

- Modify `src/renderer/src/styles/panels.css`
  - Add styles for concept teaching layout: quick cards, formula blocks, misconception warnings, relation badges, paper entries.

---

## Task 1: Add Concept Learning Shared Types

**Files:**
- Modify: `src/shared/kg4.ts`

- [ ] **Step 1: Add `ConceptLearningView` interface**

After `MethodLineageView`, add:

```ts
export interface ConceptFormulaEntry {
  latex: string
  explanation: string
  variables: Array<{ symbol: string; meaning: string }>
}

export interface ConceptLearningView {
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
    formulas: ConceptFormulaEntry[]
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

- [ ] **Step 2: Add `teach_concept` to `Kg4LLMTaskType`**

Add to the union type:

```ts
  | 'teach_concept'
```

- [ ] **Step 3: Add optional field to `Kg4NodeExpansionRecord`**

```ts
  conceptLearningView?: ConceptLearningView
```

- [ ] **Step 4: Add validator constants and helpers**

Near existing concept relation constants or near paperBadges:

```ts
const conceptRelations = ['prerequisite', 'similar', 'contrasts_with', 'used_by', 'variant'] as const satisfies readonly ConceptLearningView['relationMap'][number]['relation'][]

const conceptViewCompleteness = ['complete', 'partial', 'insufficient'] as const satisfies readonly ConceptLearningView['dataCompleteness'][]
```

Add `isConceptLearningView` validator:

```ts
function isConceptLearningView(value: unknown): value is ConceptLearningView {
  if (!isRecordObject(value)) return false
  if (
    typeof value.id !== 'string' || !value.id.trim() ||
    typeof value.anchorNodeId !== 'string' || !value.anchorNodeId.trim() ||
    typeof value.title !== 'string' || !value.title.trim()
  ) return false

  const qe = value.quickExplanation
  if (!isRecordObject(qe)) return false
  if (!['intuition', 'problemSolved', 'coreMechanism', 'whenToUse'].every((k) => typeof qe[k] === 'string' && Boolean(qe[k].trim()))) return false

  const fe = value.formalExplanation
  if (!isRecordObject(fe)) return false
  if (typeof fe.definition !== 'string' || !fe.definition.trim()) return false
  if (!Array.isArray(fe.formulas)) return false
  if (!fe.formulas.every((f) => isRecordObject(f) && typeof f.latex === 'string' && Boolean(f.latex.trim()) && typeof f.explanation === 'string' && Boolean(f.explanation.trim()) && Array.isArray(f.variables) && f.variables.every((v) => isRecordObject(v) && typeof v.symbol === 'string' && typeof v.meaning === 'string')))) return false
  if (!isStringArray(fe.assumptions)) return false

  if (!Array.isArray(value.misconceptions) || !value.misconceptions.every((m) => isRecordObject(m) && typeof m.misconception === 'string' && Boolean(m.misconception.trim()) && typeof m.correction === 'string' && Boolean(m.correction.trim()))) return false

  if (!Array.isArray(value.relationMap) || !value.relationMap.every((r) => isRecordObject(r) && typeof r.label === 'string' && Boolean(r.label.trim()) && isOneOf(r.relation, conceptRelations) && typeof r.explanation === 'string' && Boolean(r.explanation.trim()))) return false

  if (!isStringArray(value.representativePaperIds)) return false
  if (!isStringArray(value.recentPaperIds)) return false
  if (!isOneOf(value.dataCompleteness, conceptViewCompleteness)) return false
  if (!isStringArray(value.missingDataReasons)) return false

  return true
}
```

- [ ] **Step 5: Update `isKg4NodeExpansionRecord`**

Add optional field check:

```ts
  if (value.conceptLearningView !== undefined && !isConceptLearningView(value.conceptLearningView)) return false
```

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`

- [ ] **Step 7: Commit**

```bash
git add src/shared/kg4.ts
git commit -m "feat(expansion): add concept learning shared types"
```

## Task 2: Add LLM Prompt And Validation For teach_concept

**Files:**
- Modify: `src/main/llm/jobPrompts.ts`
- Modify: `src/main/llm/orchestrator.ts`
- Modify: `src/main/llm/orchestrator.test.ts`

- [ ] **Step 1: Add `teach_concept` to job type set in jobPrompts.ts**

In `KG4_JOB_TYPES`, add:

```ts
  'teach_concept',
```

- [ ] **Step 2: Add system prompt in jobPrompts.ts**

After existing prompts, add:

```ts
  if (type === 'teach_concept') {
    return [
      'You are a KG4 concept teaching worker. Return strict JSON only.',
      'Input contains currentNode, currentPaperInsight, compact retrievedPapers, and optional qualitySignals.',
      'Return exactly one ConceptLearningView JSON with fields: id, anchorNodeId, title, quickExplanation, formalExplanation, misconceptions, relationMap, representativePaperIds, recentPaperIds, dataCompleteness, missingDataReasons.',
      'quickExplanation must have: intuition, problemSolved, coreMechanism, whenToUse.',
      'formalExplanation must have: definition, formulas, assumptions.',
      'Each formula must have: latex (valid LaTeX), explanation, and variables array (each with symbol and meaning).',
      'misconceptions: list of { misconception, correction } pairs.',
      'relationMap: list of { label, relation (prerequisite|similar|contrasts_with|used_by|variant), explanation } describing how this concept relates to connected ideas.',
      'representativePaperIds: representative, definitional, survey, or classic papers.',
      'recentPaperIds: recent papers (within 2 years) building on or applying this concept.',
      'All explanatory text fields must be Chinese (中文). LaTeX formulas can use standard English math notation.',
      'Every referred paperId must come from supplied retrievedPapers or currentPaperInsight.',
      'Do not invent paper titles or external IDs.'
    ].join(' ')
  }
```

- [ ] **Step 3: Add validation in orchestrator.ts**

In `validateJobOutput`, add after existing job type checks:

```ts
  if (job.type === 'teach_concept') {
    return mergeValidationResults(
      validateReferencedPapers(output, [...job.relatedPaperIds, ...(job.paperId ? [job.paperId] : [])]),
      validateConceptLearning(output)
    )
  }
```

Add `validateConceptLearning` function:

```ts
function validateConceptLearning(output: unknown): ReferencedPaperValidationResult {
  const errors: string[] = []
  if (!isRecord(output)) return schemaErrors('teach_concept output must be an object')
  if (!isNonEmptyString(output.id)) errors.push('teach_concept.id must be a non-empty string')
  if (!isNonEmptyString(output.anchorNodeId)) errors.push('teach_concept.anchorNodeId must be a non-empty string')
  if (!isNonEmptyString(output.title)) errors.push('teach_concept.title must be a non-empty string')
  const qe = output.quickExplanation
  if (!isRecord(qe)) {
    errors.push('teach_concept.quickExplanation must be an object')
  } else {
    if (!isNonEmptyString(qe.intuition)) errors.push('teach_concept.quickExplanation.intuition must be a non-empty string')
    if (!isNonEmptyString(qe.problemSolved)) errors.push('teach_concept.quickExplanation.problemSolved must be a non-empty string')
    if (!isNonEmptyString(qe.coreMechanism)) errors.push('teach_concept.quickExplanation.coreMechanism must be a non-empty string')
    if (!isNonEmptyString(qe.whenToUse)) errors.push('teach_concept.quickExplanation.whenToUse must be a non-empty string')
  }
  const fe = output.formalExplanation
  if (!isRecord(fe)) {
    errors.push('teach_concept.formalExplanation must be an object')
  } else {
    if (!isNonEmptyString(fe.definition)) errors.push('teach_concept.formalExplanation.definition must be a non-empty string')
    if (!Array.isArray(fe.formulas)) errors.push('teach_concept.formalExplanation.formulas must be an array')
  }
  if (!Array.isArray(output.misconceptions)) errors.push('teach_concept.misconceptions must be an array')
  return schemaErrors(...errors)
}
```

- [ ] **Step 4: Add test assertions in orchestrator.test.ts**

```ts
const conceptJob = {
  type: 'teach_concept' as const,
  relatedPaperIds: ['paper-lo'],
  paperId: undefined,
  nodeId: undefined
} as any

const validConceptOutput = {
  id: 'cv-lo',
  anchorNodeId: 'n-lo',
  title: 'LoRA: Low-Rank Adaptation',
  quickExplanation: {
    intuition: '用低秩矩阵近似全参数更新，降低微调开销。',
    problemSolved: '大语言模型全参数微调成本过高的瓶颈。',
    coreMechanism: '冻结原始权重，通过低秩分解矩阵 BA 注入可训练参数。',
    whenToUse: '需要高效适配预训练模型到新任务且硬件有限的场景。'
  },
  formalExplanation: {
    definition: '对于预训练权重 W，LoRA 参数化更新为 W + BA。',
    formulas: [
      {
        latex: 'h = Wx + BAx',
        explanation: '前向传播时，原始权重冻结，低秩更新通过 BA 矩阵注入。',
        variables: [
          { symbol: 'W', meaning: '原始预训练权重矩阵' },
          { symbol: 'B', meaning: '低秩分解左矩阵' },
          { symbol: 'A', meaning: '低秩分解右矩阵' }
        ]
      }
    ],
    assumptions: ['预训练权重包含足够知识无需大幅调整']
  },
  misconceptions: [
    { misconception: 'LoRA 是模型压缩方法', correction: 'LoRA 的提出目的是参数高效微调，并非压缩模型推理尺寸。' }
  ],
  relationMap: [
    { label: '适配器方法', relation: 'similar', explanation: '与 Adapter 同为参数高效微调方案，但 LoRA 结构更简单。' }
  ],
  representativePaperIds: ['paper-lo'],
  recentPaperIds: [],
  dataCompleteness: 'partial',
  missingDataReasons: []
}

assert.equal(orchestrator.validateJobOutput(conceptJob, validConceptOutput).ok, true)

const badConcept = { ...validConceptOutput, quickExplanation: null }
assert.equal(orchestrator.validateJobOutput(conceptJob, badConcept).ok, false)
```

Adapt to existing test file conventions as needed.

- [ ] **Step 5: Run tests**

Run: `npx tsx src/main/llm/orchestrator.test.ts` — must pass.

- [ ] **Step 6: Commit**

```bash
git add src/main/llm/jobPrompts.ts src/main/llm/orchestrator.ts src/main/llm/orchestrator.test.ts
git commit -m "feat(expansion): add teach_concept LLM prompt and validation"
```

## Task 3: Create Concept Teaching Module

**Files:**
- Create: `src/main/kg4/conceptTeaching.ts`
- Create: `src/main/kg4/conceptTeaching.test.ts`

- [ ] **Step 1: Write test file**

Create `src/main/kg4/conceptTeaching.test.ts`:

```ts
import assert from 'node:assert/strict'
import type { ConceptLearningView } from '../../shared/kg4'
import { normalizeConceptLearningView } from './conceptTeaching'

const validLLMOutput: unknown = {
  id: 'cv-lo',
  anchorNodeId: 'n-lo',
  title: 'LoRA: Low-Rank Adaptation',
  quickExplanation: {
    intuition: '用低秩矩阵近似全参数更新。',
    problemSolved: '大模型全参数微调成本过高。',
    coreMechanism: '冻结权重，通过低秩分解注入可训练参数。',
    whenToUse: '需要高效适配预训练模型时。'
  },
  formalExplanation: {
    definition: '对于权重 W，参数化为 W + BA。',
    formulas: [
      {
        latex: 'h = Wx + BAx',
        explanation: '前向传播。',
        variables: [{ symbol: 'W', meaning: '原始权重' }]
      }
    ],
    assumptions: ['预训练权重包含足够知识']
  },
  misconceptions: [{ misconception: '错误理解', correction: '正确解释' }],
  relationMap: [{ label: 'Adapter', relation: 'similar', explanation: '类似方案' }],
  representativePaperIds: ['p1'],
  recentPaperIds: [],
  dataCompleteness: 'partial',
  missingDataReasons: []
}

const result = normalizeConceptLearningView(validLLMOutput, { anchorNodeId: 'n-lo' })
assert.equal(result?.title, 'LoRA: Low-Rank Adaptation')
assert.equal(result?.formalExplanation.formulas[0].latex, 'h = Wx + BAx')
assert.equal(result?.dataCompleteness, 'partial')

const malformed = normalizeConceptLearningView(null, { anchorNodeId: 'n-lo' })
assert.equal(malformed, undefined)

const missingQuick = normalizeConceptLearningView({ ...validLLMOutput, quickExplanation: null }, { anchorNodeId: 'n-lo' })
assert.equal(missingQuick, undefined)

console.log('conceptTeaching tests passed')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx src/main/kg4/conceptTeaching.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write module implementation**

Create `src/main/kg4/conceptTeaching.ts`:

```ts
import type { ConceptLearningView } from '../../shared/kg4'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []
}

const ALLOWED_RELATIONS = new Set(['prerequisite', 'similar', 'contrasts_with', 'used_by', 'variant'])
const ALLOWED_COMPLETENESS = new Set(['complete', 'partial', 'insufficient'])

export function normalizeConceptLearningView(value: unknown, context: { anchorNodeId: string }): ConceptLearningView | undefined {
  if (!isRecord(value)) return undefined

  const id = readString(value.id) ?? `cv_${context.anchorNodeId}`
  const title = readString(value.title)
  if (!title) return undefined

  const qe = isRecord(value.quickExplanation) ? value.quickExplanation : null
  if (!qe) return undefined
  const intuition = readString(qe.intuition)
  const problemSolved = readString(qe.problemSolved)
  const coreMechanism = readString(qe.coreMechanism)
  const whenToUse = readString(qe.whenToUse)
  if (!intuition || !problemSolved || !coreMechanism || !whenToUse) return undefined

  const formalDef = isRecord(value.formalExplanation) ? (readString(value.formalExplanation.definition) ?? '') : ''
  const formulas = isRecord(value.formalExplanation) && Array.isArray(value.formalExplanation.formulas)
    ? (value.formalExplanation.formulas as unknown[]).filter((f): f is NonNullable<ConceptLearningView['formalExplanation']['formulas'][number]> => {
        if (!isRecord(f)) return false
        const latex = readString(f.latex)
        const explanation = readString(f.explanation)
        const variables = Array.isArray(f.variables)
          ? (f.variables as unknown[]).filter((v): v is { symbol: string; meaning: string } => isRecord(v) && readString(v.symbol) !== undefined && readString(v.meaning) !== undefined)
          : []
        return Boolean(latex && explanation && variables.length)
      })
    : []

  const assumptions = isRecord(value.formalExplanation) ? readStringArray(value.formalExplanation.assumptions) : []

  const misconceptions = Array.isArray(value.misconceptions)
    ? (value.misconceptions as unknown[]).filter((m): m is { misconception: string; correction: string } => {
        if (!isRecord(m)) return false
        return Boolean(readString(m.misconception) && readString(m.correction))
      })
    : []

  const relationMap = Array.isArray(value.relationMap)
    ? (value.relationMap as unknown[]).filter((r): r is ConceptLearningView['relationMap'][number] => {
        if (!isRecord(r)) return false
        const label = readString(r.label)
        const relation = readString(r.relation) as ConceptLearningView['relationMap'][number]['relation'] | undefined
        const explanation = readString(r.explanation)
        return Boolean(label && relation && ALLOWED_RELATIONS.has(relation) && explanation)
      })
    : []

  const representativePaperIds = readStringArray(value.representativePaperIds)
  const recentPaperIds = readStringArray(value.recentPaperIds)
  const dataCompleteness = ALLOWED_COMPLETENESS.has(value.dataCompleteness as string) ? value.dataCompleteness as ConceptLearningView['dataCompleteness'] : 'partial'
  const missingDataReasons = readStringArray(value.missingDataReasons)

  return {
    id,
    anchorNodeId: value.anchorNodeId as string ?? context.anchorNodeId,
    title,
    quickExplanation: { intuition, problemSolved, coreMechanism, whenToUse },
    formalExplanation: { definition: formalDef || '', formulas, assumptions },
    misconceptions,
    relationMap,
    representativePaperIds,
    recentPaperIds,
    dataCompleteness,
    missingDataReasons
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx src/main/kg4/conceptTeaching.test.ts`
Expected: `conceptTeaching tests passed`.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`

- [ ] **Step 6: Commit**

```bash
git add src/main/kg4/conceptTeaching.ts src/main/kg4/conceptTeaching.test.ts
git commit -m "feat(expansion): normalize concept learning views"
```

## Task 4: Thread Concept Teaching Into Expansion Flow

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/kg4/lineageRecord.ts`
- Modify: `src/main/kg4/lineageRecord.test.ts`

- [ ] **Step 1: Update lineageRecord.ts to include conceptLearningView**

In `assembleLineageExpansionRecord`, add optional param:

```ts
  conceptLearningView?: import('../../shared/kg4').ConceptLearningView
```

Add to record assembly:

```ts
    conceptLearningView: params.conceptLearningView,
```

- [ ] **Step 2: Add test to lineageRecord.test.ts**

```ts
const conceptView: import('../../shared/kg4').ConceptLearningView = {
  id: 'cv-n1',
  anchorNodeId: 'n1',
  title: 'Testing Concept',
  quickExplanation: {
    intuition: '直观理解。',
    problemSolved: '解决了什么问题。',
    coreMechanism: '核心机制。',
    whenToUse: '什么时候用。'
  },
  formalExplanation: {
    definition: '形式化定义。',
    formulas: [],
    assumptions: []
  },
  misconceptions: [],
  relationMap: [],
  representativePaperIds: ['paper-a'],
  recentPaperIds: [],
  dataCompleteness: 'partial' as const,
  missingDataReasons: []
}

const conceptRecord = assembleLineageExpansionRecord({
  paperId: 'paper-main',
  nodeId: 'n1',
  jobIds: ['job-concept'],
  intent,
  retrievedPapers: [candidate('paper-a', 'Foundation RL Method', longAbstract)],
  conceptLearningView: conceptView
})

assert.equal(conceptRecord.conceptLearningView?.title, 'Testing Concept')
assert.deepEqual(conceptRecord.conceptLearningView?.representativePaperIds, ['paper-a'])
```

- [ ] **Step 3: Run lineageRecord tests**

Run: `npx tsx src/main/kg4/lineageRecord.test.ts` — must pass.

- [ ] **Step 4: Commit lineageRecord changes**

```bash
git add src/main/kg4/lineageRecord.ts src/main/kg4/lineageRecord.test.ts
git commit -m "feat(expansion): store concept learning view in records"
```

- [ ] **Step 5: Add concept teaching flow in index.ts imports**

Add:

```ts
import { normalizeConceptLearningView } from './kg4/conceptTeaching'
```

- [ ] **Step 6: Insert concept teaching branch in kg4:start-expansion**

After the quality annotation and before/around the `expansionIntent.kind === 'generic_related_papers'` check, insert a new branch for `learn_concept`:

```ts
        if (expansionClassification.recommendedPath === 'learn_concept' && candidates.length >= 1) {
          mainWindow.webContents.send('expansion:progress', {
            sessionId,
            jobId,
            step: 'teaching',
            message: '正在生成概念教学解释...'
          })

          const conceptJob = await llmTaskOrchestrator.createJob({
            type: 'teach_concept',
            input: {
              currentNode: {
                id: params.nodeId,
                label: params.nodeLabel,
                searchQueries: params.searchQueries ?? []
              },
              currentPaperInsight: params.paperInsight,
              retrievedPapers: candidates.map((c) => ({
                id: candidatePaperId(c),
                title: c.title,
                year: c.year,
                abstract: c.abstract?.replace(/\s+/g, ' ').trim().slice(0, 300)
              })).slice(0, 6),
              qualitySignals: qualitySignals.slice(0, 8)
            },
            nodeId: params.nodeId,
            paperId: params.paperId,
            relatedPaperIds,
            sessionId,
            model: 'deepseek-v4-pro',
            maxTokens: 8000,
            temperature: 0.1
          })
          jobId = conceptJob.id

          let conceptResult = await llmTaskOrchestrator.runJob(conceptJob.id)
          if (conceptResult.status === 'queued' || conceptResult.status === 'running') {
            conceptResult = await waitForJobTerminalState(conceptJob.id)
          }
          const conceptLearningView = normalizeConceptLearningView(
            conceptResult.status === 'succeeded' || conceptResult.status === 'cache_hit' ? conceptResult.resultJson : undefined,
            { anchorNodeId: params.nodeId }
          )

          const record = assembleLineageExpansionRecord({
            paperId: params.paperId ?? 'current-paper',
            nodeId: params.nodeId,
            jobIds: [classifyJob.id, conceptJob.id],
            intent: expansionIntent,
            classification: expansionClassification,
            retrievedPapers: candidates,
            qualitySignals,
            relatedPaperRecommendations,
            conceptLearningView
          })
          if (!conceptLearningView) {
            record.missingDataReasons = ['概念教学生成失败或输出不完整。']
          }

          mainWindow.webContents.send('expansion:progress', {
            sessionId,
            jobId,
            step: 'persisting',
            message: '正在保存概念教学结果...'
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

Insert this BEFORE the `if (expansionIntent.kind === 'generic_related_papers' || candidates.length < 2)` check.

- [ ] **Step 7: Run typecheck**

Run: `npm run typecheck`

- [ ] **Step 8: Commit**

```bash
git add src/main/index.ts
git commit -m "feat(expansion): add concept teaching flow"
```

## Task 5: Create ConceptLearningView UI

**Files:**
- Create: `src/renderer/src/components/ConceptLearningView.tsx`
- Modify: `src/renderer/src/components/ExpansionGraphView.tsx`
- Modify: `src/renderer/src/styles/panels.css`

- [ ] **Step 1: Create ConceptLearningView component**

Create `src/renderer/src/components/ConceptLearningView.tsx`:

```tsx
import type { ConceptLearningView as ConceptLearningViewType } from '../../../shared/kg4'

interface Props {
  concept: ConceptLearningViewType
  nodeLabel: string
  onSelectPaper?: (paperId: string) => void
}

export function ConceptLearningView({ concept }: Props) {
  return (
    <section className="concept-learning-view">
      <span className="eyebrow">Concept Teaching</span>
      <h3>{concept.title}</h3>

      <section className="concept-learning-view__grid">
        <article className="concept-card concept-card--quick">
          <h4>Quick Understanding</h4>
          <div className="concept-card__block">
            <strong>直觉 / Intuition</strong>
            <p>{concept.quickExplanation.intuition}</p>
          </div>
          <div className="concept-card__block">
            <strong>解决什么问题</strong>
            <p>{concept.quickExplanation.problemSolved}</p>
          </div>
          <div className="concept-card__block">
            <strong>核心机制</strong>
            <p>{concept.quickExplanation.coreMechanism}</p>
          </div>
          <div className="concept-card__block">
            <strong>适用场景</strong>
            <p>{concept.quickExplanation.whenToUse}</p>
          </div>
        </article>

        <article className="concept-card concept-card--formal">
          <h4>Formal View</h4>
          {concept.formalExplanation.definition ? (
            <div className="concept-card__block">
              <strong>定义</strong>
              <p>{concept.formalExplanation.definition}</p>
            </div>
          ) : null}
          {concept.formalExplanation.formulas.map((formula, idx) => (
            <div className="concept-card__block concept-card__formula" key={idx}>
              <code>{formula.latex}</code>
              <p>{formula.explanation}</p>
              {formula.variables.length ? (
                <table className="concept-card__variables">
                  <tbody>
                    {formula.variables.map((v) => (
                      <tr key={v.symbol}>
                        <td><code>{v.symbol}</code></td>
                        <td>{v.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          ))}
          {concept.formalExplanation.assumptions.length ? (
            <div className="concept-card__block">
              <strong>假设条件</strong>
              <ul>
                {concept.formalExplanation.assumptions.map((a, idx) => <li key={idx}>{a}</li>)}
              </ul>
            </div>
          ) : null}
        </article>

        {concept.misconceptions.length ? (
          <article className="concept-card concept-card--misconceptions">
            <h4>常见误区</h4>
            {concept.misconceptions.map((m, idx) => (
              <div className="concept-card__block concept-card__misconception" key={idx}>
                <strong>{m.misconception}</strong>
                <p>{m.correction}</p>
              </div>
            ))}
          </article>
        ) : null}

        {concept.relationMap.length ? (
          <article className="concept-card concept-card--relations">
            <h4>Related Concepts</h4>
            {concept.relationMap.map((r, idx) => (
              <div className="concept-card__block" key={idx}>
                <span className="concept-card__relation-tag">{r.relation}</span>
                <strong>{r.label}</strong>
                <p>{r.explanation}</p>
              </div>
            ))}
          </article>
        ) : null}

        <article className="concept-card concept-card--papers">
          <h4>Papers</h4>
          {concept.representativePaperIds.length ? (
            <div className="concept-card__block">
              <strong>代表论文</strong>
              <p>{concept.representativePaperIds.length} 篇</p>
            </div>
          ) : null}
          {concept.recentPaperIds.length ? (
            <div className="concept-card__block">
              <strong>近期相关论文</strong>
              <p>{concept.recentPaperIds.length} 篇</p>
            </div>
          ) : null}
        </article>

        {concept.missingDataReasons.length ? (
          <article className="concept-card concept-card--missing">
            <h4>Missing</h4>
            <ul>
              {concept.missingDataReasons.map((reason, idx) => <li key={idx}>{reason}</li>)}
            </ul>
          </article>
        ) : null}
      </section>
    </section>
  )
}
```

- [ ] **Step 2: Integrate into ExpansionGraphView**

In `ExpansionGraphView.tsx`, add import:

```tsx
import { ConceptLearningView } from './ConceptLearningView'
```

After the `ExpansionRouteHeader` line and before the method lineage display (or after lineage if lineage is absent), add:

```tsx
      {record?.conceptLearningView ? (
        <ConceptLearningView concept={record.conceptLearningView} nodeLabel={session.nodeLabel} />
      ) : null}
```

- [ ] **Step 3: Add styles**

Append to `src/renderer/src/styles/panels.css`:

```css
.concept-learning-view {
  display: grid;
  gap: 16px;
  padding-top: 8px;
}

.concept-learning-view h3 {
  color: #0f172a;
  margin: 0;
}

.concept-learning-view__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
}

.concept-card {
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
}

.concept-card h4 {
  margin: 0 0 12px;
  color: #0f172a;
  font-size: 16px;
}

.concept-card__block {
  margin-bottom: 12px;
}

.concept-card__block strong {
  color: #475569;
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.concept-card__block p {
  color: #334155;
  margin: 0;
  line-height: 1.6;
}

.concept-card--quick {
  border-left: 4px solid #3b82f6;
}

.concept-card--formal {
  border-left: 4px solid #8b5cf6;
}

.concept-card--misconceptions {
  border-left: 4px solid #f59e0b;
}

.concept-card__misconception {
  padding: 10px 12px;
  border-radius: 10px;
  background: #fff7ed;
}

.concept-card__misconception strong {
  color: #c2410c;
}

.concept-card--relations {
  border-left: 4px solid #10b981;
}

.concept-card__relation-tag {
  display: inline-block;
  border-radius: 999px;
  padding: 2px 8px;
  background: #ecfdf5;
  color: #047857;
  font-size: 11px;
  font-weight: 700;
  margin-right: 8px;
  text-transform: lowercase;
}

.concept-card--papers {
  border-left: 4px solid #0ea5e9;
}

.concept-card--missing {
  border-left: 4px solid #94a3b8;
}

.concept-card__formula {
  padding: 12px;
  border-radius: 10px;
  background: #f8fafc;
  font-family: monospace;
}

.concept-card__formula code {
  display: block;
  color: #1e293b;
  margin-bottom: 8px;
  font-size: 15px;
  overflow-x: auto;
  white-space: pre-wrap;
}

.concept-card__variables {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
}

.concept-card__variables td {
  padding: 4px 8px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 13px;
  color: #475569;
}

.concept-card__variables td:first-child {
  font-family: monospace;
  font-weight: 700;
  color: #1e293b;
  width: 64px;
}

.concept-card__block ul {
  margin: 4px 0 0;
  padding-left: 18px;
  color: #64748b;
}

.concept-card__block li {
  margin-bottom: 4px;
  line-height: 1.5;
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/ConceptLearningView.tsx src/renderer/src/components/ExpansionGraphView.tsx src/renderer/src/styles/panels.css
git commit -m "feat(expansion): render concept teaching view"
```

## Task 6: Final Verification

**Files:**
- All files touched in Tasks 1-5.

- [ ] **Step 1: Run focused tests**

```bash
npx tsx src/main/kg4/conceptTeaching.test.ts
npx tsx src/main/kg4/expansionClassification.test.ts
npx tsx src/main/kg4/paperQuality.test.ts
npx tsx src/main/kg4/lineageRecord.test.ts
npx tsx src/main/llm/orchestrator.test.ts
npx tsx src/main/retrieval/retrievalTest.test.ts
npx tsx src/main/retrieval/paperSearch.test.ts
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck` — must pass.

- [ ] **Step 3: Inspect diff**

Run: `git diff --stat <base-commit>..HEAD`
Expected: changes limited to KG4 shared types, concept teaching module/tests, LLM prompt/validation, index.ts concept branch, concept UI component, and panels.css.

If fixes were needed, commit with `fix(expansion): polish concept teaching`.
