import assert from 'node:assert/strict'
import { systemPromptForJob } from './jobPrompts'

const prompt = systemPromptForJob('expand_node_retrieve_context')

assert.match(prompt, /currentPaper, currentNode, retrievedPapers/i)
assert.doesNotMatch(prompt, /paperAnalyses/i)
assert.doesNotMatch(prompt, /selectedIdeaCards/i)
assert.doesNotMatch(prompt, /comparisonRows/i)
assert.doesNotMatch(prompt, /userReflection/i)

console.log('orchestrator tests passed')
