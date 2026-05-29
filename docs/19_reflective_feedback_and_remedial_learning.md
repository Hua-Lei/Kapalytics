# Reflective Feedback 与 Remedial Learning 设计文档

## 1. 目标

KG4 的反馈系统把现有“答题诊断”扩展为两类反馈：

1. Reflective Feedback：研究导师式反馈，适用于用户比较算法思想、总结方法差异、提出判断或疑问。
2. Remedial Learning：基础知识补齐型反馈，适用于用户暴露出前置概念缺失或概念混淆。

目标不是简单判断“正确/错误”，而是帮助用户把节点理解沉淀为可复用的研究理解。

## 2. 现有结构接入点

| 模块 | 现有位置 | KG4 接入方式 |
|---|---|---|
| 阶段诊断 | `src/renderer/src/modules/diagnosis/diagnose.ts`、`src/main/llm/generate.ts` | 保留用于阶段学习和 optional transfer task |
| 诊断数据 | `DiagnosisRecord` in `src/shared/kg3.ts` | 不直接复用为 KG4 反馈，因为 KG4 不一定有 correct/incorrect |
| LLM 编排 | `src/main/llm/orchestrator.ts` | 新增 `generate_reflective_feedback`、`generate_remedial_lesson` |
| UI | `NodeDetailPanel.tsx` | 新增用户理解输入、反馈结果和保存按钮 |
| 长期记忆 | `kg3Repository.ts` | 反馈摘要进入 Node Understanding Memory |

现有 `DiagnosisRecord` 含 `isCorrect`、`errorType`、`remedialTask`，适合传统作答诊断；KG4 需要新增 feedback 结构，避免强行塞入正确/错误语义。

## 3. 数据结构

### 3.1 用户理解输入

```ts
export interface NodeReflectionInput {
  id: string
  paperId: string
  nodeId: string
  selectedIdeaCardIds: string[]
  comparisonWorkspaceId?: string
  userReflection: string
  createdAt: string
}
```

### 3.2 Reflective Feedback

```ts
export interface ReflectiveFeedback {
  id: string
  type: 'reflective'
  paperId: string
  nodeId: string
  selectedIdeaCardIds: string[]
  strengths: string[]
  missingDimensions: string[]
  possibleCounterArguments: string[]
  evidenceFromPapers: Array<{
    paperId: string
    evidence: string
  }>
  followUpQuestions: string[]
  suggestedUnderstandingNote: string
  generatedByJobId?: string
  createdAt: string
}
```

### 3.3 Remedial Lesson

```ts
export interface RemedialLesson {
  id: string
  type: 'remedial'
  paperId: string
  nodeId: string
  missingPrerequisite: string
  whyItMattersForCurrentNode: string
  shortExplanation: string
  visualExplanation?: string
  example?: string
  formulaOrPseudoCode?: string
  recommendedPapers: string[]
  recommendedArticles: string[]
  checkQuestion: string
  generatedByJobId?: string
  createdAt: string
}
```

`recommendedPapers` 只能引用 retrieved papers、current paper 或 local library。外部 article 推荐如果没有内置资料库，MVP 应为空数组。

### 3.4 Feedback Decision

```ts
export interface FeedbackModeDecision {
  mode: 'reflective' | 'remedial'
  reason: string
  prerequisiteGap?: string
  confidence: number
}
```

MVP 可由 `generate_reflective_feedback` 任务同时判断模式；如果判定为 remedial，再调用 `generate_remedial_lesson`。

## 4. 流程

### 4.1 用户写下理解

用户在 Algorithm Idea Workbench 对比后输入：

```text
我认为 Paper A 和当前论文的主要差异是……
```

输入与当前上下文绑定：

```text
currentPaper
currentNode
selectedIdeaCards
comparisonRows
reflectionQuestions
userReflection
```

### 4.2 判断反馈模式

LLM 先做轻量判断：

```text
如果用户能使用方法假设、更新对象、机制、适用场景等研究维度，只是遗漏部分比较点 → reflective。
如果用户混淆基础概念、无法解释关键机制、把相近概念误作同一对象 → remedial。
```

