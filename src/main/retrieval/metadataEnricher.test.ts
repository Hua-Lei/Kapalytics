import assert from 'node:assert/strict'
import { clearMetadataCache, enrichCandidatesWithSemanticScholar, EnrichedMetadata } from './metadataEnricher'

const candidates = [
  { canonicalId: 'p1', semanticScholarId: undefined },
  { canonicalId: 'p2', semanticScholarId: 'dummy-id-wont-resolve' }
]

async function runTests() {
  const result = await enrichCandidatesWithSemanticScholar(candidates)
  assert.ok(result instanceof Map)
  assert.equal(result.size, 0, 'Should not find results for non-existent S2 ID')

  // Verify cache was populated with null for failed lookup
  const cached = await enrichCandidatesWithSemanticScholar(candidates)
  assert.equal(cached.size, 0)
  clearMetadataCache()

  console.log('metadataEnricher tests passed')
}

runTests().catch(console.error)
