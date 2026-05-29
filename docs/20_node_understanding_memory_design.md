# Node Understanding Memory 设计文档

## 1. 目标

Node Understanding Memory 用于保存用户在 KG4 Node Expansion 中形成的节点理解、算法思想比较和 AI 反馈。

它不是普通笔记，也不是诊断记录。它的目标是把用户对某个节点、方法路线、算法思想差异的理解沉淀为长期学习资产，并在之后遇到相似节点时复用。

典型提示：

```text
你之前在 Paper X 中比较过 online learning 与 replay-based adaptation。
是否复用这段理解来帮助阅读当前论文？
```

## 2. 现有结构接入点

| 能力 | 现有位置 | 接入方式 |
|---|---|---|
| 长期记忆 repository | `src/main/memory/kg3Repository.ts` | 新增保存/查询 Node Understanding Memory 的方法 |
| SQLite JSON 表 | `SqlitePaperMemoryRepository.initialize()` | 新增 `node_understanding_memories` 表，或 MVP 放入 JSON blob |
| KG3 snapshot | `Kg3MemorySnapshot` in `src/shared/kg3.ts` | 后续可新增 `nodeUnderstandingMemories` 字段 |
| 用户掌握度 | `UserMasteryRecord` | 可由 memory 的 strengths / gaps 更新，但 MVP 不强制 |
| 图谱融合 | `graphFusion.ts` | memory 可作为融合建议证据，但不能直接触发自动融合 |
| UI | `NodeDetailPanel.tsx` | 展示历史理解提示和保存确认 |

当前 repository 没有 `saveNodeUnderstandingMemory` 或相似查询接口，因此实现时必须新增，不能假设已有 API。

## 3. 数据结构

### 3.1 NodeUnderstandingMemory

```ts
export interface NodeUnderstandingMemory {
  id: string
  userId?: string
  nodeId: string
  nodeLabel: string
  nodeType: string
  normalizedNodeLabel: string
  sourcePaperId: string
  relatedPaperIds: string[]
  ideaCardIds: string[]
  methodFamilyTags: string[]
  topicTags: string[]

  userReflection: string
  aiFeedbackType: 'reflective' | 'remedial'
  aiFeedbackSummary: string

  strengths: string[]
  missingDimensions: string[]
  prerequisiteGaps: string[]

  generatedUnderstandingNote: string
  userEditedUnderstandingNote?: string

  feedbackJobId?: string
  comparisonWorkspaceId?: string

  createdAt: string
  updatedAt: string
}
```

### 3.2 Memory Query

```ts
export interface NodeUnderstandingMemoryQuery {
  nodeLabel?: string
  normalizedNodeLabel?: string
  nodeType?: string
  topicTags?: string[]
  methodFamilyTags?: string[]
  sourcePaperId?: string
  relatedPaperIds?: string[]
  limit?: number
}
```

### 3.3 Memory Reuse Suggestion

```ts
export interface MemoryReuseSuggestion {
  id: string
  memoryId: string
  currentNodeId: string
  currentPaperId: string
  matchReason: string
  matchedSignals: Array<'normalized_label' | 'topic_tag' | 'method_family' | 'related_paper' | 'node_type'>
  confidence: number
  suggestedReuseText: string
}
```

## 4. 存储设计

### 4.1 SQLite 表

建议新增表：

```text
node_understanding_memories
```

字段：

```text
id TEXT PRIMARY KEY
node_id TEXT NOT NULL
source_paper_id TEXT NOT NULL
normalized_node_label TEXT NOT NULL
node_type TEXT NOT NULL
json TEXT NOT NULL
created_at TEXT
updated_at TEXT
```

索引：

```text
idx_node_memory_label(normalized_node_label)
idx_node_memory_type(node_type)
idx_node_memory_source_paper(source_paper_id)
idx_node_memory_updated(updated_at)
```

因为 `topicTags` 和 `methodFamilyTags` 初期可在 JSON 中查询，MVP 不强制拆 tag 表。后续如果查询变慢，再新增 `node_understanding_memory_tags`。

### 4.2 Repository 接口

在 `PaperMemoryRepository` 中新增：

