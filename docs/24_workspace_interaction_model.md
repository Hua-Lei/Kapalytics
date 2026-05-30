# Workspace Interaction Model 设计文档

## 1. 目标

本文档定义前端 Workspace 架构下的交互模型：用户如何在不同工作区之间切换、如何选择对象、AI Panel 如何响应上下文、Node Expansion 如何打开新工作区。

目标是建立稳定的前端状态模型，避免继续用单个 `activeTab: 'graph' | 'learning'` 承载所有场景。

## 2. 当前问题

当前交互模型主要由 `App.tsx` 中的状态驱动：

```ts
activeTab: 'graph' | 'learning'
selectedGraphNodeId: string | null
selectedStageId: string | null
kg4ExpansionGraph: Kg4ExpansionGraphLayer | null
```

这对早期三栏界面足够，但对 KG4 后的功能不够：

1. 无法表达多个打开的 Node Expansion。
2. 无法表达 Expansion Loading View 与 Expand View 的区别。
3. 无法表达扩展节点、算法思想卡、memory record 等非原始图谱对象。
4. 右侧 Panel 和中央 Workspace 的职责混在一起。
5. 切换 graph / learning 会清空 selected node，后续多 workspace 体验会断裂。

## 3. 新交互结构

### 3.1 三个核心状态

```text
Paper Session State：当前论文、图谱、阶段、分析结果
Workspace State：打开了哪些 workspace、当前激活哪个 workspace
Selection State：当前选中了什么对象，右侧 AI Panel 如何显示
```

### 3.2 状态关系

```text
active workspace tab
→ 决定 Central Workspace 内容

selected object
→ 决定 Right AI Context Panel 内容

paper session
→ 提供图谱、insight、stages、diagnosis、KG4 records
```

### 3.3 Workspace 操作

用户可以：

1. 从 Left Sidebar 切换主 workspace。
2. 点击节点后在 AI Panel 查看简要解释。
3. 点击「展开该方向」后新建 expansion workspace tab。
4. 从 Expansion Graph 进入 Expand View。
5. 关闭 Node Expansion / Expand View tab。
6. 回到 Paper Graph / Stage Learning，不丢失当前论文状态。

## 4. 涉及组件

### 4.1 当前组件

| 组件 | 需要调整的交互职责 |
|---|---|
| `App.tsx` | 从 graph/learning tab state 升级为 workspace state owner |
| `AppShell.tsx` | 接收 workspace state，渲染整体 shell |
| `CenterPanel.tsx` | 变成 `CentralWorkspaceRouter` |
| `RightLearningPanel.tsx` | 变成 `AIContextPanel` |
| `NodeDetailPanel.tsx` | 拆成轻量 inspector 和中央 Expand View 内容 |
| `KnowledgeGraph.tsx` | 支持 graph node selection 和 expansion node selection |
| `LearningPath.tsx` | 在 Stage Learning workspace 内使用 |
| `StageDetail.tsx` | 根据 selected stage 显示在中央或 AI Panel |

### 4.2 建议新增状态模块

```text
src/renderer/src/modules/workspace/types.ts
src/renderer/src/modules/workspace/workspaceReducer.ts
src/renderer/src/modules/workspace/defaultTabs.ts
```

## 5. 状态设计

### 5.1 Workspace Types

```ts
export type WorkspaceTabType =
  | 'paper_graph'
  | 'argument_chain'
  | 'method_mechanism'
  | 'stage_learning'
  | 'node_expansion_loading'
  | 'expansion_graph'
  | 'expand_view'
  | 'field_memory'

export interface WorkspaceTab {
  id: string
  type: WorkspaceTabType
  title: string
  paperId?: string
  nodeId?: string
  expansionId?: string
  closable: boolean
  status?: 'idle' | 'loading' | 'ready' | 'failed' | 'empty'
}
```

### 5.2 Selected Object

```ts
export type SelectedObject =
  | { type: 'graph_node'; id: string }
  | { type: 'expansion_node'; id: string; expansionId: string }
  | { type: 'learning_stage'; id: string }
  | { type: 'algorithm_idea'; id: string; expansionId: string }
  | { type: 'memory_record'; id: string }
```

