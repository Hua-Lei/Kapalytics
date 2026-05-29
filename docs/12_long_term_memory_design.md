# KG 3.0 长期记忆数据库设计

## 1. 目标

KG 3.0 的长期记忆系统用于把单篇论文学习结果沉淀为可复用的领域知识资产。

它不是普通论文收藏夹，也不是推荐系统。它要服务 Kapalytics 的核心学习闭环：

```text
AI 讲解
→ 用户尝试
→ AI 反馈
→ 再强化 / 迁移
→ 沉淀到长期领域图谱
```

长期记忆系统需要保存：

- 用户读过哪些论文；
- 每篇论文生成过哪些图谱节点和学习任务；
- 用户在哪些节点、概念、迁移任务上出错；
- 多篇论文中哪些节点可以融合成长期领域图谱；
- 后续 Node Expansion、对比阅读和诊断如何复用历史上下文。

## 2. 存储策略

### 2.1 本地 SQLite 优先

初期优先使用本地 SQLite：

- 适合 Electron 桌面应用；
- 无需用户注册和云端配置；
- 可离线保存阅读历史、诊断记录和图谱；
- 可通过迁移脚本逐步扩展 schema；
- 后续可同步到云端数据库。

建议 SQLite 文件位置：

```text
appData/kapalytics/kapalytics.sqlite
```

本地文件只存结构化数据和小型文本。PDF 原文件可以只保存本地路径、hash、导入时间和可选全文摘要，不强制复制 PDF。

### 2.2 未来云端扩展

未来可以扩展到：

- PostgreSQL：多人、多设备同步；
- Supabase / Neon：轻量云端部署；
- Turso / libSQL：SQLite 兼容同步；
- 向量数据库：只用于语义检索，不替代结构化数据库。

数据库抽象层应避免把业务直接绑死在 SQLite SQL 上。建议保留 Repository 接口：

```ts
interface PaperMemoryRepository {
  savePaper(record: PaperRecord): Promise<void>
  getPaper(id: string): Promise<PaperRecord | null>
  listPapers(filter?: PaperFilter): Promise<PaperRecord[]>
}
```

## 3. 需要保存的对象

长期记忆系统至少保存以下对象：

| 对象 | 作用 |
|---|---|
| `PaperRecord` | 单篇论文元数据、来源、全文状态、分析状态 |
| `GraphNodeRecord` | 单篇论文内的图谱节点 |
| `GraphEdgeRecord` | 单篇论文内的图谱边 |
| `PaperInsightRecord` | 论文 central insight 和论证链 |
| `ReadingSession` | 用户一次阅读/学习会话 |
| `LearningTaskRecord` | 阶段任务、迁移任务、节点任务 |
| `DiagnosisRecord` | 用户作答与 AI 诊断结果 |
| `NodeExpansionRecord` | 节点展开结果与缓存 |
| `PaperSearchResultRecord` | 真实检索或本地库得到的论文结果 |
| `MergedGraphNode` | 跨论文融合后的长期领域节点 |
| `MergedGraphEdge` | 跨论文融合后的长期领域关系 |
| `UserMasteryRecord` | 用户对概念、方法、能力的掌握状态 |
| `LLMJobRecord` | LLM 任务编排、缓存和错误处理记录 |

## 4. 核心 Schema

### 4.1 PaperRecord

`PaperRecord` 是所有长期记忆的根对象。

```ts
interface PaperRecord {
  id: string
  title: string
  authors: string[]
  year?: number
  venue?: string
  abstract?: string
  doi?: string
  arxivId?: string
  externalIds: PaperExternalId[]
  source: 'uploaded_pdf' | 'arxiv' | 'semantic_scholar' | 'openalex' | 'local_library'
  sourceUrl?: string
  pdfUrl?: string
  localPdfPath?: string
  contentHash?: string
  importedAt: string
  lastReadAt?: string
  analysisStatus: 'not_analyzed' | 'analyzing' | 'analyzed' | 'failed'
  graphVersion: string
  createdAt: string
  updatedAt: string
}

interface PaperExternalId {
  provider: 'arxiv' | 'semantic_scholar' | 'openalex' | 'doi' | 'corpus_id' | 'local'
  externalId: string
  url?: string
}
```

要求：

- 真实论文必须有 `source`、`externalIds` 和可追溯 `sourceUrl` 或 `url`；
- 用户上传 PDF 可以没有外部 ID，但必须有 `contentHash`；
- 如果同一论文来自多个 provider，应合并到一个 `PaperRecord`，保留所有 external IDs。

### 4.2 PaperInsightRecord

```ts
interface PaperInsightRecord {
  id: string
  paperId: string
  centralInsight: string
  priorLimitation: string
  methodMechanism: string
  evidenceChainNodeIds: string[]
  remainingGap: string
  generatedByJobId?: string
  createdAt: string
  updatedAt: string
}
```

作用：

- 支撑论文论证图；
- 支撑 Node Expansion 中“当前论文位置”；
- 支撑后续诊断判断用户是否抓住论文主线。

