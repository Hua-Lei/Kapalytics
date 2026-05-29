# Prompt Schema 更新文档

## 1. 当前 Prompt 的不足

当前分析 prompt 主要要求 LLM 输出：

```ts
{
  graph: { nodes, edges },
  tasks: Record<string, string>
}
```

节点类型已经覆盖 field、concept、problem、method、formula、experiment、limitation，但主要问题是：

- 输出偏实体抽取，而不是论文论证链；
- 缺少论文级 central insight；
- 节点没有 `roleInPaper`、`whyImportant`、`contrastWithPrior` 等学习字段；
- 节点详情无法根据类型结构化展示；
- 不能支持 Node Expansion；
- 相关论文如果交给 LLM 直接生成，存在幻觉风险。

## 2. 新增 PaperInsight Schema

建议在 `PaperAnalysisResult` 中新增：

```ts
interface PaperInsight {
  centralInsight: string
  priorLimitation: string
  methodMechanism: string
  evidenceChain: string[]
  remainingGap: string
}
```

更新后的结果：

```ts
interface PaperAnalysisResult {
  insight: PaperInsight
  graph: KnowledgeGraph
  tasks: Record<string, string>
}
```

Prompt 要求：

- `centralInsight` 必须用一句清晰的话总结论文最核心思想转折；
- `priorLimitation` 必须指出已有方法的具体瓶颈；
- `methodMechanism` 必须说明本文如何把 insight 落地成方法；
- `evidenceChain` 必须引用图谱中的公式、实验或方法节点 label；
- `remainingGap` 必须避免夸大，说明未解决的问题。

## 3. GraphNode 字段扩展

建议扩展 GraphNode：

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

Prompt 要求：

- 核心 method / formula / experiment 节点必须有 `roleInPaper`；
- method 节点应说明如何服务 central insight；
- experiment 节点应说明验证了哪个 claim；
- field / concept / method 节点可判断是否 expandable；
- expandable 节点必须生成 2-5 个 searchQueries；
- `evidenceNodeIds` 必须引用真实存在的 node id。

## 4. NodeDetail Schema

为支持结构化节点详情，可以新增可选字段：

```ts
interface NodeDetail {
  summary: string
  keyPoints?: string[]
  roleInArgument?: string
  formulaExplanation?: FormulaExplanation
  methodFlow?: MethodFlowStep[]
  claimEvidence?: ClaimEvidenceRow[]
  failureConditions?: string[]
}

interface FormulaExplanation {
  latex: string
  symbols: { symbol: string; meaning: string }[]
  trainingObjective?: string
  positionInMethod?: string
  ablationThought?: string
}

interface MethodFlowStep {
  id: string
  label: string
  description: string
  input?: string
  output?: string
}

interface ClaimEvidenceRow {
  experiment: string
  claim: string
  observation: string
  conclusion: string
}
```

MVP 可以先不把 `NodeDetail` 嵌入每个节点，而是让节点字段支撑右侧 UI。后续再扩展为完整结构。

## 5. NodeExpansion Schema

节点扩展建议 schema：

```ts
interface NodeExpansionResult {
  nodeId: string
  overview: FieldOverviewCard
  relatedPapers: RelatedPaper[]
  methodEvolution?: MethodEvolutionStep[]
  comparisonRows?: PaperComparisonRow[]
  transferTask?: TransferTask
}

interface FieldOverviewCard {
  title: string
  definition: string
  coreProblems: string[]
  methodFamilies: string[]
  relationToCurrentPaper: string
  keyTerms: string[]
}

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
  source: 'mock' | 'semantic_scholar' | 'arxiv' | 'openalex' | 'local'
}
```

LLM 只能基于传入的 `relatedPapers` 总结和比较，不允许自行添加论文。

## 6. 诊断/对比任务 Schema

迁移任务需要接入现有诊断闭环。

