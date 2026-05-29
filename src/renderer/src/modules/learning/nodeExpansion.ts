import type {
  FieldOverviewCard,
  GraphNode,
  MethodEvolutionStep,
  NodeExpansionResult,
  PaperComparisonRow,
  PaperInsight,
  RelatedPaper,
  TransferTask
} from '../../../../shared/paper'

export const mockRelatedPapers: RelatedPaper[] = [
  {
    id: 'mock-lora-2021',
    title: 'LoRA: Low-Rank Adaptation of Large Language Models',
    authors: ['Hu et al.'],
    year: 2021,
    venue: 'ICLR',
    topicTags: ['lora', 'parameter efficient fine tuning', 'adapter', 'peft'],
    summary: '通过低秩矩阵更新冻结大模型中的部分权重，降低微调参数量。',
    relationToCurrentPaper: '提供任务级 LoRA 适配器的基础形式，当前论文通常在此基础上改进生成或迁移方式。',
    influenceReason: '是理解参数高效适配路线的关键基线。',
    source: 'mock'
  },
  {
    id: 'mock-prefix-2021',
    title: 'Prefix-Tuning: Optimizing Continuous Prompts for Generation',
    authors: ['Li and Liang'],
    year: 2021,
    venue: 'ACL',
    topicTags: ['prefix tuning', 'prompt tuning', 'parameter efficient fine tuning', 'peft'],
    summary: '冻结语言模型，只优化连续前缀向量以控制生成行为。',
    relationToCurrentPaper: '代表另一类参数高效适配方法，可与 LoRA 路线比较更新对象和表达能力。',
    source: 'mock'
  },
  {
    id: 'mock-hypernetwork-2017',
    title: 'HyperNetworks',
    authors: ['Ha et al.'],
    year: 2017,
    venue: 'ICLR',
    topicTags: ['hypernetwork', 'weight generation', 'conditional parameter generation'],
    summary: '用一个网络生成另一个网络的权重，支持条件化参数生成。',
    relationToCurrentPaper: '为根据任务、文本或上下文生成适配器参数提供机制来源。',
    source: 'mock'
  },
  {
    id: 'mock-tta-2020',
    title: 'Tent: Fully Test-Time Adaptation by Entropy Minimization',
    authors: ['Wang et al.'],
    year: 2021,
    venue: 'ICLR',
    topicTags: ['test time adaptation', 'test-time training', 'entropy minimization', 'domain shift'],
    summary: '在测试阶段通过熵最小化更新归一化参数，以适应分布变化。',
    relationToCurrentPaper: '可用于比较训练时适配、测试时适配和持续适配的差异。',
    source: 'mock'
  },
  {
    id: 'mock-continual-2017',
    title: 'Overcoming Catastrophic Forgetting in Neural Networks',
    authors: ['Kirkpatrick et al.'],
    year: 2017,
    venue: 'PNAS',
    topicTags: ['continual learning', 'catastrophic forgetting', 'regularization'],
    summary: '通过估计参数重要性约束新任务更新，缓解灾难性遗忘。',
    relationToCurrentPaper: '提供持续学习中稳定性-可塑性权衡的经典参照。',
    source: 'mock'
  }
]

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/).filter((part) => part.length > 1)
}

