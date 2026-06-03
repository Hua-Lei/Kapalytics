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
assert.match(lineagePrompt, /PDF-grounded method lineage/i)
assert.match(lineagePrompt, /methodLineageContext/i)
assert.match(lineagePrompt, /paperSource\.extractedText/i)
assert.match(lineagePrompt, /problemSetup/i)
assert.match(lineagePrompt, /anchorPosition/i)
assert.match(lineagePrompt, /not a literature list/i)
assert.match(lineagePrompt, /typed method nodes/i)
assert.match(lineagePrompt, /relationship edges/i)
assert.match(lineagePrompt, /current_pdf/i)
assert.match(lineagePrompt, /model_knowledge/i)
assert.match(lineagePrompt, /future_retrieval_needed/i)

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

const suppliedDoiPaperId = 'doi:10 1109 tip 2026 3672375'
const modelDoiPaperId = 'doi:10.1109/TIP.2026.3672375'
const modelBareDoiPaperId = '10.1109/TIP.2026.3672375'
assert.equal(
  validateJobOutput(
    makeJob({
      type: 'digest_paper_method',
      relatedPaperIds: [suppliedDoiPaperId],
      inputJson: {
        retrievedPaper: { id: suppliedDoiPaperId, title: 'TIP Paper' }
      }
    }),
    {
      id: 'digest-tip',
      paperId: modelDoiPaperId,
      paperTitle: 'TIP Paper',
      methodName: 'TIP Method',
      problemSetting: 'Image restoration with parameter generation.',
      coreMechanism: 'Uses a hypernetwork-like generator.',
      relationHints: ['application_variant'],
      evidenceSummary: 'The DOI is equivalent to the supplied candidate id.',
      confidence: 0.7
    }
  ).ok,
  true
)

assert.equal(
  validateJobOutput(
    makeJob({
      type: 'synthesize_method_lineage',
      paperId: 'paper-main',
      relatedPaperIds: ['paper-a'],
      inputJson: {
        methodLineageContext: {
          paperSource: {
            pdfUrl: 'file:///paper.pdf',
            extractedText: '[Page 1]\ntext',
            pages: [{ pageNumber: 1, text: 'text' }]
          }
        },
        retrievedPapers: [{ id: 'paper-a', title: 'Related Paper A' }],
        paperMethodDigests: [{ id: 'digest-a', paperId: 'paper-a', paperTitle: 'Related Paper A' }]
      }
    }),
    {
      id: 'lineage-node-reading-order',
      anchorNodeId: 'n-current',
      title: 'Node reading order lineage',
      summary: 'The model returned a lineage node order instead of paper ids.',
      problemSetup: {
        beginnerExplanation: 'The current paper studies efficient adaptation.',
        whyThisProblemMatters: 'Efficient adaptation reduces inference cost.',
        pdfEvidence: []
      },
      anchorPosition: {
        summary: 'The current method is the PDF anchor.',
        whatTheCurrentPaperChanges: 'It generates adapters from context.',
        whatItInherits: [],
        whatItDoesNotSolve: [],
        pdfEvidence: []
      },
      nodes: [{
        id: 'n-current',
        label: 'Current Method',
        role: 'current_method',
        summary: 'The current PDF method.',
        representativePaperIds: [],
        digestIds: [],
        evidence: [{
          sourceType: 'current_pdf',
          pageNumber: 1,
          excerpt: 'We propose a lightweight hypernetwork.',
          claimSupported: 'The current method is grounded in the PDF.'
        }]
      }, {
        id: 'n-paper',
        label: 'Related Method',
        role: 'parallel_variant',
        summary: 'A related method from a retrieved paper.',
        representativePaperIds: ['paper-a'],
        digestIds: ['digest-a']
      }],
      edges: [{
        id: 'edge-parallel',
        sourceId: 'n-current',
        targetId: 'n-paper',
        relation: 'parallel_variant',
        explanation: 'The methods are parallel variants.',
        evidencePaperIds: ['paper-a'],
        confidence: 0.7
      }],
      openQuestions: [],
      readingOrder: ['n-current', 'n-paper'],
      dataCompleteness: 'partial',
      missingDataReasons: []
    }
  ).ok,
  true
)

