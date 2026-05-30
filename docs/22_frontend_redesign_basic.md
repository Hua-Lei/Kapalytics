# Frontend Workspace Redesign 初步需求文档

## 1. 背景

当前项目已经完成 KG4.0，知识图谱能力、节点展开、长期记忆、论文检索、LLM 任务派发和图谱融合等基础能力已经逐步具备。

但随着功能复杂度提升，当前前端界面逐渐不适合承载以下内容：

- 当前论文知识图谱；
- 论文论证链；
- 方法机制图；
- 分阶段学习路径；
- 节点详情；
- 可展开节点；
- Node Expansion 检索与分析过程；
- 扩展子图；
- 相关论文 / 算法思想卡；
- 多论文对比；
- 长期领域图谱；
- 学习记录与反馈。

因此需要对前端进行一次信息架构与交互逻辑重构。

本轮重构重点不是新增 AI 能力，而是重新组织已有能力，使系统从“单页面论文学习工具”升级为“多工作区论文研究学习台”。

---

## 2. 重构目标

本轮前端重构的目标是：

> 建立一个可扩展的 Workspace 式前端框架，让用户可以在当前论文学习、图谱探索、节点展开、对比阅读和长期记忆之间清晰切换，而不是把所有内容挤在一个三栏页面中。

具体目标：

1. 降低主界面信息密度；
2. 区分轻量节点解释和深度节点展开；
3. 支持图谱放大和独立探索；
4. 保留分阶段学习路径；
5. 支持 Node Expansion 的检索、分析、扩展子图和深度 Expand View；
6. 让右侧 AI Panel 成为上下文解释入口，而不是承载所有复杂内容；
7. 为后续长期领域图谱、多论文阅读和学习记忆预留空间；
8. 保持原有学习闭环不被破坏。

课程评分标准强调系统需要有清晰模块、完整学习闭环、明确 AI 触发条件与交互逻辑 [1]。因此本轮前端重构应突出“用户操作触发什么 AI 行为、AI 结果展示在哪里、用户下一步如何继续学习”。

---

## 3. 总体设计原则

### 3.1 从三栏布局升级为 Workspace 架构

旧思路：

```text
左侧 PDF / 中间图谱 / 右侧 AI 面板
```

新思路：

```text
顶部全局栏
+ 左侧导航栏
+ 中央主工作区
+ 右侧上下文 AI Panel
+ 可选底部任务状态区
```

建议整体结构：

```text
┌──────────────────────────────────────────────┐
│ Top Bar：当前论文 / 当前 Workspace / 任务状态 │
├────────┬─────────────────────────┬───────────┤
│ 左侧导航 │ 中央 Workspace 主工作区   │ 右侧AI面板 │
│        │ 图谱/阶段/展开/对比/记忆   │ 上下文操作 │
└────────┴─────────────────────────┴───────────┘
```

### 3.2 不要同时展示所有功能

前端应通过：

```text
Workspace View 切换
+ Tab
+ Context Panel
+ Modal / Drawer
```

控制信息层级。

用户当前只应聚焦一个主要任务，例如：

- 看当前论文图谱；
- 做阶段学习；
- 展开某个节点；
- 查看扩展子图；
- 进入某个 Expand View；
- 查看长期领域图谱。

### 3.3 右侧 AI Panel 只做上下文轻量操作

右侧 AI Panel 不应变成“所有信息都塞进去”的万能区域。

它主要承担：

- 当前选中对象的简要解释；
- 当前对象的重要性；
- 当前对象在论文中的作用；
- 操作入口；
- 轻量反馈；
- 跳转入口。

复杂内容应进入中央主工作区或新的 Workspace Tab。

---

## 4. 页面总体信息架构

建议前端分为以下几个主要区域。

## 4.1 Top Bar

### 作用

显示全局状态和当前工作上下文。

### 内容建议

```text
- 当前论文标题
- 当前 Workspace 名称
- 当前分析状态 / LLM Job 状态
- 全局搜索入口
- 设置 / 数据源状态
```

示例：

```text
Kapalytics | Paper: Text-to-LoRA | Workspace: Paper Graph | Jobs: 2 running
```

### 要求

- Top Bar 不承载复杂操作；
- 只显示全局信息和状态；
- LLM 任务运行中应有明确提示。

---

## 4.2 Left Navigation Sidebar

### 作用

作为工作区入口，而不是具体内容展示区。