### 5.3 Workspace State

```ts
export interface WorkspaceState {
  activeTabId: string
  tabs: WorkspaceTab[]
  selectedObject?: SelectedObject
  activePaperId?: string
}
```

### 5.4 Actions

```ts
export type WorkspaceAction =
  | { type: 'open_tab'; tab: WorkspaceTab }
  | { type: 'close_tab'; tabId: string }
  | { type: 'activate_tab'; tabId: string }
  | { type: 'select_object'; selectedObject?: SelectedObject }
  | { type: 'update_tab_status'; tabId: string; status: WorkspaceTab['status'] }
  | { type: 'open_node_expansion'; nodeId: string; title: string }
  | { type: 'open_expand_view'; expansionId: string; nodeId: string; title: string }
```

## 6. 主要用户流程

### 6.1 切换基础 workspace

```text
用户点击 Left Sidebar: Paper Graph
→ activate_tab('paper_graph')
→ CentralWorkspaceRouter 渲染 KnowledgeGraph
→ selectedObject 保持或清空，取决于对象是否属于该 workspace
```

### 6.2 点击图谱节点

```text
KnowledgeGraph onNodeSelect(nodeId)
→ select_object({ type: 'graph_node', id: nodeId })
→ AIContextPanel 渲染 NodeInspector
→ Central Workspace 不切换
```

### 6.3 展开节点

```text
NodeInspector 点击「展开该方向」
→ open_node_expansion(nodeId)
→ 新建 node_expansion_loading tab
→ activate_tab(newTabId)
→ Central Workspace 渲染 ExpansionLoadingView
```

### 6.4 完成展开

```text
Expansion job ready
→ update_tab_status(ready)
→ tab.type 切换或新建 expansion_graph tab
→ Central Workspace 渲染 ExpansionGraphView
```

### 6.5 点击扩展节点

```text
ExpansionGraphView onExpansionNodeSelect(expansionNodeId)
→ select_object({ type: 'expansion_node', id, expansionId })
→ AI Panel 显示 ExpansionNodeInspector
```

### 6.6 进入 Expand View

```text
ExpansionNodeInspector 点击「进入 Expand View」
→ open_expand_view(expansionId, nodeId)
→ Central Workspace 渲染完整 KG4 Workbench
```

## 7. AI Context Panel 模板

AI Panel 根据 `selectedObject.type` 渲染：

| type | 模板 |
|---|---|
| `graph_node` | NodeInspector |
| `expansion_node` | ExpansionNodeInspector |
| `learning_stage` | StageInspector |
| `algorithm_idea` | AlgorithmIdeaInspector |
| `memory_record` | MemoryRecordInspector |
| undefined | EmptyContextPanel |

Panel 只展示摘要和 action，不展示完整表格、完整论文列表、完整 workbench。

## 8. 不在范围内的内容

1. 不实现云端同步 workspace tabs。
2. 不实现跨论文多窗口 session。
3. 不重新设计 LLM job queue。
4. 不重写 KG4 数据生成逻辑。
5. 不新增 graph layout 算法。

## 9. 验收标准

1. Workspace state 可以表达至少 8 种 tab type。
2. Central Workspace 和 AI Panel 由不同状态驱动。
3. 点击节点不会直接打开完整 KG4 Workbench。
4. 点击「展开该方向」会打开新的 Node Expansion workspace。
5. 可以从 Expansion Graph 进入 Expand View。
6. 可以关闭 Node Expansion / Expand View tab。
7. 关闭 tab 不删除 graph、stage、memory 数据。
8. Stage Learning 可以作为独立 workspace 继续完成作答和诊断。

## 10. 风险与 fallback

| 风险 | fallback |
|---|---|
| 状态模型过度设计 | 先用 reducer 管理本地 UI state，不引入外部状态库 |
| Tab 与 Sidebar 重复 | Sidebar 管分组入口，Tabs 管当前打开的具体工作区 |
| selectedObject 跨 tab 残留 | tab 切换时校验 selectedObject 是否属于新 tab |
| 旧组件迁移成本高 | 保留旧组件内部实现，只改变挂载位置 |
| 用户迷路 | Top Bar 始终显示 current workspace 和 paper title |