```ts
saveNodeUnderstandingMemory(record: NodeUnderstandingMemory): Promise<void>
listNodeUnderstandingMemories(query?: NodeUnderstandingMemoryQuery): Promise<NodeUnderstandingMemory[]>
findReusableNodeMemories(params: {
  node: GraphNodeRecord
  topicTags: string[]
  methodFamilyTags: string[]
  limit?: number
}): Promise<MemoryReuseSuggestion[]>
```

如果短期不想扩展 interface，可先新增 `kg4Repository.ts` 包装 `paperMemoryRepository.getSnapshot()`，但长期建议统一 repository。

## 5. 流程

### 5.1 保存流程

```text
用户完成算法思想对比
→ 用户写下理解
→ AI 生成 feedback
→ UI 展示 suggestedUnderstandingNote
→ 用户确认或编辑
→ saveNodeUnderstandingMemory
```

保存时必须绑定：

```text
nodeId
nodeLabel
nodeType
sourcePaperId
relatedPaperIds
ideaCardIds
feedback type
feedback summary
generated note
```

### 5.2 查询流程

用户点击新节点时：

```text
current node label / normalized label / node type
→ topicTags / methodFamilyTags from expansion or graph node searchQueries
→ query memory
→ score candidates
→ show reuse suggestion
```

### 5.3 复用流程

用户接受复用后，系统可：

1. 在 Workbench 顶部展示历史理解。
2. 将历史 note 注入 reflective feedback 的上下文。
3. 在 comparison prompt 中提醒“用户过去已有类似理解”。
4. 不自动覆盖当前理解，仍要求用户确认。

## 6. UI 影响

### 6.1 保存 UI

在 KG4 feedback 后展示：

```text
建议保存的理解笔记
[可编辑文本框]
[保存为长期理解]
```

保存成功后显示：

```text
已保存到 Node Understanding Memory。
后续遇到相似节点时会提示复用。
```

### 6.2 历史提示 UI

在用户点击相似节点时展示非阻塞提示：

```text
你之前在 Paper X 中保存过关于 Test-Time Adaptation 的理解。
匹配原因：method family 相同、节点类型相同。
[查看] [用于本次对比] [忽略]
```

### 6.3 Memory Detail

详情展示：

```text
来源论文
相关论文
用户原始理解
AI 反馈摘要
保存的理解笔记
strengths / gaps
```

## 7. Prompt 约束

### 7.1 保存摘要

```text
请基于 userReflection 和 aiFeedback 生成一段可复用理解笔记。
不得引入输入之外的论文或实验。
笔记应保留用户观点，但修正明显概念混淆。
如果用户理解仍不充分，请在 note 中保留“不确定/待验证”的边界。
```

### 7.2 复用建议

```text
你只能基于已有 NodeUnderstandingMemory 和 currentNode 判断是否建议复用。
不得假设两者一定相同。
必须说明匹配原因，例如 normalized label、method family、topic tag 或 related paper 重叠。
如果只是弱相似，请降低 confidence。
```

MVP 可先用规则匹配生成建议，不必调用 LLM。

## 8. 验收标准

1. 用户理解和 AI 反馈可以保存为 Node Understanding Memory。
2. 每条 memory 可追溯 node、source paper、related papers 和 idea cards。
3. memory 保存前需要用户确认。
4. 可以按 `normalizedNodeLabel` 查询历史理解。
5. 可以按 `topicTags` 或 `methodFamilyTags` 做弱匹配。
6. 复用建议必须展示 matchReason 和 confidence。
7. 被复用的 memory 不自动覆盖当前回答。
8. Remedial feedback 的 prerequisite gaps 能被保存。
9. Reflective feedback 的 strengths / missingDimensions 能被保存。

## 9. 风险与 fallback

| 风险 | fallback |
|---|---|
| 用户保存错误理解 | 保存 AI feedback summary 和 gaps，复用时提示边界 |
| 相似节点误匹配 | 展示 confidence 和 match reason，由用户确认 |
| memory 查询性能差 | 初期 JSON 查询；后续拆 tag 表和索引 |
| 数据结构频繁变化 | 先 JSON blob，稳定后 schema migration |
| 多用户尚未实现 | `userId` 可选，默认单机单用户 |
| 与 DiagnosisRecord 混淆 | Memory 不保存 isCorrect，保存研究理解和反馈摘要 |
