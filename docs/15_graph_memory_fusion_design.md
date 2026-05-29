# KG 3.0 图谱记忆融合设计

## 1. 目标

KG 3.0 的图谱记忆融合系统用于把多篇论文的单篇图谱，逐步融合成用户自己的长期领域图谱。

它的目标不是构建通用知识库，而是服务论文深度学习：

```text
读一篇论文
→ 形成单篇论文图谱
→ 诊断用户理解
→ 读更多论文
→ 融合同类节点和关系
→ 形成长期领域地图
→ 生成更好的迁移任务和复习任务
```

## 2. 输入与输出

### 2.1 输入

- `PaperRecord`；
- `PaperInsightRecord`；
- `GraphNodeRecord[]`；
- `GraphEdgeRecord[]`；
- `DiagnosisRecord[]`；
- `UserMasteryRecord[]`；
- verified related papers；
- Node Expansion 方向地图和谱系。

### 2.2 输出

- `MergedGraphNode[]`；
- `MergedGraphEdge[]`；
- source mapping；
- consensus summary；
- disagreements；
- mastery-aware review tasks；
- transfer tasks across papers。

## 3. 融合原则

1. 来源优先：每个融合节点必须保留来源论文和来源节点。
2. 不强行合并：标签相似但论文语境不同的节点可以保持分离。
3. 学习优先：融合不是为了图大，而是为了帮助用户理解领域结构。
4. 可解释：每次 merge decision 要有理由。
5. 可回退：错误融合可以拆分。
6. LLM 不创造论文：融合只能使用数据库中已有 PaperRecord / GraphNodeRecord。

## 4. 节点去重

### 4.1 候选生成

候选 merge pair 来自：

- normalized label exact match；
- alias match；
- same node type + high lexical overlap；
- same paper search topic；
- user manually marks as related；
- Node Expansion 中同一 method branch。

```ts
interface MergeCandidate {
  id: string
  sourceNodeId: string
  targetMergedNodeId?: string
  targetNodeId?: string
  similaritySignals: MergeSimilaritySignals
  decisionStatus: 'pending' | 'merged' | 'rejected' | 'needs_review'
}

interface MergeSimilaritySignals {
  normalizedLabelScore: number
  typeMatch: boolean
  descriptionOverlapScore: number
  sharedPaperTopics: string[]
  sharedMethodFamily?: string
  llmSemanticScore?: number
}
```

### 4.2 决策规则

自动合并条件：

- node type 相同；
- normalized label 高相似；
- description 语义一致；
- 不存在明显语境冲突。

需要人工或 LLM 二次判断：

- label 相同但类型不同，例如 “Adapter” 既可能是方法也可能是模块；
- concept 和 method 边界模糊；
- 同名方法在不同领域中含义不同；
- 一个节点是 broad field，另一个是 specific method。

拒绝合并：

- 一个是问题，一个是方法；
- label 相同但作用相反；
- 当前论文明确 contrastWithPrior，说明二者不是同一节点。

## 5. MergedGraphNode Schema

```ts
interface MergedGraphNode {
  id: string
  canonicalLabel: string
  aliases: string[]
  normalizedLabel: string
  nodeType: 'field' | 'concept' | 'problem' | 'method' | 'formula' | 'experiment' | 'limitation' | 'mixed'
  sourceNodeIds: string[]
  sourcePaperIds: string[]
  representativePaperIds: string[]
  consensusSummary: string
  keyInsights: string[]
  disagreements: NodeDisagreement[]
  methodFamilies: string[]
  firstSeenAt: string
  lastSeenAt: string
  userMastery?: MergedNodeMastery
  confidence: number
  createdAt: string
  updatedAt: string
}

interface NodeDisagreement {
  sourcePaperId: string
  description: string
  whyItDiffers: string
}

interface MergedNodeMastery {
  masteryScore: number
  weakAbilities: string[]
  lastDiagnosisIds: string[]
}
```

## 6. 关系合并

单篇论文里的边是局部论证关系。长期领域图谱里的边应表达跨论文稳定关系。

### 6.1 边类型

```ts
type MergedRelationType =
  | 'is_prerequisite_of'
  | 'motivates'
  | 'solves'
  | 'uses'
  | 'extends'
  | 'contrasts_with'
  | 'validated_by'
  | 'limited_by'
  | 'evolves_to'
  | 'belongs_to_branch'
```

### 6.2 MergedGraphEdge Schema

```ts
interface MergedGraphEdge {
  id: string
  sourceMergedNodeId: string
  targetMergedNodeId: string
  relationType: MergedRelationType
  label: string
  sourceEdgeIds: string[]
  sourcePaperIds: string[]
  evidenceSnippets: string[]
  confidence: number
  createdAt: string
  updatedAt: string
}
```

### 6.3 合并规则

- 多篇论文重复出现同类关系，提高 confidence；
- 关系方向冲突时保留 disagreement；
- 单篇论文的 speculative relation 不自动升级为长期关系；
- 当前论文的 limitation 可以形成 `limited_by` 或 future work 边。

## 7. 来源标记

长期图谱中每个节点和边都必须能追溯到来源。

```ts
interface SourceAttribution {
  paperId: string
  paperTitle: string
  nodeId?: string
  edgeId?: string
  pageRefs?: PaperPageRef[]
  sourceUrl?: string
  externalIds: PaperExternalId[]
}
```