### 4.3 Reflective Feedback

任务：`generate_reflective_feedback`

输出必须包含：

```text
亮点
遗漏维度
可能反驳
论文证据
后续问题
建议保存的理解笔记
```

不得使用简单“正确/错误”。

### 4.4 Remedial Lesson

任务：`generate_remedial_lesson`

输出必须包含：

```text
缺失前置知识
为什么影响当前节点理解
简短解释
例子或图示
检查问题
```

如果需要推荐论文，只能引用已检索或已上传论文。

### 4.5 用户确认保存

反馈生成后，UI 展示建议理解笔记。用户可以编辑或确认保存为 Node Understanding Memory。

## 5. UI 影响

### 5.1 Workbench Feedback Panel

新增右侧或工作台底部区域：

```text
你的理解
AI 反馈类型 badge
反馈内容
建议理解笔记
保存到长期记忆
可选：生成迁移任务
```

### 5.2 Reflective UI

展示结构：

```text
你抓住了什么
还缺哪些比较维度
可能的反驳
可回到哪些论文证据
下一步思考问题
```

### 5.3 Remedial UI

展示结构：

```text
你可能缺少的基础概念
为什么它影响当前节点
3-5 句话解释
图示 / 伪代码 / 例子
检查问题
```

### 5.4 与现有诊断区分

现有 `RightLearningPanel` 的阶段诊断仍用于 stage tasks。KG4 feedback 嵌在 Node Expansion Workbench，不直接改变 stage status，除非用户点击 optional transfer task。

## 6. Prompt 约束

### 6.1 共同约束

```text
你只能使用输入中的 currentPaper、currentNode、selectedIdeaCards、comparisonRows、retrievedPapers、userReflection。
不得引用未提供论文或未检索资料。
不得编造实验结论、论文标题、作者、年份、venue。
如果证据不足，请明确写“证据不足”。
```

### 6.2 Reflective Feedback Prompt

```text
请以研究导师风格反馈用户对算法思想差异的理解。
不要给简单正确/错误。
必须指出用户理解中合理的部分。
必须指出遗漏的比较维度，例如关键假设、更新对象、机制流程、优化目标、适用场景、失败条件。
必须给出可能的反驳或边界条件。
论文证据只能来自 selectedIdeaCards 或 currentPaper。
最后生成一段 suggestedUnderstandingNote，供用户保存。
```

### 6.3 Remedial Lesson Prompt

```text
请判断用户缺少哪个 prerequisite。
解释为什么该 prerequisite 对 currentNode 重要。
用简短解释、例子、图示或伪代码补齐。
给一个检查问题。
推荐资料必须来自已检索论文或内置资料库；如果没有，返回空数组。
```

## 7. 验收标准

1. 用户提交理解后，系统能返回 reflective 或 remedial 类型。
2. Reflective feedback 不使用简单正确/错误判断。
3. Reflective feedback 必须包含 strengths、missingDimensions、followUpQuestions。
4. Remedial lesson 必须包含 missingPrerequisite、whyItMatters、shortExplanation、checkQuestion。
5. 反馈中引用的 paperId 必须来自 selected idea cards 或 current paper。
6. 推荐论文不能来自 LLM 编造。
7. 用户可以确认或编辑 suggestedUnderstandingNote 后保存。
8. 不会自动改变阶段学习状态。
9. Optional transfer task 仍可接入 `transfer_comparison`。

## 8. 风险与 fallback

| 风险 | fallback |
|---|---|
| 反馈模式判断错误 | UI 允许用户切换“我需要基础讲解 / 我想要研究反馈” |
| 用户输入太短 | 要求补充理解，或只返回 follow-up question |
| LLM 引用未知论文 | validation 失败，提示重新生成 |
| Remedial 推荐资料不足 | recommendedPapers / recommendedArticles 返回空数组 |
| 反馈太像评分 | prompt 禁止 correct/incorrect，UI 不展示分数 |
| 与 DiagnosisRecord 重叠 | KG4 feedback 独立保存，只在 optional transfer task 后进入 DiagnosisRecord |
