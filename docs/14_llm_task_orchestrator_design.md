# KG 3.0 LLM 任务编排器设计

## 1. 目标

KG 3.0 会引入更多 LLM 调用：单篇论文分析、节点按需解释、Node Expansion、论文对比、迁移任务、诊断、跨论文图谱融合。

如果每个组件直接调用 LLM，会出现：

- 调用失控；
- 重复生成；
- UI 不知道具体进度；
- 错误不可恢复；
- 无法缓存；
- 成本不可控；
- 用户点击多个节点时排队混乱。

LLM Task Orchestrator 的目标是统一管理所有 LLM 调用。

## 2. 设计原则

1. 用到时调用：初步知识图谱后，不为所有节点预生成深度内容。
2. 可取消：用户切换节点或关闭视图时，低优先级任务可取消。
3. 可缓存：同一输入 hash 的任务不重复调用。
4. 可观测：每个任务有状态、进度、错误和耗时。
5. 可限流：避免大量 LLM 调用失控。
6. 可校验：LLM JSON 输出必须经过 schema validation。
7. 不编造论文：LLM 只能使用检索 API 或本地库提供的论文。

## 3. DeepSeek API 能力参考

DeepSeek 官方 API 提供 OpenAI / Anthropic 兼容格式。

OpenAI 兼容配置：

```text
base_url: https://api.deepseek.com
model: deepseek-v4-flash / deepseek-v4-pro
```

官方 JSON Output 要求：

- 设置 `response_format: { type: 'json_object' }`；
- prompt 中包含 “json”；
- 提供 JSON 示例；
- 设置合理 `max_tokens` 避免截断；
- JSON 模式可能偶发返回空内容，需要重试或 prompt 修复策略。

DeepSeek Context Caching 默认启用：

- 重复前缀可命中缓存；
- response usage 中有 `prompt_cache_hit_tokens` 和 `prompt_cache_miss_tokens`；
- 缓存是 best effort，不保证 100% 命中。

这些能力决定 KG 3.0 应把长论文上下文、稳定 system prompt 和 schema prompt 放在稳定前缀中，以提高缓存命中率。

## 4. LLMJob 数据结构

```ts
type LLMJobType =
  | 'analyze_single_paper'
  | 'generate_node_detail'
  | 'expand_node'
  | 'compare_papers'
  | 'generate_transfer_task'
  | 'diagnose_answer'
  | 'fuse_graph_nodes'
  | 'repair_json'
  | 'summarize_retrieved_paper'

type LLMJobStatus =
  | 'queued'
  | 'running'
  | 'waiting_for_retrieval'
  | 'validating'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'cache_hit'

interface LLMJob {
  id: string
  type: LLMJobType
  status: LLMJobStatus
  priority: 'low' | 'normal' | 'high' | 'user_blocking'
  inputHash: string
  cacheKey: string
  paperId?: string
  nodeId?: string
  sessionId?: string
  taskId?: string
  relatedPaperIds: string[]
  promptVersion: string
  model: 'deepseek-v4-flash' | 'deepseek-v4-pro' | 'deepseek-chat' | 'deepseek-reasoner'
  jsonMode: boolean
  maxTokens: number
  temperature: number
  attempts: number
  maxAttempts: number
  progressStep: LLMProgressStep
  progressMessage: string
  errorCode?: string
  errorMessage?: string
  resultJson?: unknown
  rawOutput?: string
  usage?: LLMUsage
  createdAt: string
  startedAt?: string
  finishedAt?: string
}

interface LLMUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  promptCacheHitTokens?: number
  promptCacheMissTokens?: number
}

type LLMProgressStep =
  | 'building_context'
  | 'waiting_for_retrieval'
  | 'calling_model'
  | 'parsing_json'
  | 'validating_schema'
  | 'saving_memory'
  | 'done'
```

## 5. 支持任务

### 5.1 analyze_single_paper

输入：

- extracted PDF text；
- formula candidates；
- paper metadata。

输出：

- `PaperInsightRecord`；
- `GraphNodeRecord[]`；
- `GraphEdgeRecord[]`；
- `LearningTaskRecord[]`。

策略：

- 用户点击“分析论文”时调用；
- 只生成初步图谱和阶段任务；
- 不生成所有节点的深度扩展；
- 保存到 SQLite。

### 5.2 generate_node_detail

输入：

- paperId；
- nodeId；
- 当前节点上下文；
- 相关 pageRefs。

输出：

- structured `NodeDetail`。

策略：

- 用户点击节点并打开“深度解释”时调用；
- 如果 `GraphNodeRecord.detailJson` 已存在且 promptVersion 未过期，直接 cache hit；
- UI 显示“正在分析该节点在论文中的作用”。

### 5.3 expand_node

输入：

- node；
- paper insight；
- verified retrieved papers；
- reading history。

输出：

- direction map；
- method lineage；
- candidate comparison workspace。

策略：

- 必须先完成检索；
- LLM 不能新增 related paper；
- 数据不足返回 `insufficientData`。

### 5.4 compare_papers

输入：

- current paper；
- current node；
- selected related paper；
- source metadata；
- abstracts / summaries。

输出：

- sharp comparison rows。

必须包含：

- research problem；
- method mechanism；
- adaptation stage；
- updated object；
- inheritance；
- improvement；
- difference；
- limitation；
- combination。

### 5.5 generate_transfer_task

输入：

- comparison rows；
- current node；
- selected related paper；
- user mastery。

输出：

- transfer task；
- expected reasoning points。

策略：

- 写入 `LearningTaskRecord`；
- 接入 `transfer_comparison` 学习阶段。