function matchRelatedPapers(node: GraphNode): RelatedPaper[] {
  const queries = [...(node.searchQueries ?? []), node.label, node.description]
  const queryTokens = new Set(queries.flatMap(tokenize))
  return mockRelatedPapers
    .map((paper) => ({
      paper,
      score: paper.topicTags.reduce((sum, tag) => {
        const tagTokens = tokenize(tag)
        return sum + tagTokens.filter((token) => queryTokens.has(token)).length
      }, 0)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.paper)
}

function buildOverview(node: GraphNode, insight: PaperInsight | null): FieldOverviewCard {
  return {
    title: `${node.label} 方向学习卡`,
    definition: node.detail?.summary ?? node.insight ?? node.description,
    coreProblems: [
      node.whyImportant ?? '理解该方向要先判断它解决的核心建模瓶颈。',
      insight?.priorLimitation ?? '比较当前论文和已有方法的约束条件。'
    ].filter(Boolean),
    methodFamilies: node.type === 'method'
      ? ['当前论文方法', '已有基线方法', '可迁移或可组合变体']
      : ['代表方法类别', '相关概念分支', '当前论文所属路线'],
    relationToCurrentPaper: node.roleInPaper ?? insight?.methodMechanism ?? '该节点是当前论文论证链中的关键学习入口。',
    keyTerms: node.searchQueries?.length ? node.searchQueries : [node.label]
  }
}

function buildMethodEvolution(node: GraphNode, relatedPapers: RelatedPaper[]): MethodEvolutionStep[] | undefined {
  if (node.type !== 'method') return undefined
  return [
    {
      id: 'baseline',
      label: '已有方法或基线',
      description: node.contrastWithPrior ?? '先理解当前论文相对已有方法改动了什么。',
      representativePaperIds: relatedPapers.slice(0, 1).map((paper) => paper.id),
      relation: 'predecessor'
    },
    {
      id: 'current',
      label: node.label,
      description: node.insight ?? node.description,
      representativePaperIds: [],
      relation: 'variant'
    },
    {
      id: 'transfer',
      label: '迁移或组合方向',
      description: '比较当前方法和代表论文，判断哪些输入、目标或更新对象可以迁移。',
      representativePaperIds: relatedPapers.slice(1, 3).map((paper) => paper.id),
      relation: 'successor'
    }
  ]
}

function buildComparisonRows(node: GraphNode, paper: RelatedPaper | undefined, insight: PaperInsight | null): PaperComparisonRow[] {
  if (!paper) return []
  return [
    { dimension: '研究问题', currentPaper: insight?.priorLimitation || node.description, relatedPaper: paper.summary },
    { dimension: '方法类别', currentPaper: node.type === 'method' ? node.label : '当前论文关键机制', relatedPaper: paper.topicTags.join(', ') },
    { dimension: '训练/适配阶段', currentPaper: node.detail?.roleInArgument ?? node.roleInPaper ?? '需结合论文方法流程判断', relatedPaper: paper.relationToCurrentPaper },
    { dimension: '优势', currentPaper: node.insight ?? insight?.centralInsight ?? '当前论文的核心洞察', relatedPaper: paper.influenceReason ?? paper.summary },
    { dimension: '局限', currentPaper: insight?.remainingGap || '需结合论文局限节点判断', relatedPaper: '需阅读原文确认具体失败条件' },
    { dimension: '可结合点', currentPaper: '用当前论文机制处理代表论文场景中的约束。', relatedPaper: '用代表论文作为迁移任务或对比基线。' }
  ]
}

function buildTransferTask(node: GraphNode, relatedPapers: RelatedPaper[]): TransferTask | undefined {
  if (!relatedPapers.length) return undefined
  return {
    id: `transfer_${node.id}`,
    prompt: `请比较当前论文中的“${node.label}”与代表论文“${relatedPapers[0].title}”：如果把当前方法迁移到代表论文关注的场景，最需要修改的是输入、优化目标，还是参数更新方式？为什么？`,
    expectedReasoningPoints: [
      '说明当前论文节点在原论文中的作用',
      '指出代表论文关注的问题或方法类别',
      '比较输入、训练目标、更新对象或适用条件',
      '给出可迁移点和风险'
    ],
    relatedPaperIds: relatedPapers.map((paper) => paper.id),
    targetAbility: 'transfer_comparison'
  }
}

export function expandNode(node: GraphNode, insight: PaperInsight | null): NodeExpansionResult {
  const relatedPapers = matchRelatedPapers(node)
  return {
    nodeId: node.id,
    overview: buildOverview(node, insight),
    relatedPapers,
    methodEvolution: buildMethodEvolution(node, relatedPapers),
    comparisonRows: buildComparisonRows(node, relatedPapers[0], insight),
    transferTask: buildTransferTask(node, relatedPapers)
  }
}