UI 展示建议：

- 节点详情展示“来自 4 篇论文”；
- 可展开来源列表；
- 每个来源显示该论文中的原始解释；
- consensus summary 和 disagreement 分开显示。

## 8. 长期领域图谱形成流程

```text
Analyze single paper
→ Save GraphNodeRecord / GraphEdgeRecord
→ Generate merge candidates
→ Fuse high-confidence nodes
→ Merge stable relations
→ Update MergedGraphNode / MergedGraphEdge
→ Update user mastery
→ Generate review / transfer tasks
```

融合可以分三种时机：

### 8.1 即时轻量融合

论文分析完成后，快速匹配 normalized label，给用户提示：

```text
本篇论文中的 Test-Time Adaptation 与你之前读过的 3 篇论文有关。
```

### 8.2 节点展开时融合

用户点击某个节点展开时，优先检索长期图谱中的相关 merged nodes，再决定是否调用外部检索 API。

### 8.3 后台深度融合

低优先级 LLM job，在用户空闲时融合多篇论文的复杂节点。

## 9. 接入阅读历史和学习状态

长期领域图谱不只保存知识，还保存用户理解状态。

### 9.1 用户掌握度输入

来自：

- stage completion；
- diagnosis correctness；
- errorType；
- remedial task completion；
- repeated mistakes；
- transfer task performance。

### 9.2 更新策略

```text
用户答对 formula task
→ 提升对应 formula node mastery
→ 轻微提升相关 method node mastery

用户 transfer_comparison 答错
→ 降低当前 method branch 的 transfer mastery
→ 标记 related merged node 需要复习
```

### 9.3 生成个性化任务

长期图谱可以生成：

- 复习任务：针对低掌握节点；
- 对比任务：针对相似但常混淆节点；
- 迁移任务：跨论文方法组合；
- 证据任务：要求用户引用实验或公式支持 claim。

## 10. Graph Memory View

未来 UI 可以增加长期领域图谱视图。

建议分层：

```text
Field
→ Problem clusters
→ Method branches
→ Paper nodes
→ Evidence / limitation nodes
```

节点视觉：

- 颜色表示 node type；
- 边粗细表示出现频次 / confidence；
- 小 badge 表示用户掌握度；
- current reading paper 高亮；
- weak mastery nodes 使用 warning 标记。

## 11. 与 Node Expansion 2.0 的关系

Node Expansion 2.0 是局部领域地图。Graph Memory Fusion 是长期领域地图。

关系：

```text
Node Expansion direction map
→ 可写入长期图谱 method branch

Method lineage
→ 可写入 evolves_to 边

Comparison workspace
→ 可生成 contrasts_with / extends 边

Diagnosis result
→ 更新 user mastery
```

## 12. LLM 融合任务边界

LLM 可以：

- 判断两个节点是否语义相同；
- 生成 consensus summary；
- 提取 disagreement；
- 判断 relation type；
- 生成 review / transfer task。

LLM 不可以：

- 添加数据库中不存在的论文；
- 删除来源；
- 合并没有足够证据的节点；
- 把 disagreement 隐藏成 consensus。

融合输出必须包含：

```ts
interface FuseGraphNodesResult {
  decision: 'merge' | 'do_not_merge' | 'needs_review'
  reason: string
  canonicalLabel?: string
  consensusSummary?: string
  disagreements: NodeDisagreement[]
  sourceNodeIds: string[]
  sourcePaperIds: string[]
}
```

## 13. 去除假数据策略

长期图谱不能吸收 mock paper 数据，除非处于 dev fixture 模式。

规则：

- `source = mock` 的论文不得进入生产长期图谱；
- 没有 `PaperRecord` 的论文不得进入融合；
- 没有 `sourceUrl` 或 `externalId` 的外部论文不得进入融合；
- LLM 输出的新论文引用一律丢弃并记录错误。

## 14. UI 等待状态

图谱融合多为后台任务，但用户触发节点展开时需要清晰提示。

建议文案：

```text
正在检查你读过的相关论文...
正在匹配长期领域图谱中的相似节点...
正在合并来源证据...
正在生成该领域的 consensus summary...
正在识别不同论文之间的 disagreement...
正在更新你的掌握度状态...
```

动画建议：

- graph node pulse；
- source paper chips 逐个出现；
- merge progress timeline；
- background job toast，不阻塞当前学习。

## 15. 评分标准提升

### AI 参与机制

AI 不只是生成单篇图谱，而是持续融合用户读过的论文，并生成可解释的长期领域图谱。

### 学习闭环

长期图谱接入 DiagnosisRecord 和 UserMasteryRecord，使复习和迁移任务能根据历史表现生成。

### 错误反馈质量

错误反馈可定位到长期领域节点和跨论文混淆点，例如用户把 LoRA 的低秩适配和 HyperNetwork 参数生成混为一谈。

### 可扩展性

MergedGraphNode / MergedGraphEdge 让系统从单篇论文学习扩展到多论文领域学习，同时保留来源和可回退能力。

## 16. 不做范围

本设计不要求立即实现：

- 自动构建全 AI 领域知识库；
- 未经用户阅读或真实检索验证的大规模节点；
- 社交化共享图谱；
- 自动下载并分析任意论文集合。

KG 3.0 的图谱记忆融合必须坚持“用户通过论文深度学习 AI 知识”的产品目标。
