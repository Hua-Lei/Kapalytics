# 任务：根据需求上下文生成 Knowledge Graph 2.0 修改文档

请先阅读项目已有文档和代码结构，但本轮不要修改业务代码，只生成/更新设计文档。

## 一、项目背景

当前项目是一个基于 Electron + React + Vite + TypeScript 的 AI 论文深度学习助手。

项目目标不是普通论文总结器，而是帮助用户通过阅读 AI 论文建立知识结构。核心闭环是：

上传论文
→ 生成论文知识图谱
→ 分层学习
→ 每阶段生成小任务
→ 用户作答
→ AI 错误诊断
→ 针对性反馈
→ 更新学习状态
→ 强化/迁移学习

该项目需要符合课程评分标准中的要求：
- 学习问题建模；
- AI 参与机制；
- 完整学习闭环；
- 错误反馈质量；
- 可扩展性；
- 实现质量 [1]。

当前项目已经做到 V1.0，并经历过一次前端重构。现在希望进入功能体验深度打磨阶段。

---

## 二、当前主要问题

当前知识图谱功能虽然能展示论文中的节点，例如领域、概念、问题、方法、公式、实验、局限等，但存在以下不足：

### 1. 图谱不够有 insight

现在的图谱更像是“论文内容实体抽取图”，没有真正抓住：

- 这篇论文在领域中的关键洞察是什么；
- 它解决了已有方法的什么核心瓶颈；
- 它的方法为什么值得关注；
- 它在整个领域演进中处于什么位置。

例如一篇关于 Continual Learning / Test-Time Training / LoRA / Hypernetwork 的论文，图谱应该不仅告诉用户有哪些概念，还应该说明：

```text
已有方法的问题是什么
→ 本文的关键思想转折是什么
→ 方法机制如何实现这个思想
→ 哪些实验验证了它
→ 它还没有解决什么问题
```

### 2. 节点详情不够实用

现在点击某个节点后，右侧基本只是显示文字描述。

例如点击“元训练目标”后，只显示一段公式说明。  
但用户真正需要的是：

- 公式拆解；
- 符号解释；
- 该目标在训练过程中的位置；
- 它如何服务于论文核心方法；
- 它和实验 claim 的关系。

类似地，点击 method 节点时，应该能看到流程图；点击 experiment 节点时，应该能看到 claim-evidence 表；点击 limitation 节点时，应该能看到失败条件分析。

### 3. 图谱没有连接到领域学习

用户读一篇论文时，往往不知道它在整个研究领域中的位置。

例如：
- 如果论文属于 Continual Learning，系统应该能从这个领域节点扩展出该领域的关键问题、方法分类、综述和代表论文。
- 如果识别出 Test-Time Training / Test-Time Adaptation 节点，系统应该能围绕这个节点查找近几年有影响力的论文，形成对比阅读和方法演进谱系。
- 如果识别出 LoRA / Hypernetwork / Adapter Generation 节点，系统应该能展示参数高效适配方法的演进路线。

当前系统还没有做到“从单篇论文节点扩展到领域知识结构”。

---

## 三、目标：Knowledge Graph 2.0

本轮希望将知识图谱从：

```text
单篇论文内容结构图
```

升级为：

```text
论文驱动的领域学习图谱
```

也就是让知识图谱不仅回答：

> 这篇论文讲了什么？

还要回答：

> 这篇论文为什么重要？  
> 它在领域中处于什么位置？  
> 它继承/改进/挑战了哪些已有方法？  
> 用户可以从哪个节点继续深入学习一个方向？

---

## 四、建议新增或修改的核心功能

### F1：论文核心洞察提取

当前分析 prompt 需要增强，不只生成 nodes 和 edges，还要生成论文级别的 insight 信息。

建议新增结构：

```ts
interface PaperInsight {
  centralInsight: string;
  priorLimitation: string;
  methodMechanism: string;
  evidenceChain: string[];
  remainingGap: string;
}
```

含义：

- `centralInsight`：这篇论文最核心的思想转折是什么；
- `priorLimitation`：已有方法的关键不足；
- `methodMechanism`：本文如何把 insight 落地成算法机制；
- `evidenceChain`：哪些实验或公式支撑这个 insight；
- `remainingGap`：该方法仍未解决的问题。

示例：

```text
传统 LoRA 虽然参数高效，但仍需要为每个任务单独训练适配器。
本文的核心 insight 是：能否根据任务描述或上下文直接生成 LoRA 参数，从而实现零样本任务适配。
```

---

### F2：节点数据结构增强

现有 GraphNode 不应只有 label、type、description。

建议增加：

