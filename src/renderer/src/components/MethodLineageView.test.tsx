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
  nodes: [
    {
      id: 'lineage-foundation',
      label: 'Foundation Hypernetwork',
      role: 'foundation_method',
      summary: '用网络生成另一个网络的权重。',
      representativePaperIds: ['paper-a'],
      digestIds: ['digest-a']
    }
  ],
  edges: [],
  openQuestions: [],
  readingOrder: ['paper-a'],
  dataCompleteness: 'partial',
  missingDataReasons: []
}

const html = renderToStaticMarkup(<MethodLineageView lineage={lineage} />)

assert.match(html, /谱系\/演进图/)
assert.match(html, /方法谱系节点/)

console.log('MethodLineageView tests passed')
