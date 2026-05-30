# Frontend Redesign 迭代计划

## 1. 目标

本迭代计划将前端 Workspace Redesign 拆成可验收的阶段，避免一次性重写整个 UI。

总体目标：

```text
Workspace Shell
→ Paper Graph 与 AI Panel 分离
→ Node Expansion Loading View
→ Expansion Graph View
→ Expand View
→ Field Memory 预留
```

## 2. 当前问题

当前实现虽然已经能运行 KG4 MVP，但存在结构性问题：

1. `activeTab` 只有 graph / learning，无法表达多 workspace。
2. `RightLearningPanel` 同时承担 inspector 和完整工作台。
3. `NodeDetailPanel` 过大，未来继续扩展会失控。
4. `CenterPanel` 只能切换图谱与学习路径。
5. KG4 expansion graph 仍依附主 graph，而不是独立 expansion workspace。

## 3. 新交互结构

分阶段目标结构：

```text
App
→ WorkspaceShell
  → TopBar
  → WorkspaceSidebar
  → CentralWorkspaceRouter
  → AIContextPanel
```

Workspace types：

```text
paper_graph
argument_chain
method_mechanism
stage_learning
node_expansion_loading
expansion_graph
expand_view
field_memory
```

## 4. v4.1 Workspace Shell

### 目标

搭建新版前端外壳，先不迁移全部功能。

### 涉及组件

新增：

```text
WorkspaceShell
TopBar
WorkspaceSidebar
CentralWorkspaceRouter
AIContextPanel
```

调整：

```text
App.tsx
AppShell.tsx
CenterPanel.tsx
RightLearningPanel.tsx
layout.css
panels.css
```

### 状态设计

新增最小 workspace state：

```ts
const defaultTabs = [
  { id: 'paper_graph', type: 'paper_graph', title: 'Paper Graph', closable: false },
  { id: 'argument_chain', type: 'argument_chain', title: 'Argument Chain', closable: false },
  { id: 'method_mechanism', type: 'method_mechanism', title: 'Method Mechanism', closable: false },
  { id: 'stage_learning', type: 'stage_learning', title: 'Stage Learning', closable: false }
]
```

### 主要用户流程

```text
用户打开应用
→ 默认 Paper Graph workspace
→ 左侧可切换基础 workspace
→ 右侧显示 EmptyContextPanel 或当前 selected object
```

### 不在范围内

1. 不实现完整 Node Expansion flow。
2. 不接真实 LLM job 状态。
3. 不拆所有旧组件内部逻辑。

### 验收标准

1. 有 Top Bar、Left Sidebar、Central Workspace、Right AI Panel。
2. 可切换 Paper Graph、Argument Chain、Method Mechanism、Stage Learning。
3. 原上传和分析入口仍可用。
4. 原图谱仍能显示。

### 风险与 fallback

| 风险 | fallback |
|---|---|
| 新 shell 破坏旧布局 | 保留旧 AppShell 作为 fallback branch 或组件 |
| PDF 面板位置不明确 | PDF 作为独立 Workspace Tab（pdf_reader）出现在左侧导航栏中 |

## 5. v4.2 Paper Graph 与 AI Panel 分离

### 目标

Paper Graph View 只展示图谱；节点点击只更新 AI Panel。

### 涉及组件

```text
KnowledgeGraph.tsx
AIContextPanel
NodeInspector
NodeDetailPanel.tsx
```

### 状态设计

```ts
selectedObject = { type: 'graph_node', id: nodeId }
```

### 主要用户流程

```text
点击普通节点
→ AI Panel 显示轻量解释

点击 expandable 节点
→ AI Panel 显示轻量解释 + 展开按钮
```

### 不在范围内

1. 不展示完整 KG4 Workbench。
2. 不打开 expansion tab。

### 验收标准

1. 普通节点点击不改变中央 workspace。
2. AI Panel 显示 NodeInspector。
3. expandable node 显示「展开该方向」。
4. 右侧不再展示完整扩展内容。

### 风险与 fallback

| 风险 | fallback |
|---|---|
| 旧 NodeDetailPanel 太难拆 | 先加 `mode="compact"`，隐藏 expansion 内容 |

## 6. v4.3 Node Expansion Loading View

### 目标

点击展开按钮后打开新的 Workspace Tab，并展示 loading steps。

### 涉及组件

```text
ExpansionLoadingView
WorkspaceTabs
WorkspaceSidebar
kg4Workbench.ts
```

### 状态设计

```ts
NodeExpansionSession.status = 'loading' | 'ready' | 'failed' | 'empty'
```

### 主要用户流程

```text
NodeInspector 点击展开
→ open_node_expansion
→ 创建 node_expansion_loading tab
→ 显示 steps
→ dev fixture 生成 Kg4NodeExpansionRecord
```

### 不在范围内

1. 不新增真实检索 API。
2. 不新增 LLM 任务。

### 验收标准

