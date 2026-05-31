import assert from 'node:assert/strict'
import type { DedupedPaperCandidate } from '../../shared/kg3'
import type { ExpansionIntent, ExpansionNodeClassification, MethodLineageView, PaperMethodDigest, PaperQualitySignal } from '../../shared/kg4'
import { buildExpansionRetrievalPlan, buildStrategyRetrievalPlan } from './expansionQuery'
import { assembleLineageExpansionRecord, toShortDisplayText } from './lineageRecord'

function candidate(id: string, title: string, abstract: string): DedupedPaperCandidate {
  return {
    canonicalId: id,
    mergedFrom: [],
    title,
    authors: [],
    sources: ['openalex'],
    externalIds: [],
    bestUrl: `https://example.test/${id}`,
    abstract,
    score: 1
  }
}

const longAbstract = 'This is a very long abstract. '.repeat(80)
const intent: ExpansionIntent = {
  kind: 'algorithm_method_lineage',
  confidence: 0.91,
  queryFocus: 'policy optimization methods for sparse reward reinforcement learning',
  rationale: 'The node describes a concrete algorithmic method.'
}

const digestA: PaperMethodDigest = {
  id: 'digest_a',
  paperId: 'paper-a',
  paperTitle: 'Foundation RL Method',
  methodName: 'Foundation RL',
  problemSetting: 'Sparse reward policy learning.',
  coreMechanism: 'Uses value-guided exploration to stabilize policy updates.',
  claimedImprovement: 'Improves sample efficiency.',
  limitation: 'Requires careful reward shaping.',
  relationHints: ['foundation'],
  evidenceSummary: 'This paper supplies a foundation method for the current node.',
  confidence: 0.84
}

const digestB: PaperMethodDigest = {
  id: 'digest_b',
  paperId: 'paper-b',
  paperTitle: 'Variant RL Method',
  methodName: 'Variant RL',
  problemSetting: 'Sparse reward policy learning.',
  coreMechanism: 'Adds curriculum-guided replay to the foundation method.',
  claimedImprovement: 'Handles harder exploration cases.',
  limitation: 'Adds replay memory overhead.',
  relationHints: ['extends', 'parallel_variant'],
  evidenceSummary: 'This paper provides a variant that extends the foundation method.',
  confidence: 0.79
}

const lineage: MethodLineageView = {
  id: 'lineage_n1',
  anchorNodeId: 'n1',
  title: 'Sparse Reward RL Method Lineage',
  summary: 'Methods evolve from value-guided exploration to curriculum replay variants.',
  nodes: [
    {
      id: 'lineage_foundation',
      label: 'Foundation RL',
      role: 'foundation_method',
      summary: 'A foundation method for stabilizing sparse reward policy learning.',
      representativePaperIds: ['paper-a'],
      digestIds: ['digest_a']
    },
    {
      id: 'lineage_variant',
      label: 'Curriculum Replay Variant',
      role: 'parallel_variant',
      summary: 'A variant that adds curriculum replay to improve exploration.',
      representativePaperIds: ['paper-b'],
      digestIds: ['digest_b']
    }
  ],
  edges: [
    {
      id: 'edge_1',
      sourceId: 'lineage_foundation',
      targetId: 'lineage_variant',
      relation: 'extends',
      explanation: 'The variant extends the foundation method with curriculum replay.',
      evidencePaperIds: ['paper-a', 'paper-b'],
      confidence: 0.76
    }
  ],
  openQuestions: ['Whether curriculum replay improves transfer remains unclear.'],
  readingOrder: ['paper-a', 'paper-b'],
  dataCompleteness: 'partial',
  missingDataReasons: []
}

const retrievalPlan = buildExpansionRetrievalPlan({
  intent,
  node: { id: 'n1', label: 'Sparse Reward RL', searchQueries: ['policy optimization'] },
  paperInsight: { problem: 'sparse reward reinforcement learning', method: 'deep reinforcement learning' }
})

assert.equal(retrievalPlan.retrievalGoal, 'same_problem_methods')
assert.equal(retrievalPlan.primaryQuery, 'policy optimization')
assert.ok(retrievalPlan.searchQueries.some((query) => /sparse reward/i.test(query)))

const conceptClassification: ExpansionNodeClassification = {
  primaryType: 'concept',
  facets: ['method_component', 'parameter_efficient_finetuning'],
  confidence: 0.9,
  rationale: 'LoRA is a reusable concept.',
  recommendedPath: 'learn_concept',
  alternativePaths: ['track_method_lineage', 'review_related_papers']
}

const conceptRetrievalPlan = buildStrategyRetrievalPlan({
  classification: conceptClassification,
  node: { id: 'n-lora', label: 'LoRA', searchQueries: ['low rank adaptation'] }
})

assert.equal(conceptRetrievalPlan.retrievalGoal, 'concept_learning_papers')
assert.match(conceptRetrievalPlan.primaryQuery, /LoRA|low rank adaptation/)
assert.ok(conceptRetrievalPlan.searchQueries.some((query) => /survey|tutorial|foundation/i.test(query)))

