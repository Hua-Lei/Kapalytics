# Frontend Workspace Redesign 正式需求文档

## 1. 目标

本轮前端重构的目标是把 Kapalytics 从“三栏论文学习工具”升级为“多工作区论文研究学习台”。

核心原则：

```text
右侧 AI Panel 只做轻量上下文解释；复杂内容进入中央 Workspace；Node Expansion 分成 Inspector、Loading、Expansion Graph、Expand View 四层。
```

重构后用户应能清楚区分：

1. 当前论文图谱学习；
2. 论文论证链理解；
3. 方法机制拆解；
4. 分阶段学习与诊断；
5. 节点展开过程；
6. 扩展子图探索；
7. 完整 Expand View；
8. 长期领域记忆。

本轮不新增 AI 能力、不新增真实检索 API、不新增长期记忆 schema。重点是重组已有前端信息架构和交互层级。

## 2. 当前问题

当前代码已经具备 KG4 能力，但前端承载方式开始过载：

| 问题 | 现状 | 影响 |
|---|---|---|
| 三栏布局承担过多任务 | `PdfPanel`、`CenterPanel`、`RightLearningPanel` 固定并列 | 图谱、阶段学习、节点扩展都挤在同一结构中 |
| 右侧 Panel 过重 | `NodeDetailPanel.tsx` 同时承载节点解释、KG3 Expansion、KG4 Workbench | AI Panel 从 Inspector 变成完整工作台 |
| Workspace 概念不足 | `CenterPanel.tsx` 只有 `graph` / `learning` 两个 tab | 无法容纳 Expansion Loading、Expansion Graph、Expand View |
| Node Expansion 分层不清 | 点击节点后右侧直接展开复杂内容 | 用户无法区分轻量解释和深度研究 |
| 扩展图谱状态附着在主图谱 | `kg4ExpansionGraph` 在 `App.tsx` 保存，传入 `KnowledgeGraph` | 缺少独立 expansion workspace 和 tab 生命周期 |
| 学习路径和图谱探索耦合 | `activeTab` 只区分 graph / learning | 后续 Field Memory、多论文阅读难接入 |

## 3. 新交互结构

### 3.1 总体布局

从旧布局：

```text
左侧 PDF / 中间图谱或学习路径 / 右侧 AI Tutor
```

升级为：

```text
Top Bar
Left Navigation Sidebar
Central Workspace
Right AI Context Panel
Optional Bottom Job Status Bar
```

建议结构：

```text
┌─────────────────────────────────────────────────────────┐
│ Top Bar: Paper / Workspace / Jobs / Settings             │
├──────────────┬──────────────────────────────┬───────────┤
│ Left Nav     │ Central Workspace             │ AI Panel  │
│ Workspaces   │ Graph / Stage / Expansion     │ Inspector │
│  - PDF Reader│ Expand View / Field Memory    │ Actions   │
│  - Paper Grph│                               │           │
│  - Arg Chain │                               │           │
│  - Method Me.│                               │           │
│  - Stage Lear│                               │           │
│ Memories     │                               │           │
└──────────────┴──────────────────────────────┴───────────┘
```

PDF Reader 作为独立的 Workspace Tab（`pdf_reader`），与其他 workspace 并列在左侧导航栏中。用户可以在阅读原文和查看图谱之间自由切换，不再使用固定左侧 PDF 面板。

### 3.2 Workspace View 类型

```ts
export type WorkspaceTabType =
  | 'pdf_reader'
  | 'paper_graph'
  | 'argument_chain'
  | 'method_mechanism'
  | 'stage_learning'
  | 'node_expansion_loading'
  | 'expansion_graph'
  | 'expand_view'
  | 'field_memory'
```

### 3.3 Selected Object 类型

```ts
export type SelectedObject =
  | { type: 'graph_node'; id: string }
  | { type: 'expansion_node'; id: string; expansionId: string }
  | { type: 'learning_stage'; id: string }
  | { type: 'algorithm_idea'; id: string; expansionId: string }
  | { type: 'memory_record'; id: string }
```

`activeTab` 决定中央工作区，`selectedObject` 决定右侧 AI Panel 内容。

## 4. 涉及组件

### 4.1 当前组件映射

| 现有组件 | 当前职责 | 重构后职责 |
|---|---|---|
| `App.tsx` | 全局状态、保存、三栏布局输入 | 管理 workspace state、selected object、paper session |
| `AppShell.tsx` | 布局容器 | 新 shell：Top Bar + Sidebar + Workspace + AI Panel |
| `AppHeader.tsx` | 顶部按钮 | 升级为 Top Bar，显示当前 paper/workspace/job 状态 |
| `PdfPanel.tsx` | 左侧 PDF | 已替换为独立 workspace `PdfReaderWorkspace`，通过左侧导航切换 |
| `CenterPanel.tsx` | graph/learning 切换 | 改为 Central Workspace router |
| `RightLearningPanel.tsx` | AI Tutor / Node Detail / Stage Detail | 改为 `AIContextPanel`，只显示轻量解释和操作入口 |
| `NodeDetailPanel.tsx` | 节点详情 + KG3/KG4 expansion | 拆分为轻量 `NodeInspector` 和中央 `ExpandView` |
| `KnowledgeGraph.tsx` | 当前论文图谱 + temporary layer | 继续作为 Paper Graph / Expansion Graph 的渲染基础 |
| `LearningPath.tsx` | 阶段学习路径 | 进入 Stage Learning Workspace |
| `StageDetail.tsx` | 阶段作答与反馈 | 由 Stage Learning Workspace 或 AI Panel 模板调用 |
| `kg4Workbench.ts` | 本地 KG4 workbench builder | 作为 Expand View 的 dev fixture 数据源 |

