import assert from 'node:assert/strict'
import type { NodeUnderstandingMemory } from '../../../../shared/kg4'
import { saveMemoryAndRefresh } from './memoryPersistence'

const memory: NodeUnderstandingMemory = {
  id: 'memory-1',
  nodeId: 'node-1',
  nodeLabel: 'Text-to-LoRA',
  nodeType: 'method',
  normalizedNodeLabel: 'text-to-lora',
  sourcePaperId: 'paper-1',
  relatedPaperIds: [],
  ideaCardIds: [],
  methodFamilyTags: ['adapter generation'],
  topicTags: ['LoRA'],
  userReflection: 'The method generates adapter parameters from task descriptions.',
  aiFeedbackType: 'reflective',
  aiFeedbackSummary: 'The main mechanism is identified.',
  strengths: ['Identified the generated object.'],
  missingDimensions: [],
  prerequisiteGaps: [],
  generatedUnderstandingNote: 'Text-to-LoRA generates adapter parameters from task descriptions.',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z'
}

let savedMemory: NodeUnderstandingMemory | undefined
let reloadCount = 0

async function main() {
  await saveMemoryAndRefresh(memory, {
    save: async (record) => {
      savedMemory = record
      return { ok: true }
    },
    reload: async () => {
      reloadCount += 1
    }
  })

  assert.equal(savedMemory, memory)
  assert.equal(reloadCount, 1)

  reloadCount = 0
  await assert.rejects(
    saveMemoryAndRefresh(memory, {
      save: async () => ({ ok: false }),
      reload: async () => {
        reloadCount += 1
      }
    }),
    /KG4 IPC/
  )
  assert.equal(reloadCount, 0)

  console.log('memoryPersistence tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
