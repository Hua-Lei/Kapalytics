import assert from 'node:assert/strict'
import type { DedupedPaperCandidate, PaperSearchResult } from '../../shared/kg3'
import { toRetrievalConnectionTestResult } from './retrievalTest'

function candidate(title: string, sources: PaperSearchResult['source'][], year?: number): DedupedPaperCandidate {
  return {
    canonicalId: title.toLowerCase().replace(/\s+/g, '-'),
    mergedFrom: [],
    title,
    authors: [],
    year,
    sources,
    externalIds: [],
    bestUrl: `https://example.test/${encodeURIComponent(title)}`,
    abstract: 'abstract',
    score: 1
  }
}

const success = toRetrievalConnectionTestResult({
  query: 'hypernetwork meta-learning',
  candidates: [
    candidate('HyperNetworks', ['arxiv', 'openalex'], 2016),
    candidate('Meta Learning Survey', ['openalex'], 2021),
    candidate('Third Paper', ['semantic_scholar']),
    candidate('Fourth Paper', ['openalex'])
  ],
  providerStatus: [
    { provider: 'openalex', status: 'success', message: '找到 5 篇可验证论文' },
    { provider: 'arxiv', status: 'empty', message: 'arXiv 暂无结果或未启用' }
  ]
})

assert.equal(success.ok, true)
assert.equal(success.candidateCount, 4)
assert.equal(success.samplePapers.length, 3)
assert.equal(success.samplePapers[0].title, 'HyperNetworks')
assert.deepEqual(success.samplePapers[0].sources, ['arxiv', 'openalex'])

const failure = toRetrievalConnectionTestResult({
  query: 'hypernetwork meta-learning',
  candidates: [],
  providerStatus: [
    { provider: 'openalex', status: 'error', message: 'NETWORK_ERROR' },
    { provider: 'semantic_scholar', status: 'error', message: 'Semantic Scholar API 429' }
  ]
})

assert.equal(failure.ok, false)
assert.match(failure.message, /未检索到可用论文/)
assert.match(failure.providerStatus[1].message, /429/)

console.log('retrievalTest tests passed')
