import assert from 'node:assert/strict'
import { buildStagesFromTasks } from './stageFramework'

const stages = buildStagesFromTasks({
  field_positioning: '解释论文处在什么具体研究方向，以及它和已有适配方法的关系。',
  method_overview: '用论文中的核心模块串起整体方法流程。',
})

const fieldStage = stages.find((stage) => stage.id === 'field_positioning')
assert.ok(fieldStage)
assert.match(fieldStage.task, /请回答：/)
assert.match(fieldStage.task, /回答要覆盖：/)
assert.match(fieldStage.task, /具体研究方向/)
assert.match(fieldStage.task, /已有方法/)
assert.match(fieldStage.task, /论文证据/)

const methodStage = stages.find((stage) => stage.id === 'method_overview')
assert.ok(methodStage)
assert.match(methodStage.task, /输入/)
assert.match(methodStage.task, /核心模块/)
assert.match(methodStage.task, /输出/)

const fallbackStage = stages.find((stage) => stage.id === 'formula_algorithm')
assert.ok(fallbackStage)
assert.match(fallbackStage.task, /请回答：/)
assert.match(fallbackStage.task, /公式/)
assert.match(fallbackStage.task, /回答要覆盖：/)

console.log('stageFramework tests passed')
