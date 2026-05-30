# AI Context Panel 设计文档

## 1. 目标

AI Context Panel 是新版 Workspace 架构中的右侧上下文面板。它的定位是：

```text
Context-aware Inspector + Action Launcher
```

它不再承载完整 Node Expansion、完整对比表、完整论文列表或完整学习路径。复杂内容必须进入 Central Workspace。

## 2. 当前问题

当前 `RightLearningPanel.tsx` 和 `NodeDetailPanel.tsx` 承担过多：

1. 空状态提示；
2. 论文分析入口；
3. 节点详情；
4. KG3 Node Expansion；
5. KG4 Workbench；
6. 学习阶段作答；
7. 诊断反馈；
8. 学习报告。

这导致右侧区域从“上下文解释”变成“所有复杂功能容器”。重构后右侧只保留轻量内容和跳转入口。

## 3. 新交互结构

### 3.1 Panel 输入

AI Context Panel 由 `selectedObject` 决定：

```ts
type SelectedObject =
  | { type: 'graph_node'; id: string }
  | { type: 'expansion_node'; id: string; expansionId: string }
  | { type: 'learning_stage'; id: string }
  | { type: 'algorithm_idea'; id: string; expansionId: string }
  | { type: 'memory_record'; id: string }
```

### 3.2 Panel 输出

Panel 输出由固定模板组成：

```text
Header
Summary
Why it matters / relation
Evidence/source summary
Actions
Lightweight status/feedback
```

### 3.3 Panel 禁止内容

不在 AI Panel 中展示：

1. 完整 KG4 Workbench；
2. 完整 Algorithm Idea Card grid；
3. 多论文对比表；
4. 长篇 reflective feedback；
5. 长期领域图谱；
6. 大段论文推荐列表；
7. PDF 阅读器。

## 4. 涉及组件

### 4.1 当前组件迁移

| 当前组件 | 迁移方向 |
|---|---|
| `RightLearningPanel.tsx` | 改名或替换为 `AIContextPanel` |
| `NodeDetailPanel.tsx` | 拆出 `NodeInspector`，完整 expansion 移到 `ExpandView` |
| `StageDetail.tsx` | 作答主体进入 Stage Learning workspace，AI Panel 只显示阶段摘要 |
| `DiagnosisView.tsx` | 反馈摘要可在 AI Panel，完整诊断保留在 Stage workspace |
| `LearningReportPanel.tsx` | 进入 Field Memory 或 Learning Report workspace |
| `AnalysisPanel.tsx` | 空状态和分析入口可保留，但不承载复杂学习内容 |

### 4.2 建议新增模板组件

```text
AIContextPanel
EmptyContextPanel
NodeInspector
ExpandableNodeActions
ExpansionNodeInspector
StageInspector
AlgorithmIdeaInspector
MemoryRecordInspector
JobStatusInspector
```

## 5. 状态设计

### 5.1 Panel Props

```ts
export interface AIContextPanelProps {
  selectedObject?: SelectedObject
  graph: KnowledgeGraph
  paperInsight: PaperInsight | null
  stages: Stage[]
  expansionSessions: NodeExpansionSession[]
  memories: NodeUnderstandingMemory[]
  onOpenNodeExpansion: (nodeId: string) => void
  onOpenExpandView: (expansionId: string, nodeId: string) => void
  onSelectStage: (stageId: string) => void
  onOpenWorkspaceTab: (tab: WorkspaceTab) => void
}
```

### 5.2 Panel View Model

建议不要直接在 Panel 内写复杂查找逻辑，可构造 view model：

```ts
export interface AIContextPanelViewModel {
  title: string
  eyebrow: string
  summary: string
  details: Array<{ label: string; value: string }>
  actions: Array<{
    id: string
    label: string
    kind: 'primary' | 'secondary' | 'danger'
    disabled?: boolean
  }>
  status?: string
}
```

## 6. 主要用户流程

### 6.1 普通图谱节点

触发：点击 node。

Panel 显示：

```text
节点名称
节点类型
summary / description
whyImportant
roleInPaper
证据节点摘要
操作：查看相关证据
```

不显示 Node Expansion 结果。

### 6.2 可展开节点

触发：点击 expandable node。

Panel 额外显示：

```text
可展开原因
searchQueries chips
操作：展开该方向
```

点击展开后：

```text
onOpenNodeExpansion(nodeId)
→ 新建 Expansion Loading workspace
```

### 6.3 扩展节点

触发：点击 Expansion Graph View 中的 temporary node。

Panel 显示：

```text
扩展节点名称
类型：algorithm_idea / method_family / related_paper
一句话解释
与原节点关系
来源论文数量
操作：进入 Expand View / 加入对比 / 查看来源
```

### 6.4 学习阶段

触发：选中 learning stage。

Panel 显示：

```text
阶段名称
阶段目标
当前状态
任务摘要
操作：进入 Stage Learning / 继续作答 / 查看反馈
```

完整作答框和诊断详情建议在 Stage Learning workspace。

### 6.5 Algorithm Idea Card

触发：在 Expand View 中选中某张 card。

Panel 显示：

```text
paper title
core idea
key assumption
relationToCurrentNode
source
操作：加入对比 / 查看来源 / 从对比移除
```

### 6.6 Memory Record

触发：点击 memory record。

Panel 显示：

```text
node label
saved note summary
AI feedback summary
match reason
操作：复用到当前节点 / 查看完整记录
```

## 7. 新交互结构

### 7.1 Panel 长度规则

1. 单个 detail 字段建议不超过 160 字。
2. 超过长度时显示“进入 View 查看完整内容”。
3. Panel actions 不超过 4 个。
4. Primary action 只能有 1 个。

### 7.2 Action 规则

| 场景 | Primary Action |
|---|---|
| expandable graph node | 展开该方向 |
| expansion node | 进入 Expand View |
| learning stage | 进入 Stage Learning |
| algorithm idea | 加入对比 |
| memory record | 复用理解 |

## 8. 不在范围内的内容

1. 不把 AI Panel 改成聊天机器人。
2. 不支持自由问答上下文记忆。
3. 不在 Panel 内新增 LLM 调用入口，除非该动作已有明确 workspace flow。
4. 不在 Panel 内实现完整 Expand View。

## 9. 验收标准

1. AI Panel 根据 selected object 切换模板。
2. 普通节点只显示轻量解释。
3. 可展开节点显示展开按钮。
4. 扩展节点只显示摘要和进入 Expand View 操作。
5. 学习阶段只显示阶段摘要和进入学习操作。
6. Algorithm Idea Card 只显示核心思想和加入对比操作。
7. Memory Record 只显示摘要和复用入口。
8. Panel 不展示完整 KG4 Workbench 或长对比表。
9. 复杂内容均通过 action 进入 Central Workspace。

## 10. 风险与 fallback

| 风险 | fallback |
|---|---|
| 用户觉得 Panel 信息不够 | 提供清晰的“进入 View”按钮 |
| Panel 模板太多难维护 | 统一使用 `AIContextPanelViewModel` |
| Stage 作答迁移影响习惯 | MVP 可保留 StageDetail 在中央，Panel 仅提供快捷入口 |
| NodeDetailPanel 拆分成本高 | 先新增 `compact` 模式，完整模式迁到 Expand View 后再删除 |
| 操作入口不明确 | 每个模板仅保留一个 primary action |
