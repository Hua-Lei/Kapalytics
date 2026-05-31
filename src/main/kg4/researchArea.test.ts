import assert from 'node:assert/strict'
import { normalizeResearchAreaView } from './researchArea'

const validOutput: unknown = {
  id: 'ra-llm',
  anchorNodeId: 'n-llm',
  title: 'LLM Alignment Research',
  overview: '大语言模型对齐研究概述。',
  keyProblems: ['安全对齐', '指令遵循', '偏好学习'],
  methodFamilies: [
    { label: 'RLHF', summary: '基于人类反馈的强化学习', representativePaperIds: ['p1'] },
    { label: 'DPO', summary: '直接偏好优化', representativePaperIds: ['p2'] }
  ],
  recentHotDirections: [
    { label: 'Constitutional AI', summary: '基于规则的自我对齐', paperIds: ['p3'], confidence: 0.8 }
  ],
  recommendedReading: [
    { paperId: 'p1', reason: 'RLHF奠基性工作', role: 'foundation' },
    { paperId: 'p3', reason: '近期热点方向', role: 'recent_hot' }
  ]
}

const result = normalizeResearchAreaView(validOutput, { anchorNodeId: 'n-llm' })
assert.ok(result)
assert.equal(result.title, 'LLM Alignment Research')
assert.equal(result.methodFamilies[0].label, 'RLHF')
assert.equal(result.recommendedReading[0].role, 'foundation')

assert.equal(normalizeResearchAreaView(null, { anchorNodeId: 'n-llm' }), undefined)
assert.equal(normalizeResearchAreaView({ ...validOutput, title: '' }, { anchorNodeId: 'n-llm' }), undefined)

console.log('researchArea tests passed')
