# Node Expansion UI Flow 设计文档

## 1. 目标

本文档定义 Node Expansion 在新版 Workspace 前端中的分层交互流程。

目标是把现有“右侧直接展开完整 KG4 Workbench”的方式拆成四层：

```text
Node Inspector
→ Expansion Loading View
→ Expansion Graph View
→ Expand View
```

这样可以保证 AI Panel 保持轻量，复杂内容进入 Central Workspace。

## 2. 当前问题

当前 `NodeDetailPanel.tsx` 同时承担：

1. 普通节点详情；
2. KG3 Direction Map；
3. KG3 Method Lineage；
4. KG3 Comparison Workspace；
5. KG4 Algorithm Idea Workbench；
6. Memory reuse；
7. feedback；
8. optional transfer task。

这违反了新设计中“AI Panel 是 Inspector，不是完整工作台”的原则。

当前 `KnowledgeGraph.tsx` 已能显示 `Kg4ExpansionGraphLayer`，但该 layer 仍直接依附在主 graph view，没有独立的 Expansion Graph workspace。

## 3. 新交互结构

### 3.1 四层流程

```text
1. Node Inspector：右侧轻量解释和展开入口
2. Expansion Loading View：中央展示检索/分析过程
3. Expansion Graph View：中央展示原节点 + temporary expansion graph
4. Expand View：中央展示完整 KG4 Workbench
```

### 3.2 用户路径

```text
点击 graph node
→ AI Panel 显示 Node Inspector
→ 点击「展开该方向」
→ 新建 Node Expansion tab
→ Loading steps
→ Expansion Graph ready
→ 点击 expansion node
→ AI Panel 显示 Expansion Node Inspector
→ 点击「进入 Expand View」
→ 完整 workbench
```

## 4. 涉及组件

### 4.1 当前组件改造

| 组件 | 改造方向 |
|---|---|
| `NodeDetailPanel.tsx` | 拆出 `NodeInspector`，移除完整 KG4 Workbench 承载职责 |
| `KnowledgeGraph.tsx` | 继续渲染主图谱；Expansion Graph View 可复用其 SVG 逻辑 |
| `kg4Workbench.ts` | 保留为 Expand View 的数据 builder / fixture |
| `CenterPanel.tsx` | 改为根据 workspace type 渲染 loading、graph、expand view |
| `RightLearningPanel.tsx` | 改为根据 selected object 渲染轻量 inspector |
| `App.tsx` | 管理 expansion UI state 和 workspace tabs |

### 4.2 建议新增组件

```text
NodeInspector
ExpansionLoadingView
ExpansionGraphView
ExpansionNodeInspector
ExpandView
AlgorithmIdeaCardGrid
AlgorithmIdeaComparisonPanel
UnderstandingFeedbackPanel
MemorySavePanel
```

## 5. 状态设计

### 5.1 Expansion Session

```ts
export interface NodeExpansionSession {
  id: string
  nodeId: string
  nodeLabel: string
  paperId?: string
  status: 'loading' | 'ready' | 'failed' | 'empty'
  currentStepId?: string
  steps: NodeExpansionStep[]
  expansionGraph?: Kg4ExpansionGraphLayer
  expansionRecord?: Kg4NodeExpansionRecord
  selectedExpansionNodeId?: string
  usesMockData: boolean
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

export interface NodeExpansionStep {
  id: string
  label: string
  status: 'pending' | 'running' | 'done' | 'failed'
  detail?: string
}
```

### 5.2 Loading Steps

MVP steps：

```text
read_node_context
build_search_query
retrieve_papers
rank_candidates
extract_algorithm_ideas
generate_expansion_graph
prepare_workspace
```

### 5.3 Expansion Graph Selection

```ts
export interface ExpansionNodeSelection {
  type: 'expansion_node'
  id: string
  expansionId: string
}
```

该 selection 只驱动 AI Panel 的摘要，不直接打开 Expand View。

## 6. 主要用户流程

### 6.1 Node Inspector

触发：点击普通图谱节点。

显示：

```text
节点标题
节点类型
一句话解释
whyImportant
roleInPaper
证据摘要
```

可展开节点额外显示：

```text
可展开原因
[展开该方向]
```

约束：不显示完整论文列表、算法思想卡、对比表。

### 6.2 Expansion Loading View

触发：点击「展开该方向」。

显示：

```text
正在展开：{nodeLabel}
当前数据源：mock / local / arXiv / OpenAlex / Semantic Scholar
步骤 timeline
当前 job 状态
错误或空状态
```

MVP 可使用 `buildKg4ExpansionRecord` fixture 模拟完成状态，但 UI 必须明确标注 mock/dev fixture。

### 6.3 Expansion Graph View

触发：Expansion session ready。

显示：

```text
原节点高亮
temporary expansion nodes
dashed expansion edges
clear temporary graph
进入 Expand View 的入口
```

点击扩展节点：

```text
select_object({ type: 'expansion_node', id, expansionId })
→ AI Panel 显示扩展节点摘要
```

### 6.4 Expand View

触发：用户在 Expansion Node Inspector 点击「进入 Expand View」。

显示完整内容：

```text
扩展子图摘要
相关论文来源
Algorithm Idea Cards
2-3 card comparison
reflection questions
用户理解输入
reflective/remedial feedback
Node Understanding Memory 保存
optional transfer task
```

约束：只有 Expand View 承载完整 KG4 Workbench。

## 7. 新交互结构与现有 KG4 的关系

当前 `Kg4Workbench` 可以迁移到 `ExpandView`。迁移前后：

| 当前 | 重构后 |
|---|---|
| `NodeDetailPanel` 内直接渲染 `Kg4Workbench` | `ExpandView` 渲染 `Kg4Workbench` 内容 |
| `onSetKg4ExpansionGraph` 直接传到右侧 panel | expansion session 写入 workspace state |
| `KnowledgeGraph` 主图内显示 expansion layer | `ExpansionGraphView` 中显示 expansion graph |
| memory reuse 在右侧展示 | Expand View 或 Memory Inspector 展示 |

## 8. 不在范围内的内容

1. 不改变 KG4 数据结构。
2. 不新增真实检索 provider。
3. 不新增 LLM task。
4. 不实现图谱融合确认 UI 的完整持久化。
5. 不实现复杂 graph layout。

## 9. 验收标准

1. 点击普通节点只显示 Node Inspector。
2. 点击可展开节点显示「展开该方向」。
3. 点击展开后进入 Expansion Loading View。
4. Loading View 显示至少 5 个步骤。
5. 展开完成后进入 Expansion Graph View。
6. Expansion Graph View 中扩展节点是 temporary 样式。
7. 点击扩展节点只更新 AI Panel，不展示完整 workbench。
8. 点击「进入 Expand View」后才展示 Algorithm Idea Cards、对比和 feedback。
9. 关闭 Expand View 不删除已保存 Node Understanding Memory。
10. 原 Stage Learning 的作答和诊断不受影响。

## 10. 风险与 fallback

| 风险 | fallback |
|---|---|
| Loading View 只是伪进度 | MVP 明确标注 dev fixture，后续接真实 job status |
| 用户想快速看完整结果 | Loading 完成后自动提供「进入 Expand View」CTA，但不自动打开 |
| Expansion Graph 与 Paper Graph 混淆 | 使用独立 tab title 和 temporary badge |
| 右侧信息太少 | Inspector 提供明确 action：进入 Expand View、加入对比、查看来源 |
| 多个 expansion 难管理 | Left Sidebar 显示已展开节点列表和状态 |
