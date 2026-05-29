# Knowledge Graph 2.0 需求文档

## 1. 背景

Kapalytics 是一个基于 Electron + React + Vite + TypeScript 的 AI 论文深度学习助手。项目目标不是普通论文总结器，而是帮助用户通过阅读 AI 论文建立可迁移的知识结构。

当前 V1.0 已经形成基础闭环：

```text
上传论文
→ 生成论文知识图谱
→ 分层学习
→ 每阶段生成小任务
→ 用户作答
→ AI 错误诊断
→ 针对性反馈
→ 更新学习状态
→ 强化/迁移学习
```

当前知识图谱已经能展示论文中的领域、概念、问题、方法、公式、实验和局限节点，但整体仍偏“论文内容实体抽取图”。KG 2.0 的目标是把它升级为“论文驱动的领域学习图谱”。

## 2. 当前问题

### 2.1 图谱不够有 insight

当前图谱可以回答“这篇论文有哪些概念”，但没有充分回答：

- 这篇论文在领域中的关键洞察是什么；
- 它解决了已有方法的什么核心瓶颈；
- 它的方法为什么值得关注；
- 它在整个领域演进中处于什么位置；
- 用户应该沿着哪个节点继续深入学习。

KG 2.0 需要把图谱从实体网络升级为论证结构和领域学习结构。

### 2.2 节点详情不够实用

当前节点详情主要展示 `label`、`type`、`description`。这对浅层理解够用，但不足以支持深度学习。

例如 formula 节点应展示：

- KaTeX 公式；
- 符号逐项解释；
- 训练目标含义；
- 它位于方法流程的哪个环节；
- 如果去掉或修改该项会导致什么影响。

method 节点应展示流程结构，experiment 节点应展示 claim-evidence 表，limitation 节点应展示失败条件分析。

### 2.3 图谱没有连接到领域学习

用户读一篇论文时，往往不知道它在更大研究方向中的位置。

KG 2.0 需要支持从单篇论文节点扩展到领域知识结构，例如：

- 从 Continual Learning 节点扩展出核心问题、方法分类和代表论文；
- 从 Test-Time Training 节点扩展出近年方法演进；
- 从 LoRA / Hypernetwork 节点扩展出参数高效适配路线。

## 3. KG 2.0 目标

KG 2.0 要从：

```text
单篇论文内容结构图
```

升级为：

```text
论文驱动的领域学习图谱
```

它不仅回答：

> 这篇论文讲了什么？

还要回答：

> 这篇论文为什么重要？
> 它在领域中处于什么位置？
> 它继承、改进或挑战了哪些已有方法？
> 用户可以从哪个节点继续深入学习一个方向？

## 4. 新增功能列表

### F1：论文核心洞察提取

新增论文级 insight 数据：

```ts
interface PaperInsight {
  centralInsight: string
  priorLimitation: string
  methodMechanism: string
  evidenceChain: string[]
  remainingGap: string
}
```

字段含义：

- `centralInsight`：论文最核心的思想转折；
- `priorLimitation`：已有方法的关键不足；
- `methodMechanism`：本文如何把 insight 落地成算法机制；
- `evidenceChain`：哪些公式、实验或结果支撑这个 insight；
- `remainingGap`：该方法仍未解决的问题。

### F2：节点数据结构增强

GraphNode 需要从简单内容节点升级为学习节点：

```ts
interface GraphNode {
  id: string
  type: 'field' | 'concept' | 'problem' | 'method' | 'formula' | 'experiment' | 'limitation'
  label: string
  description: string
  x: number
  y: number

  insight?: string
  whyImportant?: string
  roleInPaper?: string
  contrastWithPrior?: string
  evidenceNodeIds?: string[]

  expandable?: boolean
  expansionType?: 'field_overview' | 'related_papers' | 'method_evolution' | 'comparison'
  searchQueries?: string[]
}
```

新增字段应优先用于右侧节点详情和后续 Node Expansion。

### F3：三种图谱视图

KG 2.0 需要支持三种视图。MVP 可以先通过 tab 或 view switch 呈现，不要求三套完全独立布局。

#### 论文论证图

回答：这篇论文为什么提出这个方法？

结构：

```text
领域背景
→ 核心瓶颈
→ 现有方法不足
→ 本文 central insight
→ 方法机制
→ 实验证据
→ 局限
```

#### 方法机制图

回答：这个方法到底怎么工作？

结构：

```text
输入
→ 编码/表征
→ 核心模块
→ 训练目标
→ 输出
→ 推理/应用方式
```

#### 领域扩展图

回答：当前论文中的某个领域/方法节点，在更大的研究方向中处于什么位置？

结构示例：

```text
Parameter-Efficient Fine-Tuning
→ Adapter / Prefix / Prompt Tuning
→ LoRA
→ Task-specific LoRA
→ Hypernetwork-generated LoRA
→ Text-to-LoRA / Doc-to-LoRA
```

### F4：节点详情页结构化

节点详情应根据节点类型展示不同结构。

#### field 节点

展示：

- 领域定义；
- 该领域核心问题；
- 当前论文与该领域的关系；
- 代表方法类别；
- 可扩展阅读入口。

#### concept 节点

展示：

- 概念解释；
- 论文中如何使用该概念；
- 容易混淆的相邻概念；
- 与当前论文 central insight 的关系。

#### method 节点