### 建议导航结构

```text
当前论文
- Paper Graph
- Argument Chain
- Method Mechanism
- Stage Learning

Node Expansion
- 已展开节点 A
- 已展开节点 B
- 当前运行中的展开任务

Field Memory
- Long-term Field Graph
- Read Papers
- Understanding Memories
```

### 要求

- 左侧只负责导航和切换；
- 不展示大段 AI 内容；
- 用户可以清楚知道当前处于哪个工作区；
- Node Expansion 生成的新工作区应自动出现在左侧导航或 Tab 中。

---

## 4.3 Central Workspace

### 作用

承载当前主要任务。

### 必须支持的 Workspace View

```text
1. Paper Graph View
2. Argument Chain View
3. Method Mechanism View
4. Stage Learning View
5. Node Expansion Loading View
6. Expansion Graph View
7. Expand View
8. Field Memory View
```

其中，前四个属于当前论文学习；后四个属于节点展开和长期领域学习。

---

## 4.4 Right AI Context Panel

### 作用

根据用户当前选中对象，显示轻量解释和操作入口。

### 不同上下文下的内容

| 当前选中对象 | AI Panel 显示内容 |
|---|---|
| 普通图谱节点 | 简要解释、whyImportant、roleInPaper、证据摘要 |
| 可展开节点 | 简要解释 + 展开该方向按钮 |
| 扩展节点 | 扩展节点摘要、与原节点关系、进入 Expand View |
| 学习阶段 | 阶段目标、当前任务、作答入口、反馈摘要 |
| Algorithm Idea Card | 核心思想、关键假设、与当前论文关系 |
| 长期记忆记录 | 用户历史理解、AI反馈摘要、复用入口 |

### 要求

- AI Panel 是 Inspector，不是完整工作台；
- 不应在 AI Panel 中展示完整论文列表、长对比表、复杂图谱；
- 复杂操作跳转到 Central Workspace 或新 Tab。

---

## 5. Workspace View 设计

## 5.1 Paper Graph View

### 目标

展示当前论文的知识图谱。

KG 系统已经要求图谱不仅展示实体，还应服务论文 insight、节点角色和领域扩展 [5]。

### 内容

- 当前论文图谱；
- 节点类型样式；
- 可展开节点标识；
- 图谱缩放 / 拖拽 / 重置视图；
- 节点点击后，右侧 AI Panel 显示 Node Inspector。

### 节点点击逻辑

普通节点：

```text
点击节点
→ 右侧 AI Panel 显示轻量解释
```

可展开节点：

```text
点击节点
→ 右侧 AI Panel 显示轻量解释
→ 显示「展开该方向」按钮
```

### 要求

- Paper Graph View 不直接展示完整 Node Expansion 内容；
- 图谱区域应支持放大查看；
- 可展开节点需要有视觉标记。

---

## 5.2 Argument Chain View

### 目标

展示论文论证链。

KG 2.0 中要求系统帮助用户理解：

```text
已有方法不足 → 本文 insight → 方法机制 → 实验证据 → 局限
```

这也是从实体图升级为论文驱动领域学习图谱的核心要求 [5]。

### 内容

```text
领域背景
→ 核心瓶颈
→ prior limitation
→ central insight
→ method mechanism
→ evidence chain
→ remaining gap
```

### 要求

- 该视图用于帮助用户理解论文主线；
- 不需要展示所有节点；
- 应突出 PaperInsight；
- 点击链条中的元素仍可在右侧 AI Panel 展示轻量解释。

---

## 5.3 Method Mechanism View

### 目标

展示方法如何工作。

KG 2.0 要求 method 节点展示流程，formula 节点展示符号解释和训练目标 [5]。

### 内容

```text
输入
→ 编码 / 表征
→ 核心模块
→ 训练目标
→ 输出
→ 推理 / 应用方式
```

### 要求

- 可以复用现有 methodFlow / formulaExplanation；
- 点击某个步骤，右侧 AI Panel 展示该步骤说明；
- 不承载 Node Expansion。

---

## 5.4 Stage Learning View

### 目标

保留原有分阶段学习路径。

课程评分标准要求完整链路：

```text
输入 / 知识点 → AI讲解 → 用户尝试 → AI反馈 → 再强化 / 迁移
```

因此 Stage Learning 仍然是项目评分核心之一 [1]。

### 内容

固定阶段可以继续保留：

