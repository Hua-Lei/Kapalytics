# KG 3.0 验收反馈与修改意见

## 1. 验收结论

当前 KG 3.0 实现已经通过基础工程验证：

- `npm run typecheck` 通过；
- `npm run build` 通过；
- 已新增 KG3 类型、记忆仓库、检索入口、轻量融合、LLM job 骨架和 IPC；
- 分析论文后可以把当前图谱保存到 KG3 记忆，并触发轻量融合。

但当前实现更接近：

```text
KG 3.0 可编译原型 / 本地 JSON 记忆脚手架
```

还不能视为完整 KG 3.0。它尚未完全达到文档中对“长期领域图谱与论文记忆系统”的目标，尤其是：

- SQLite-first 长期存储；
- 真实 arXiv / Semantic Scholar / OpenAlex provider；
- LLM 任务真实执行、限流、重试和 schema validation；
- 防止 LLM 编造论文的强校验；
- 用到时调用的节点深度分析体验；
- 多论文关系合并和长期领域图谱完善。

建议下一阶段不要大改 UI，先补齐数据正确性和真实检索链路。

## 2. 已完成内容

### 2.1 类型与接口

已新增：

```text
src/shared/kg3.ts
```

包含：

- `PaperRecord`
- `GraphNodeRecord`
- `GraphEdgeRecord`
- `ReadingSession`
- `LearningTaskRecord`
- `DiagnosisRecord`
- `PaperSearchResult`
- `MergedGraphNode`
- `MergedGraphEdge`
- `LLMJob`
- `PaperSearchProvider`
- `Kg3MemorySnapshot`

这些类型基本覆盖 `docs/12-15` 中的 KG 3.0 schema 方向。

### 2.2 本地记忆原型

已新增：

```text
src/main/memory/kg3Repository.ts
```

当前使用 JSON 文件：

```text
appData/memory/kg3-memory.json
```

支持保存：

- `PaperRecord`
- 单篇论文 `GraphNodeRecord`
- 单篇论文 `GraphEdgeRecord`
- `PaperInsightRecord`
- `PaperSearchResultRecord`
- `NodeExpansionRecord`
- `LLMJob`

### 2.3 检索入口

已新增：

```text
src/main/retrieval/paperSearch.ts
```

当前实现：

- `LocalProvider`
- `dedupeAndRankResults`
- provider 状态返回
- 搜索结果保存到记忆仓库

### 2.4 轻量图谱融合

已新增：

```text
src/main/memory/graphFusion.ts
```

当前实现：

- 生成 merge candidates；
- 基于 normalized label / node type / description overlap 决定是否合并；
- 生成或更新 `MergedGraphNode`；
- 保存一条 `fuse_graph_nodes` 类型的 LLM job 记录。

### 2.5 LLM 任务骨架

已新增：

```text
src/main/llm/orchestrator.ts
```

当前支持：

- `createJob`
- cache hit 识别；
- `markRunning`
- `markSucceeded`
- `markFailed`
- `cancel`

### 2.6 IPC 接入

已新增 KG3 IPC：

```text
kg3:get-memory-snapshot
kg3:search-papers
kg3:save-current-graph
kg3:fuse-paper-graph
kg3:create-llm-job
kg3:cancel-llm-job
```

Renderer 侧 `electronApi.kg3` 已接入。

## 3. 主要差距与风险

### 3.1 长期记忆未使用 SQLite

文档目标是：

```text
本地 SQLite 优先，未来扩展云端数据库
```

当前是 JSON 文件仓库。

风险：

- 并发写入可能丢数据；
- 无索引，后续查询性能差；
- schema migration 不明确；
- 不能很好支持按节点、论文、诊断记录检索；
- 和文档的 SQLite-first 目标不一致。

修改意见：

- 短期可保留 JSON repository 作为 prototype；
- 需要明确标注为 `FilePaperMemoryRepository` 临时实现；
- 下一阶段新增 `SqlitePaperMemoryRepository`；
- 保持 `PaperMemoryRepository` 接口不变，便于切换。

### 3.2 外部论文检索 Provider 未真正实现

当前：

```ts
new DisabledExternalProvider('arxiv', 'arXiv')
new DisabledExternalProvider('semantic_scholar', 'Semantic Scholar')
new DisabledExternalProvider('openalex', 'OpenAlex')
```

实际只有 `LocalProvider` 可返回结果。

风险：

- KG 3.0 仍无法真正获取外部论文；
- Node Expansion 2.0 / KG 3.0 仍依赖本地已读论文；
- 无法满足“真实论文来自检索 API 或本地论文库”的完整目标。

修改意见：

按优先级实现：

1. arXiv provider：实现 `search_query` / `id_list` / Atom 解析 / 3 秒 delay / cache。
2. OpenAlex provider：实现 `/works?search=...`，保存 OpenAlex ID、DOI、OA URL、topics、cited_by_count。
3. Semantic Scholar provider：实现 paper search 和 detail lookup，保存 paperId、corpusId、externalIds、url。