### 4.3 GraphNodeRecord

```ts
interface GraphNodeRecord {
  id: string
  paperId: string
  nodeType: 'field' | 'concept' | 'problem' | 'method' | 'formula' | 'experiment' | 'limitation'
  label: string
  normalizedLabel: string
  description: string
  insight?: string
  whyImportant?: string
  roleInPaper?: string
  contrastWithPrior?: string
  evidenceNodeIds: string[]
  expandable: boolean
  expansionType?: 'field_overview' | 'related_papers' | 'method_evolution' | 'comparison'
  searchQueries: string[]
  detailJson?: NodeDetail
  pageRefs?: PaperPageRef[]
  confidence: number
  generatedByJobId?: string
  createdAt: string
  updatedAt: string
}

interface PaperPageRef {
  page: number
  textSnippet?: string
  boundingBox?: { x: number; y: number; width: number; height: number }
}
```

注意：

- `normalizedLabel` 用于跨论文节点融合；
- `confidence` 表示当前节点抽取和解释可信度；
- `detailJson` 保存结构化节点详情，但具体深入解释可以用到时再生成。

### 4.4 GraphEdgeRecord

```ts
interface GraphEdgeRecord {
  id: string
  paperId: string
  sourceNodeId: string
  targetNodeId: string
  relationType: 'motivates' | 'solves' | 'uses' | 'derives' | 'validates' | 'limits' | 'contrasts' | 'extends' | 'related'
  label: string
  directed: boolean
  evidence?: string
  confidence: number
  generatedByJobId?: string
  createdAt: string
  updatedAt: string
}
```

边必须表达学习依赖或论文论证关系，不保存松散同义关系。

### 4.5 ReadingSession

```ts
interface ReadingSession {
  id: string
  paperId: string
  startedAt: string
  endedAt?: string
  activeGraphView?: 'argument' | 'mechanism' | 'expansion'
  selectedNodeIds: string[]
  completedStageIds: string[]
  lastActiveStageId?: string
  notes?: string
  createdAt: string
  updatedAt: string
}
```

ReadingSession 让系统知道用户不是只“看过论文”，而是在哪些节点和阶段停留、作答、复习。

### 4.6 LearningTaskRecord

```ts
interface LearningTaskRecord {
  id: string
  paperId: string
  sessionId?: string
  nodeId?: string
  taskType: 'stage_task' | 'node_explanation' | 'transfer_comparison' | 'review' | 'fusion_reflection'
  stageId?: string
  prompt: string
  expectedReasoningPoints: string[]
  relatedPaperIds: string[]
  relatedMergedNodeIds: string[]
  status: 'not_started' | 'in_progress' | 'answered' | 'diagnosed' | 'completed'
  generatedByJobId?: string
  createdAt: string
  updatedAt: string
}
```

### 4.7 DiagnosisRecord

```ts
interface DiagnosisRecord {
  id: string
  paperId: string
  sessionId?: string
  taskId: string
  nodeId?: string
  userAnswer: string
  isCorrect: boolean
  errorType: 'concept_confusion' | 'missing_evidence' | 'weak_transfer' | 'method_misread' | 'formula_misread' | 'overgeneralization'
  feedback: string
  remedialTask: string
  masteryDelta: number
  diagnosedByJobId?: string
  createdAt: string
}
```

用途：

- 更新 `UserMasteryRecord`；
- 让下次解释更针对用户常错点；
- 支撑长期学习报告。

### 4.8 NodeExpansionRecord

```ts
interface NodeExpansionRecord {
  id: string
  paperId: string
  nodeId: string
  directionMapJson?: DirectionMap
  methodLineageJson?: MethodLineage
  comparisonWorkspaceJson?: ComparisonWorkspace
  relatedPaperIds: string[]
  dataCompleteness: 'complete' | 'partial' | 'insufficient'
  missingDataReasons: string[]
  generatedByJobIds: string[]
  createdAt: string
  updatedAt: string
}
```

Node Expansion 3.0 仍然遵守：真实论文只能来自检索 API 或本地论文库，LLM 不能补出论文。

### 4.9 PaperSearchResultRecord

```ts
interface PaperSearchResultRecord {
  id: string
  provider: 'arxiv' | 'semantic_scholar' | 'openalex' | 'local'
  query: string
  title: string
  authors: string[]
  year?: number
  venue?: string
  abstract?: string
  source: string
  url: string
  externalId: string
  doi?: string
  arxivId?: string
  semanticScholarPaperId?: string
  openAlexId?: string
  pdfUrl?: string
  rawJson: unknown
  cacheKey: string
  fetchedAt: string
  expiresAt?: string
}
```

要求：每篇论文必须保留 `source` / `url` / `externalId`。

### 4.10 MergedGraphNode

```ts
interface MergedGraphNode {
  id: string
  canonicalLabel: string
  normalizedLabel: string
  nodeType: 'field' | 'concept' | 'problem' | 'method' | 'formula' | 'experiment' | 'limitation' | 'mixed'
  sourceNodeIds: string[]
  sourcePaperIds: string[]
  descriptions: string[]
  consensusSummary: string
  disagreements: string[]
  representativePaperIds: string[]
  masteryScore?: number
  lastReviewedAt?: string
  generatedByJobId?: string
  createdAt: string
  updatedAt: string
}
```