1. 展开动作不在 AI Panel 内展示完整内容。
2. 新 tab 显示 loading steps。
3. 明确显示 mock/dev fixture 或 provider 状态。
4. 失败和空结果有 UI。

### 风险与 fallback

| 风险 | fallback |
|---|---|
| 没有真实异步任务 | MVP 使用短暂 simulated steps，并明确标注 fixture |

## 7. v4.4 Expansion Graph View

### 目标

Loading 完成后进入 Expansion Graph View，展示原节点和浅色扩展节点。

### 涉及组件

```text
ExpansionGraphView
KnowledgeGraph.tsx
ExpansionNodeInspector
graph.css
```

### 状态设计

```ts
expansionSession.expansionGraph = Kg4ExpansionGraphLayer
selectedObject = { type: 'expansion_node', id, expansionId }
```

### 主要用户流程

```text
Expansion ready
→ Central Workspace 显示 ExpansionGraphView
→ 点击浅色扩展节点
→ AI Panel 显示摘要和操作入口
```

### 不在范围内

1. 不自动写入长期图谱。
2. 不实现复杂 layout。

### 验收标准

1. 原节点高亮。
2. 扩展节点浅色。
3. 扩展边与主图谱边区分。
4. 可清除 temporary graph。
5. 点击扩展节点不打开完整 Workbench，只更新 AI Panel。

### 风险与 fallback

| 风险 | fallback |
|---|---|
| 图谱太拥挤 | 限制最多 8 个 expansion nodes |

## 8. v4.5 Expand View

### 目标

把完整 KG4 Workbench 从 AI Panel 迁移到 Central Workspace。

### 涉及组件

```text
ExpandView
Kg4Workbench sections
AlgorithmIdeaCardGrid
ComparisonPanel
ReflectionFeedbackPanel
MemorySavePanel
```

### 状态设计

```ts
WorkspaceTab.type = 'expand_view'
WorkspaceTab.expansionId = session.id
```

### 主要用户流程

```text
ExpansionNodeInspector 点击进入 Expand View
→ open_expand_view
→ Central Workspace 展示完整 Algorithm Idea Workbench
→ 用户对比、写理解、保存 memory
```

### 不在范围内

1. 不重写 KG4 workbench 数据生成。
2. 不新增 memory schema。

### 验收标准

1. 完整 Algorithm Idea Cards 不在 AI Panel。
2. 对比表、feedback、memory 保存都在 Expand View。
3. 可以返回 Expansion Graph。
4. Optional transfer task 仍可接入 Stage Learning。

### 风险与 fallback

| 风险 | fallback |
|---|---|
| 迁移过程中功能断裂 | 先把现有 `Kg4Workbench` 原样搬到 Expand View，再逐步拆小组件 |

## 9. v4.6 Field Memory 预留

### 目标

为长期领域图谱、读过论文、Understanding Memories 预留 workspace。

### 涉及组件

```text
FieldMemoryView
MemoryList
MemoryRecordInspector
```

### 状态设计

```ts
WorkspaceTab.type = 'field_memory'
selectedObject = { type: 'memory_record', id }
```

### 主要用户流程

```text
Left Sidebar 点击 Understanding Memories
→ Field Memory workspace
→ 点击 memory record
→ AI Panel 显示摘要和复用入口
```

### 不在范围内

1. 不实现完整长期领域图谱算法。
2. 不实现云同步。

### 验收标准

1. Left Sidebar 有 Field Memory 分组。
2. 可以展示 memory placeholder 或已有 local memories。
3. 点击 memory record 更新 AI Panel。

### 风险与 fallback

| 风险 | fallback |
|---|---|
| 当前 memory 数据少 | 显示空状态和“完成 Expand View 后会出现记录” |

## 10. 总体验收清单

1. 新 UI 有明确 Top Bar / Sidebar / Central Workspace / AI Panel。
2. 基础 workspace 可切换。
3. AI Panel 不承载复杂 KG4 Workbench。
4. Node Expansion 有 Loading View。
5. Expansion Graph 与 Paper Graph 有清晰区分。
6. Expand View 才展示完整算法思想对比和反馈。
7. 原上传、分析、图谱、阶段学习、诊断不破坏。
8. mock / dev fixture 状态明确标注。
9. 不新增本轮范围外的 AI 能力。

## 11. 推荐实施顺序

1. 新增 workspace types 和 reducer。
2. 新增 WorkspaceShell 外壳，保留旧组件作为内容。
3. 将 `CenterPanel` 替换为 `CentralWorkspaceRouter`。
4. 将 `RightLearningPanel` 替换为 `AIContextPanel`。
5. 拆 `NodeDetailPanel` 为 compact inspector 与 full expand content。
6. 增加 Expansion Loading View。
7. 增加 Expansion Graph View。
8. 将 KG4 Workbench 搬入 Expand View。
9. 添加 Field Memory placeholder。

这样可以每一步单独验收，并降低破坏现有学习闭环的风险。
