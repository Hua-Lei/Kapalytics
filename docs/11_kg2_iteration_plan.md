# KG 2.0 迭代计划

## 1. 总体原则

KG 2.0 不应一次性实现所有功能。建议以可演示、可验证、可回退的小版本推进。

核心路线：

```text
v1.1 结构化节点详情
→ v1.2 central insight 与论文论证图
→ v1.3 方法机制图与公式拆解器
→ v1.4 节点级领域扩展
→ v1.5 相关论文对比阅读
→ v1.6 轻量多论文融合图谱
```

每个版本必须保持原有学习闭环可用。

## 2. v1.1：节点详情页结构化

### 目标

把节点详情从单段 description 升级为类型化详情。

### 范围

- field 节点：领域定义、核心问题、当前论文关系；
- concept 节点：概念解释、论文用法、混淆概念；
- method 节点：输入、核心模块、输出、相对已有方法改进；
- formula 节点：KaTeX 公式、符号解释、方法位置；
- experiment 节点：claim-evidence 表；
- limitation 节点：失败条件。

### 实现建议

1. 扩展 GraphNode 可选字段；
2. 更新 LLM prompt；
3. 更新 `NodeDetailPanel`；
4. 保留旧字段兼容：如果新字段缺失，继续展示 description。

### 完成标准

- 点击不同类型节点，右侧展示不同结构；
- formula 节点公式可用 KaTeX 渲染；
- experiment 节点能展示 claim-evidence；
- 不破坏现有图谱和学习路径。

### 测试方式

- 用包含公式和实验的 PDF 测试；
- 用无公式 PDF 测试 fallback；
- 运行 `npm run typecheck`。

## 3. v1.2：central insight 与论文论证图

### 目标

让系统明确展示论文的核心洞察和论证链。

### 范围

- 新增 `PaperInsight`；
- prompt 输出 centralInsight / priorLimitation / methodMechanism / evidenceChain / remainingGap；
- 中间图谱新增“论文论证图”视图；
- 右侧分析面板展示 insight summary。

### 完成标准

- 分析结果包含 PaperInsight；
- 用户能看到“已有方法不足 → 本文 insight → 方法机制 → 实验证据 → 局限”；
- evidenceChain 能对应已有节点。

### 测试方式

- 检查 LLM JSON 是否包含 insight；
- 检查 evidenceChain 是否引用真实节点；
- 用至少两篇不同领域论文测试泛化。

## 4. v1.3：方法机制图与公式拆解器

### 目标

让用户能看懂方法如何工作，以及公式在方法中的位置。

### 范围

- 新增“方法机制图”视图；
- method 节点输出 methodFlow；
- formula 节点输出符号表和训练目标解释；
- 公式候选模块继续作为 LLM 上下文，不作为最终公式真值。

### 完成标准

- 方法机制图展示输入、核心模块、训练目标、输出；
- formula 节点详情包含符号逐项解释；
- 公式显示失败时有可读 fallback。

### 测试方式

- 用含复杂公式 PDF 测试；
- 用公式提取不完整 PDF 测试；
- 检查 KaTeX 渲染错误不会导致页面崩溃。

## 5. v1.4：节点级领域扩展

### 目标

支持用户从 field / concept / method 节点进入领域学习。

### 范围

- GraphNode 增加 expandable / expansionType / searchQueries；
- 右侧 Node Inspector 增加“展开该方向”；
- 实现 mock paper library；
- 生成领域概览卡和方法分类。

### 完成标准

- 至少 3 类节点可扩展；
- 展开后能展示领域概览；
- 相关论文来自 mock library；
- UI 明确显示当前使用内置候选论文库。

### 测试方式

- 测试 searchQueries 匹配；
- 测试无匹配结果空状态；
- 验证 LLM 不会编造论文。

## 6. v1.5：相关论文对比阅读

### 目标

把 Node Expansion 和学习闭环连接起来。

### 范围

- 当前论文 vs 代表论文对比表；
- 根据对比生成迁移任务；
- 用户作答；
- AI 对迁移能力进行诊断反馈。

### 完成标准

- 对比表包含研究问题、方法类别、训练/适配阶段、优势、局限等维度；
- 能生成迁移任务；
- 迁移任务能提交并获得诊断；
- 诊断结果能指出用户对方法迁移理解是否充分。

### 测试方式

- 用 mock related paper 测试对比；
- 提交正确/错误迁移回答；
- 检查诊断反馈是否具体。

## 7. v1.6：轻量多论文融合图谱

### 目标

支持多个论文产生的节点进行轻量融合，为后续领域知识库打基础。

### 范围

- 节点去重；
- 关系合并；
- 来源标记；
- 综合解释；
- 不做复杂知识库和大规模检索。

### 数据结构

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

### 完成标准

- 能合并多个同名/近似节点；
- 能展示节点来源；
- 能生成综合解释；
- 不影响单篇论文学习流程。

### 测试方式

- 使用 2-3 篇 mock paper graph；
- 检查节点合并结果；
- 检查来源展示。

## 8. 总体验收

KG 2.0 全部阶段完成后，应满足：

- 用户能理解论文核心 insight；
- 用户能看懂论文论证链和方法机制；
- 用户能从节点扩展到领域学习；
- 用户能对当前论文与代表论文做迁移比较；
- 系统仍然保持“讲解 → 尝试 → 反馈 → 强化/迁移”的学习闭环；
- 相关论文来源可信，不由 LLM 编造；
- 代码结构可扩展，后续能接真实论文检索 API。