### 4.11 MergedGraphEdge

```ts
interface MergedGraphEdge {
  id: string
  sourceMergedNodeId: string
  targetMergedNodeId: string
  relationType: string
  label: string
  sourceEdgeIds: string[]
  sourcePaperIds: string[]
  confidence: number
  createdAt: string
  updatedAt: string
}
```

### 4.12 UserMasteryRecord

```ts
interface UserMasteryRecord {
  id: string
  targetType: 'paper' | 'graph_node' | 'merged_graph_node' | 'ability'
  targetId: string
  masteryScore: number
  confidence: number
  strengths: string[]
  weaknesses: string[]
  lastDiagnosisIds: string[]
  nextRecommendedTaskId?: string
  updatedAt: string
}
```

Ability examples：

- `field_positioning`
- `problem_motivation`
- `method_mechanism`
- `formula_interpretation`
- `experiment_claim_evidence`
- `transfer_comparison`

## 5. SQLite 表建议

建议表结构：

```text
papers
paper_external_ids
paper_insights
graph_nodes
graph_edges
reading_sessions
learning_tasks
diagnoses
node_expansions
paper_search_results
merged_graph_nodes
merged_graph_edges
user_mastery
llm_jobs
```

JSON 字段可以先用 SQLite `TEXT` 保存序列化 JSON，后续云端迁移时映射到 PostgreSQL `jsonb`。

必要索引：

```text
papers(content_hash)
papers(doi)
paper_external_ids(provider, external_id)
graph_nodes(paper_id, normalized_label)
graph_nodes(node_type)
graph_edges(paper_id, source_node_id, target_node_id)
diagnoses(task_id)
diagnoses(node_id)
paper_search_results(provider, external_id)
paper_search_results(cache_key)
merged_graph_nodes(normalized_label)
user_mastery(target_type, target_id)
llm_jobs(job_type, status)
```

## 6. 假数据和占位数据清理策略

KG 3.0 之后，系统不应再依赖假数据或占位数据。

迁移策略：

1. 保留 mock library 只作为开发 fixture，不进入生产默认流程。
2. UI 中如果没有真实检索结果或本地论文库结果，显示空状态。
3. 所有 `RelatedPaper` 必须关联 `PaperSearchResultRecord` 或 `PaperRecord`。
4. 所有代表论文必须有 `source` / `url` / `externalId`。
5. LLM 输出中出现未知论文标题时直接丢弃，并记录 job validation error。

## 7. 用到时调用的记忆加载

初步知识图谱生成后，不应立刻为所有节点生成深度解释、方向地图、谱系和对比结果。

建议策略：

```text
初次分析论文
→ 保存 PaperRecord / PaperInsight / GraphNode / GraphEdge / LearningTask
→ 用户点击节点
→ 按需加载或生成 NodeDetail / NodeExpansion
→ 用户选择代表论文
→ 按需生成 comparison rows / transfer task
```

收益：

- 降低初次分析等待时间；
- 避免大量无用 LLM 调用；
- 更容易展示细粒度进度；
- 让用户的点击行为决定计算优先级。

## 8. 等待状态与进度提示

长期记忆系统应记录 LLM job 和 retrieval job 的状态，UI 可展示更细的等待提示。

示例状态文案：

```text
正在读取本地论文记忆...
正在检索真实论文来源...
正在去重候选论文...
正在分析该节点在领域中的位置...
正在生成方法演进谱系...
正在构造对比阅读表...
正在生成迁移任务...
正在诊断你的回答...
```

动画建议：

- 节点局部 skeleton，不阻塞整页；
- 当前 step 高亮的 timeline loading；
- “LLM 正在分析”带阶段名称和可取消按钮；
- 慢任务显示预计阶段，而不是无限 spinner。

## 9. 评分标准提升

### AI 参与机制

AI 不只总结当前论文，而是基于长期记忆执行节点解释、跨论文对比、图谱融合和诊断反馈。

### 学习闭环

ReadingSession、LearningTaskRecord、DiagnosisRecord 和 UserMasteryRecord 使每次学习都能沉淀，并驱动下一次强化/迁移任务。

### 错误反馈质量

诊断记录能绑定具体论文、节点、任务和能力维度，使反馈不再是一次性的文本，而是长期学习状态的一部分。

### 可扩展性

SQLite-first schema 可以平滑扩展到云端数据库；GraphNodeRecord 和 MergedGraphNode 为长期领域图谱提供结构基础。

## 10. 不做范围

本设计不要求立即实现：

- 多用户云同步；
- 全文向量数据库；
- 自动下载所有论文 PDF；
- 大规模开放领域推荐；
- 未经真实来源验证的论文生成。

KG 3.0 的长期记忆系统必须始终围绕论文深度学习，而不是泛化成论文推荐产品。
