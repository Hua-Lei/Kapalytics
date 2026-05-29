
# KG 4.0 初步需求文档：节点驱动的领域认知与算法思想对比工作台

## 1. 背景

当前项目 Kapalytics 是一个 AI 论文深度学习助手，目标不是普通论文总结器，而是帮助用户通过论文建立可迁移的 AI 知识结构。

已有 KG 2.0 设计中，知识图谱已经从单篇论文实体图升级为论文驱动的领域学习图谱，核心目标包括：

- 展示论文 central insight；
- 展示论文论证链；
- 支持结构化节点详情；
- 从 field / concept / method 节点扩展到领域学习；
- 通过相关论文对比接入学习闭环 [5]。

已有 Node Expansion 设计流程大致是：

```text
单篇论文节点
→ 领域概览
→ 方法分类
→ 代表论文
→ 方法演进
→ 当前论文对比
→ 迁移任务
```

该设计仍然有效，但现在需要进一步调整产品重点 [2]。

## 2. 当前问题

当前 Node Expansion 容易变成：

```text
节点展开
→ 推荐几篇论文
→ 展示对比表
→ 生成迁移任务
```

这虽然满足基础功能，但距离用户真正想要的“通过论文理解领域和算法思想”仍有差距。

主要问题：

1. 迁移任务权重过高，和原本阶段学习里的迁移任务重复；
2. 相关论文更像列表，而不是方法谱系或领域结构；
3. 用户很难看出不同论文在同一问题上的算法思想差异；
4. AI 反馈偏“评分/诊断”，不够像研究导师式的启发；
5. 用户对某个节点产生的理解没有很好沉淀为长期记忆；
6. 基础知识缺失和研究理解不充分没有分开处理。

## 3. KG4.0 产品目标

KG 4.0 的目标是：

> 将 Node Expansion 从“相关论文推荐 + 迁移任务”升级为“节点驱动的领域认知与算法思想对比工作台”。

展开一个节点后，系统应帮助用户理解：

1. 这个节点在研究领域中属于哪条路线；
2. 相同或相邻问题下，其他论文采用了哪些不同算法思想；
3. 当前论文的方法与这些方法相比，继承了什么、改进了什么、牺牲了什么；
4. 用户自己如何理解这些方法差异；
5. 用户是否缺少某些基础知识；
6. 用户的理解如何沉淀为长期记忆，并在之后遇到相似节点时复用。

该功能必须服务“通过论文深度学习 AI 知识”，不能变成普通论文推荐工具。已有文档也要求 Node Expansion 不能脱离学习闭环 [5]。

## 4. 总体交互流程

新版 Node Expansion 推荐流程：

```text
用户点击可扩展节点
↓
系统基于节点 label / insight / searchQueries 检索相关论文
↓
系统抽取相关论文中的算法思想
↓
在原图谱旁生成浅色扩展节点
↓
形成“当前节点 + 相关算法路线 + 代表论文”的扩展子图
↓
用户选择 2-3 个扩展节点进行算法思想对比
↓
系统生成对比分析与引导问题
↓
用户写下自己的理解/判断
↓
AI 给出研究理解型反馈或基础知识补齐型反馈
↓
用户确认后保存为 Node Understanding Memory
↓
可选：生成迁移任务或加入长期领域图谱
```

## 5. 核心原则

### 5.1 检索负责找论文，LLM 负责分析

相关论文必须来自：

- mock library；
- arXiv；
- Semantic Scholar；
- OpenAlex；
- local paper library。

LLM 不允许凭空编造论文标题、年份、作者、venue。已有 KG 2.0 文档中已经明确要求相关论文只能来自 mock library 或真实检索结果 [2][3]。

### 5.2 主任务是领域认知，不是迁移训练

迁移任务可以保留，但降级为 optional。

主流程应从：

```text
对比 → 迁移任务 → 诊断
```

调整为：

```text
算法思想对比 → 用户理解记录 → AI 辅助反馈 → 长期记忆
```

### 5.3 反馈分为两类

AI 反馈不再只有“对/错诊断”，而应分为：

1. 研究理解型反馈；
2. 基础知识补齐型反馈。

### 5.4 用户理解是长期学习资产

用户对某个节点、方法、领域方向的理解不应该只是一次性答案，而应该保存为长期记忆，之后遇到类似论文时可复用。