```text
field_positioning
problem_motivation
method_overview
formula_algorithm
experiment_analysis
contribution_limitation
transfer_comparison
```

### 要求

- 阶段学习不应被图谱探索替代；
- 用户作答和 AI 反馈逻辑继续保留；
- Stage Learning View 可以独立作为一个 Workspace。

---

## 6. Node Expansion 分层交互设计

这是本轮前端重构的重点。

Node Expansion 的原始目标是让用户从单篇论文中的关键节点继续深入学习一个研究方向，而不是变成普通论文推荐 [2]。

新版交互需要严格分层：

```text
Node Inspector
→ Expansion Loading View
→ Expansion Graph View
→ Expand View
```

---

## 6.1 第一层：Node Inspector

### 位置

右侧 AI Context Panel。

### 触发

用户点击任意图谱节点。

### 普通节点显示

```text
节点名称
节点类型
一句话解释
为什么重要
它在论文中的作用
相关证据摘要
```

### 可展开节点额外显示

```text
[展开该方向]
```

按钮只在节点满足以下条件时显示：

```ts
expandable: true
expansionType: 'field_overview' | 'related_papers' | 'method_evolution' | 'comparison'
searchQueries: string[]
```

这些字段在 Prompt Schema 中已有定义 [3]。

### 要求

- Node Inspector 只做轻量解释；
- 不展示完整扩展结果；
- 不展示复杂论文列表；
- 不展示大对比表。

---

## 6.2 第二层：Expansion Loading View

### 触发

用户点击「展开该方向」。

### 位置

中央 Workspace。

可以采用两种方式之一：

```text
方式 A：中央主工作区切换到 Expansion Loading View
方式 B：打开新的 Workspace Tab，例如「展开：Test-Time Training」
```

推荐使用方式 B，方便用户回到当前论文图谱。

### 显示内容

展示节点展开过程，而不是空白等待。

示例：

```text
正在展开节点：Test-Time Training

步骤 1：读取当前节点 label / insight / searchQueries
步骤 2：生成检索查询
步骤 3：搜索相关论文
步骤 4：筛选与排序
步骤 5：抽取算法思想
步骤 6：生成扩展子图
步骤 7：准备进入 Expansion Graph
```

### 要求

- 显示任务进度；
- 显示当前使用的数据源；
- 如果使用 mock library，需要明确标注；
- 如果无结果，需要显示空状态；
- 不能让 LLM 编造论文。

相关论文只能来自 mock library 或真实检索结果，LLM 只能总结、比较和生成任务，不能编造论文 [2][3]。

---

## 6.3 第三层：Expansion Graph View

### 目标

分析完成后，在图谱中从原节点引申出其他浅色节点，形成扩展子图。

### 显示方式

以原节点为中心：

```text
原节点：Online Learning Algorithm
├── 浅色节点：Experience Replay 路线
├── 浅色节点：Meta-learning Adaptation 路线
├── 浅色节点：Policy Regularization 路线
├── 浅色节点：Continual Adaptation 路线
└── 浅色节点：Test-time Update 路线
```

### 节点类型

扩展节点可以包括：

```text
related_paper
algorithm_idea
method_family
prerequisite_concept
open_problem
```

### 视觉规则

- 原节点高亮；
- 扩展节点使用浅色；
- 扩展边使用虚线或较浅颜色；
- 扩展节点默认是 temporary；
- 不自动写入长期领域图谱；
- 用户可清除扩展结果；
- 用户可选择进入更深层 Expand View。

### 右侧 AI Panel 行为

当用户点击扩展节点时，右侧只显示摘要：

```text
扩展节点名称
一句话解释
与原节点关系
来源论文数量
操作：
- 进入 Expand View
- 加入对比
- 查看来源
```

### 要求

- 右侧 AI Panel 不承载完整扩展内容；
- 完整论文列表、算法思想卡、对比表应进入 Expand View；
- 扩展节点不能污染当前论文原始图谱。

---

## 6.4 第四层：Expand View

### 触发

用户在 Expansion Graph 中点击某个扩展节点，然后选择：

```text
进入 Expand View
```

### 位置

新的 Workspace Tab 或中央 Workspace 独立页面。

### 内容

Expand View 是完整的节点深度研究工作台。

建议包含：

```text
A. 扩展子图
B. 相关论文列表
C. Algorithm Idea Cards
D. 算法思想对比表
E. 用户理解记录
F. AI reflective feedback / remedial feedback
G. 可选迁移任务
```

