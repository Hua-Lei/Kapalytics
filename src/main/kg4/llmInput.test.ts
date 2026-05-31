import assert from 'node:assert/strict'
import type { DedupedPaperCandidate } from '../../shared/kg3'
import { compactRetrievedPapersForLineage } from './llmInput'

const noisyPaper: DedupedPaperCandidate = {
  canonicalId: 'paper-a',
  mergedFrom: [
    {
      id: 'raw-a',
      provider: 'openalex',
      source: 'openalex',
      externalId: 'raw-a',
      url: 'https://example.test/raw-a',
      title: 'Raw Paper A',
      authors: ['A'],
      abstract: 'raw abstract '.repeat(200),
      topicTags: [],
      raw: { large: 'payload'.repeat(1000) },
      fetchedAt: '2026-05-31T00:00:00.000Z'
    }
  ],
  title: 'Paper A',
  authors: ['Author A'],
  year: 2026,
  sources: ['openalex'],
  externalIds: [{ provider: 'openalex', externalId: 'paper-a', url: 'https://example.test/paper-a' }],
  bestUrl: 'https://example.test/paper-a',
  abstract: 'This paper studies hypernetwork meta-learning. '.repeat(100),
  score: 0.9
}

const compact = compactRetrievedPapersForLineage([noisyPaper])
const first = compact[0]

assert.ok(first)
assert.deepEqual(Object.keys(first), ['id', 'title', 'year', 'sources', 'abstract'])
assert.equal(first.id, 'paper-a')
assert.ok(first.abstract && first.abstract.length <= 700)
assert.doesNotMatch(JSON.stringify(compact), /mergedFrom|externalIds|raw|bestUrl/)

console.log('llmInput tests passed')
