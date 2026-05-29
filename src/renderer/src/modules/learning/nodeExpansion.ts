import type {
  AdaptationStage,
  ComparisonWorkspace,
  DirectionMap,
  FieldOverviewCard,
  GraphNode,
  LineageRole,
  MethodLineage,
  MethodLineageStep,
  NodeExpansionResult,
  PaperInsight,
  RelatedPaperV2,
  SharpComparisonRow,
  TransferTask
} from '../../../../shared/paper'

const ADAPTATION_STAGE_LABEL: Record<AdaptationStage, string> = {
  training_time: '训练时适配',
  test_time: '测试时适配',
  continual_test_time: '持续测试时适配',
  inference_time: '推理时条件化'
}

const LINEAGE_LABEL: Record<LineageRole, string> = {
  predecessor: 'predecessor',
  foundation: 'foundation',
  variant: 'variant',
  current_paper: 'current paper',
  possible_successor: 'possible successor'
}

export const mockRelatedPapers: RelatedPaperV2[] = [
  {
    id: 'mock-adapter-2019',
    title: 'Parameter-Efficient Transfer Learning for NLP',
    authors: ['Houlsby et al.'],
    year: 2019,
    venue: 'ICML',
    topicTags: ['adapter', 'parameter efficient fine tuning', 'peft', 'transfer learning'],
    methodFamily: 'Adapter Tuning',
    branchId: 'adapter-tuning',
    branchLabel: 'Adapter Tuning',
    lineageRole: 'predecessor',
    summary: '在冻结预训练模型主体的基础上插入小型 adapter 模块，只训练少量新增参数完成迁移。',
    relationToCurrentNode: '它提供“冻结主模型、只训练小模块”的参数高效适配动机，是理解 LoRA 或生成式 adapter 的前置路线。',
    relationToCurrentPaper: '当前论文继承参数高效适配的成本目标，但进一步尝试减少每个任务或上下文单独训练 adapter 的过程。',
    whyCompare: '它能帮助判断当前论文解决的是“参数量”问题，还是进一步解决“每次适配仍需训练”的问题。',
    solves: '冻结大模型主体，只训练轻量 adapter 模块，降低全量微调成本。',
    remainingGap: '每个任务仍需单独训练和保存 adapter，快速迁移能力有限。',
    updatedObject: 'Adapter modules',
    adaptationStage: 'training_time',
    source: 'mock'
  },
  {
    id: 'mock-lora-2021',
    title: 'LoRA: Low-Rank Adaptation of Large Language Models',
    authors: ['Hu et al.'],
    year: 2021,
    venue: 'ICLR',
    topicTags: ['lora', 'parameter efficient fine tuning', 'adapter', 'peft', 'low rank'],
    methodFamily: 'Low-rank Adapter Tuning',
    branchId: 'low-rank-adapter-tuning',
    branchLabel: 'Low-rank Adapter Tuning',
    lineageRole: 'foundation',
    summary: '通过低秩矩阵更新冻结大模型中的部分权重，降低微调参数量。',
    relationToCurrentNode: 'LoRA 是当前节点生成或改造的参数对象；当前节点不是任意权重生成，而是围绕低秩适配矩阵工作。',
    relationToCurrentPaper: '当前论文利用 LoRA 的参数高效性质，进一步尝试减少每个任务或上下文单独训练 LoRA 的成本。',
    whyCompare: '它是判断当前论文是否真正降低任务级训练成本的基础参照。',
    influenceReason: '是理解参数高效适配路线的关键基线。',
    solves: '用低秩矩阵表达权重更新，大幅减少可训练参数量。',
    remainingGap: 'LoRA 仍通常需要针对每个任务训练并保存一组低秩矩阵。',
    updatedObject: 'LoRA A/B matrices',
    adaptationStage: 'training_time',
    source: 'mock'
  },
  {
    id: 'mock-prefix-2021',
    title: 'Prefix-Tuning: Optimizing Continuous Prompts for Generation',
    authors: ['Li and Liang'],
    year: 2021,
    venue: 'ACL',
    topicTags: ['prefix tuning', 'prompt tuning', 'parameter efficient fine tuning', 'peft'],
    methodFamily: 'Prompt-based Adaptation',
    branchId: 'prompt-based-adaptation',
    branchLabel: 'Prompt / Prefix Tuning',
    lineageRole: 'predecessor',
    summary: '冻结语言模型，只优化连续前缀向量以控制生成行为。',
    relationToCurrentNode: '它代表不改模型权重主体、通过输入侧或隐式提示适配行为的平行 PEFT 分支。',
    relationToCurrentPaper: '可与当前论文比较：一个优化连续提示，一个生成或改造 adapter 参数。',
    whyCompare: '它帮助用户区分“提示空间适配”和“参数空间适配”的能力边界。',
    solves: '用连续 prompt 控制生成，避免全量微调。',
    remainingGap: '表达能力和可解释性依赖 prompt 表示，且任务级 prompt 仍需要优化。',
    updatedObject: 'Continuous prompt / prefix vectors',
    adaptationStage: 'training_time',
    source: 'mock'
  },
  {
    id: 'mock-hypernetwork-2017',
    title: 'HyperNetworks',
    authors: ['Ha et al.'],
    year: 2017,
    venue: 'ICLR',
    topicTags: ['hypernetwork', 'weight generation', 'conditional parameter generation', 'adapter generation'],
    methodFamily: 'Hypernetwork-generated Adapter',
    branchId: 'conditional-adapter-generation',
    branchLabel: 'Conditional Adapter Generation',
    lineageRole: 'variant',
    summary: '用一个网络生成另一个网络的权重，支持条件化参数生成。',
    relationToCurrentNode: '它是当前节点“根据文本、任务或上下文生成适配参数”的机制来源。',
    relationToCurrentPaper: '当前论文把条件参数生成约束到 LoRA 或 adapter 形式，用于降低新任务适配成本。',
    whyCompare: '它能说明当前论文的关键风险从参数量转移到条件表示和生成器训练覆盖。',
    solves: '让权重由条件网络生成，支持按输入或任务动态产生参数。',
    remainingGap: '生成质量依赖条件表示、训练分布和目标网络参数化形式。',
    updatedObject: 'Generated weights / adapter parameters',
    adaptationStage: 'inference_time',
    source: 'mock'
  },
  {
    id: 'mock-tta-2021',
    title: 'Tent: Fully Test-Time Adaptation by Entropy Minimization',
    authors: ['Wang et al.'],
    year: 2021,
    venue: 'ICLR',
    topicTags: ['test time adaptation', 'test-time training', 'entropy minimization', 'domain shift'],
    methodFamily: 'Entropy-minimization Test-Time Adaptation',
    branchId: 'test-time-adaptation',
    branchLabel: 'Test-Time Adaptation',
    lineageRole: 'possible_successor',
    summary: '在测试阶段通过熵最小化更新归一化参数，以适应分布变化。',
    relationToCurrentNode: '它不是 LoRA 生成路线的直接祖先，但可作为“把快速适配放到测试/推理阶段”的迁移比较对象。',
    relationToCurrentPaper: '可用于比较训练时生成 adapter 与测试时在线更新参数的阶段差异。',
    whyCompare: '它能迫使用户判断：当前论文的快速生成是否能替代或结合测试时自适应。',
    solves: '在没有训练标签的测试阶段适应分布偏移。',
    remainingGap: '在线更新可能不稳定，且适应目标可能和真实任务指标不一致。',
    updatedObject: 'BatchNorm affine/statistics parameters',
    adaptationStage: 'test_time',
    source: 'mock'
  },
  {
    id: 'mock-continual-2017',
    title: 'Overcoming Catastrophic Forgetting in Neural Networks',
    authors: ['Kirkpatrick et al.'],
    year: 2017,
    venue: 'PNAS',
    topicTags: ['continual learning', 'catastrophic forgetting', 'regularization'],
    methodFamily: 'Regularization-based Continual Learning',
    branchId: 'regularization-continual-learning',
    branchLabel: 'Regularization-based Continual Learning',
    lineageRole: 'predecessor',
    summary: '通过估计参数重要性约束新任务更新，缓解灾难性遗忘。',
    relationToCurrentNode: '当当前节点涉及持续学习或多任务迁移时，它提供稳定性-可塑性权衡的基础参照。',
    relationToCurrentPaper: '它不是 PEFT 的直接基础，但可比较“保存旧能力”和“快速适配新上下文”的目标差异。',
    whyCompare: '它帮助避免把参数高效适配误判为持续学习，并明确二者目标不同。',
    solves: '用正则约束保护旧任务重要参数，缓解灾难性遗忘。',
    remainingGap: '面对长任务序列时容量和任务边界仍是瓶颈。',
    updatedObject: 'Full model parameters with regularization',
    adaptationStage: 'training_time',
    source: 'mock'
  }
]

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/).filter((part) => part.length > 1)
}