### 5.5 必须继续符合课程学习闭环

课程评分标准要求完整链路：

```text
输入 / 知识点 → AI讲解 → 用户尝试 → AI反馈 → 再强化 / 迁移
```

并要求 AI 有明确角色、触发条件和动态调整机制 [1]。

KG4.0 中的闭环可以定义为：

```text
节点展开
→ AI 检索与算法思想归纳
→ 用户进行方法对比理解
→ AI 给出研究反馈或补齐基础知识
→ 用户理解沉淀为长期记忆
→ 后续复用 / 强化 / 可选迁移
```

## 6. 功能需求

## F1. 扩展图谱：原节点旁生成浅色扩展节点

展开节点后，不应只展示卡片，而应在图谱中生成一组临时扩展节点。

示例：

```text
Online Learning Algorithm  原节点
├── Paper A: Experience Replay 路线
├── Paper B: Meta-learning Adaptation 路线
├── Paper C: Policy Regularization 路线
├── Paper D: Continual Adaptation 路线
└── Paper E: Test-time Update 路线
```

扩展节点可以包括：

- related_paper；
- algorithm_idea；
- method_family；
- prerequisite_concept；
- open_problem。

建议数据结构：

```ts
type ExpansionNodeType =
  | 'related_paper'
  | 'algorithm_idea'
  | 'method_family'
  | 'prerequisite_concept'
  | 'open_problem'

interface ExpansionGraphNode {
  id: string
  type: ExpansionNodeType
  label: string
  description: string
  sourcePaperIds: string[]
  isTemporary: boolean
  visualStyle?: 'faded' | 'highlighted' | 'normal'
}
```

边关系建议：

```ts
type ExpansionRelation =
  | 'same_problem_different_method'
  | 'extends'
  | 'contrasts_with'
  | 'uses_as_foundation'
  | 'solves_limitation_of'
  | 'shares_assumption_with'
  | 'requires_prerequisite'
```

```ts
interface ExpansionGraphEdge {
  id: string
  sourceId: string
  targetId: string
  relation: ExpansionRelation
  explanation: string
}
```

验收标准：

- 原始节点仍然高亮；
- 扩展节点以浅色或临时样式展示；
- 用户能看出不同论文/方法和原节点之间的关系；
- 扩展结果不能污染主图谱，除非用户确认融合。

---

## F2. Algorithm Idea Card：把相关论文转成算法思想卡

相关论文不应只是论文列表，而应被抽象为算法思想。

建议结构：

```ts
interface AlgorithmIdeaCard {
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

每张卡片必须回答：

1. 这篇论文面对什么问题？
2. 它的核心算法思想是什么？
3. 它依赖什么关键假设？
4. 它更新什么对象或优化什么目标？
5. 它相比当前节点/当前论文有什么不同？
6. 它解决了什么问题，又留下了什么问题？

---

## F3. 领域认知视图 Field Cognition View

展开 field / concept / method 节点后，应生成一个领域认知视图。

内容包括：

```text
1. 当前节点所属研究方向
2. 这个方向的核心问题
3. 主要算法路线
4. 当前论文所在路线
5. 其他代表路线
6. 哪些基础概念需要补齐
```

示例：

```text
Test-Time Adaptation
├── Entropy Minimization
├── Self-supervised Test-Time Training
├── BatchNorm Adaptation
├── Continual Test-Time Adaptation
└── Parameter-Efficient TTA
```

或者：

```text
Parameter-Efficient Adaptation
├── Adapter-based
├── Prompt / Prefix Tuning
├── LoRA-based
└── Hypernetwork-generated Adapter
```

验收标准：

- 不允许出现“代表方法类别”“相关概念分支”这种占位符；
- 方法类别必须来自当前节点和检索论文的真实信息；
- 当前论文所在路线必须明确标出。

---

## F4. 算法思想对比工作台

用户可以选择 2-3 个 Algorithm Idea Card 进行对比。

对比维度：

| 维度 | 当前节点/当前论文 | 相关论文 A | 相关论文 B |
|---|---|---|---|
| 研究问题 |  |  |  |
| 核心思想 |  |  |  |
| 关键假设 |  |  |  |
| 机制流程 |  |  |  |
| 优化目标 / 更新规则 |  |  |  |
| 更新对象 |  |  |  |
| 优势 |  |  |  |
| 局限 |  |  |  |
| 适用场景 |  |  |  |
| 与当前论文关系 |  |  |  |

生成对比表后，系统应给出研究思考问题，而不是直接进入迁移任务。

示例问题：

```text
这几种方法都试图解决 online adaptation 问题。
请比较其中两种方法的核心思想差异：

