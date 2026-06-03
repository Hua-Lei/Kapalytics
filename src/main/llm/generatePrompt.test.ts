import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./generate.ts', import.meta.url), 'utf8')

assert.match(source, /结构化作答问题/)
assert.match(source, /回答要覆盖/)
assert.match(source, /不要把 tasks 写成阶段摘要/)
assert.match(source, /不是替学生总结答案/)

console.log('generate prompt tests passed')
