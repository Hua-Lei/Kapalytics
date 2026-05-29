# KG 4.0 迭代计划

## 1. 目标

本迭代计划把 KG4 拆成可独立交付的垂直切片，避免一次性改动过大。

总体目标：

```text
可验证论文检索
→ 算法思想卡
→ 临时扩展图谱
→ 思想对比工作台
→ 双模式反馈
→ Node Understanding Memory
→ 用户确认式图谱融合
```

原则：

1. 不删除 KG3 已有学习闭环。
2. 不让 LLM 编造论文。
3. 每一阶段都能展示可用 UI 或明确 empty state。
4. 先通过 JSON blob 和现有 repository 快速验证，再拆专表。
5. 迁移任务保留为 optional，不再主导 Node Expansion。

## 2. 现有基础

当前项目已具备：

| 基础 | 文件 | 可复用程度 |
|---|---|---|
| 可扩展节点字段 | `src/shared/paper.ts` | 可直接复用 |
| Node Detail Expansion UI | `NodeDetailPanel.tsx` | 需改造 |
| Graph UI | `KnowledgeGraph.tsx` | 需增加 temporary layer |
| mock related papers | `nodeExpansion.ts` | dev fixture，可保留 |
| real search providers | `paperSearch.ts` | 可直接接入 KG4 retrieval |
| LLM orchestrator | `orchestrator.ts` | 需扩展 task type 和 validation |
| SQLite / JSON repository | `kg3Repository.ts` | 需新增 KG4 records |
| rule-based graph fusion | `graphFusion.ts` | 需改为 suggestion-first |
| IPC shell | `electron-api.ts`、`preload/index.ts`、`main/index.ts` | 需新增 KG4 API |

## 3. 全局设计要素

### 3.1 数据结构

KG4 迭代会逐步引入以下结构：

```text
ExpansionGraphNode / ExpansionGraphEdge
AlgorithmIdeaCard
AlgorithmIdeaComparisonWorkspace / AlgorithmIdeaComparisonRow
ReflectiveFeedback / RemedialLesson
NodeUnderstandingMemory / MemoryReuseSuggestion
GraphFusionSuggestion
```

这些结构先服务 Node Expansion 工作台，不直接替换 KG3 的 `GraphNodeRecord`、`NodeExpansionRecord`、`DiagnosisRecord`。MVP 可以先保存为 JSON blob；稳定后再拆专表和 repository 方法。

### 3.2 流程

全局流程保持为：

```text
节点点击
→ 真实检索或显式 dev fixture
→ LLM task orchestrator 抽取/对比/反馈
→ UI 展示扩展图谱、算法思想卡、对比表和理解输入
→ 用户确认保存理解记忆
→ 可选迁移任务或图谱融合建议
```

### 3.3 UI 影响

主要改造集中在：

```text
KnowledgeGraph.tsx：temporary expansion layer
NodeDetailPanel.tsx：KG4 workbench
RightLearningPanel.tsx：只保留阶段学习和 optional transfer task 接入
```

### 3.4 Prompt 约束

所有 KG4 LLM 任务都必须遵守：

```text
只能使用输入中的 currentPaper、currentNode、retrievedPapers、selectedIdeaCards、userReflection 和已有 memory。
不得编造论文元数据、实验结果、引用或外部资料。
信息不足时返回 insufficient information，不生成占位内容。
```

### 3.5 验收标准

每个迭代都必须通过以下检查：

1. 不破坏 KG3 已有学习闭环。
2. 不让 LLM 生成候选列表外的论文。
3. UI 有明确 loading、empty、error 和 retry 状态。
4. 长期写入必须有用户确认或明确系统边界。

### 3.6 风险与 fallback

全局 fallback：真实检索失败时使用 local provider 或 empty state；LLM 校验失败时不落库；schema 未稳定时使用 JSON blob；图谱融合始终 suggestion-first。

## 4. v2.1 扩展子图接入

### 目标

点击节点后，在原图谱旁生成浅色临时扩展节点，展示当前节点、相关论文、方法路线和关系边。

### 数据结构

新增：

```text
ExpansionGraphNode
ExpansionGraphEdge
Kg4NodeExpansionRecord
```

### 流程

```text
用户点击 expandable node
→ searchPapers(query)
→ 规则或 LLM 生成 expansion graph
→ renderer 接收 temporary graph layer
→ KnowledgeGraph 渲染浅色节点
→ 用户可清除
```

### UI 影响