assert.equal(
  validateJobOutput(
    makeJob({
      type: 'synthesize_method_lineage',
      paperId: 'paper-main',
      relatedPaperIds: [suppliedDoiPaperId],
      inputJson: {
        methodLineageContext: {
          paperSource: {
            pdfUrl: 'file:///paper.pdf',
            extractedText: '[Page 1]\ntext',
            pages: [{ pageNumber: 1, text: 'text' }]
          }
        },
        paperMethodDigests: [{ id: 'digest-tip' }]
      }
    }),
    {
      id: 'lineage-doi',
      anchorNodeId: 'node-a',
      title: 'DOI equivalent lineage',
      summary: 'The model used a DOI spelling that is equivalent to the supplied paper id.',
      problemSetup: {
        beginnerExplanation: 'The paper studies efficient adaptation.',
        whyThisProblemMatters: 'Efficient adaptation reduces cost.',
        pdfEvidence: []
      },
      anchorPosition: {
        summary: 'The current paper is the anchor method.',
        whatTheCurrentPaperChanges: 'It changes how context is internalized.',
        whatItInherits: [],
        whatItDoesNotSolve: [],
        pdfEvidence: []
      },
      nodes: [{
        id: 'node-current',
        label: 'Current Method',
        role: 'current_method',
        summary: 'The current PDF method.',
        representativePaperIds: ['paper-main'],
        digestIds: []
      }, {
        id: 'node-tip',
        label: 'TIP Method',
        role: 'application_variant',
        summary: 'An external method whose paper id is written as a DOI.',
        representativePaperIds: [modelDoiPaperId],
        digestIds: ['digest-tip']
      }],
      edges: [{
        id: 'edge-tip',
        sourceId: 'node-current',
        targetId: 'node-tip',
        relation: 'applies_to_new_context',
        explanation: 'The external method applies a related idea in another context.',
        evidencePaperIds: [modelBareDoiPaperId],
        confidence: 0.62
      }],
      openQuestions: [],
      readingOrder: [modelDoiPaperId, modelBareDoiPaperId],
      dataCompleteness: 'partial',
      missingDataReasons: []
    }
  ).ok,
  true
)

const suppliedArxivDoiPaperId = 'doi:https doi org 10 48550 arxiv 2203 00759'
const modelArxivPaperId = 'arXiv:2203.00759'
const modelArxivDoiUrlPaperId = 'https://doi.org/10.48550/arXiv.2203.00759'

assert.equal(
  validateJobOutput(
    makeJob({
      type: 'digest_paper_method',
      relatedPaperIds: [suppliedArxivDoiPaperId],
      inputJson: {
        retrievedPaper: { id: suppliedArxivDoiPaperId, title: 'HyperPrompt: Prompt-based Task-Conditioning of Transformers' }
      }
    }),
    {
      id: 'digest-hyperprompt',
      paperId: modelArxivPaperId,
      paperTitle: 'HyperPrompt: Prompt-based Task-Conditioning of Transformers',
      methodName: 'HyperPrompt',
      problemSetting: 'Task-conditioned transformer prompting.',
      coreMechanism: 'A hypernetwork generates task-specific prompt parameters.',
      relationHints: ['parallel_variant'],
      evidenceSummary: 'The arXiv id is equivalent to the supplied DOI-style candidate id.',
      confidence: 0.78
    }
  ).ok,
  true
)