1. 它们分别假设了什么？
2. 它们分别更新了什么？
3. 哪种方法更适合非平稳环境？为什么？
```

---

## F5. 研究理解型反馈 Reflective Feedback

用户完成算法思想对比后，AI 应给出“研究导师式反馈”，而不是简单判对错。

适用场景：

- 用户在比较两种算法思想；
- 用户评价某个方法是否合理；
- 用户总结一个领域方向的方法演进；
- 用户提出自己的理解或疑问。

反馈结构：

```ts
interface ReflectiveFeedback {
  type: 'reflective'
  strengths: string[]
  missingDimensions: string[]
  possibleCounterArguments: string[]
  evidenceFromPapers: string[]
  followUpQuestions: string[]
  suggestedUnderstandingNote: string
}
```

反馈风格示例：

```text
你的理解抓住了两种方法都关注 online adaptation 这一点。
但你目前主要比较了使用场景，还没有比较它们的更新机制和关键假设。

可以进一步思考：
1. Paper A 是否依赖显式 reward signal？
2. 当前论文是否更新模型参数，还是生成 adapter？
3. 两者面对 distribution shift 时的失败条件是否不同？
```

验收标准：

- 不使用简单“正确/错误”；
- 必须指出用户理解中的亮点；
- 必须指出遗漏的比较维度；
- 必须给出后续思考问题；
- 可以引用相关论文或当前论文证据，但只能引用已检索/已上传论文。

---

## F6. 基础知识补齐型反馈 Remedial Teaching Feedback

如果用户回答暴露出基础概念缺失，AI 应切换到教学模式。

适用场景：

- 用户不理解某个算法基础；
- 用户混淆相近概念；
- 用户无法理解某个方法为何有效；
- 用户缺少前置知识。

建议结构：

```ts
interface RemedialLesson {
  type: 'remedial'
  missingPrerequisite: string
  whyItMattersForCurrentNode: string
  shortExplanation: string
  visualExplanation?: string
  example?: string
  formulaOrPseudoCode?: string
  recommendedPapers?: string[]
  recommendedArticles?: string[]
  checkQuestion: string
}
```

示例：

```text
系统判断：你对 experience replay 的作用理解不清。

为什么它和当前节点有关：
当前节点讨论 online / continual 场景下如何稳定更新模型，
而 replay buffer 是缓解遗忘和样本相关性的经典机制。

简要解释：
Experience replay 的核心思想是保存过去交互样本，
在后续训练中反复采样旧经验，与新经验混合训练。

图示：
过去经验 buffer → 采样旧经验 → 与新经验混合训练 → 稳定策略更新

检查问题：
为什么 replay buffer 可以缓解 continual / online learning 中的遗忘？
```

后续可扩展：

- 图片解释；
- 伪代码；
- 推荐综述；
- 推荐基础教程；
- 关联到用户已经读过的论文。

---

## F7. Node Understanding Memory：保存用户对节点的理解

用户在 Node Expansion 中产生的回答不应只作为一次性任务答案，而应保存为长期理解记录。

建议结构：

```ts
interface NodeUnderstandingMemory {
  id: string
  userId?: string
  nodeId: string
  nodeLabel: string
  nodeType: string
  sourcePaperId: string
  relatedPaperIds: string[]

  userReflection: string
  aiFeedbackType: 'reflective' | 'remedial'
  aiFeedbackSummary: string

  strengths: string[]
  missingDimensions: string[]
  prerequisiteGaps: string[]

  generatedUnderstandingNote: string