function matchRelatedPapers(node: GraphNode): RelatedPaperV2[] {
  const queries = [...(node.searchQueries ?? []), node.label, node.description, node.roleInPaper ?? '']
  const queryTokens = new Set(queries.flatMap(tokenize))

  return mockRelatedPapers
    .map((paper) => {
      const indexedText = [paper.title, paper.methodFamily, paper.branchLabel, paper.summary, ...paper.topicTags].join(' ')
      const indexedTokens = tokenize(indexedText)
      const score = indexedTokens.filter((token) => queryTokens.has(token)).length
      return { paper, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.paper)
}

function inferCurrentBranchId(node: GraphNode, papers: RelatedPaperV2[]): string | null {
  const nodeText = `${node.label} ${node.description} ${(node.searchQueries ?? []).join(' ')}`.toLowerCase()
  if (/hypernetwork|超网络|generate|生成|conditional/.test(nodeText)) return 'conditional-adapter-generation'
  if (/lora|low.?rank|低秩/.test(nodeText)) return 'low-rank-adapter-tuning'
  if (/prompt|prefix|提示/.test(nodeText)) return 'prompt-based-adaptation'
  if (/test.?time|测试时|entropy|熵/.test(nodeText)) return 'test-time-adaptation'
  return papers[0]?.branchId ?? null
}

function buildOverview(node: GraphNode, insight: PaperInsight | null, relatedPapers: RelatedPaperV2[]): FieldOverviewCard {
  const methodFamilies = [...new Set(relatedPapers.map((paper) => paper.methodFamily).filter(Boolean))]
  return {
    title: `${node.label} 领域地图`,
    definition: node.detail?.summary ?? node.insight ?? node.description,
    coreProblems: [
      node.whyImportant ?? '理解该方向要先判断它解决的核心建模瓶颈。',
      insight?.priorLimitation
    ].filter((item): item is string => Boolean(item)),
    methodFamilies,
    relationToCurrentPaper: node.roleInPaper ?? insight?.methodMechanism ?? '该节点是当前论文论证链中的关键学习入口。',
    keyTerms: node.searchQueries?.length ? node.searchQueries : [node.label]
  }
}

function buildDirectionMap(node: GraphNode, insight: PaperInsight | null, relatedPapers: RelatedPaperV2[]): DirectionMap {
  if (!relatedPapers.length) {
    return {
      nodeId: node.id,
      fieldTitle: node.label,
      fieldDefinition: node.description,
      coreProblems: [],
      methodBranches: [],
      currentPaperPosition: null,
      source: 'mock',
      insufficientDataReason: '当前内置候选论文库暂无与该节点匹配的论文。可以扩充 mock library 或接入真实论文检索 API 后再生成领域地图。'
    }
  }

  if (relatedPapers.some((paper) => !paper.methodFamily || !paper.branchLabel)) {
    return {
      nodeId: node.id,
      fieldTitle: node.label,
      fieldDefinition: node.description,
      coreProblems: [],
      methodBranches: [],
      currentPaperPosition: null,
      source: 'mock',
      insufficientDataReason: '已有相关论文，但缺少 methodFamily / branchLabel，暂不能构造可靠的方法分支。'
    }
  }

  const currentBranchId = inferCurrentBranchId(node, relatedPapers)
  const coreProblems = [
    {
      id: 'p1',
      label: insight?.priorLimitation || node.whyImportant || '如何降低新任务或新上下文的适配成本',
      whyItMatters: '该问题决定当前论文是在减少参数量、减少训练次数，还是改变适配发生的阶段。'
    },
    {
      id: 'p2',
      label: '如何保持适配能力和泛化稳定性',
      whyItMatters: '快速生成或快速更新如果泛化不稳，成本优势会转化为可靠性风险。'
    }
  ]

  const branchMap = new Map<string, RelatedPaperV2[]>()
  for (const paper of relatedPapers) {
    const key = paper.branchId ?? paper.branchLabel
    branchMap.set(key, [...(branchMap.get(key) ?? []), paper])
  }

  const methodBranches = [...branchMap.entries()].map(([branchId, papers]) => ({
    id: branchId,
    label: papers[0].branchLabel,
    solvesProblemIds: ['p1', 'p2'],
    description: papers[0].methodFamily,
    representativePaperIds: papers.map((paper) => paper.id),
    currentPaperBelongsHere: branchId === currentBranchId,
    currentPaperRelation: branchId === currentBranchId
      ? node.roleInPaper ?? insight?.methodMechanism ?? '当前论文在该分支中提供具体方法机制。'
      : undefined
  }))

  const currentBranch = methodBranches.find((branch) => branch.currentPaperBelongsHere)
  return {
    nodeId: node.id,
    fieldTitle: relatedPapers[0].methodFamily.includes('Continual')
      ? 'Continual / Test-Time Adaptation'
      : 'Parameter-Efficient Adaptation',
    fieldDefinition: node.detail?.summary ?? node.description,
    coreProblems,
    methodBranches,
    currentPaperPosition: currentBranch ? {
      branchId: currentBranch.id,
      positionLabel: node.label,
      reason: node.insight ?? node.roleInPaper ?? '当前节点是论文在该方向中的技术锚点。',
      inheritedFrom: relatedPapers.filter((paper) => paper.lineageRole !== 'possible_successor').slice(0, 3).map((paper) => paper.id),
      improvesOn: relatedPapers.filter((paper) => paper.lineageRole === 'foundation' || paper.lineageRole === 'predecessor').map((paper) => paper.id),
      remainingGap: insight?.remainingGap || '仍需判断该机制在分布外任务、长上下文或真实低资源场景中的稳定性。'
    } : null,
    source: 'mock'
  }
}

function buildMissingLineageStep(role: Exclude<LineageRole, 'current_paper'>): MethodLineageStep {
  return {
    id: `missing-${role}`,
    role,
    label: `${LINEAGE_LABEL[role]} 数据不足`,
    solves: '当前 mock library 缺少该谱系位置的可信候选。',
    remainingGap: '请扩充 mock library 或接入真实检索结果。',
    relationToCurrentPaper: '缺口状态，不补虚构论文。',
    representativePaperIds: [],
    isCurrentPaper: false,
    missing: true
  }
}

function buildMethodLineage(node: GraphNode, insight: PaperInsight | null, relatedPapers: RelatedPaperV2[]): MethodLineage {
  const roles: Exclude<LineageRole, 'current_paper'>[] = ['predecessor', 'foundation', 'variant', 'possible_successor']
  const steps: MethodLineageStep[] = []

  for (const role of roles.slice(0, 3)) {
    const paper = relatedPapers.find((candidate) => candidate.lineageRole === role)
    steps.push(paper ? {
      id: paper.id,
      role,
      label: paper.branchLabel,
      solves: paper.solves,
      remainingGap: paper.remainingGap,
      relationToCurrentPaper: paper.relationToCurrentPaper,
      representativePaperIds: [paper.id],
      isCurrentPaper: false
    } : buildMissingLineageStep(role))
  }

  steps.push({
    id: `current-${node.id}`,
    role: 'current_paper',
    label: node.label,
    solves: node.insight ?? insight?.centralInsight ?? node.description,
    remainingGap: insight?.remainingGap || '需要通过迁移比较继续判断泛化边界。',
    relationToCurrentPaper: '当前论文自身，是谱系中的视觉锚点。',
    representativePaperIds: [],
    isCurrentPaper: true
  })

  const successor = relatedPapers.find((candidate) => candidate.lineageRole === 'possible_successor')
  steps.push(successor ? {
    id: successor.id,
    role: 'possible_successor',
    label: successor.branchLabel,
    solves: `可能方向：${successor.solves}`,
    remainingGap: successor.remainingGap,
    relationToCurrentPaper: successor.relationToCurrentPaper,
    representativePaperIds: [successor.id],
    isCurrentPaper: false
  } : buildMissingLineageStep('possible_successor'))

  return { nodeId: node.id, title: `${node.label} 方法演进谱系`, steps }
}

function stageLabel(stage: AdaptationStage | undefined): string {
  return stage ? ADAPTATION_STAGE_LABEL[stage] : '需阅读原文确认'
}

function buildSharpComparisonRows(node: GraphNode, paper: RelatedPaperV2, insight: PaperInsight | null): SharpComparisonRow[] {
  const currentMechanism = node.detail?.summary ?? node.insight ?? insight?.methodMechanism ?? node.description
  const currentGap = insight?.remainingGap || '需结合论文局限节点判断。'
  return [
    {
      dimension: 'research_problem',
      label: '研究问题',
      currentPaper: insight?.priorLimitation || node.description,
      relatedPaper: paper.solves,
      sharpInsight: '先判断两者是否在同一层解决问题：当前论文通常不是重新定义 PEFT，而是进一步压缩适配发生的成本或时间。'
    },
    {
      dimension: 'method_mechanism',
      label: '方法机制',
      currentPaper: currentMechanism,
      relatedPaper: paper.summary,
      sharpInsight: `当前节点与 ${paper.methodFamily} 的关系不是简单替代，而是继承或重组其中的机制假设。`
    },
    {
      dimension: 'adaptation_stage',
      label: '训练/适配阶段',
      currentPaper: node.type === 'method' ? '推理前生成或训练时学习生成器' : node.roleInPaper ?? '需结合论文流程判断',
      relatedPaper: stageLabel(paper.adaptationStage),
      sharpInsight: '适配阶段决定成本边界：训练时方法成本前置，推理时方法把风险转移到条件表示或在线稳定性。'
    },
    {
      dimension: 'updated_object',
      label: '更新对象',
      currentPaper: /lora|低秩/i.test(`${node.label} ${node.description}`) ? 'LoRA / adapter 参数或其生成器' : '当前节点涉及的参数或表示',
      relatedPaper: paper.updatedObject ?? '需阅读原文确认',
      sharpInsight: '更新对象越小不必然越强，真正差异在成本、表达能力和可泛化条件之间的取舍。'
    },
    {
      dimension: 'inheritance',
      label: '继承点',
      currentPaper: paper.relationToCurrentNode,
      relatedPaper: paper.relationToCurrentPaper,
      sharpInsight: '继承点应落到机制或参数对象上，而不是泛泛说“使用了相关方法”。'
    },
    {
      dimension: 'improvement',
      label: '改进点',
      currentPaper: node.contrastWithPrior ?? node.insight ?? '当前论文试图降低适配成本或提高迁移效率。',
      relatedPaper: paper.remainingGap,
      sharpInsight: '改进是否成立，取决于它是否直接击中了代表论文留下的真实瓶颈。'
    },
    {
      dimension: 'difference',
      label: '差异',
      currentPaper: currentMechanism,
      relatedPaper: paper.methodFamily,
      sharpInsight: `关键差异是当前论文把 ${paper.branchLabel} 的哪一部分固定、生成或迁移，而不是只比较指标高低。`
    },
    {
      dimension: 'limitation',
      label: '局限',
      currentPaper: currentGap,
      relatedPaper: paper.remainingGap,
      sharpInsight: '很多“改进”只是把局限从参数量转移到条件质量、检索质量或训练覆盖范围。'
    },
    {
      dimension: 'combination',
      label: '可结合点',
      currentPaper: `用“${node.label}”处理代表论文关注场景中的适配成本或迁移问题。`,
      relatedPaper: paper.whyCompare,
      sharpInsight: '可结合点必须能被实验验证，例如比较输入表示、更新对象或适配阶段，而不是停留在概念拼接。'
    }
  ]
}

function buildTransferTask(node: GraphNode, paper: RelatedPaperV2 | undefined): TransferTask | undefined {
  if (!paper) return undefined
  return {
    id: `transfer_${node.id}_${paper.id}`,
    prompt: `请比较当前论文中的“${node.label}”与“${paper.title}”。如果把当前论文的方法迁移到代表论文关注的场景，最需要改变的是输入表示、优化目标、更新对象，还是数据假设？请说明继承点、改进点和一个可能失败条件。`,
    expectedReasoningPoints: [
      `说明当前节点“${node.label}”在原论文中的作用`,
      `指出代表论文“${paper.title}”解决的问题和方法类别`,
      '比较输入表示、优化目标、适配阶段或更新对象',
      '明确继承点、改进点和关键差异',
      '给出一个可能失败条件或验证实验'
    ],
    relatedPaperIds: [paper.id],
    targetAbility: 'transfer_comparison'
  }
}

function buildComparisonWorkspace(node: GraphNode, relatedPapers: RelatedPaperV2[], insight: PaperInsight | null): ComparisonWorkspace {
  if (!relatedPapers.length) {
    return {
      nodeId: node.id,
      selectedRelatedPaperId: null,
      candidates: [],
      comparisonRows: [],
      insufficientDataReason: '当前内置候选论文库暂无与该节点匹配的论文。'
    }
  }

  const candidates = relatedPapers.filter((paper) => paper.relationToCurrentNode)
  if (!candidates.length) {
    return {
      nodeId: node.id,
      selectedRelatedPaperId: null,
      candidates: [],
      comparisonRows: [],
      insufficientDataReason: '候选论文缺少与当前节点的关系说明，暂不进入对比工作台。'
    }
  }

  const selectedPaper = candidates[0]
  return {
    nodeId: node.id,
    selectedRelatedPaperId: selectedPaper.id,
    candidates,
    comparisonRows: buildSharpComparisonRows(node, selectedPaper, insight),
    transferTask: buildTransferTask(node, selectedPaper)
  }
}

export function buildComparisonWorkspaceForPaper(
  node: GraphNode,
  insight: PaperInsight | null,
  relatedPaperId: string
): ComparisonWorkspace {
  const candidates = matchRelatedPapers(node).filter((paper) => paper.relationToCurrentNode)
  const selectedPaper = candidates.find((paper) => paper.id === relatedPaperId) ?? candidates[0]
  if (!selectedPaper) return buildComparisonWorkspace(node, candidates, insight)
  return {
    nodeId: node.id,
    selectedRelatedPaperId: selectedPaper.id,
    candidates,
    comparisonRows: buildSharpComparisonRows(node, selectedPaper, insight),
    transferTask: buildTransferTask(node, selectedPaper)
  }
}

export function expandNode(node: GraphNode, insight: PaperInsight | null): NodeExpansionResult {
  const relatedPapers = matchRelatedPapers(node)
  const comparisonWorkspace = buildComparisonWorkspace(node, relatedPapers, insight)
  return {
    nodeId: node.id,
    overview: buildOverview(node, insight, relatedPapers),
    relatedPapers,
    directionMap: buildDirectionMap(node, insight, relatedPapers),
    methodLineage: buildMethodLineage(node, insight, relatedPapers),
    comparisonWorkspace,
    transferTask: comparisonWorkspace.transferTask
  }
}