```ts
interface TransferTask {
  id: string
  prompt: string
  expectedReasoningPoints: string[]
  relatedPaperIds: string[]
  targetAbility: 'transfer_comparison'
}

interface ExpansionDiagnosisParams {
  nodeId: string
  transferTask: TransferTask
  userAnswer: string
  expansionContext: NodeExpansionResult
}
```

诊断 prompt 应判断：

- 用户是否正确理解当前论文；
- 用户是否正确理解代表论文；
- 用户是否能比较二者差异；
- 用户是否能提出合理迁移或组合方式。

## 7. Prompt 修改建议

### 7.1 论文分析 Prompt

核心要求：

```text
你不是论文摘要器，而是 AI 论文学习图谱构建器。
请输出论文 central insight、已有方法瓶颈、方法机制、证据链、剩余局限。
图谱节点不是普通实体抽取，而是学习者理解论文论证链所需节点。
每个核心节点必须说明它在论文论证中的作用。
```

新增约束：

```text
必须生成 insight 字段。
必须让 graph.nodes 中至少包含：
- 一个 problem 节点表达 priorLimitation；
- 一个 method 节点表达 methodMechanism；
- 一个 formula 或 experiment 节点支撑 evidenceChain；
- 一个 limitation 节点表达 remainingGap。
```

### 7.2 节点字段 Prompt

```text
对每个节点，除 label/description 外，尽量补充：
- insight：这个节点背后的关键理解点；
- whyImportant：为什么它对读懂论文重要；
- roleInPaper：它在论文论证链条中的作用；
- contrastWithPrior：它和已有方法相比的差异；
- evidenceNodeIds：支撑它的节点 id；
- expandable：是否适合作为领域学习入口；
- searchQueries：后续检索相关论文的查询词。
```

### 7.3 公式节点 Prompt

```text
formula 节点 description 必须包含 KaTeX 可渲染公式，使用 $...$ 或 $$...$$ 包裹。
如果 PDF 候选公式不完整，请结合正文上下文修复，但不要编造论文中不存在的公式。
必须解释关键符号、训练目标含义以及该公式在方法流程中的位置。
```

### 7.4 相关论文扩展 Prompt

```text
只能使用输入 relatedPapers 数组中的论文。
不得生成数组外的论文标题、年份、作者、venue。
如果没有相关论文，返回空 relatedPapers 和说明文本。
```

## 8. JSON 输出约束

LLM 输出必须是严格 JSON object，不要 markdown。

顶层结构建议：

```json
{
  "insight": {
    "centralInsight": "...",
    "priorLimitation": "...",
    "methodMechanism": "...",
    "evidenceChain": ["..."],
    "remainingGap": "..."
  },
  "graph": {
    "nodes": [
      {
        "id": "n1",
        "type": "problem",
        "label": "...",
        "description": "...",
        "x": 140,
        "y": 80,
        "insight": "...",
        "whyImportant": "...",
        "roleInPaper": "...",
        "contrastWithPrior": "...",
        "evidenceNodeIds": ["n3"],
        "expandable": true,
        "expansionType": "related_papers",
        "searchQueries": ["..."]
      }
    ],
    "edges": [
      {
        "id": "e1",
        "sourceId": "n1",
        "targetId": "n2",
        "label": "动机",
        "directed": true
      }
    ]
  },
  "tasks": {
    "field_positioning": "...",
    "problem_motivation": "...",
    "method_overview": "...",
    "formula_algorithm": "...",
    "experiment_analysis": "...",
    "contribution_limitation": "...",
    "transfer_comparison": "..."
  }
}
```

校验要求：

- 所有 edge source/target 必须引用存在的 node id；
- `evidenceNodeIds` 必须引用存在的 node id；
- `searchQueries` 必须是字符串数组；
- 不允许输出 Transformer 模板内容，除非论文本身讨论 Transformer；
- 不允许编造论文中不存在的实验、公式、结论。
