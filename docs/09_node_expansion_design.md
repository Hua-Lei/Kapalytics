# Node Expansion 设计文档

## 1. 产品目标

Node Expansion 的目标是让用户从单篇论文中的关键节点继续深入学习一个研究方向。

当前知识图谱主要围绕单篇论文。用户点击节点后，只能看到当前论文中的解释。KG 2.0 需要支持：

```text
单篇论文节点
→ 领域概览
→ 方法分类
→ 代表论文
→ 方法演进
→ 当前论文对比
→ 迁移任务
```

Node Expansion 必须服务“通过论文深度学习 AI 知识”的目标，而不是变成普通论文推荐。

## 2. 哪些节点可以扩展

优先支持以下节点类型：

- `field`：适合扩展为领域 overview。
- `concept`：适合扩展为相关概念和代表论文。
- `method`：适合扩展为方法演进和对比。

暂不优先支持：

- `formula`：通常应先在当前论文内解释清楚。
- `experiment`：可以作为 evidence，不一定需要扩展。
- `limitation`：可以用于生成 future work，但不作为 MVP 扩展入口。

节点需要满足：

```ts
expandable: true
expansionType: 'field_overview' | 'related_papers' | 'method_evolution' | 'comparison'
searchQueries: string[]
```

## 3. 扩展流程

用户点击可扩展节点后，右侧 Node Inspector 显示“展开该方向”。

点击后流程：

```text
1. 读取当前节点 label / insight / roleInPaper / searchQueries
2. 根据 expansionType 选择扩展模板
3. 查询 mock paper library
4. 生成领域概览卡
5. 生成方法分类或方法演进谱系
6. 生成代表论文列表
7. 生成当前论文 vs 代表论文对比表
8. 生成迁移/对比任务
9. 用户作答
10. AI 诊断并反馈
```

MVP 中可以先不新增完整页面，只在右侧面板展示 expansion card。

## 4. 相关论文检索策略

### 阶段 1：Mock Paper Library

展示版必须使用内置 mock paper library，避免 LLM 编造论文。

建议文件位置：

```text
src/renderer/src/mock/relatedPapers.ts
```

或如果由主进程处理：

```text
src/main/paper/relatedPapers/mockLibrary.ts
```

数据结构：

```ts
interface RelatedPaper {
  id: string
  title: string
  authors?: string[]
  year?: number
  venue?: string
  topicTags: string[]
  summary: string
  relationToCurrentPaper: string
  influenceReason?: string
  url?: string
}
```

匹配策略：

- 使用 node.searchQueries 和 topicTags 做简单匹配；
- 如果无匹配结果，展示“当前内置论文库暂无相关条目”；
- 不允许让 LLM 直接补出虚构论文。

### 阶段 2：真实检索 API

后续可以接入：

- Semantic Scholar API；
- arXiv API；
- OpenAlex API；
- 用户本地论文库。

真实检索结果必须保存来源字段，例如：

```ts
source: 'mock' | 'semantic_scholar' | 'arxiv' | 'openalex' | 'local'
```

## 5. 领域概览卡

展开 field / concept 节点时生成领域概览卡。

结构：

```ts
interface FieldOverviewCard {
  title: string
  definition: string
  coreProblems: string[]
  methodFamilies: string[]
  relationToCurrentPaper: string
  keyTerms: string[]
}
```

展示内容：

- 这个方向是什么；
- 它解决什么学习/建模问题；
- 主要方法类别；
- 当前论文属于哪一支；
- 用户继续学习时应关注哪些关键词。

## 6. 方法演进谱系

展开 method 节点时生成方法演进谱系。

结构：

```ts
interface MethodEvolutionStep {
  id: string
  label: string
  description: string
  representativePaperIds: string[]
  relation: 'predecessor' | 'parallel' | 'successor' | 'variant'
}
```

示例：

```text
Parameter-Efficient Fine-Tuning
→ Adapter / Prefix / Prompt Tuning
→ LoRA
→ Task-specific LoRA
→ Hypernetwork-generated LoRA
→ Text-to-LoRA / Doc-to-LoRA
```

## 7. 当前论文 vs 代表论文对比表

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

数据结构：

```ts
interface PaperComparisonRow {
  dimension: string
  currentPaper: string
  relatedPaper: string
}
```

## 8. 迁移任务设计

Node Expansion 不应停留在“看推荐论文”，必须生成可诊断的迁移任务。

任务示例：

```text
请判断：当前论文的方法如果迁移到 Test-Time Training 场景，最需要修改的是输入、优化目标，还是参数更新方式？为什么？
```

迁移任务结构：

```ts
interface TransferTask {
  id: string
  prompt: string
  expectedReasoningPoints: string[]
  relatedPaperIds: string[]
  targetAbility: 'transfer_comparison'
}
```

作答后复用现有诊断模块，但 prompt 需要带上 expansion context。

## 9. 防止 LLM 幻觉的策略

必须遵守：

1. 相关论文只能来自 mock library 或真实检索结果。
2. LLM 可以总结、比较、生成任务，但不能编造论文标题、年份、作者和 venue。
3. UI 需要显示数据来源。
4. 没有匹配论文时，应显示空状态，不要生成假结果。
5. LLM 输出对比时必须引用 `relatedPaper.id`。

建议在 prompt 中加入：

```text
只能使用提供的 relatedPapers 数组中的论文。不得补充数组外的真实或虚构论文。
如果没有足够信息，请返回空数组或说明“内置论文库暂无相关条目”。
```

## 10. MVP 验收标准

Node Expansion MVP 应满足：

- 至少 field / concept / method 节点可以标记为 expandable；
- 右侧节点详情能显示“展开该方向”；
- 展开后能展示领域概览卡；
- 能从 mock paper library 匹配相关论文；
- 能展示当前论文 vs 代表论文对比表；
- 能生成迁移任务；
- 迁移任务能接入作答和诊断；
- 不出现 LLM 编造论文。
