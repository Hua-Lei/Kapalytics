# KG 4.0 正式需求文档

## 1. 目标

KG 4.0 的目标是把现有 Node Expansion 从“相关论文 + 对比表 + 迁移任务”升级为“节点驱动的领域认知与算法思想对比工作台”。

用户点击 `field` / `concept` / `method` 节点后，系统不只展示论文列表，而是帮助用户完成以下学习链路：

```text
节点展开
→ 检索可验证论文
→ 抽取算法思想
→ 生成临时扩展子图
→ 选择 2-3 个算法思想对比
→ 用户写下理解
→ AI 生成 reflective 或 remedial feedback
→ 用户确认保存为 Node Understanding Memory
→ 可选生成迁移任务或提出图谱融合建议
```

KG 4.0 必须继续服务 Kapalytics 的核心目标：通过论文深度学习 AI 知识，而不是泛化成论文推荐工具。

## 2. 现有结构接入点

当前项目已有可复用基础：

| 能力 | 现有位置 | KG4 接入方式 |
|---|---|---|
| 图谱节点与论文结构 | `src/shared/paper.ts`、`src/shared/kg3.ts` | 扩展 KG4 数据类型，保留 KG3 结构兼容 |
| Node Expansion UI | `src/renderer/src/components/NodeDetailPanel.tsx` | 从右侧卡片扩展为工作台入口，同时推动扩展节点进入图谱视图 |
| 图谱渲染 | `src/renderer/src/components/KnowledgeGraph.tsx` | 增加 temporary expansion nodes / edges 渲染层 |
| mock Node Expansion | `src/renderer/src/modules/learning/nodeExpansion.ts` | 可作为 dev fixture；生产路径应改为 KG3 IPC 检索和 LLM job |
| 论文检索 | `src/main/retrieval/paperSearch.ts` | 已有 local / arXiv / OpenAlex / Semantic Scholar provider 和去重排序 |
| LLM 任务编排 | `src/main/llm/orchestrator.ts` | 扩展 `LLMJobType`，新增 KG4 task types，不在 UI 直接调用 LLM |
| 长期记忆 | `src/main/memory/kg3Repository.ts` | 新增 Node Understanding Memory、Algorithm Idea、Expansion Graph 等 JSON 记录 |
| 图谱融合 | `src/main/memory/graphFusion.ts` | 从自动轻量融合扩展为“建议融合”，由用户确认 |
| IPC | `src/shared/electron-api.ts`、`src/preload/index.ts`、`src/main/index.ts` | 需要新增 KG4 专用 IPC；目前不存在，不可假设已可调用 |

本需求不要求直接修改业务代码，但后续实现必须沿用这些边界。

## 3. 数据结构

KG4 在 KG3 基础上新增以下核心对象。建议先加入 `src/shared/kg4.ts`，再由 `src/shared/kg3.ts` 按需引用或逐步迁移，避免继续膨胀 KG3 文件。

### 3.1 Expansion Graph

```ts
export type ExpansionNodeType =
  | 'related_paper'
  | 'algorithm_idea'
  | 'method_family'
  | 'prerequisite_concept'
  | 'open_problem'

export interface ExpansionGraphNode {
  id: string
  type: ExpansionNodeType
  label: string
  description: string
  sourcePaperIds: string[]
  isTemporary: boolean
  visualStyle?: 'faded' | 'highlighted' | 'normal'
}

export type ExpansionRelation =
  | 'same_problem_different_method'
  | 'extends'
  | 'contrasts_with'
  | 'uses_as_foundation'
  | 'solves_limitation_of'
  | 'shares_assumption_with'
  | 'requires_prerequisite'

export interface ExpansionGraphEdge {
  id: string
  sourceId: string
  targetId: string
  relation: ExpansionRelation
  explanation: string
}
```

### 3.2 Algorithm Idea Card

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
  strength: string
  limitation: string
  relationToCurrentNode:
    | 'same_problem_different_method'
    | 'predecessor'
    | 'parallel'
    | 'successor'
    | 'foundation'
    | 'variant'
  relationExplanation: string
}
```

`paperTitle` 只能从 `PaperSearchResult`、`PaperRecord` 或 deduped candidate 复制，不能由 LLM 生成。

### 3.3 Field Cognition View

```ts
export interface FieldCognitionView {
  id: string
  nodeId: string
  fieldTitle: string
  currentDirection: string
  coreProblems: string[]
  methodFamilies: Array<{
    id: string
    label: string
    description: string
    representativePaperIds: string[]
    isCurrentPaperRoute: boolean
  }>
  prerequisiteConcepts: string[]
  insufficientInformation?: string
}
```

### 3.4 KG4 Node Expansion Record

建议不覆盖 KG3 `NodeExpansionRecord`，而是新增或扩展字段：

```ts
export interface Kg4NodeExpansionRecord {
  id: string
  paperId: string
  nodeId: string
  retrievedPaperIds: string[]
  algorithmIdeaCards: AlgorithmIdeaCard[]
  expansionGraphNodes: ExpansionGraphNode[]
  expansionGraphEdges: ExpansionGraphEdge[]
  fieldCognitionView?: FieldCognitionView
  dataCompleteness: 'complete' | 'partial' | 'insufficient'
  missingDataReasons: string[]
  generatedByJobIds: string[]
  createdAt: string
  updatedAt: string
}
```

## 4. 流程

### 4.1 用户触发

用户在 `KnowledgeGraph.tsx` 中点击可扩展节点，右侧 `NodeDetailPanel.tsx` 显示 KG4 工作台入口。

可扩展节点仍沿用现有规则：

```ts
expandable: true
expansionType?: 'field_overview' | 'related_papers' | 'method_evolution' | 'comparison'
searchQueries: string[]
```

### 4.2 检索

调用现有 `searchPapers(query)`：

```text
currentNode.label / searchQueries / insight
→ PaperSearchQuery
→ local + arXiv + OpenAlex + Semantic Scholar
→ PaperSearchResult[]
→ DedupedPaperCandidate[]
```

无结果时不调用 LLM 生成论文，只返回空状态。

### 4.3 LLM 任务链

扩展 `LLMJobType`，新增任务：

```ts
type Kg4LLMTaskType =
  | 'expand_node_retrieve_context'
  | 'extract_algorithm_ideas'
  | 'build_field_cognition_map'
  | 'generate_expansion_graph'
  | 'compare_algorithm_ideas'
  | 'generate_reflective_feedback'
  | 'generate_remedial_lesson'
  | 'suggest_graph_fusion'
  | 'generate_optional_transfer_task'