### 5.6 diagnose_answer

输入：

- learning task；
- user answer；
- current node；
- comparison context；
- user mastery。

输出：

- `DiagnosisRecord`。

诊断应判断：

- 是否理解当前论文；
- 是否理解代表论文；
- 是否能比较继承和改进；
- 是否能指出迁移风险。

### 5.7 fuse_graph_nodes

输入：

- 多个 GraphNodeRecord；
- source paper metadata；
- existing MergedGraphNode candidates。

输出：

- merge / no-merge decision；
- consensus summary；
- disagreements；
- source mapping。

策略：

- 低优先级后台任务；
- 不阻塞当前阅读；
- 必须保留来源。

## 6. 任务状态机

```text
queued
→ waiting_for_retrieval
→ running
→ validating
→ succeeded
```

失败路径：

```text
running → failed → queued retry
validating → repair_json → validating
queued/running → cancelled
queued → cache_hit
```

状态说明：

- `queued`：等待调度；
- `waiting_for_retrieval`：需要论文检索结果；
- `running`：正在调用模型；
- `validating`：解析和校验 JSON；
- `cache_hit`：已有相同输入结果；
- `failed`：超出重试或不可恢复错误；
- `cancelled`：用户切换上下文或取消。

## 7. 重试与错误处理

错误类型：

```ts
type LLMJobErrorCode =
  | 'no_api_key'
  | 'rate_limited'
  | 'timeout'
  | 'empty_output'
  | 'invalid_json'
  | 'schema_validation_failed'
  | 'hallucinated_paper'
  | 'insufficient_retrieval_data'
  | 'cancelled_by_user'
  | 'unknown'
```

策略：

- `rate_limited`：指数退避；
- `timeout`：最多重试 2 次；
- `empty_output`：DeepSeek JSON Output 已知可能发生，使用更短 prompt 或 retry prompt；
- `invalid_json`：进入 `repair_json`；
- `schema_validation_failed`：如果是字段缺失可修复，否则失败；
- `hallucinated_paper`：直接失败，不允许自动补论文；
- `insufficient_retrieval_data`：显示空状态。

## 8. 缓存策略

```ts
interface LLMJobCacheEntry {
  cacheKey: string
  jobType: LLMJobType
  inputHash: string
  promptVersion: string
  model: string
  resultJson: unknown
  createdAt: string
  expiresAt?: string
}
```

cache key 必须包含：

- job type；
- prompt version；
- model；
- stable input hash；
- related paper IDs；
- node ID / paper ID。

缓存 TTL：

- analyze_single_paper：除非 promptVersion 变化，否则长期；
- generate_node_detail：长期；
- expand_node：7-30 天，取决于检索结果 TTL；
- compare_papers：长期，除非 source paper metadata 更新；
- diagnose_answer：不复用不同用户答案；
- fuse_graph_nodes：长期，但源节点变化时失效。

## 9. 防止调用失控

### 9.1 并发限制

```text
user_blocking: max 1-2 concurrent
normal: max 2 concurrent
low/background: max 1 concurrent
```

### 9.2 预算限制

每个 session 设置预算：

- 最大 LLM job 数；
- 最大 tokens；
- 最大失败重试次数；
- 最大后台融合任务数。

超过预算时提示用户：

```text
本次阅读已生成较多 AI 分析。是否继续生成更深层节点解释？
```

### 9.3 Lazy Invocation

用到时调用：

```text
初步图谱：立即生成
节点深度解释：点击节点后生成
方向地图：点击展开后生成
代表论文对比：选择论文后生成
迁移任务：用户点击生成任务后生成
图谱融合：后台低优先级生成
```

### 9.4 取消和去抖

- 用户快速切换节点时，取消旧节点的非必要 job；
- 同一节点 500ms 内重复点击不重复排队；
- 相同 inputHash 的 job 合并。

## 10. Schema Validation

每个 job 必须有输出 schema。

验证步骤：

```text
parse JSON
→ schema validate
→ verify IDs exist
→ verify relatedPaperIds exist in retrieval candidates
→ verify no unknown paper titles
→ save result
```

对论文相关任务的硬规则：

- LLM 输出引用的 paper ID 必须存在；
- 不能新增 title/year/venue/source；
- `source/url/externalId` 必须来自 provider；
- 出现未知论文时标记 `hallucinated_paper`。

## 11. UI 进度与动画提示

LLM 等待不应只有 spinner。

### 11.1 进度文案

```text
正在准备论文上下文...
正在读取历史学习记忆...
正在调用 DeepSeek 分析节点...
正在校验 JSON 输出...
正在确认引用论文来源...
正在保存到长期记忆...
```

### 11.2 动画建议

- 局部 shimmer skeleton；
- 节点卡片内 step progress；
- LLM 分析 pulse 动画；
- 当前 job 类型标签，例如 “Node Detail Analysis”；
- 展示可取消按钮；
- 超过 20 秒显示“仍在分析，可能是论文上下文较长”。

### 11.3 失败恢复

失败 UI 应提供：

- 重试；
- 查看错误摘要；
- 使用已有 fallback；
- 跳过该深度分析。

## 12. 评分标准提升

### AI 参与机制

LLM 从一次性总结升级为可编排、多任务、可追踪的学习代理。

### 学习闭环

任务编排器确保分析、扩展、对比、迁移和诊断都能回到学习任务系统。

### 错误反馈

诊断 job 可使用长期记忆、当前节点和代表论文上下文，反馈更具体。

### 可扩展性

统一 LLMJob 状态机支持未来接入更多模型、后台任务和云端队列。