  createdAt: string
  updatedAt: string
}
```

后续使用方式：

```text
当用户再次遇到相似节点时，系统提示：
“你之前在 Paper X 中比较过 online learning 与 replay-based adaptation。
是否复用这段理解来帮助阅读当前论文？”
```

验收标准：

- 用户的对比理解可保存；
- AI 反馈摘要可保存；
- 节点、当前论文、相关论文之间的关系可追踪；
- 后续可根据 node label / topic tag / method family 检索历史理解。

---

## F8. 迁移任务降级为 Optional

已有 KG 2.0 文档中要求 Node Expansion 可以生成迁移任务，并接入诊断闭环 [2][5]。

KG4.0 中，迁移任务不删除，但降级为可选入口。

主流程：

```text
算法思想对比
→ 用户理解记录
→ AI 反馈
→ 长期记忆
```

可选流程：

```text
生成迁移任务
→ 用户作答
→ AI 诊断
→ 更新 transfer_comparison 能力
```

这样可以避免 Node Expansion 和阶段学习中的迁移任务重复。

---

## F9. 图谱融合必须采用“建议融合”，不要自动污染长期图谱

节点扩展产生的浅色节点默认是 temporary。

如果要进入长期领域图谱，必须经过：

```text
LLM 生成融合建议
↓
展示：
- 待合并节点
- 来源论文
- 合并理由
- 置信度
↓
用户确认
↓
写入长期领域图谱
```

建议结构：

```ts
interface GraphFusionSuggestion {
  id: string
  candidateNodeIds: string[]
  suggestedMergedLabel: string
  suggestedType: string
  sources: string[]
  mergeReason: string
  confidence: number
  risks: string[]
}
```

验收标准：

- 默认不自动融合；
- 每个融合节点必须有来源；
- 用户可以接受或拒绝融合建议；
- 被拒绝的融合建议应保留记录，避免反复出现。

---

## F10. LLM Task Orchestrator 接入建议

由于 Node Expansion 3.0 会产生多个 LLM 调用，必须通过任务派发器，而不是在 UI 中直接调用 LLM。

建议任务类型：

```ts
type LLMTaskType =
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

任务链示例：

```text
expand_node_retrieve_context
→ extract_algorithm_ideas
→ build_field_cognition_map
→ generate_expansion_graph
→ compare_algorithm_ideas
→ generate_reflective_feedback / generate_remedial_lesson
→ save NodeUnderstandingMemory
→ optional suggest_graph_fusion
```

必须支持：

- job 状态；
- 缓存；
- 失败重试；
- 错误提示；
- 最大调用次数限制；
- 所有任务结果可追踪。

---

## 7. Prompt 约束

所有 Node Expansion 相关 prompt 必须遵守：

```text
你只能使用输入中提供的 currentPaper、currentNode、retrievedPapers、paperAnalyses。
不得编造论文标题、作者、年份、venue、实验结果或引用。
如果信息不足，请明确返回 insufficient_information。
```

算法思想抽取 prompt 应关注：

```text
1. problemSetting
2. coreIdea
3. keyAssumption
4. mechanism
5. objectiveOrUpdateRule
6. strength
7. limitation
8. relationToCurrentNode
```

研究理解反馈 prompt 应关注：

```text
1. 用户理解中合理的部分；
2. 用户遗漏的比较维度；
3. 可能的反例或反驳；
4. 哪些证据支持或限制用户观点；
5. 下一步应该思考什么。
```

基础知识补齐 prompt 应关注：

```text
1. 用户缺少哪个 prerequisite；
2. 为什么这个 prerequisite 对当前节点重要；
3. 用简短解释、例子、图示或伪代码补齐；
4. 给一个检查问题；
5. 推荐资料必须来自已检索或内置资料库。
```

---

## 8. UI 初步设想

Node Expansion 页面或面板可以分为三块：

```text
A. 扩展图谱区
B. 算法思想对比区
C. 理解记录与反馈区
```

### A. 扩展图谱区

展示：

- 当前原始节点；
- 浅色扩展节点；
- 方法路线节点；
- 代表论文节点；
- 关系边。

### B. 算法思想对比区

展示：

- Algorithm Idea Cards；
- 可选择 2-3 个进行对比；
- 生成对比表；
- 生成研究思考问题。

### C. 理解记录与反馈区

展示：

- 用户输入自己的理解；
- AI 给出 reflective 或 remedial feedback；
- 用户确认保存为长期记忆；
- 可选生成迁移任务。

---

## 9. 验收标准

Node Expansion 3.0 MVP 应满足：

