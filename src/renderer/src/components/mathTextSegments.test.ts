import assert from 'node:assert/strict'
import { segmentMathText } from './mathTextSegments'

assert.deepEqual(segmentMathText(String.raw`目标是 $L(\theta)$ 最小化`), [
  '目标是 ',
  { type: 'math', formula: String.raw`L(\theta)`, display: false },
  ' 最小化'
])

assert.deepEqual(segmentMathText(String.raw`$$\Delta W = BA$$`), [
  { type: 'math', formula: String.raw`\Delta W = BA`, display: true }
])

assert.deepEqual(segmentMathText(String.raw`使用 \(h = Wx + b\) 表示隐藏状态`), [
  '使用 ',
  { type: 'math', formula: 'h = Wx + b', display: false },
  ' 表示隐藏状态'
])

assert.deepEqual(segmentMathText(String.raw`\[\frac{1}{N}\sum_i loss_i\]`), [
  { type: 'math', formula: String.raw`\frac{1}{N}\sum_i loss_i`, display: true }
])

assert.deepEqual(segmentMathText(String.raw`\Delta W = BA`, { displayMode: true }), [
  { type: 'math', formula: String.raw`\Delta W = BA`, display: true }
])

assert.deepEqual(segmentMathText(String.raw`\theta`), [
  { type: 'math', formula: String.raw`\theta`, display: false }
])

assert.deepEqual(segmentMathText(String.raw`\mathcal{T}_i`), [
  { type: 'math', formula: String.raw`\mathcal{T}_i`, display: false }
])

assert.deepEqual(segmentMathText('核心公式包括测试时更新规则 W_t = W_{t-1} - η ∇ℓ_t(W_{t-1})，其中ℓ_t为交叉熵损失'), [
  '核心公式包括测试时更新规则 ',
  { type: 'math', formula: String.raw`W_t = W_{t-1} - \eta \nabla \ell_t(W_{t-1})`, display: false },
  '，其中',
  { type: 'math', formula: String.raw`\ell_t`, display: false },
  '为交叉熵损失'
])

assert.deepEqual(segmentMathText('训练目标 L(W_0; X) = (1/T) Σ_{t=1}^T ℓ_t(W_{t-1})，其中W_{t-1}由测试时更新得到'), [
  '训练目标 ',
  { type: 'math', formula: String.raw`L(W_0; X) = (1/T) \sum_{t=1}^T \ell_t(W_{t-1})`, display: false },
  '，其中',
  { type: 'math', formula: String.raw`W_{t-1}`, display: false },
  '由测试时更新得到'
])

assert.deepEqual(segmentMathText('h = Wx + BAx', { displayMode: true }), [
  { type: 'math', formula: 'h = Wx + BAx', display: true }
])

assert.deepEqual(segmentMathText(String.raw`反斜杠路径 C:\Users\paper 不是公式`), [
  String.raw`反斜杠路径 C:\Users\paper 不是公式`
])

console.log('mathTextSegments tests passed')
