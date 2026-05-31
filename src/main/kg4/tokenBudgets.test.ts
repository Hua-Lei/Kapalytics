import assert from 'node:assert/strict'
import { KG4_EXPANSION_TOKEN_BUDGETS } from './tokenBudgets'

assert.equal(KG4_EXPANSION_TOKEN_BUDGETS.classifyExpansionIntent, 2000)
assert.equal(KG4_EXPANSION_TOKEN_BUDGETS.digestPaperMethod, 4000)
assert.equal(KG4_EXPANSION_TOKEN_BUDGETS.synthesizeMethodLineage, 24000)

console.log('tokenBudgets tests passed')
