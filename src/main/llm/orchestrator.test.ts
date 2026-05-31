import assert from 'node:assert/strict'
import { systemPromptForJob } from './jobPrompts'
import { timeoutMsForJob, validateJobOutput } from './orchestrator'
import type { LLMJob } from '../../shared/kg3'

const prompt = systemPromptForJob('expand_node_retrieve_context')

assert.match(prompt, /currentPaper, currentNode, retrievedPapers/i)
assert.doesNotMatch(prompt, /paperAnalyses/i)
assert.doesNotMatch(prompt, /selectedIdeaCards/i)
assert.doesNotMatch(prompt, /comparisonRows/i)
assert.doesNotMatch(prompt, /userReflection/i)

const classifyPrompt = systemPromptForJob('classify_expansion_intent')
assert.match(classifyPrompt, /primaryType/i)
assert.match(classifyPrompt, /facets/i)
assert.match(classifyPrompt, /recommendedPath/i)
assert.match(classifyPrompt, /alternativePaths/i)
assert.match(classifyPrompt, /learn_concept/i)
assert.match(classifyPrompt, /track_method_lineage/i)
assert.match(classifyPrompt, /explore_research_area/i)
assert.match(classifyPrompt, /中文/)

const digestPrompt = systemPromptForJob('digest_paper_method')
assert.match(digestPrompt, /PaperMethodDigest/i)
assert.match(digestPrompt, /PaperMethodDigest with id, paperId, paperTitle/i)
assert.match(digestPrompt, /relationHints/i)
assert.match(digestPrompt, /中文/)
assert.match(digestPrompt, /confidence.*0.*1/i)
assert.match(digestPrompt, /relationHints.*array/i)

const lineagePrompt = systemPromptForJob('synthesize_method_lineage')
assert.match(lineagePrompt, /MethodLineageView/i)
assert.match(lineagePrompt, /evidencePaperIds/i)
assert.match(lineagePrompt, /anchorNodeId/i)
assert.match(lineagePrompt, /role.*current_method/i)
assert.match(lineagePrompt, /Do not output.*methodName/i)
assert.match(lineagePrompt, /At most 6 nodes/i)

assert.equal(timeoutMsForJob('synthesize_method_lineage'), 240000)
assert.equal(timeoutMsForJob('digest_paper_method'), 120000)

