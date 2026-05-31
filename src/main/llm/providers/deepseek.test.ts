import assert from 'node:assert/strict'
import { deepseekProvider } from './deepseek'

const jsonBody = deepseekProvider.buildBody({
  messages: [{ role: 'user', content: 'Return JSON.' }],
  jsonMode: true,
  maxTokens: 12000,
  temperature: 0.1
}, 'deepseek-v4-pro') as Record<string, unknown>

assert.deepEqual(jsonBody.thinking, { type: 'disabled' })
assert.equal(jsonBody.reasoning_effort, undefined)

const thinkingBody = deepseekProvider.buildBody({
  messages: [{ role: 'user', content: 'Think deeply.' }],
  thinking: 'enabled',
  reasoningEffort: 'max'
}, 'deepseek-v4-pro') as Record<string, unknown>

assert.deepEqual(thinkingBody.thinking, { type: 'enabled' })
assert.equal(thinkingBody.reasoning_effort, 'max')

console.log('deepseek provider tests passed')
