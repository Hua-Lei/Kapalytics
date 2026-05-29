# Algorithm Idea Workbench 设计文档

## 1. 目标

Algorithm Idea Workbench 用于把 Node Expansion 中的“相关论文”转化为“算法思想卡”和“多方法对比工作台”。

它解决三个问题：

1. 相关论文不能只是列表，必须抽象成可学习的算法思想。
2. 用户需要看出不同论文面对同一或相邻问题时的机制差异。
3. 对比结果要引导用户形成自己的研究判断，而不是直接进入迁移任务。

MVP 应优先支持 `field` / `concept` / `method` 节点。

## 2. 现有结构接入点

| 模块 | 现有位置 | 改造说明 |
|---|---|---|
| mock expansion | `src/renderer/src/modules/learning/nodeExpansion.ts` | 目前含 `RelatedPaperV2`、DirectionMap、ComparisonWorkspace，可作为 UI fixture |
| 真实检索 | `src/main/retrieval/paperSearch.ts` | 生产数据入口，返回 `DedupedPaperCandidate[]` |
| 共享类型 | `src/shared/paper.ts`、`src/shared/kg3.ts` | 新增 `AlgorithmIdeaCard`、`AlgorithmIdeaComparisonWorkspace` |
| UI 面板 | `src/renderer/src/components/NodeDetailPanel.tsx` | 现有 ComparisonWorkspaceView 改造成 2-3 card 多选工作台 |
| LLM job | `src/main/llm/orchestrator.ts` | 新增 `extract_algorithm_ideas` 和 `compare_algorithm_ideas` |
| IPC | `src/shared/electron-api.ts` 等 | 当前只有 `kg3.searchPapers` 和 LLM job 基础接口，需要新增 KG4 工作台接口 |

不要在 `NodeDetailPanel.tsx` 中直接调用 `callLlm`。UI 只能通过 IPC 请求 main process 的检索和 orchestrator。

## 3. 数据结构

### 3.1 AlgorithmIdeaCard

```ts
export interface AlgorithmIdeaCard {
  id: string
  paperId: string
  paperTitle: string
  problemSetting: string
  coreIdea: string
  keyAssumption: string
  mechanism: string
  objectiveOrUpdateRule?: string
  updatedObject?: string
  strength: string
  limitation: string
  bestUseCase?: string
  relationToCurrentNode:
    | 'same_problem_different_method'
    | 'predecessor'
    | 'parallel'
    | 'successor'
    | 'foundation'
    | 'variant'
  relationExplanation: string
  evidenceSource: {
    paperId: string
    source: 'arxiv' | 'semantic_scholar' | 'openalex' | 'local_library' | 'mock'
    url?: string
    externalId?: string
  }
  insufficientInformation?: string
}
```

`paperTitle`、`source`、`url`、`externalId` 必须从检索结果复制。LLM 只允许生成算法解释字段。

### 3.2 Comparison Workspace

```ts
export type AlgorithmIdeaComparisonDimension =
  | 'research_problem'
  | 'core_idea'
  | 'key_assumption'
  | 'mechanism_flow'
  | 'objective_or_update_rule'
  | 'updated_object'
  | 'strength'
  | 'limitation'
  | 'best_use_case'
  | 'relation_to_current_paper'

export interface AlgorithmIdeaComparisonCell {
  ideaCardId: string
  value: string
  evidencePaperId: string
}

export interface AlgorithmIdeaComparisonRow {
  dimension: AlgorithmIdeaComparisonDimension
  label: string
  currentNodeOrPaper: string
  selectedIdeas: AlgorithmIdeaComparisonCell[]
  contrastInsight: string
}

export interface AlgorithmIdeaComparisonWorkspace {
  id: string
  nodeId: string
  currentPaperId: string
  ideaCards: AlgorithmIdeaCard[]
  selectedIdeaCardIds: string[]
  comparisonRows: AlgorithmIdeaComparisonRow[]
  reflectionQuestions: string[]
  generatedByJobId?: string
  insufficientInformation?: string
}
```

### 3.3 Field Cognition View

```ts
export interface FieldCognitionView {
  id: string
  nodeId: string
  fieldTitle: string
  coreProblemSummary: string
  methodFamilies: Array<{
    id: string
    label: string
    ideaCardIds: string[]
    representativePaperIds: string[]
    isCurrentPaperRoute: boolean
    routeExplanation: string
  }>
  prerequisiteConcepts: Array<{
    label: string
    whyNeeded: string
  }>
}
```

## 4. 流程

### 4.1 检索到候选论文

```text
currentNode
→ construct PaperSearchQuery
→ searchPapers(query)
→ DedupedPaperCandidate[]
→ filter candidates with source/url/externalId/abstract or local fulltext
```

如果候选论文没有 abstract 或本地 fulltext，允许进入卡片但标注 `insufficientInformation`，不允许 LLM 补实验细节。

