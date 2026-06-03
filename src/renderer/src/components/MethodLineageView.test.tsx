import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { MethodLineageView as MethodLineageViewType } from '../../../shared/kg4'
import { MethodLineageView } from './MethodLineageView'

const lineage: MethodLineageViewType = {
  id: 'lineage-a',
  anchorNodeId: 'n1',
  title: 'Hypernetwork 方法谱系',
  summary: '从基础超网络到适配器生成路线。',
  problemSetup: {
    beginnerExplanation: '这篇论文要解决高效适配问题。',
    whyThisProblemMatters: '高效适配能降低训练成本。',
    pdfEvidence: [{
      sourceType: 'current_pdf',
      pageNumber: 2,
      sectionTitle: 'Introduction',
      excerpt: 'We study efficient adaptation.',
      claimSupported: '论文问题是高效适配。'
    }]
  },
  anchorPosition: {
    summary: '当前论文位于动态适配器生成这一步。',
    whatTheCurrentPaperChanges: '它根据上下文生成适配器权重。',
    whatItInherits: ['冻结主干模型'],
    whatItDoesNotSolve: ['完整外部文献谱系'],
    pdfEvidence: [{
      sourceType: 'current_pdf',
      pageNumber: 4,
      sectionTitle: 'Method',
      excerpt: 'Our method generates adaptation weights.',
      claimSupported: '本文方法机制。'
    }]
  },
  methodComparisons: [{
    methodA: 'Static adapters',
    methodB: 'Generated adapters',
    keyDifference: '一个固定学习参数，一个按上下文生成参数。',
    whyItMatters: '这决定了方法是否能随输入变化。',
    evidence: [{ sourceType: 'model_knowledge', note: 'Adapter background.', confidence: 0.7 }]
  }],
  confidenceAndEvidence: {
    groundedInCurrentPdf: ['问题定义', '本文方法'],
    fromModelKnowledge: ['适配器背景'],
    needsFutureRetrieval: ['代表性前作']
  },
  nodes: [
    {
      id: 'lineage-foundation',
      label: 'Foundation Hypernetwork',
      role: 'foundation_method',
      summary: '用网络生成另一个网络的权重。',
      representativePaperIds: ['paper-a'],
      digestIds: ['digest-a'],
      evidence: [{
        sourceType: 'current_pdf',
        pageNumber: 5,
        excerpt: 'The module predicts another module weights.',
        claimSupported: 'Node mechanism comes from the PDF.'
      }]
    }
  ],
  edges: [{
    id: 'edge-a',
    sourceId: 'lineage-foundation',
    targetId: 'lineage-foundation',
    relation: 'extends',
    explanation: 'Self edge used only to verify inline edge evidence rendering.',
    evidencePaperIds: [],
    confidence: 0.8,
    evidence: [{
      sourceType: 'current_pdf',
      pageNumber: 6,
      excerpt: 'The method extends the foundation mechanism.',
      claimSupported: 'Edge relation comes from the PDF.'
    }]
  }],
  openQuestions: [],
  readingOrder: ['paper-a'],
  dataCompleteness: 'partial',
  missingDataReasons: []
}

const html = renderToStaticMarkup(<MethodLineageView lineage={lineage} />)

assert.match(html, /谱系\/演进图/)
assert.match(html, /方法谱系节点/)
assert.match(html, /PDF 原文证据/)
assert.match(html, /We study efficient adaptation/)
assert.match(html, /Page 2/)
assert.match(html, /当前论文位于动态适配器生成这一步/)
assert.match(html, /Static adapters/)
assert.match(html, /model_knowledge/)
assert.match(html, /The module predicts another module weights/)
assert.match(html, /The method extends the foundation mechanism/)

console.log('MethodLineageView tests passed')