修改 `KnowledgeGraph.tsx`：

1. 新增 `expansionGraph?: { nodes; edges }` prop。
2. 主图谱节点保持原样。
3. 扩展节点用 faded style。
4. 扩展边用 dashed line。
5. 当前原始节点高亮。

### Prompt 约束

如果使用 LLM 生成扩展关系：

```text
只能使用 currentNode 和 retrievedPapers。
不得生成 retrievedPapers 之外的 related_paper node。
算法路线必须来自 currentNode 或 retrievedPapers 的 title/abstract/topicTags。
```

### 验收标准

1. 原节点仍高亮。
2. 扩展节点浅色或 temporary 样式。
3. 扩展结果可清除。
4. 不写入 `graph.nodes` 主图谱。
5. 无检索结果时显示空状态。

### 风险与 fallback

| 风险 | fallback |
|---|---|
| 图谱拥挤 | 限制最多 8 个扩展节点 |
| 扩展布局不稳定 | 初期固定围绕原节点的 radial layout |
| LLM 关系不可靠 | MVP 用规则关系：paper candidate -> algorithm idea -> current node |

## 5. v2.2 Algorithm Idea Card

### 目标

将检索论文转换为结构化算法思想卡。

### 数据结构

```text
AlgorithmIdeaCard
FieldCognitionView
```

### 流程

```text
DedupedPaperCandidate[]
→ extract_algorithm_ideas LLM job
→ schema validation
→ save in Kg4NodeExpansionRecord
→ NodeDetailPanel displays card grid
```

### UI 影响

`NodeDetailPanel.tsx` 新增卡片区域：

```text
problemSetting
coreIdea
keyAssumption
mechanism
objectiveOrUpdateRule
strength
limitation
source
```

### Prompt 约束

```text
paperTitle/source/url/externalId 必须来自输入。
无 abstract/fulltext 时返回 insufficientInformation。
不得补实验结果。
```

### 验收标准

1. 每个候选论文最多生成一张主卡。
2. 卡片字段不为空，除非标记 insufficient。
3. LLM 输出 paperId 必须存在于候选。
4. UI 显示 source。

### 风险与 fallback

| 风险 | fallback |
|---|---|
| 候选摘要不足 | 标记 insufficient，提示导入 PDF |
| 卡片过长 | 默认显示摘要，展开查看完整字段 |
| LLM 输出不合 schema | orchestrator retry 或失败 |

## 6. v2.3 算法思想对比工作台

### 目标

用户可选择 2-3 个 Algorithm Idea Cards，生成对比表和研究思考问题。

### 数据结构

```text
AlgorithmIdeaComparisonWorkspace
AlgorithmIdeaComparisonRow
```

### 流程

```text
用户选择 2-3 cards
→ compare_algorithm_ideas job
→ comparison rows + reflection questions
→ 用户写下理解
```

### UI 影响

将现有 `ComparisonWorkspaceView` 从单论文对比改为多卡对比：

```text
card selector
comparison table
reflection questions
user reflection textarea
```

迁移任务入口移到底部 optional 区域。

### Prompt 约束

```text
只能比较 selectedIdeaCards。
每个维度必须指出机制差异或写信息不足。
不得引用未选中论文。
```

### 验收标准

1. 支持选择 2-3 张卡。
2. 对比表覆盖指定 10 个维度。
3. 生成 2-4 个研究思考问题。
4. 不自动生成迁移任务。

### 风险与 fallback

| 风险 | fallback |
|---|---|
| 对比太模板化 | 每行必须有 `contrastInsight` |
| 用户只选一张 | 展示单卡深读提示，不生成表 |
| LLM 调用慢 | 允许先显示 cards，表格 skeleton 加载 |

## 7. v2.4 双模式 AI 反馈

### 目标

实现 Reflective Feedback 与 Remedial Lesson。

### 数据结构

```text
NodeReflectionInput
ReflectiveFeedback
RemedialLesson
FeedbackModeDecision
```

### 流程

```text
用户提交 reflection
→ generate_reflective_feedback job 判断模式
→ reflective response 或 remedial trigger
→ generate_remedial_lesson if needed
→ 展示反馈和 suggestedUnderstandingNote
```

### UI 影响

新增反馈区：

```text
feedback type badge
strengths / gaps / questions
or prerequisite mini lesson
save memory CTA
```

### Prompt 约束

```text
不使用简单正确/错误。
只引用 currentPaper 和 selectedIdeaCards。
基础资料推荐必须来自已检索或内置资料库。
```

