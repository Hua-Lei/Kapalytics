import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import StageDetail from './StageDetail'
import type { Stage } from '../types'

const stage: Stage = {
  id: 'method_overview',
  order: 3,
  name: '方法主线',
  status: 'in_progress',
  mastery: 20,
  description: '提炼论文方法的输入、核心模块、处理流程和输出。',
  task: '请回答：这篇论文的方法如何从输入走到输出？\n回答要覆盖：\n1. 输入\n2. 核心模块\n3. 输出'
}

const html = renderToStaticMarkup(
  <StageDetail
    answer=""
    diagnosed={false}
    diagnosisError={null}
    diagnosisLoading={false}
    diagnosisResult={undefined}
    draft=""
    onConfirmDiagnosis={() => undefined}
    onEnterStage={() => undefined}
    onMarkNeedsReview={() => undefined}
    onRetryDiagnosis={() => undefined}
    onRetryStage={() => undefined}
    onSubmitAnswer={() => undefined}
    onUpdateDraft={() => undefined}
    stage={stage}
  />
)

assert.match(html, /思考问题/)
assert.doesNotMatch(html, /阶段任务/)
assert.match(html, /提交回答/)
assert.match(html, /论文证据/)

console.log('StageDetail tests passed')