```ts
interface GraphNode {
  id: string;
  type: "field" | "concept" | "problem" | "method" | "formula" | "experiment" | "limitation";
  label: string;
  description: string;

  insight?: string;
  whyImportant?: string;
  roleInPaper?: string;
  contrastWithPrior?: string;
  evidenceNodeIds?: string[];

  expandable?: boolean;
  expansionType?: 
    | "field_overview"
    | "related_papers"
    | "method_evolution"
    | "comparison";

  searchQueries?: string[];
}
```

其中：

- `insight`：这个节点背后的关键理解点；
- `whyImportant`：为什么这个节点对读懂论文重要；
- `roleInPaper`：它在论文论证链条中的作用；
- `contrastWithPrior`：它和已有方法相比的差异；
- `evidenceNodeIds`：支撑它的公式、实验或段落；
- `expandable`：是否可以从该节点扩展到领域学习；
- `searchQueries`：后续做论文检索时的查询词。

---

### F3：知识图谱视图升级

当前只有一个普通节点网络图。

建议增加三个视图：

```text
1. 论文论证图
2. 方法机制图
3. 领域扩展图
```

#### 1. 论文论证图

回答：

```text
这篇论文为什么提出这个方法？
```

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

#### 2. 方法机制图

回答：

```text
这个方法到底怎么工作？
```

结构：

```text
输入
→ 编码/表征
→ 核心模块
→ 训练目标
→ 输出
→ 推理/应用方式
```

例如：

```text
任务描述 / 上下文
→ 文本编码器
→ Hypernetwork
→ 生成 LoRA A/B 矩阵
→ 插入基础模型
→ 完成下游任务
```

#### 3. 领域扩展图

回答：

```text
当前论文中的某个领域/方法节点，在更大的研究方向中处于什么位置？
```

例如：

```text
Parameter-Efficient Fine-Tuning
→ Adapter / Prefix / Prompt Tuning
→ LoRA
→ Task-specific LoRA
→ Hypernetwork-generated LoRA
→ Text-to-LoRA / Doc-to-LoRA
```

---

### F4：节点详情页重构

当前点击节点后只是显示文字。

建议改成根据节点类型展示不同的结构化内容。

#### field 节点详情

显示：

```text
1. 领域定义
2. 该领域核心问题
3. 当前论文与该领域的关系
4. 代表方法类别
5. 可扩展阅读入口
```

例如 Continual Learning 节点：

```text
核心问题：
- 灾难性遗忘
- 任务边界未知
- 新旧知识平衡
- 存储成本
- 分布漂移

方法类别：
- Regularization-based
- Replay-based
- Architecture-based
- Prompt-based
- Parameter-efficient adaptation
```

#### concept 节点详情

显示：

```text
1. 概念解释
2. 论文中如何使用该概念
3. 容易混淆的相邻概念
4. 与当前论文 central insight 的关系
```

#### method 节点详情

显示：

```text
1. 方法流程图
2. 输入是什么
3. 核心模块是什么
4. 输出是什么
5. 相比已有方法改在哪里
6. 哪些实验验证它有效
```

#### formula 节点详情

显示：

```text
1. KaTeX 公式
2. 符号逐项解释
3. 训练目标解释
4. 它在方法流程中的位置
5. 如果去掉/改变这一项会发生什么
```

#### experiment 节点详情

显示 claim-evidence 表：

| 实验 | 验证的 claim | 观察结果 | 支持的结论 |
|---|---|---|---|

#### limitation 节点详情

显示失败条件图：

```text
局限
├── 条件 1：什么时候失败
├── 条件 2：依赖什么假设
└── 条件 3：泛化到哪里可能出问题
```

---

### F5：节点级领域扩展 Node Expansion

这是本轮最重要的进阶功能。

当用户点击某个 field / concept / method 节点时，如果该节点是可扩展节点，右侧应该出现：

```text
展开该方向
```

点击后进入节点扩展流程：

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

示例：点击 Test-Time Training 节点。

系统应该生成：

```text
Test-Time Training 方向学习卡

1. 它是什么？
2. 它解决什么问题？
3. 它和当前论文有什么关系？
4. 代表论文有哪些？
5. 近几年有哪些重要进展？
6. 方法演进谱系是什么？
7. 当前论文和这些方法有什么异同？
8. 用户可以完成什么对比任务？
```

---

### F6：相关论文检索策略

注意：不要让大模型直接凭空编造“近几年高影响力论文”。

建议分两阶段实现：

#### 阶段 1：展示版 / Mock 论文库

使用项目内置 mock paper library。

每条 mock paper 包含：

```ts
interface RelatedPaper {
  id: string;
  title: string;
  authors?: string[];
  year?: number;
  venue?: string;
  topicTags: string[];
  summary: string;
  relationToCurrentPaper: string;
  influenceReason?: string;
  url?: string;
}
```

#### 阶段 2：真实检索版

后续可以接入：

- Semantic Scholar API；
- arXiv API；
- OpenAlex API；
- 用户上传的本地论文库。

如果没有真实检索能力，UI 和文档中应明确说明：