### 3.3 LLMTaskOrchestrator 没有真实执行任务

当前 orchestrator 只负责 job 记录和状态更新，不负责真正运行任务。

缺失：

- 队列；
- 并发限制；
- 重试执行；
- 实际调用 `callLlm`；
- JSON parse / repair；
- schema validation；
- relatedPaperIds 校验；
- hallucinated paper 检测。

风险：

- “用到时调用”的节点深度解释、对比、迁移任务无法真正统一编排；
- UI 无法基于 job 状态显示真实进度；
- LLM 调用仍可能散落在各模块。

修改意见：

新增：

```ts
runJob(jobId: string): Promise<LLMJob>
enqueueJob(params): Promise<LLMJob>
validateJobOutput(job, output): ValidationResult
```

并按 job type 分发：

- `generate_node_detail`
- `expand_node`
- `compare_papers`
- `generate_transfer_task`
- `diagnose_answer`
- `fuse_graph_nodes`

### 3.4 防幻觉校验仍停留在类型层

文档要求：

```text
LLM 不允许编造论文。
LLM 输出中的论文必须来自检索 API 或本地论文库。
```

当前实现没有校验：

- LLM 输出的 relatedPaperId 是否存在于 candidates；
- LLM 是否新增了 title / year / venue；
- `source/url/externalId` 是否来自 provider；
- 是否存在 hallucinated paper。

修改意见：

新增统一校验函数：

```ts
function validateReferencedPapers(
  output: unknown,
  allowedPaperIds: string[]
): { ok: boolean; hallucinatedIds: string[]; errors: string[] }
```

所有涉及论文的 job 必须经过该校验。

### 3.5 `evidenceChainNodeIds` 保存不严谨

当前：

```ts
evidenceChainNodeIds: insight.evidenceChain
```

但 KG 2.0 中 `evidenceChain` 常是节点 label，不一定是 node id。

风险：

- 长期记忆中 evidence chain 无法正确回链到节点；
- 后续诊断无法引用证据节点；
- 多论文融合时证据关系不可靠。

修改意见：

在 `saveGraphForPaper` 中建立 label → nodeId 映射：

```ts
const labelToRecordId = new Map(nodeRecords.map(node => [node.label, node.id]))
```

然后把 `evidenceChain` 映射到真实 node id，映射失败则丢弃或保存到 `evidenceChainLabels`。

### 3.6 本地 PaperRecord 溯源不足

当前上传 PDF 保存的 `PaperRecord`：

- 有 `contentHash`；
- 有 `externalIds: [{ provider: 'local', externalId: ... }]`；
- 没有 `localPdfPath`；
- 没有 `sourceUrl`；
- `contentHash` 实际来自 pdfUrl hash，不是文件内容 hash。

风险：

- Local provider 无法回到原始 PDF；
- 同名或移动文件可能导致 ID 不稳定；
- 长期记忆来源追踪不完整。

修改意见：

- `SelectedPdf` 已有 `filePath`，应传给 `saveCurrentGraph`；
- `PaperRecord.localPdfPath = selected.filePath`；
- `contentHash` 应尽量使用 PDF 文件内容 hash；
- 暂时不能算内容 hash 时，字段命名不要伪装为内容 hash，可用 `localFileId`。

### 3.7 图谱融合只处理节点，不处理关系

当前有 `MergedGraphEdge` 类型和 `mapRelationToMergedType`，但 `fusePaperGraph` 没有写入 `mergedGraphEdges`。

风险：

- 长期领域图谱只有点，没有稳定的跨论文关系；
- 无法形成 field → problem → method → evidence 的长期结构；
- Node Expansion 的方向地图无法复用长期关系。

修改意见：

在节点融合后增加边融合：

```text
GraphEdgeRecord
→ source/target 对应 MergedGraphNode
→ MergedGraphEdge upsert
→ sourceEdgeIds/sourcePaperIds 合并
→ confidence 累加
```

### 3.8 MergedGraphNode ID 可能冲突

当前新融合节点 ID：

```ts
merged_${hash(node.normalizedLabel)}
```

风险：

- 同 label 不同类型可能冲突；
- 同 label 不同语境不应合并但会生成同 ID；
- 多次融合可能产生重复 ID。

修改意见：

ID 至少包含 node type：

```ts
merged_${hash(`${node.nodeType}:${node.normalizedLabel}`)}
```

更好的方式是：

- 先查是否已有相同 ID；
- 如果需要分叉，加 semantic suffix；
- 使用 upsert 而不是直接 push。

### 3.9 检索排序缺少 relationToCurrentNode 信号

文档设计：

```text
score = lexicalMatch * 0.35
      + semanticTagMatch * 0.25
      + relationToCurrentNodeConfidence * 0.20
      + sourceQuality * 0.10
      + recencyOrCitationSignal * 0.10
```