const noisyRetrievalPlan = buildExpansionRetrievalPlan({
  intent: {
    kind: 'algorithm_method_lineage',
    confidence: 0.95,
    queryFocus: 'Hypernetwork algorithm/method',
    rationale: 'Hypernetwork is a concrete algorithm/method.'
  },
  node: {
    id: 'n5',
    label: 'Hypernetwork',
    searchQueries: ['hypernetwork meta-learning', 'Ha et al. 2016 hypernetwork', 'weight generating networks']
  },
  paperInsight: {
    problem: '传统上下文蒸馏需要为每个提示单独进行昂贵的训练，导致高延迟和内存消耗，不适合频繁变化的上下文。',
    method: '使用 Perceiver 架构的超网络 H_phi 将上下文 token 激活映射为低秩 LoRA 矩阵；通过分块机制实现长上下文的高秩组合。'
  }
})

assert.match(noisyRetrievalPlan.primaryQuery, /hypernetwork meta-learning/i)
assert.doesNotMatch(noisyRetrievalPlan.primaryQuery, /传统上下文蒸馏/)
assert.doesNotMatch(noisyRetrievalPlan.primaryQuery, /Perceiver 架构的超网络/)
assert.equal(noisyRetrievalPlan.primaryQuery, 'hypernetwork meta-learning')
assert.ok(noisyRetrievalPlan.primaryQuery.length < 80)
assert.deepEqual(noisyRetrievalPlan.searchQueries, [
  'hypernetwork meta-learning',
  'Ha et al. 2016 hypernetwork',
  'weight generating networks',
  'Hypernetwork algorithm/method',
  'Hypernetwork'
])

const short = toShortDisplayText(longAbstract, 120)
assert.ok(short.length <= 121)
assert.ok(short.endsWith('…'))

const record = assembleLineageExpansionRecord({
  paperId: 'paper-main',
  nodeId: 'n1',
  jobIds: ['job-lineage'],
  intent,
  retrievedPapers: [candidate('paper-a', 'Foundation RL Method', longAbstract), candidate('paper-b', 'Variant RL Method', longAbstract)],
  paperMethodDigests: [digestA, digestB],
  methodLineageView: lineage
})

assert.equal(record.methodLineageView?.nodes.length, 2)
assert.equal(record.paperMethodDigests?.length, 2)
assert.equal(record.expansionGraphNodes.length, 2)
assert.equal(record.expansionGraphNodes[0].type, 'algorithm_idea')
assert.equal(record.expansionGraphNodes[0].description, lineage.nodes[0].summary)
assert.doesNotMatch(record.expansionGraphNodes.map((node) => node.description).join('\n'), /This is a very long abstract.*This is a very long abstract/)
assert.equal(record.expansionGraphEdges.length, 1)
assert.equal(record.dataCompleteness, 'partial')

const fallback = assembleLineageExpansionRecord({
  paperId: 'paper-main',
  nodeId: 'n1',
  jobIds: ['job-fallback'],
  intent: {
    kind: 'generic_related_papers',
    confidence: 0.3,
    queryFocus: 'related papers',
    rationale: 'Low confidence',
    fallbackReason: '分类置信度低，降级为相关论文展开。'
  },
  retrievedPapers: [candidate('paper-a', 'Foundation RL Method', longAbstract)],
  paperMethodDigests: []
})

assert.equal(fallback.methodLineageView, undefined)
assert.equal(fallback.expansionGraphNodes[0].type, 'related_paper')
assert.ok(fallback.expansionGraphNodes[0].description.length <= 180)
assert.match(fallback.expansionGraphNodes[0].description, /This is a very long abstract/)
assert.equal(fallback.expansionIntent?.fallbackReason, '分类置信度低，降级为相关论文展开。')

const digestCollisionFallback = assembleLineageExpansionRecord({
  paperId: 'paper-main',
  nodeId: 'n1',
  jobIds: ['job-digest-fallback'],
  intent,
  retrievedPapers: [],
  paperMethodDigests: [
    { ...digestA, id: 'digest:a', paperId: 'paper-a' },
    { ...digestB, id: 'digest_a', paperId: 'paper-b' }
  ]
})

assert.equal(digestCollisionFallback.expansionGraphNodes.length, 2)
assert.notEqual(digestCollisionFallback.expansionGraphNodes[0].id, digestCollisionFallback.expansionGraphNodes[1].id)

const qualitySignals: PaperQualitySignal[] = [
  {
    paperId: 'paper-a',
    qualityScore: 0.92,
    trendScore: 0.2,
    badges: ['top_venue', 'highly_cited'],
    reasons: ['Top venue.'],
    warnings: []
  }
]

const enrichedRecord = assembleLineageExpansionRecord({
  paperId: 'paper-main',
  nodeId: 'n1',
  jobIds: ['job-enriched'],
  intent,
  classification: conceptClassification,
  retrievedPapers: [candidate('paper-a', 'Foundation RL Method', longAbstract)],
  qualitySignals,
  relatedPaperRecommendations: [
    {
      paperId: 'paper-a',
      title: 'Foundation RL Method',
      sources: ['openalex'],
      qualitySignal: qualitySignals[0],
      whyRecommended: 'Top venue / high citation',
      relevanceSummary: 'A foundation method.',
      bestUrl: 'https://example.test/paper-a'
    }
  ]
})

assert.equal(enrichedRecord.expansionClassification?.primaryType, 'concept')
assert.equal(enrichedRecord.qualitySignals?.[0].paperId, 'paper-a')
assert.equal(enrichedRecord.relatedPaperRecommendations?.[0].whyRecommended, 'Top venue / high citation')

console.log('lineageRecord tests passed')