assert.equal(
  validateJobOutput(
    makeJob({
      type: 'synthesize_method_lineage',
      paperId: 'paper-main',
      relatedPaperIds: [suppliedArxivDoiPaperId],
      inputJson: {
        methodLineageContext: {
          paperSource: {
            pdfUrl: 'file:///paper.pdf',
            extractedText: '[Page 1]\ntext',
            pages: [{ pageNumber: 1, text: 'text' }]
          }
        },
        paperMethodDigests: [{ id: 'digest-hyperprompt' }]
      }
    }),
    {
      id: 'lineage-arxiv-alias',
      anchorNodeId: 'node-a',
      title: 'ArXiv alias lineage',
      summary: 'The model used arXiv and DOI URL spellings equivalent to supplied paper ids.',
      problemSetup: {
        beginnerExplanation: 'The paper studies efficient adaptation.',
        whyThisProblemMatters: 'Efficient adaptation reduces cost.',
        pdfEvidence: []
      },
      anchorPosition: {
        summary: 'The current paper is the anchor method.',
        whatTheCurrentPaperChanges: 'It changes how context is internalized.',
        whatItInherits: [],
        whatItDoesNotSolve: [],
        pdfEvidence: []
      },
      nodes: [{
        id: 'node-current',
        label: 'Current Method',
        role: 'current_method',
        summary: 'The current PDF method.',
        representativePaperIds: ['paper-main'],
        digestIds: []
      }, {
        id: 'node-hyperprompt',
        label: 'HyperPrompt',
        role: 'parallel_variant',
        summary: 'An external method whose paper id is written as an arXiv id.',
        representativePaperIds: [modelArxivPaperId],
        digestIds: ['digest-hyperprompt']
      }],
      edges: [{
        id: 'edge-hyperprompt',
        sourceId: 'node-current',
        targetId: 'node-hyperprompt',
        relation: 'contrasts_with',
        explanation: 'The external method uses a related hypernetwork idea for task conditioning.',
        evidencePaperIds: [modelArxivDoiUrlPaperId],
        confidence: 0.62
      }],
      openQuestions: [],
      readingOrder: ['current_pdf', modelArxivPaperId, modelArxivDoiUrlPaperId],
      dataCompleteness: 'partial',
      missingDataReasons: []
    }
  ).ok,
  true
)