### 要求

- 只有用户明确进入 Expand View 后，才展示复杂内容；
- Expand View 可以调用长期记忆、图融合建议、对比工作台；
- 迁移任务可以作为 optional，不应成为主流程；
- 用户理解记录应可保存。

---

## 7. Node Expansion 推荐完整链路

最终交互链路应为：

```text
用户点击普通节点
→ 右侧 AI Panel 显示简要解释

用户点击可展开节点
→ 右侧 AI Panel 显示简要解释 + 展开按钮

用户点击「展开该方向」
→ 打开新的 Workspace Tab
→ 显示 Expansion Loading View
→ 展示检索、筛选、分析、生成扩展图过程

分析完成
→ 进入 Expansion Graph View
→ 原节点旁生成浅色临时扩展节点

用户点击某个浅色扩展节点
→ 右侧 AI Panel 显示扩展节点摘要

用户点击「进入 Expand View」
→ 打开完整 Node Expansion 工作台
→ 进行算法思想对比、理解记录、AI反馈、长期记忆或可选迁移任务
```

---

## 8. Workspace Tab 设计

### 目标

避免界面无限加栏。

### Tab 类型

```ts
type WorkspaceTabType =
  | 'paper_graph'
  | 'argument_chain'
  | 'method_mechanism'
  | 'stage_learning'
  | 'node_expansion_loading'
  | 'expansion_graph'
  | 'expand_view'
  | 'field_memory'
```

### Tab 示例

```text
[当前论文：Paper A]
[图谱：Paper A]
[展开：Test-Time Training]
[Expand View：Continual TTA]
[领域图谱：PEFT]
```

### 要求

- 用户可以关闭 Node Expansion Tab；
- 当前论文主 Tab 不应被破坏；
- 关闭 Tab 不应删除数据库中的长期记录；
- 临时扩展结果关闭后可以重新生成或从历史中恢复。

---

## 9. AI Panel 设计规范

### 9.1 AI Panel 的定位

AI Panel 是：

```text
Context-aware Inspector + Action Launcher
```

不是：

```text
万能聊天框
完整论文推荐区
完整对比工作台
完整学习路径页面
```

### 9.2 AI Panel 内容模板

#### 普通节点

```text
标题
类型
一句话解释
为什么重要
在论文中的作用
操作：
- 查看相关证据
```

#### 可展开节点

```text
标题
类型
一句话解释
为什么重要
在论文中的作用
可展开原因
操作：
- 展开该方向
```

#### 扩展节点

```text
标题
扩展节点类型
与原节点关系
来源数量
操作：
- 进入 Expand View
- 加入对比
- 查看来源
```

#### 学习阶段

```text
阶段目标
当前任务
用户作答框
提交
反馈摘要
```

### 9.3 要求

- 面板内容必须短；
- 长内容应通过“进入 View”打开；
- 每种选中对象有明确模板；
- 不同上下文下的操作按钮要明确。

---

## 10. 状态与交互要求

### 10.1 需要管理的前端状态

建议至少包括：

```ts
interface WorkspaceState {
  activeTabId: string
  tabs: WorkspaceTab[]
  selectedObject?: SelectedObject
  activePaperId?: string
  activeNodeId?: string
  activeExpansionId?: string
}
```

```ts
interface SelectedObject {
  type:
    | 'graph_node'
    | 'expansion_node'
    | 'learning_stage'
    | 'algorithm_idea'
    | 'memory_record'
  id: string
}
```

### 10.2 Node Expansion 状态

```ts
interface NodeExpansionUIState {
  nodeId: string
  status: 'idle' | 'loading' | 'ready' | 'failed'
  currentStep?: string
  expansionGraphId?: string
  errorMessage?: string
}
```

### 10.3 状态原则

- 选中对象决定右侧 AI Panel 内容；
- activeTab 决定中央 Workspace；
- Node Expansion 的加载、完成、失败状态必须可视化；
- 关闭 Tab 不应破坏主学习状态。

---

## 11. 不在本轮范围内的功能

本轮前端重构暂不处理以下功能：

1. PDF 选中文字解释；
2. PDF 公式解释；
3. 图谱节点定位到 PDF；
4. PDF 证据高亮；
5. 新增真实论文检索 API；
6. 新增 LLM 分析能力；
7. 新增长期记忆 schema；
8. 新增图谱融合算法。