展示：

- 方法流程；
- 输入；
- 核心模块；
- 输出；
- 相比已有方法改在哪里；
- 哪些实验验证它有效。

#### formula 节点

展示：

- KaTeX 公式；
- 符号逐项解释；
- 训练目标解释；
- 它在方法流程中的位置；
- 如果去掉或改变该项会发生什么。

#### experiment 节点

展示 claim-evidence 表：

| 实验 | 验证的 claim | 观察结果 | 支持的结论 |
|---|---|---|---|

#### limitation 节点

展示失败条件：

```text
局限
├── 条件 1：什么时候失败
├── 条件 2：依赖什么假设
└── 条件 3：泛化到哪里可能出问题
```

### F5：节点级领域扩展

field / concept / method 节点如果标记为 `expandable`，右侧应展示“展开该方向”入口。

点击后进入 Node Expansion 流程：

```text
当前节点
→ 生成检索查询
→ 查找相关论文
→ 生成领域概览
→ 生成方法分类
→ 生成代表论文列表
→ 生成当前论文 vs 代表论文对比
→ 生成迁移/对比任务
```

### F6：相关论文检索策略

不要让 LLM 凭空编造相关论文。实现分两阶段：

1. 展示版：使用项目内置 mock paper library。
2. 真实检索版：后续接入 Semantic Scholar、arXiv、OpenAlex 或本地论文库。

UI 必须说明当前数据来源。如果使用 mock 库，应明确展示“当前版本使用内置候选论文库”。

### F7：代表论文对比阅读

支持生成当前论文与代表论文的对比表。

对比维度：

| 维度 | 当前论文 | 代表论文 |
|---|---|---|
| 研究问题 | 当前论文解决什么 | 对方解决什么 |
| 方法类别 | 当前方法类型 | 对方方法类型 |
| 训练/适配阶段 | 训练时 / 测试时 / 持续测试时 | 对方设置 |
| 是否需要标签 | 是否需要监督信号 | 对方是否需要 |
| 更新对象 | 全模型 / Adapter / LoRA / BN 参数 | 对方更新对象 |
| 优势 | 当前论文优势 | 对方优势 |
| 局限 | 当前论文局限 | 对方局限 |
| 可结合点 | 二者如何结合 | 融合方向 |

对比后应生成迁移任务，并接入原有“作答 → 诊断 → 反馈”闭环。

### F8：轻量多论文融合图谱

该功能不阻塞 KG 2.0 MVP，可作为后续增强。

轻量版目标：

```text
节点去重
+ 关系合并
+ 来源标记
+ 综合解释
```

建议数据结构：

```ts
interface MergedGraphNode {
  id: string
  label: string
  type: string
  sources: string[]
  descriptions: string[]
  consensusSummary: string
}
```

## 5. 与学习闭环的关系

KG 2.0 不能变成普通论文推荐工具，必须服务原有学习闭环。

新增功能应接入以下链路：

```text
AI 讲解
→ 用户尝试
→ AI 反馈
→ 再强化/迁移
```

具体要求：

- PaperInsight 帮助用户建立论文主线；
- 节点详情帮助用户理解局部机制；
- Node Expansion 帮助用户从单篇论文进入领域学习；
- 相关论文对比用于生成迁移任务；
- 用户对迁移任务作答后仍由诊断模块反馈。

## 6. 优先级

### P0：必须做

1. PaperInsight 提取；
2. GraphNode 增加 `insight` / `roleInPaper` / `evidenceNodeIds`；
3. 节点详情页结构化；
4. method 节点流程展示；
5. formula 节点公式拆解；
6. experiment 节点 claim-evidence 表。

### P1：强烈建议

1. 论文论证图；
2. 方法机制图；
3. field / concept / method 节点 expandable；
4. mock related paper library；
5. 当前论文 vs 代表论文对比表。

### P2：后续扩展

1. 真实论文检索 API；
2. 多论文融合图谱；
3. 自动生成领域学习路径；
4. 大规模领域知识地图。

## 7. 验收标准

KG 2.0 MVP 完成后应满足：

- 图谱可以展示论文 central insight；
- 用户能从图谱理解“已有方法不足 → 本文 insight → 方法机制 → 实验证据 → 局限”；
- 不同类型节点详情有结构化展示，而不是单段文字；
- formula 节点能渲染公式并解释符号；
- method 节点能展示流程；
- experiment 节点能展示 claim-evidence；
- 至少 field / concept / method 节点支持 expandable 标记和 searchQueries；
- 相关论文不由 LLM 凭空编造，展示版使用 mock 库；
- 对比阅读能生成迁移任务并接入诊断反馈；
- 修改后仍保持上传、分析、学习、作答、诊断、保存的基础闭环。

## 8. 对课程评分标准的提升

KG 2.0 对评分标准的提升：

- 学习问题建模：从论文实体抽取升级为论文论证链和领域学习路径。
- AI 参与机制：AI 不只总结论文，还生成 insight、节点角色、证据链和扩展任务。
- 完整学习闭环：相关论文对比和迁移任务继续接入作答与诊断。
- 错误反馈质量：节点详情和 evidence chain 为诊断反馈提供更明确依据。
- 可扩展性：Node Expansion 和 mock paper library 为真实检索 API 预留接口。
- 实现质量：通过 schema 化、结构化节点详情和分阶段迭代降低实现风险。