assert.equal(
  validateJobOutput(
    makeJob({
      type: 'synthesize_method_lineage',
      paperId: 'paper-main',
      relatedPaperIds: [suppliedArxivDoiPaperId],
      inputJson: {
        methodLineageContext: {
          paperSource: {
            pdfUrl: 'file:///paper.pdf',
            extractedText: '[Page 1]\ntext',
            pages: [{ pageNumber: 1, text: 'text' }]
          }
        },
        retrievedPapers: [{
          id: suppliedArxivDoiPaperId,
          title: 'HyperPrompt: Prompt-based Task-Conditioning of Transformers'
        }],
        paperMethodDigests: [{
          id: 'digest-hyperprompt',
          paperId: suppliedArxivDoiPaperId,
          paperTitle: 'HyperPrompt: Prompt-based Task-Conditioning of Transformers'
        }]
      }
    }),
    {
      id: 'lineage-digest-id-order',
      anchorNodeId: 'node-a',
      title: 'Digest id lineage',
      summary: 'The model used digest ids and supplied titles in paper-id slots.',
      problemSetup: {
        beginnerExplanation: 'The paper studies efficient adaptation.',
        whyThisProblemMatters: 'Efficient adaptation reduces cost.',
        pdfEvidence: []
      },
      anchorPosition: {
        summary: 'The current paper is the anchor method.',
        whatTheCurrentPaperChanges: 'It changes how context is internalized.',
        whatItInherits: [],
        whatItDoesNotSolve: [],
        pdfEvidence: []
      },
      nodes: [{
        id: 'node-current',
        label: 'Current Method',
        role: 'current_method',
        summary: 'The current PDF method.',
        representativePaperIds: ['current_paper'],
        digestIds: []
      }, {
        id: 'node-hyperprompt',
        label: 'HyperPrompt',
        role: 'parallel_variant',
        summary: 'An external method whose paper id is recoverable from the digest.',
        representativePaperIds: ['digest-hyperprompt'],
        digestIds: ['digest-hyperprompt']
      }],
      edges: [{
        id: 'edge-hyperprompt',
        sourceId: 'node-current',
        targetId: 'node-hyperprompt',
        relation: 'contrasts_with',
        explanation: 'The external method uses a related hypernetwork idea.',
        evidencePaperIds: ['HyperPrompt: Prompt-based Task-Conditioning of Transformers'],
        confidence: 0.62
      }],
      openQuestions: [],
      readingOrder: ['digest-hyperprompt', 'HyperPrompt: Prompt-based Task-Conditioning of Transformers'],
      dataCompleteness: 'partial',
      missingDataReasons: []
    }
  ).ok,
  true
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

// map_research_area validation
const mapaPrompt = systemPromptForJob('map_research_area')
assert.match(mapaPrompt, /ResearchAreaView/i)
assert.match(mapaPrompt, /overview/i)
assert.match(mapaPrompt, /keyProblems/i)
assert.match(mapaPrompt, /methodFamilies/i)
assert.match(mapaPrompt, /recentHotDirections/i)
assert.match(mapaPrompt, /recommendedReading/i)
assert.match(mapaPrompt, /Chinese/)
assert.match(mapaPrompt, /Do not invent paper titles or IDs/)

const mapaJob = {
  type: 'map_research_area' as const,
  relatedPaperIds: ['paper-x'],
  paperId: undefined,
  nodeId: undefined
} as any

const validMapa = {
  id: 'ra-lo',
  anchorNodeId: 'n-lo',
  title: 'Low-Rank Adaptation Research Area',
  overview: '低秩适配是参数高效微调的重要研究方向。',
  keyProblems: ['如何选择最优秩？', '如何扩展到不同模态？'],
  methodFamilies: [{
    label: 'LoRA Variants',
    summary: 'LoRA 的各类变体。',
    representativePaperIds: ['paper-x']
  }],
  recentHotDirections: [{
    label: 'Dynamic Rank Selection',
    summary: '动态选择秩大小。',
    paperIds: ['paper-x'],
    confidence: 0.8
  }],
  recommendedReading: [{
    paperId: 'paper-x',
    reason: '基础论文。',
    role: 'foundation'
  }]
}

assert.equal(validateJobOutput(mapaJob, validMapa).ok, true)

const badMapa = { ...validMapa, overview: '' }
assert.equal(validateJobOutput(mapaJob, badMapa).ok, false)

const pdfGroundedLineageOutput = {
  id: 'lineage-pdf',
  anchorNodeId: 'node-a',
  title: 'PDF grounded lineage',
  summary: 'A lineage grounded in the current paper.',
  problemSetup: {
    beginnerExplanation: 'The paper studies how to adapt a model efficiently.',
    whyThisProblemMatters: 'Efficient adaptation reduces training cost.',
    pdfEvidence: [{
      sourceType: 'current_pdf',
      pageNumber: 2,
      sectionTitle: 'Introduction',
      excerpt: 'We study efficient adaptation for large models.',
      claimSupported: 'The paper problem is efficient adaptation.'
    }]
  },
  conceptBridge: [{
    concept: 'Adapter',
    explanation: 'A small trainable module added to a frozen model.',
    whyNeededForThisLineage: 'Adapters are the baseline family being improved.',
    pdfEvidence: []
  }],
  anchorPosition: {
    summary: 'The current paper is an improvement stage.',
    whatTheCurrentPaperChanges: 'It generates adapter parameters dynamically.',
    whatItInherits: ['Frozen backbone adaptation'],
    whatItDoesNotSolve: ['Full retrieval-backed literature coverage'],
    pdfEvidence: [{
      sourceType: 'current_pdf',
      pageNumber: 4,
      sectionTitle: 'Method',
      excerpt: 'Our method generates adaptation weights conditioned on context.',
      claimSupported: 'The paper changes how adapter weights are produced.'
    }]
  },
  methodComparisons: [{
    methodA: 'Static adapters',
    methodB: 'Context-conditioned adapters',
    keyDifference: 'Static adapters learn fixed parameters; the current method generates them from context.',
    whyItMatters: 'This changes how adaptation responds to inputs.',
    evidence: [{ sourceType: 'model_knowledge', note: 'General adapter background.', confidence: 0.65 }]
  }],
  confidenceAndEvidence: {
    groundedInCurrentPdf: ['Problem statement', 'Current method mechanism'],
    fromModelKnowledge: ['Background adapter lineage'],
    needsFutureRetrieval: ['Representative predecessor papers']
  },
  nodes: [{
    id: 'stage-current',
    label: 'Context-conditioned adapter generation',
    role: 'current_method',
    summary: 'The current paper generates adapter weights dynamically.',
    representativePaperIds: ['paper-main'],
    digestIds: [],
    evidence: [{
      sourceType: 'current_pdf',
      pageNumber: 4,
      excerpt: 'Our method generates adaptation weights conditioned on context.',
      claimSupported: 'Current method mechanism.'
    }]
  }],
  edges: [],
  openQuestions: ['Which predecessor papers should be retrieved next?'],
  readingOrder: [],
  dataCompleteness: 'partial',
  missingDataReasons: ['External retrieval evidence is reserved for a later phase.']
}

assert.equal(
  validateJobOutput(
    makeJob({
      type: 'synthesize_method_lineage',
      paperId: 'paper-main',
      relatedPaperIds: [],
      inputJson: {
        methodLineageContext: {
          paperSource: {
            pdfUrl: 'file:///paper.pdf',
            extractedText: '[Page 1]\ntext',
            pages: [{ pageNumber: 1, text: 'text' }]
          }
        }
      }
    }),
    pdfGroundedLineageOutput
  ).ok,
  true
)

const loosePdfGroundedLineageOutput = {
  id: 'lineage-loose',
  anchorNodeId: 'node-a',
  title: 'Loose PDF grounded lineage',
  summary: 'A lineage grounded in the current paper, but shaped like a real model response.',
  problemSetup: 'The paper frames long-context modeling as a tradeoff between loss quality and inference latency.',
  conceptBridge: 'The method connects test-time training, meta-learning, and sliding-window attention.',
  anchorPosition: 'The current paper turns test-time training into an end-to-end next-token objective.',
  methodComparisons: [{
    methodA: 'Full attention',
    methodB: 'TTT-E2E',
    comparison: 'Full attention uses quadratic context interaction while TTT-E2E compresses context into updated weights.',
    evidence: [{
      sourceType: 'current_pdf',
      pageNumber: 1,
      excerpt: 'TTT-E2E has constant inference latency regardless of context length.'
    }]
  }],
  nodes: [{
    id: 'stage-current',
    label: 'TTT-E2E',
    role: 'current_method',
    summary: 'The current paper trains the model at test time with a next-token prediction loss.',
    representativePaperIds: [],
    digestIds: [],
    evidence: [{
      sourceType: 'current_pdf',
      pageNumber: 2,
      excerpt: 'Our inner loop directly optimizes the next-token prediction loss.'
    }]
  }, {
    id: 'stage-foundation',
    label: 'Sliding-window attention',
    role: 'foundation_method',
    summary: 'A local attention baseline with constant inference latency.',
    representativePaperIds: [],
    digestIds: []
  }],
  edges: [{
    id: 'edge-current-foundation',
    sourceId: 'stage-foundation',
    targetId: 'stage-current',
    relation: 'extends',
    explanation: 'TTT-E2E keeps the sliding-window backbone while adding test-time optimization.',
    evidencePaperIds: [],
    confidence: '高',
    evidence: [{
      sourceType: 'current_pdf',
      pageNumber: 1,
      excerpt: 'Under this formulation, we only use a standard architecture - a Transformer with sliding-window attention.'
    }]
  }],
  openQuestions: [],
  readingOrder: [],
  dataCompleteness: '部分完整',
  missingDataReasons: 'External retrieval evidence is reserved for a later phase.'
}

assert.equal(
  validateJobOutput(
    makeJob({
      type: 'synthesize_method_lineage',
      paperId: 'paper-main',
      relatedPaperIds: [],
      inputJson: {
        methodLineageContext: {
          paperSource: {
            pdfUrl: 'file:///paper.pdf',
            extractedText: '[Page 1]\ntext',
            pages: [{ pageNumber: 1, text: 'text' }]
          }
        }
      }
    }),
    loosePdfGroundedLineageOutput
  ).ok,
  true
)

console.log('map_research_area tests passed')
