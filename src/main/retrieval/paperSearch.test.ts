import assert from 'node:assert/strict'
import {
  __testing,
  dedupeAndRankResults
} from './paperSearch'
import type { PaperSearchQuery, PaperSearchResult } from '../../shared/kg3'

const query: PaperSearchQuery = {
  query: 'Hypernetwork related papers hypernetwork meta-learning Ha et al. 2016 hypernetwork weight generating networks related papers',
  searchQueries: ['hypernetwork meta-learning', 'Ha et al. 2016 hypernetwork', 'weight generating networks'],
  maxResults: 8,
  requireAbstract: true
}

const arxivQuery = __testing.buildArxivSearchQuery(query)
assert.match(arxivQuery, /all:hypernetwork/)
assert.match(arxivQuery, /AND/)
assert.doesNotMatch(arxivQuery, /related papers related papers/)

const resultWithAbstract: PaperSearchResult = {
  id: 'openalex-a',
  provider: 'openalex',
  source: 'openalex',
  externalId: 'https://openalex.org/W1',
  url: 'https://example.test/a',
  title: 'Hypernetwork Method',
  authors: [],
  abstract: 'A concrete abstract about hypernetwork weight generation.',
  doi: '10.1000/test',
  topicTags: ['hypernetwork'],
  raw: { id: 'W1' },
  fetchedAt: '2026-01-01T00:00:00.000Z'
}

const resultWithoutAbstract: PaperSearchResult = {
  ...resultWithAbstract,
  id: 'openalex-b',
  externalId: 'https://openalex.org/W2',
  url: 'https://example.test/b',
  title: 'Hypernetwork Method Without Abstract',
  abstract: undefined,
  doi: '10.1000/test-without-abstract'
}

assert.equal(dedupeAndRankResults({ ...query, requireAbstract: true }, [resultWithAbstract, resultWithoutAbstract]).length, 1)
assert.equal(dedupeAndRankResults({ ...query, requireAbstract: false }, [resultWithAbstract, resultWithoutAbstract]).length, 2)

assert.equal(__testing.paperSearchConfig.arxivTimeoutMs >= 30000, true)
assert.equal(__testing.paperSearchConfig.semanticScholarRefillPerSecond <= 1, true)

console.log('paperSearch tests passed')