### 验收标准

1. Reflective feedback 包含 strengths、missingDimensions、followUpQuestions。
2. Remedial lesson 包含 missingPrerequisite、shortExplanation、checkQuestion。
3. 引用 paperId 均可验证。
4. 不改变阶段学习 status。

### 风险与 fallback

| 风险 | fallback |
|---|---|
| 模式判断不准 | UI 允许用户切换反馈模式重新生成 |
| 用户输入太短 | 要求补充或只给 follow-up question |
| 反馈引用越界 | validation 失败 |

## 8. v2.5 Node Understanding Memory

### 目标

保存用户理解、AI 反馈和可复用理解笔记。

### 数据结构

```text
NodeUnderstandingMemory
NodeUnderstandingMemoryQuery
MemoryReuseSuggestion
```

### 流程

```text
feedback generated
→ user confirms/edit note
→ saveNodeUnderstandingMemory
→ next similar node click
→ findReusableNodeMemories
→ show suggestion
```

### UI 影响

新增：

```text
Save Understanding Note
Memory Reuse Suggestion
Memory Detail Drawer
```

### Prompt 约束

```text
保存笔记不得引入新论文。
复用建议必须说明匹配原因和 confidence。
```

### 验收标准

1. Memory 可写入本地数据库。
2. 可按 normalized node label 查询。
3. 可按 method family / topic tag 做弱匹配。
4. 复用必须用户确认。

### 风险与 fallback

| 风险 | fallback |
|---|---|
| schema 还不稳定 | 使用 JSON blob 表 |
| 复用误导用户 | 展示 confidence 和原文来源 |
| 没有 userId | 单机默认 userId 为空 |

## 9. v2.6 图谱融合建议

### 目标

把扩展节点转为长期领域图谱候选，但必须由用户确认。

### 数据结构

```ts
export interface GraphFusionSuggestion {
  id: string
  candidateNodeIds: string[]
  suggestedMergedLabel: string
  suggestedType: string
  sources: string[]
  mergeReason: string
  confidence: number
  risks: string[]
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
  updatedAt: string
}
```

### 流程

```text
temporary expansion nodes
→ suggest_graph_fusion job or rule-based suggestion
→ display sources / reason / confidence / risks
→ user accepts or rejects
→ accepted writes MergedGraphNode / MergedGraphEdge
→ rejected suggestion retained
```

### UI 影响

在工作台末尾新增：

```text
Graph Fusion Suggestions
待合并节点
来源论文
合并理由
风险
接受 / 拒绝
```

### Prompt 约束

```text
只能基于 temporary expansion nodes、GraphNodeRecord、MergedGraphNode 和 verified sources。
不得新增论文。
必须输出 risks。
低置信度时返回 needs_review，不要建议自动合并。
```

### 验收标准

1. 默认不自动融合。
2. 每个建议有来源和合并理由。
3. 用户可接受或拒绝。
4. 被拒绝记录保留，避免重复出现。
5. accepted 后才调用长期图谱写入。

### 风险与 fallback

| 风险 | fallback |
|---|---|
| 自动融合污染长期图谱 | 全部改为 suggestion-first |
| 用户不知道风险 | UI 必须展示 risks |
| 重复建议骚扰 | 保存 rejected suggestions |

## 10. 总体验收清单

1. KG4 不破坏现有论文分析、图谱、阶段学习、诊断流程。
2. 检索使用真实 provider 或明确 dev fixture。
3. LLM 任务全部经 orchestrator，不在 UI 直接调用。
4. 每个 LLM 输出有 schema validation。
5. 所有论文引用可追溯 source/url/externalId。
6. 扩展节点 temporary，不自动写入主图谱。
7. Algorithm Idea Card 不为空泛。
8. Field Cognition View 不含占位分类。
9. 用户理解可保存和复用。
10. 图谱融合必须用户确认。

## 11. 推荐实施顺序

1. 先加共享类型和 KG4 IPC skeleton，不接 LLM。
2. 用现有 mock fixture 渲染 KG4 工作台 UI。
3. 接入 `searchPapers` 替换 mock 数据源。
4. 接入 `extract_algorithm_ideas` job。
5. 接入多卡对比 job。
6. 接入 feedback jobs。
7. 接入 memory 保存和复用。
8. 最后接入 fusion suggestions。

这样每一步都能单独验收，并且不会让业务代码一次性大改。