```

实现时可先把 KG4 task type 合并进 `src/shared/kg3.ts` 的 `LLMJobType`，或新建 `kg4.ts` 后让 orchestrator 支持联合类型。

### 4.4 保存

KG4 结果写入长期记忆层。现有 repository 有 JSON table 和 SQLite JSON blob 模式，但没有 KG4 专表。实现选择：

1. MVP：扩展 `node_expansions.json` 字段，保存 KG4 expansion payload。
2. 正式：新增 `kg4_node_expansions`、`algorithm_idea_cards`、`node_understanding_memories`、`graph_fusion_suggestions` 表。

## 5. UI 影响

### 5.1 Graph View

`KnowledgeGraph.tsx` 需要支持临时扩展层：

```text
主图谱节点：原颜色、高亮当前节点
扩展节点：浅色、虚线边、temporary badge
扩展关系：显示 relation label 和 explanation tooltip
```

临时节点不能写回 `graph.nodes` 主数组，除非用户确认融合。

### 5.2 Node Detail Panel

`NodeDetailPanel.tsx` 当前已有 Direction Map、Method Evolution、Comparison Workspace。KG4 应调整为三段：

```text
A. 扩展图谱区
B. 算法思想对比区
C. 理解记录与反馈区
```

迁移任务按钮保留，但标为 optional，不作为主流程 CTA。

### 5.3 Loading / Error

需要展示 provider-level 和 job-level 状态：

```text
正在检索本地论文库...
正在查询 arXiv...
正在抽取算法思想...
正在生成临时扩展子图...
正在校验引用论文来源...
```

失败时提供重试、取消、使用已有缓存、查看空状态。

## 6. Prompt 约束

所有 KG4 prompt 必须包含硬约束：

```text
你只能使用输入中的 currentPaper、currentNode、retrievedPapers、paperAnalyses、userReflection。
不得编造论文标题、作者、年份、venue、实验结果、引用或 externalId。
输出中引用的 paperId 必须存在于 retrievedPapers 或 currentPaper。
如果信息不足，请返回 insufficient_information，并说明缺少哪些字段。
```

算法思想抽取必须覆盖：

```text
problemSetting, coreIdea, keyAssumption, mechanism,
objectiveOrUpdateRule, strength, limitation, relationToCurrentNode
```

## 7. 验收标准

1. 用户点击 expandable 节点后，能获得 KG4 expansion 结果或明确 insufficient state。
2. 相关论文必须来自 `searchPapers`、local library 或显式 dev fixture。
3. LLM 输出不能新增论文元数据。
4. 每篇进入工作台的论文都能追溯 `source`、`url`、`externalId`。
5. 扩展节点以 temporary / faded 样式显示，不污染主图谱。
6. Algorithm Idea Card 不只是摘要，必须包含问题、思想、假设、机制、目标、优势、局限。
7. Field Cognition View 不出现“代表方法类别”这类占位符。
8. 用户可以选择 2-3 个算法思想做对比。
9. 用户可以写理解，并收到 reflective 或 remedial feedback。
10. 用户确认后才保存 Node Understanding Memory。
11. 迁移任务为 optional。
12. 图谱融合只能生成建议，用户确认后才写入长期图谱。
13. 原阶段学习闭环和 `transfer_comparison` 不被删除。

## 8. 风险与 fallback

| 风险 | fallback |
|---|---|
| 外部检索 API 失败 | 使用 local provider；无结果时展示空状态 |
| LLM 输出编造论文 | orchestrator validation 标记 `hallucinated_paper` 并失败 |
| 抽取信息不足 | 返回 `insufficient_information`，不生成占位卡 |
| 扩展节点过多污染视图 | 限制 MVP 5-8 个 expansion nodes，提供清除按钮 |
| KG4 schema 过早固化 | 先使用 JSON blob，稳定后拆专表 |
| UI 复杂度过高 | 第一阶段保留右侧工作台，图谱只显示浅色节点和关系 |
| 与 KG3 迁移任务重复 | 迁移入口降级到 optional CTA |
