import assert from 'node:assert/strict'
import { buildDiagnosisPrompt } from './diagnosis'

const messages = buildDiagnosisPrompt(
  'method_overview',
  '方法主线',
  '请回答：这篇论文的方法如何从输入走到输出？\n回答要覆盖：\n1. 输入\n2. 核心模块\n3. 输出',
  '它用了一个模块处理输入。'
)

const system = messages[0]?.content ?? ''
const user = messages[1]?.content ?? ''

assert.match(system, /结构化题目/)
assert.match(system, /检查点/)
assert.match(system, /遗漏/)
assert.match(system, /改写/)
assert.match(user, /思考问题/)
assert.match(user, /逐项检查/)
assert.match(user, /回答要覆盖/)

console.log('diagnosis prompt tests passed')
