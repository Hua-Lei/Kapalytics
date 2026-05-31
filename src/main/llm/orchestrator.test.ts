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
assert.match(classifyPrompt, /algorithm_method_lineage/i)
assert.match(classifyPrompt, /generic_related_papers/i)

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

console.log('orchestrator tests passed')
