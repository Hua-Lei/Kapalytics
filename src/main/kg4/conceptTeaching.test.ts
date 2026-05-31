import assert from 'node:assert/strict'
import type { ConceptLearningView } from '../../shared/kg4'
import { normalizeConceptLearningView } from './conceptTeaching'

const validLLMOutput: unknown = {
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
    formulas: [
      {
        latex: 'h = Wx + BAx',
        explanation: '前向传播。',
        variables: [{ symbol: 'W', meaning: '原始权重' }]
      }
    ],
    assumptions: ['预训练权重包含足够知识']
  },
  misconceptions: [{ misconception: '错误理解', correction: '正确解释' }],
  relationMap: [{ label: 'Adapter', relation: 'similar', explanation: '类似方案' }],
  representativePaperIds: ['p1'],
  recentPaperIds: [],
  dataCompleteness: 'partial',
  missingDataReasons: []
}

const result = normalizeConceptLearningView(validLLMOutput, { anchorNodeId: 'n-lo' })
assert.ok(result)
assert.equal(result.title, 'LoRA: Low-Rank Adaptation')
assert.equal(result.formalExplanation.formulas[0].latex, 'h = Wx + BAx')
assert.equal(result.dataCompleteness, 'partial')

const malformed = normalizeConceptLearningView(null, { anchorNodeId: 'n-lo' })
assert.equal(malformed, undefined)

const missingQuick = normalizeConceptLearningView({ ...(validLLMOutput as Record<string, unknown>), quickExplanation: null }, { anchorNodeId: 'n-lo' })
assert.equal(missingQuick, undefined)

console.log('conceptTeaching tests passed')