### 4.2 抽取 Algorithm Idea Cards

任务：`extract_algorithm_ideas`

输入：

```ts
interface ExtractAlgorithmIdeasInput {
  currentPaper: PaperRecord | null
  currentNode: GraphNodeRecord
  currentPaperInsight?: PaperInsightRecord
  retrievedPapers: DedupedPaperCandidate[]
}
```

输出：

```ts
interface ExtractAlgorithmIdeasOutput {
  ideaCards: AlgorithmIdeaCard[]
  insufficientPaperIds: string[]
}
```

校验：

```text
ideaCards[].paperId 必须来自 retrievedPapers.canonicalId 或 mergedFrom[].id。
ideaCards[].paperTitle 必须等于候选论文标题。
source/url/externalId 必须来自 provider result。
```

### 4.3 构建领域认知视图

任务：`build_field_cognition_map`

输入：current node + idea cards + current paper insight。

输出：方法路线、当前论文所属路线、其他代表路线、缺失前置概念。

约束：不能输出“代表方法类别”“相关概念分支”等占位词；每个 method family 必须能追溯到 idea card 或 current node。

### 4.4 选择 2-3 个算法思想

UI 支持多选：

```text
默认选择与当前节点关系最强的 2 张卡
用户可手动改选
最多 3 张
少于 2 张时不生成正式对比，只展示单卡阅读状态
```

### 4.5 生成对比表和研究问题

任务：`compare_algorithm_ideas`

输出：

```text
研究问题
核心思想
关键假设
机制流程
优化目标 / 更新规则
更新对象
优势
局限
适用场景
与当前论文关系
```

对比后生成 2-4 个 reflection questions，而不是自动生成迁移任务。

## 5. UI 影响

### 5.1 NodeDetailPanel

`ComparisonWorkspaceView` 应拆为：

```text
AlgorithmIdeaCardGrid
SelectedIdeaTray
AlgorithmIdeaComparisonTable
ReflectionQuestionPanel
OptionalTransferTaskEntry
```

卡片展示字段：

```text
问题设置
核心思想
关键假设
机制
更新对象 / 目标
优势
局限
与当前节点关系
来源
```

### 5.2 KnowledgeGraph

当 idea cards 生成后，`KnowledgeGraph.tsx` 可显示临时节点：

```text
method_family node
→ algorithm_idea node
→ related_paper node
```

扩展节点应浅色、低 opacity、虚线边，当前原节点保持高亮。

### 5.3 Empty State

必须区分：

```text
没有检索结果
检索结果缺少摘要或全文
LLM 输出校验失败
用户未选择足够算法思想
```

## 6. Prompt 约束

### 6.1 Algorithm Idea Extraction

```text
你只能基于输入中的 retrievedPapers、currentPaper、currentNode 和 paperAnalyses 生成算法思想卡。
不得新增论文标题、作者、年份、venue、url、externalId。
paperTitle 必须原样复制输入候选论文的 title。
如果某篇论文缺少 abstract/fulltext，不要猜测机制或实验结果，返回 insufficientInformation。
每张卡必须回答：问题、核心思想、关键假设、机制、更新目标或对象、优势、局限、与当前节点关系。
```

### 6.2 Comparison

```text
你只能比较输入中的 currentNode/currentPaper 和 selectedIdeaCards。
不得引用未选中的论文作为证据。
如果对比维度没有证据，请写“信息不足”，不要补充常识性猜测。
contrastInsight 必须指出具体机制差异，而不是泛泛说“方法不同”。
```

## 7. 验收标准

1. 每篇进入工作台的相关论文都有可追溯 source。
2. Algorithm Idea Card 至少覆盖问题、核心思想、假设、机制、优势、局限。
3. 信息不足时显示 insufficient state，不出现虚构机制。
4. 用户能选择 2-3 张卡进行对比。
5. 对比表覆盖 10 个指定维度。
6. 对比表中每个 related paper 单元格能追溯 `ideaCardId` 和 `paperId`。
7. 生成 reflection questions，迁移任务不是默认主 CTA。
8. Field Cognition View 的方法路线来自真实 cards 和 current node。
9. 扩展图谱节点可清除，默认不写入长期图谱。

## 8. 风险与 fallback

| 风险 | fallback |
|---|---|
| 检索论文摘要太短 | 卡片标记 insufficient，允许用户导入 PDF 或换 provider |
| 多篇论文同名或重复 | 使用 `dedupeAndRankResults` 合并，保留 external IDs |
| LLM 输出 title 字段不可信 | validation 要求 title 与候选完全匹配，否则失败 |
| 用户选择少于 2 张卡 | 展示单卡阅读引导，不生成对比表 |
| 对比变成模板空话 | prompt 要求每行给 `contrastInsight`，并引用 selected idea field |
| UI 信息过密 | 默认折叠假设/目标字段，展开查看完整卡 |