当前实现没有 `relationToCurrentNodeConfidence`，总权重只有 0.8。

修改意见：

- 第一版可以把 local graph relation / searchQueries overlap 作为 relation confidence；
- 真实 provider 接入后，再用 LLM 按需判断 relationToCurrentNode。

### 3.10 KG3 记忆保存失败被静默吞掉

当前：

```ts
electronApi.kg3.saveCurrentGraph(...).then(...).catch(() => {})
```

风险：

- 长期记忆保存失败时用户无感知；
- 后续以为已经进入 KG3 记忆，但实际没有；
- 难以 debug。

修改意见：

- 至少记录 console warning；
- 更好是在 UI 中显示非阻塞 toast：

```text
论文分析完成，但长期记忆保存失败。你仍可继续学习。
```

## 4. 建议优先级

### P0：数据正确性与可追溯性

1. 修复 `evidenceChainNodeIds` 映射。
2. 防止 `MergedGraphNode` ID 冲突和重复 push。
3. 保存 `localPdfPath` / `sourceUrl`，不要伪造 content hash。
4. KG3 保存失败不能完全静默。
5. 明确 JSON repository 是临时实现，准备 SQLite repository。

### P1：真实检索链路

1. 实现 arXiv provider。
2. 实现 OpenAlex provider。
3. 实现 Semantic Scholar provider。
4. 检索结果必须保存 `source/url/externalId/raw`。
5. provider 级别超时、错误、空状态要返回给 UI。

### P2：LLM 编排器真正执行任务

1. 增加 `runJob`。
2. 增加队列、并发限制和取消。
3. 增加 JSON schema validation。
4. 增加 related paper 防幻觉校验。
5. 把节点深度解释、Node Expansion、对比阅读接到 orchestrator。

### P3：长期领域图谱完善

1. 生成 `MergedGraphEdge`。
2. 保存 disagreements 和 source attribution。
3. 接入 `UserMasteryRecord`。
4. 根据诊断结果生成复习/迁移任务。

## 5. 推荐下一阶段任务切分

### Issue 1：修复 KG3 记忆数据正确性

范围：

- evidenceChain label → node id；
- MergedGraphNode ID 去冲突；
- localPdfPath 保存；
- KG3 保存失败提示。

验收：

- 重复分析同一论文不会生成重复 merged node；
- evidenceChainNodeIds 引用真实 GraphNodeRecord id；
- snapshot 中 PaperRecord 能追踪到本地 PDF 来源。

### Issue 2：实现 arXiv Provider

范围：

- `https://export.arxiv.org/api/query`；
- Atom 解析；
- `search_query` / `id_list`；
- 3 秒 delay；
- 缓存；
- source/url/externalId 保留。

验收：

- 给定 query 能返回真实 arXiv 论文；
- 每条结果有 arXiv ID、abstract URL、PDF URL、title、authors、summary；
- LLM 没有参与候选论文生成。

### Issue 3：实现 OpenAlex Provider

范围：

- `/works?search=...`；
- DOI / OpenAlex ID / OA URL / topics / cited_by_count；
- 和 arXiv/local 去重。

验收：

- 同一 DOI 不重复出现；
- OpenAlex source 保留；
- 无结果时显示 provider empty 状态。

### Issue 4：LLM Orchestrator runJob

范围：

- job queue；
- `runJob`；
- retry；
- timeout；
- schema validation；
- hallucinated paper validation。

验收：

- `compare_papers` job 能基于真实 candidate 生成对比；
- 输出引用不存在 paper id 时 job failed；
- UI 可看到 progressMessage。

### Issue 5：边融合与长期领域图谱

范围：

- `MergedGraphEdge` upsert；
- sourceEdgeIds/sourcePaperIds 合并；
- confidence 更新；
- relation disagreement 保存。

验收：

- 两篇论文中相同方法关系能合并为长期边；
- 节点详情可追溯边来源。

## 6. 给下一个 Agent 的上下文摘要

当前 KG3 已有可编译原型：

- JSON 文件记忆仓库；
- local paper provider；
- 轻量节点融合；
- LLM job 状态骨架；
- IPC / preload / renderer API；
- 论文分析后自动保存当前图谱并触发融合。

下一步不要重复搭框架，优先补齐：

```text
P0 数据正确性
→ arXiv / OpenAlex provider
→ orchestrator runJob + schema validation
→ MergedGraphEdge
→ SQLite repository
```

实现时必须继续遵守：

- 真实论文只能来自检索 API 或本地论文库；
- LLM 不得编造论文；
- 所有代表论文必须有 `source/url/externalId`；
- KG3 功能必须服务“通过论文深度学习 AI 知识”；
- 保持原有学习闭环：AI 讲解 → 用户尝试 → AI 反馈 → 再强化/迁移。