```text
当前版本使用内置候选论文库进行展示，未来可替换为真实论文检索 API。
```

---

### F7：代表论文对比阅读

当系统找到相关论文后，支持生成对比表。

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

对比后生成用户任务：

```text
请判断：当前论文的方法如果迁移到 Test-Time Training 场景，最需要修改的是输入、优化目标，还是参数更新方式？为什么？
```

这可以接入原本的学习闭环：

```text
对比讲解
→ 用户作答
→ AI 诊断
→ 针对性反馈
→ 迁移能力更新
```

---

### F8：多论文融合图谱，先做轻量版

不要一开始做复杂知识库。

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
  id: string;
  label: string;
  type: string;
  sources: string[];
  descriptions: string[];
  consensusSummary: string;
}
```

例如多个论文都有 Test-Time Adaptation 节点：

```text
Test-Time Adaptation
来源：
- Paper A
- Paper B
- Survey C

综合解释：
这些论文共同关注模型在测试分布变化时如何自适应更新。
```

该功能可以先作为 future feature 或 v1.2 之后的增强功能，不要阻塞 KG 2.0 MVP。

---

## 五、Prompt 修改方向

当前分析 prompt 已有节点类型约束：

```text
field, concept, problem, method, formula, experiment, limitation
```

建议不要立即新增大量节点类型，而是在现有节点上增加 insight 字段和 expansion 字段。

新的分析 prompt 应要求：

1. 不只是抽取实体，而是抽取论文论证链；
2. 必须识别 centralInsight；
3. 必须说明 priorLimitation；
4. 每个核心 method/formula/experiment 节点必须说明它如何服务于 centralInsight；
5. field / concept / method 节点要判断是否 expandable；
6. expandable 节点要生成 searchQueries；
7. 不允许编造论文中不存在的公式、实验或结论；
8. 不允许编造真实论文引用，相关论文扩展必须来自 mock 库或真实检索结果。

---

## 六、建议输出的修改文档

请根据以上上下文，生成以下文档：

```text
docs/08_knowledge_graph_2_0_requirements.md
docs/09_node_expansion_design.md
docs/10_prompt_schema_update.md
docs/11_kg2_iteration_plan.md
```

每个文档要求如下。

---

### docs/08_knowledge_graph_2_0_requirements.md

内容包括：

1. 当前知识图谱问题；
2. KG 2.0 目标；
3. 新增功能列表；
4. 节点详情页改造需求；
5. 三种图谱视图需求；
6. 与学习闭环的关系；
7. 验收标准。

---

### docs/09_node_expansion_design.md

内容包括：

1. Node Expansion 的产品目标；
2. 哪些节点可以扩展；
3. 扩展流程；
4. 相关论文检索策略；
5. Mock paper library 数据结构；
6. 领域概览卡；
7. 方法演进谱系；
8. 当前论文 vs 代表论文对比表；
9. 迁移任务设计；
10. 防止 LLM 幻觉的策略。

---

### docs/10_prompt_schema_update.md

内容包括：

1. 当前 prompt 的不足；
2. 新增 PaperInsight schema；
3. GraphNode 字段扩展；
4. NodeDetail schema；
5. NodeExpansion schema；
6. 诊断/对比任务 schema；
7. prompt 修改建议；
8. JSON 输出约束。

---

### docs/11_kg2_iteration_plan.md

内容包括：

1. v1.1：节点详情页结构化；
2. v1.2：central insight 与论文论证图；
3. v1.3：方法机制图与公式拆解器；
4. v1.4：节点级领域扩展；
5. v1.5：相关论文对比阅读；
6. v1.6：轻量多论文融合图谱；
7. 每个版本的完成标准和测试方式。

---

## 七、实现优先级建议

请在文档中明确优先级：

### P0：必须做

1. PaperInsight 提取；
2. GraphNode 增加 insight / roleInPaper / evidenceNodeIds；
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

---

## 八、注意事项

1. 本轮只生成文档，不修改业务代码。
2. 不要把系统改成普通论文推荐工具。
3. 所有扩展功能必须服务于“通过论文深度学习 AI 知识”这个目标。
4. 相关论文如果没有真实数据源，不允许让 LLM 编造。
5. 功能设计必须继续接入原有学习闭环：
   ```text
   AI讲解 → 用户尝试 → AI反馈 → 再强化/迁移
   ```
6. 文档中要说明这些改动如何提高项目对课程评分标准的匹配度，尤其是：
   - AI 参与策略；
   - 动态调整机制；
   - 学习闭环完整性；
   - 错误反馈质量；
   - 可扩展性 [1]。
```

---

我建议你先让 agent 跑这个任务，**只生成文档，不改代码**。  
等它生成完 `08-11` 这几个文档后，你可以把文档贴给我，我们再一起做第二轮 review，把需求压实成真正可执行的开发任务。