### 4.2 建议新增组件

```text
WorkspaceShell
TopBar
WorkspaceSidebar
CentralWorkspaceRouter
AIContextPanel
WorkspaceTabs
ArgumentChainView
MethodMechanismView
ExpansionLoadingView
ExpansionGraphView
ExpandView
FieldMemoryView
NodeInspector
ExpansionNodeInspector
AlgorithmIdeaInspector
MemoryRecordInspector
```

## 5. 状态设计

### 5.1 Workspace State

```ts
export interface WorkspaceState {
  activeTabId: string
  tabs: WorkspaceTab[]
  selectedObject?: SelectedObject
  activePaperId?: string
  activeNodeId?: string
  activeExpansionId?: string
}

export interface WorkspaceTab {
  id: string
  type: WorkspaceTabType
  title: string
  paperId?: string
  nodeId?: string
  expansionId?: string
  closable: boolean
  status?: 'idle' | 'loading' | 'ready' | 'failed'
}
```

### 5.2 Node Expansion UI State

```ts
export interface NodeExpansionUIState {
  id: string
  nodeId: string
  status: 'idle' | 'loading' | 'ready' | 'failed' | 'empty'
  currentStep?: string
  steps: Array<{
    id: string
    label: string
    status: 'pending' | 'running' | 'done' | 'failed'
  }>
  expansionGraph?: Kg4ExpansionGraphLayer
  errorMessage?: string
  usesMockData: boolean
}
```

### 5.3 状态原则

1. `selectedObject` 只控制右侧 AI Panel。
2. `activeTabId` 只控制中央主内容。
3. Node Expansion 的 loading / ready / failed 必须属于一个 workspace tab。
4. 关闭 expansion tab 不删除长期数据。
5. 临时扩展图谱可清除，但可由历史 expansion record 恢复。

## 6. 主要用户流程

### 6.1 当前论文学习

```text
上传 PDF
→ 分析论文
→ Paper Graph Workspace 展示图谱
→ 点击节点
→ AI Panel 显示轻量 Node Inspector
```

### 6.2 阶段学习

```text
左侧导航点击 Stage Learning
→ Central Workspace 展示 LearningPath / StageDetail
→ 选择阶段
→ 用户作答
→ AI 诊断
→ 更新阶段状态
```

### 6.3 节点展开

```text
点击 expandable graph node
→ AI Panel 显示「展开该方向」
→ 点击按钮
→ 新建 Node Expansion Loading Tab
→ 显示检索和分析步骤
→ 完成后切换到 Expansion Graph View
→ 点击扩展节点
→ AI Panel 显示 Expansion Node Inspector
→ 点击进入 Expand View
→ Central Workspace 展示完整 KG4 Workbench
```

## 7. 不在范围内的内容

本轮不实现：

1. 新增真实论文检索 API；
2. 新增 LLM task 类型；
3. 新增长期记忆 schema；
4. PDF 选中文字解释；
5. PDF 证据高亮；
6. 图谱节点定位到 PDF；
7. 新图谱融合算法；
8. 多用户同步；
9. 云端 workspace 存储。

## 8. 验收标准

1. 有 Top Bar、Left Sidebar、Central Workspace、Right AI Context Panel。
2. Paper Graph、Argument Chain、Method Mechanism、Stage Learning 可作为独立 workspace 切换。
3. 点击普通节点只更新右侧轻量解释，不展示完整 expansion。
4. 点击可展开节点显示「展开该方向」操作。
5. 点击展开后进入 Expansion Loading View，而不是在 AI Panel 直接展开全部内容。
6. Expansion Loading View 显示步骤和数据源状态。
7. 完成后进入 Expansion Graph View，展示浅色临时扩展节点。
8. 点击扩展节点时 AI Panel 只显示摘要和操作入口。
9. 只有进入 Expand View 后才展示 Algorithm Idea Cards、对比表、反馈和 memory 保存。
10. 原上传、分析、图谱、阶段学习、作答、诊断流程不被破坏。

## 9. 风险与 fallback

| 风险 | fallback |
|---|---|
| 一次性重构过大 | 先保留旧组件，外层加 WorkspaceShell，逐步迁移内容 |
| 用户找不到 PDF | PDF 作为独立 Workspace Tab 出现在左侧导航栏，与 Paper Graph 等并列切换 |
| AI Panel 过空 | 使用明确模板和操作入口，而不是搬回完整内容 |
| Node Expansion 状态复杂 | MVP 用本地 fixture 模拟 loading steps，再接真实 job |
| Workspace tab 太多 | 左侧导航分组 + 可关闭 tab + 最近展开列表 |
| 破坏阶段学习 | Stage Learning 独立 workspace，复用现有 `LearningPath` / `StageDetail` |