function makeJob(overrides: Partial<LLMJob>): LLMJob {
  return {
    id: 'job-test',
    type: 'classify_expansion_intent',
    status: 'queued',
    priority: 'normal',
    inputHash: 'hash',
    cacheKey: 'cache',
    relatedPaperIds: ['paper-a', 'paper-b'],
    inputJson: undefined,
    promptVersion: 'test',
    model: 'deepseek-v4-pro',
    jsonMode: true,
    maxTokens: 256,
    temperature: 0.1,
    attempts: 0,
    maxAttempts: 1,
    progressStep: 'building_context',
    progressMessage: 'testing',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

assert.equal(
  validateJobOutput(
    makeJob({ type: 'classify_expansion_intent' }),
    { kind: 'algorithm_method_lineage', confidence: 0.7, queryFocus: 'meta-learning optimizer', rationale: 'concrete method family' }
  ).ok,
  true
)

assert.equal(
  validateJobOutput(
    makeJob({ type: 'classify_expansion_intent' }),
    { kind: 'algorithm_method_lineage', confidence: 0.95, queryFocus: 'hypernetwork meta-learning', rationale: 'concrete method family', fallbackReason: null }
  ).ok,
  true
)

assert.equal(
  validateJobOutput(
    makeJob({ type: 'classify_expansion_intent' }),
    { kind: 'wrong_kind', confidence: 7, queryFocus: '', rationale: '' }
  ).ok,
  false
)

assert.equal(
  validateJobOutput(
    makeJob({
      type: 'digest_paper_method',
      relatedPaperIds: ['paper-a'],
      inputJson: {
        retrievedPaper: { id: 'paper-a', title: 'True Paper Title' }
      }
    }),
    {
      id: 'digest-a',
      paperId: 'paper-a',
      paperTitle: 'Hallucinated Title',
      problemSetting: 'optimize adaptation',
      coreMechanism: 'gradient-based update',
      relationHints: ['foundation'],
      evidenceSummary: 'describes the base method',
      confidence: 0.6
    }
  ).ok,
  false
)

assert.equal(
  validateJobOutput(
    makeJob({
      type: 'digest_paper_method',
      relatedPaperIds: ['paper-a'],
      inputJson: {
        retrievedPaper: { id: 'paper-a', title: 'True Paper Title' }
      }
    }),
    {
      id: 'digest-a',
      paperId: 'paper-a',
      paperTitle: 'True Paper Title',
      methodName: 'HyperLoRA',
      problemSetting: '方言适配缺少可扩展方法。',
      coreMechanism: '使用超网络生成 LoRA 适配器。',
      relationHints: 'extends',
      evidenceSummary: '论文摘要说明该方法用于低秩适配器生成。',
      confidence: 'medium'
    }
  ).ok,
  true
)

assert.equal(
  validateJobOutput(
    makeJob({
      type: 'synthesize_method_lineage',
      relatedPaperIds: ['paper-a'],
      inputJson: {
        paperMethodDigests: [{ id: 'digest-a' }]
      }
    }),
    {
      id: 'lineage-a',
      anchorNodeId: 'node-a',
      title: 'Method lineage',
      summary: 'summary',
      nodes: [
        {
          id: 'node-a',
          label: 'Method A',
          role: 'current_method',
          summary: 'summary',
          representativePaperIds: ['paper-outside'],
          digestIds: ['digest-a']
        }
      ],
      edges: [
        {
          id: 'edge-a',
          sourceId: 'node-a',
          targetId: 'node-a',
          relation: 'extends',
          explanation: 'extends itself',
          evidencePaperIds: ['paper-a'],
          confidence: 0.5
        }
      ],
      openQuestions: [],
      readingOrder: [],
      dataCompleteness: 'partial',
      missingDataReasons: []
    }
  ).ok,
  false
)

assert.equal(
  validateJobOutput(
    makeJob({
      type: 'synthesize_method_lineage',
      relatedPaperIds: ['paper-a'],
      inputJson: {
        paperMethodDigests: [{ id: 'digest-a' }]
      }
    }),
    {
      id: 'lineage-b',
      anchorNodeId: 'node-a',
      title: 'Method lineage',
      summary: 'summary',
      nodes: [
        {
          id: 'node-a',
          label: 'Method A',
          role: 'current_method',
          summary: 'summary',
          representativePaperIds: ['paper-a'],
          digestIds: ['digest-a']
        }
      ],
      edges: [],
      openQuestions: [],
      readingOrder: ['paper-outside'],
      dataCompleteness: 'partial',
      missingDataReasons: []
    }
  ).ok,
  false
)

assert.equal(
  validateJobOutput(
    makeJob({
      type: 'synthesize_method_lineage',
      relatedPaperIds: ['paper-a'],
      inputJson: {
        paperMethodDigests: [{ id: 'digest-a' }]
      }
    }),
    {
      id: 'lineage-c',
      anchorNodeId: 'node-a',
      title: 'Method lineage',
      summary: 'summary',
      nodes: [
        {
          id: 'node-a',
          label: 'Method A',
          role: 'current_method',
          summary: 'summary',
          representativePaperIds: ['paper-a'],
          digestIds: ['digest-a']
        }
      ],
      edges: [
        {
          id: 'edge-a',
          sourceId: 'node-a',
          targetId: 'node-missing',
          relation: 'extends',
          explanation: 'extends missing node',
          evidencePaperIds: ['paper-a'],
          confidence: 0.5
        }
      ],
      openQuestions: [],
      readingOrder: ['paper-a'],
      dataCompleteness: 'partial',
      missingDataReasons: []
    }
  ).ok,
  false
)

// New strategy classification shape should validate
assert.equal(
  validateJobOutput(
    makeJob({ type: 'classify_expansion_intent' }),
    {
      primaryType: 'concept',
      facets: ['method_component'],
      confidence: 0.88,
      rationale: 'LoRA is a reusable concept with mathematical structure.',
      recommendedPath: 'learn_concept',
      alternativePaths: ['track_method_lineage', 'review_related_papers']
    }
  ).ok,
  true
)

// Missing facets should fail
assert.equal(
  validateJobOutput(
    makeJob({ type: 'classify_expansion_intent' }),
    {
      primaryType: 'concept',
      confidence: 0.88,
      rationale: 'Missing facets and other fields.',
      recommendedPath: 'learn_concept'
    }
  ).ok,
  false
)

// New shape with ambiguity field should validate
assert.equal(
  validateJobOutput(
    makeJob({ type: 'classify_expansion_intent' }),
    {
      primaryType: 'method',
      facets: ['training_strategy', 'paper_specific'],
      confidence: 0.75,
      rationale: 'Could also be a concept.',
      recommendedPath: 'track_method_lineage',
      alternativePaths: ['learn_concept'],
      ambiguity: { competingType: 'concept', reason: 'The method has a reusable mathematical formulation.' }
    }
  ).ok,
  true
)

// Bad recommendedPath should fail
assert.equal(
  validateJobOutput(
    makeJob({ type: 'classify_expansion_intent' }),
    {
      primaryType: 'method',
      facets: ['paper_specific'],
      confidence: 0.6,
      rationale: 'Test.',
      recommendedPath: 'bad_path',
      alternativePaths: ['track_method_lineage']
    }
  ).ok,
  false
)

// Legacy output stays accepted
assert.equal(
  validateJobOutput(
    makeJob({ type: 'classify_expansion_intent' }),
    {
      kind: 'algorithm_method_lineage',
      confidence: 0.82,
      queryFocus: 'Hypernetwork',
      rationale: 'Legacy output remains accepted during migration.'
    }
  ).ok,
  true
)

// Legacy output stays accepted (generic_related_papers)
assert.equal(
  validateJobOutput(
    makeJob({ type: 'classify_expansion_intent' }),
    {
      kind: 'generic_related_papers',
      confidence: 0.5,
      queryFocus: 'meta-learning survey',
      rationale: 'Broad field topic.',
      fallbackReason: 'low confidence in method specificity'
    }
  ).ok,
  true
)

// teach_concept validation
const teachConceptPrompt = systemPromptForJob('teach_concept')
assert.match(teachConceptPrompt, /ConceptLearningView/i)
assert.match(teachConceptPrompt, /quickExplanation/i)
assert.match(teachConceptPrompt, /formalExplanation/i)
assert.match(teachConceptPrompt, /misconceptions/i)
assert.match(teachConceptPrompt, /relationMap/i)
assert.match(teachConceptPrompt, /representativePaperIds/i)
assert.match(teachConceptPrompt, /recentPaperIds/i)
assert.match(teachConceptPrompt, /Chinese/)

const conceptJob = {
  type: 'teach_concept' as const,
  relatedPaperIds: ['paper-lo'],
  paperId: undefined,
  nodeId: undefined
} as any

const validConcept = {
  id: 'cv-lo',
  anchorNodeId: 'n-lo',
  title: 'LoRA: Low-Rank Adaptation',
  quickExplanation: {
    intuition: '用低秩矩阵近似全参数更新。',
    problemSolved: '大模型全参数微调成本过高。',
    coreMechanism: '冻结权重，通过低秩分解注入可训练参数。',
    whenToUse: '高效适配预训练模型时。'
  },
  formalExplanation: {
    definition: '对于权重 W，参数化为 W + BA。',
    formulas: [{
      latex: 'h = Wx + BAx',
      explanation: '前向传播。',
      variables: [{ symbol: 'W', meaning: '原始权重' }]
    }],
    assumptions: []
  },
  misconceptions: [{ misconception: '错误', correction: '正确' }],
  relationMap: [{ label: 'Adapter', relation: 'similar', explanation: '类似' }],
  representativePaperIds: ['paper-lo'],
  recentPaperIds: [],
  dataCompleteness: 'partial' as const,
  missingDataReasons: []
}

assert.equal(validateJobOutput(conceptJob, validConcept).ok, true)

const badConcept = { ...validConcept, quickExplanation: null }
assert.equal(validateJobOutput(conceptJob, badConcept).ok, false)

console.log('teach_concept tests passed')