这些功能后续可以接入 Workspace 架构，但不是本轮重构目标。

---

## 12. 验收标准

本轮前端重构完成后，应满足：

### 基础布局

- 有 Top Bar；
- 有 Left Navigation Sidebar；
- 有 Central Workspace；
- 有 Right AI Context Panel；
- 各区域职责清晰。

### Workspace

- 可以切换 Paper Graph、Argument Chain、Method Mechanism、Stage Learning；
- 可以打开 Node Expansion 相关 Workspace；
- 不同工作区之间不会相互挤占。

### Node 点击

- 点击普通节点只在右侧显示轻量解释；
- 点击可展开节点显示「展开该方向」；
- 不在 AI Panel 中塞完整扩展内容。

### Node Expansion

- 点击「展开该方向」后进入 Expansion Loading View；
- Loading View 显示检索和分析步骤；
- 完成后进入 Expansion Graph View；
- 原节点旁出现浅色扩展节点；
- 点击扩展节点时，右侧只显示摘要和操作入口；
- 点击「进入 Expand View」后才展示完整扩展内容。

### 信息层级

- AI Panel 不再作为复杂内容容器；
- 复杂内容进入 Central Workspace 或 Workspace Tab；
- 用户能清楚知道自己处于当前论文学习、节点展开还是长期领域探索。

### 兼容性

- 原有上传、分析、图谱、阶段学习、作答、诊断流程不被破坏；
- KG4.0 已有能力能逐步接入新界面；
- 相关论文不由 LLM 编造的约束继续保留 [2][3]。

---

## 13. 分阶段实现建议

### v4.1 Workspace Shell

目标：

- 搭建新版前端外壳；
- 实现 Top Bar、Left Sidebar、Central Workspace、Right AI Panel；
- 先用 mock tab 和 mock selectedObject。

完成标准：

- 页面结构稳定；
- 可以切换几个基础 Workspace；
- 右侧 Panel 能根据 selectedObject 切换模板。

---

### v4.2 Paper Graph 与 AI Panel 分离

目标：

- Paper Graph View 只展示图谱；
- 节点点击只更新 AI Panel；
- 普通节点与可展开节点显示不同操作。

完成标准：

- 点击普通节点显示轻量解释；
- 点击 expandable 节点显示展开按钮；
- 不在右侧展示完整扩展内容。

---

### v4.3 Node Expansion Loading View

目标：

- 点击展开按钮打开新的 Workspace Tab；
- 展示 expansion loading steps；
- 接入已有 Node Expansion 状态。

完成标准：

- 用户可以看到展开过程；
- 成功、失败、空结果均有状态；
- 不影响原图谱 Tab。

---

### v4.4 Expansion Graph View

目标：

- 展开完成后显示原节点 + 浅色扩展节点；
- 点击扩展节点只在右侧显示摘要。

完成标准：

- 原节点高亮；
- 扩展节点浅色；
- 扩展边样式区分；
- 可清除扩展结果。

---

### v4.5 Expand View

目标：

- 用户点击扩展节点后进入完整 Expand View；
- 展示相关论文、Algorithm Idea Cards、对比与理解记录。

完成标准：

- 完整内容不再挤在 AI Panel；
- Expand View 与 Expansion Graph 分离；
- 可从 Expand View 返回 Expansion Graph。

---

## 14. Agent 本轮任务建议

请基于本文档和当前项目代码结构，生成正式前端重构设计文档。

建议输出：

```text
docs/23_frontend_workspace_redesign_requirements.md
docs/24_workspace_interaction_model.md
docs/25_node_expansion_ui_flow.md
docs/26_ai_context_panel_design.md
docs/27_frontend_redesign_iteration_plan.md
```

每份文档需要包含：

- 目标；
- 当前问题；
- 新交互结构；
- 涉及组件；
- 状态设计；
- 主要用户流程；
- 不在范围内的内容；
- 验收标准；
- 风险与 fallback。

本轮不要直接改业务代码。
```

---

这份文档的核心是把前端重构压成一句话：

> **右侧 AI Panel 只做轻量上下文解释；复杂内容进入中央 Workspace；Node Expansion 分成 Inspector、Loading、Expansion Graph、Expand View 四层。**

这样后续即使继续加 PDF、真实检索、多论文图谱、长期记忆，也不会把界面继续堆爆。