1. 用户点击 expandable 节点后，可以生成扩展子图；
2. 扩展节点以浅色或临时样式展示；
3. 相关论文必须来自真实检索或可信 mock/local library；
4. LLM 不得编造论文；
5. 每篇相关论文能被抽象为 Algorithm Idea Card；
6. 用户可以选择多个算法思想进行对比；
7. 对比结果能突出：
   - 研究问题；
   - 核心思想；
   - 关键假设；
   - 机制差异；
   - 优势与局限；
   - 与当前论文关系。
8. 用户可以写下自己的理解；
9. AI 反馈分为：
   - 研究理解型反馈；
   - 基础知识补齐型反馈。
10. 用户理解和 AI 反馈可以保存为长期记忆；
11. 迁移任务保留为 optional，而不是主流程；
12. 图谱融合必须由用户确认；
13. 原有阶段学习闭环不被破坏。

---

## 10. 分阶段实现建议

### v2.1 扩展子图接入

目标：

- 点击节点后生成浅色扩展节点；
- 展示相关论文节点和算法路线节点；
- 不要求完整反馈闭环。

完成标准：

- 原节点高亮；
- 扩展节点临时显示；
- 关系边有 relation 类型；
- 可清除扩展结果。

### v2.2 Algorithm Idea Card

目标：

- 将检索论文转成算法思想卡；
- 显示 problem / core idea / assumption / mechanism / limitation。

完成标准：

- 每篇相关论文都有结构化思想卡；
- LLM 只能基于检索结果分析；
- 无足够信息时显示 insufficient information。

### v2.3 算法思想对比工作台

目标：

- 支持选择 2-3 个思想卡；
- 生成对比表；
- 生成研究思考问题。

完成标准：

- 对比表不是模板空话；
- 能突出算法思想差异；
- 能说明当前论文与相关论文的关系。

### v2.4 双模式 AI 反馈

目标：

- 实现 reflective feedback；
- 实现 remedial lesson；
- 根据用户输入判断反馈类型。

完成标准：

- 研究理解型反馈不做简单对错判断；
- 基础缺失时能生成 mini lesson；
- 反馈中包含下一步思考或检查问题。

### v2.5 Node Understanding Memory

目标：

- 保存用户对节点的理解；
- 保存 AI 反馈；
- 后续遇到相似节点可检索历史理解。

完成标准：

- 理解记录可写入数据库；
- 可按 node label / topic tag / method family 查询；
- UI 能展示历史理解提示。

### v2.6 图谱融合建议

目标：

- 将扩展节点转为长期领域图谱候选；
- 由用户确认融合。

完成标准：

- 生成融合建议；
- 显示来源和合并理由；
- 用户可接受或拒绝；
- 不自动污染长期图谱。

---

## 11. 与评分标准的关系

该改造能够增强：

1. 学习问题建模
   从“不会迁移”扩展到“无法理解领域方法谱系和算法思想差异”。

2. AI 参与机制
   AI 不只是总结，而是检索、聚类、抽取算法思想、生成对比、判断反馈模式、补齐基础知识。

3. 学习闭环
   形成：
   ```text
   节点展开 → 算法思想对比 → 用户理解 → AI反馈 → 长期记忆 / 强化
   ```

4. 错误反馈质量
   反馈从统一诊断升级为：
   - 研究理解型反馈；
   - 基础知识补齐型反馈。

5. 可扩展性
   每个 field / concept / method 节点都可以扩展成领域子图，并逐步融合进长期领域图谱。

这些方向与课程评分标准中“真实学习瓶颈”“AI明确策略与动态调整机制”“完整学习闭环”“针对性反馈”和“可扩展性”的要求一致 [1]。

---

## 12. Agent 本轮任务

请先不要直接实现代码。

请基于本文档和现有项目结构，生成以下正式设计文档：

```text
docs/17_kg4_requirements.md
docs/18_algorithm_idea_workbench_design.md
docs/19_reflective_feedback_and_remedial_learning.md
docs/20_node_understanding_memory_design.md
docs/21_kg4_iteration_plan.md
```

要求：

1. 结合现有代码结构补充更具体的模块位置；
2. 如果已有数据库、检索接口、LLM task dispatcher、graph fusion 模块，请说明如何接入；
3. 不要假设不存在的 API；
4. 不要直接改业务代码；
5. 每份文档都要包含：
   - 目标；
   - 数据结构；
   - 流程；
   - UI 影响；
   - Prompt 约束；
   - 验收标准；
   - 风险与 fallback。
