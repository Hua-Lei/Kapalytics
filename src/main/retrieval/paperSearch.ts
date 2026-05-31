import { createHash } from 'crypto'
import { ProxyAgent } from 'undici'
import type { PaperRecord } from '../../shared/kg3'
import type {
  DedupedPaperCandidate,
  PaperSearchProvider,
  PaperSearchQuery,
  PaperSearchResult
} from '../../shared/kg3'
import { paperMemoryRepository } from '../memory/kg3Repository'
import { getLlmConfig, getSemanticScholarApiKey } from '../llm/client'
import { TokenBucketRateLimiter } from './rateLimiter'

type FetchInitWithDispatcher = RequestInit & { dispatcher?: ProxyAgent }

function logRetrieval(event: string, details: Record<string, unknown>): void {
  console.info(`[Retrieval] ${event}`, details)
}

function retrievalFetchInit(timeoutMs = 15000): FetchInitWithDispatcher {
  const init: FetchInitWithDispatcher = { signal: AbortSignal.timeout(timeoutMs) }
  const proxyUrl = getLlmConfig().proxyUrl
  if (proxyUrl) init.dispatcher = new ProxyAgent(proxyUrl)
  return init
}

const arxivRateLimiter = new TokenBucketRateLimiter({ capacity: 1, refillPerSecond: 1 / 3 })
const openAlexRateLimiter = new TokenBucketRateLimiter({ capacity: 20, refillPerSecond: 10 })
const semanticScholarRateLimiter = new TokenBucketRateLimiter({ capacity: 1, refillPerSecond: 1 })

const paperSearchConfig = {
  arxivTimeoutMs: 30000,
  openAlexTimeoutMs: 15000,
  semanticScholarTimeoutMs: 20000,
  semanticScholarRefillPerSecond: 1
}

function now(): string {
  return new Date().toISOString()
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ').trim()
}

function queryTokens(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 2 && !['related', 'papers', 'paper'].includes(token))
}

function buildArxivSearchQuery(query: PaperSearchQuery): string {
  const tokens = [...new Set(queryTokens([query.query, ...(query.searchQueries ?? [])].join(' ')))].slice(0, 8)
  return tokens.length ? tokens.map((token) => `all:${token}`).join(' AND ') : `all:${query.query}`
}

function hash(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 16)
}

function tokenScore(query: string, result: PaperSearchResult): number {
  const queryTokens = new Set(normalizeText(query).split(' ').filter(Boolean))
  const haystack = normalizeText([result.title, result.abstract, result.venue, ...result.topicTags].filter(Boolean).join(' '))
  return [...queryTokens].filter((token) => haystack.includes(token)).length / Math.max(1, queryTokens.size)
}

function relationConfidence(query: PaperSearchQuery, result: PaperSearchResult): number {
  const queryText = normalizeText([query.query, ...(query.searchQueries ?? [])].join(' '))
  const resultText = normalizeText([result.title, result.abstract, ...result.topicTags].filter(Boolean).join(' '))
  const queryTokens = queryText.split(' ').filter((token) => token.length > 2)
  if (!queryTokens.length) return 0
  const strongMatches = queryTokens.filter((token) => resultText.includes(token)).length
  const localBoost = result.provider === 'local' ? 0.2 : 0
  return Math.min(1, strongMatches / queryTokens.length + localBoost)
}

function canonicalKey(result: PaperSearchResult): string {
  if (result.doi) return `doi:${normalizeText(result.doi)}`
  if (result.arxivId) return `arxiv:${normalizeText(result.arxivId)}`
  if (result.semanticScholarPaperId) return `s2:${result.semanticScholarPaperId}`
  if (result.openAlexId) return `openalex:${result.openAlexId}`
  if (result.corpusId) return `corpus:${result.corpusId}`
  return `title:${normalizeText(result.title)}:${result.year ?? 'na'}:${normalizeText(result.authors[0] ?? '')}`
}

export function dedupeAndRankResults(query: PaperSearchQuery, results: PaperSearchResult[]): DedupedPaperCandidate[] {
  const groups = new Map<string, PaperSearchResult[]>()
  for (const result of results.filter((item) => item.source && item.url && item.externalId && (!query.requireAbstract || Boolean(item.abstract?.trim())))) {
    const key = canonicalKey(result)
    groups.set(key, [...(groups.get(key) ?? []), result])
  }

  return [...groups.entries()].map(([canonicalId, group]) => {
    const bestAbstract = group.map((item) => item.abstract).filter((item): item is string => Boolean(item)).sort((a, b) => b.length - a.length)[0]
    const best = group.slice().sort((a, b) => (b.citedByCount ?? 0) - (a.citedByCount ?? 0))[0]
    const lexicalMatch = Math.max(...group.map((item) => tokenScore(query.query, item)))
    const semanticTagMatch = Math.max(...group.map((item) => tokenScore((query.searchQueries ?? []).join(' '), item)))
    const relationToCurrentNodeConfidence = Math.max(...group.map((item) => relationConfidence(query, item)))
    const sourceQuality = group.some((item) => item.provider === 'local') ? 1 : 0.7
    const recencyOrCitationSignal = Math.min(1, ((best.citedByCount ?? 0) / 500) + (best.year && best.year >= 2020 ? 0.2 : 0))
    const score = lexicalMatch * 0.35 + semanticTagMatch * 0.25 + relationToCurrentNodeConfidence * 0.20 + sourceQuality * 0.10 + recencyOrCitationSignal * 0.10

    return {
      canonicalId,
      mergedFrom: group,
      title: best.title,
      authors: best.authors,
      year: best.year,
      sources: [...new Set(group.map((item) => item.source))],
      externalIds: group.map((item) => ({ provider: item.provider, externalId: item.externalId, url: item.url })),
      bestUrl: best.url,
      bestPdfUrl: group.find((item) => item.pdfUrl)?.pdfUrl,
      abstract: bestAbstract,
      score
    }
  }).sort((a, b) => b.score - a.score).slice(0, query.maxResults)
}

export class LocalProvider implements PaperSearchProvider {
  id = 'local' as const
  displayName = 'Local Library'
  capabilities = ['keyword_search', 'title_search', 'id_lookup', 'local_fulltext'] as PaperSearchProvider['capabilities']

  async search(query: PaperSearchQuery): Promise<PaperSearchResult[]> {
    const papers = await paperMemoryRepository.listPapers()
    const terms = normalizeText([query.query, ...(query.searchQueries ?? [])].join(' '))
    return papers
      .filter((paper) => normalizeText([paper.title, paper.abstract, paper.venue].filter(Boolean).join(' ')).includes(terms.split(' ')[0] ?? ''))
      .slice(0, query.maxResults)
      .map(paperToResult)
  }

  async getById(id: { provider: 'local'; externalId: string }): Promise<PaperSearchResult | null> {
    const papers = await paperMemoryRepository.listPapers()
    const paper = papers.find((item) => item.externalIds.some((external) => external.provider === 'local' && external.externalId === id.externalId))
    return paper ? paperToResult(paper) : null
  }
}

class ArxivProvider implements PaperSearchProvider {
  id = 'arxiv' as const
  displayName = 'arXiv'
  capabilities = ['keyword_search', 'title_search', 'id_lookup', 'open_access_pdf'] as PaperSearchProvider['capabilities']

  async search(query: PaperSearchQuery): Promise<PaperSearchResult[]> {
    await arxivRateLimiter.acquire()
    const params = new URLSearchParams({
      search_query: buildArxivSearchQuery(query),
      start: '0',
      max_results: String(Math.min(query.maxResults, 20)),
      sortBy: 'relevance',
      sortOrder: 'descending'
    })
    const url = `https://export.arxiv.org/api/query?${params.toString()}`
    logRetrieval('provider_request', { provider: this.id, url, query: query.query })
    const res = await fetch(url, retrievalFetchInit(paperSearchConfig.arxivTimeoutMs))
    logRetrieval('provider_response', { provider: this.id, status: res.status, ok: res.ok })
    if (!res.ok) throw new Error(`arXiv API ${res.status}`)
    return parseArxivFeed(await res.text())
  }

  async getById(id: { provider: 'arxiv'; externalId: string }): Promise<PaperSearchResult | null> {
    await arxivRateLimiter.acquire()
    const params = new URLSearchParams({ id_list: id.externalId, max_results: '1' })
    const url = `https://export.arxiv.org/api/query?${params.toString()}`
    logRetrieval('provider_get_by_id_request', { provider: this.id, url, externalId: id.externalId })
    const res = await fetch(url, retrievalFetchInit())
    logRetrieval('provider_get_by_id_response', { provider: this.id, status: res.status, ok: res.ok })
    if (!res.ok) throw new Error(`arXiv API ${res.status}`)
    return parseArxivFeed(await res.text())[0] ?? null
  }

}

class OpenAlexProvider implements PaperSearchProvider {
  id = 'openalex' as const
  displayName = 'OpenAlex'
  capabilities = ['keyword_search', 'title_search', 'id_lookup', 'references', 'open_access_pdf'] as PaperSearchProvider['capabilities']

  async search(query: PaperSearchQuery): Promise<PaperSearchResult[]> {
    await openAlexRateLimiter.acquire()
    const params = new URLSearchParams({ search: query.query, per_page: String(Math.min(query.maxResults, 25)) })
    const url = `https://api.openalex.org/works?${params.toString()}`
    logRetrieval('provider_request', { provider: this.id, url, query: query.query })
    const res = await fetch(url, retrievalFetchInit(paperSearchConfig.openAlexTimeoutMs))
    logRetrieval('provider_response', { provider: this.id, status: res.status, ok: res.ok })
    if (!res.ok) throw new Error(`OpenAlex API ${res.status}`)
    const json = await res.json() as { results?: OpenAlexWork[] }
    return (json.results ?? []).map(parseOpenAlexWork)
  }

  async getById(id: { provider: 'openalex'; externalId: string }): Promise<PaperSearchResult | null> {
    await openAlexRateLimiter.acquire()
    const url = `https://api.openalex.org/works/${encodeURIComponent(id.externalId)}`
    logRetrieval('provider_get_by_id_request', { provider: this.id, url, externalId: id.externalId })
    const res = await fetch(url, retrievalFetchInit())
    logRetrieval('provider_get_by_id_response', { provider: this.id, status: res.status, ok: res.ok })
    if (!res.ok) throw new Error(`OpenAlex API ${res.status}`)
    return parseOpenAlexWork(await res.json() as OpenAlexWork)
  }
}

class SemanticScholarProvider implements PaperSearchProvider {
  id = 'semantic_scholar' as const
  displayName = 'Semantic Scholar'
  capabilities = ['keyword_search', 'title_search', 'id_lookup', 'references', 'citations'] as PaperSearchProvider['capabilities']

  async search(query: PaperSearchQuery): Promise<PaperSearchResult[]> {
    await semanticScholarRateLimiter.acquire()
    const params = new URLSearchParams({
      query: query.query,
      limit: String(Math.min(query.maxResults, 20)),
      fields: 'paperId,corpusId,title,abstract,authors,year,venue,url,externalIds,citationCount,fieldsOfStudy'
    })
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?${params.toString()}`
    logRetrieval('provider_request', { provider: this.id, url, query: query.query })
    const init = retrievalFetchInit(paperSearchConfig.semanticScholarTimeoutMs)
    const apiKey = getSemanticScholarApiKey() ?? process.env.SEMANTIC_SCHOLAR_API_KEY?.trim()
    if (apiKey) init.headers = { ...(init.headers as Record<string, string> | undefined), 'x-api-key': apiKey }
    const res = await fetch(url, init)
    logRetrieval('provider_response', { provider: this.id, status: res.status, ok: res.ok })
    if (!res.ok) throw new Error(`Semantic Scholar API ${res.status}`)
    const json = await res.json() as { data?: SemanticScholarPaper[] }
    return (json.data ?? []).map(parseSemanticScholarPaper)
  }

  async getById(id: { provider: 'semantic_scholar'; externalId: string }): Promise<PaperSearchResult | null> {
    await semanticScholarRateLimiter.acquire()
    const params = new URLSearchParams({ fields: 'paperId,corpusId,title,abstract,authors,year,venue,url,externalIds,citationCount,fieldsOfStudy' })
    const url = `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(id.externalId)}?${params.toString()}`
    logRetrieval('provider_get_by_id_request', { provider: this.id, url, externalId: id.externalId })
    const res = await fetch(url, retrievalFetchInit())
    logRetrieval('provider_get_by_id_response', { provider: this.id, status: res.status, ok: res.ok })
    if (!res.ok) throw new Error(`Semantic Scholar API ${res.status}`)
    return parseSemanticScholarPaper(await res.json() as SemanticScholarPaper)
  }
}

type OpenAlexWork = {
  id: string
  doi?: string
  display_name?: string
  title?: string
  publication_year?: number
  cited_by_count?: number
  authorships?: Array<{ author?: { display_name?: string } }>
  primary_location?: { source?: { display_name?: string }; landing_page_url?: string; pdf_url?: string }
  best_oa_location?: { landing_page_url?: string; pdf_url?: string }
  concepts?: Array<{ display_name?: string }>
  topics?: Array<{ display_name?: string }>
  abstract_inverted_index?: Record<string, number[]>
}

type SemanticScholarPaper = {
  paperId: string
  corpusId?: number
  title?: string
  abstract?: string
  authors?: Array<{ name?: string }>
  year?: number
  venue?: string
  url?: string
  externalIds?: Record<string, string>
  citationCount?: number
  fieldsOfStudy?: string[]
}

export const paperSearchProviders: PaperSearchProvider[] = [
  new LocalProvider(),
  new ArxivProvider(),
  new OpenAlexProvider(),
  new SemanticScholarProvider()
]

export async function searchPapers(query: PaperSearchQuery): Promise<{
  candidates: DedupedPaperCandidate[]
  providerStatus: Array<{ provider: string; status: 'success' | 'empty' | 'error'; message: string }>
}> {
  const enabled = paperSearchProviders.filter((provider) => !query.providerHints?.length || query.providerHints.includes(provider.id))
  const allResults: PaperSearchResult[] = []
  const providerStatus: Array<{ provider: string; status: 'success' | 'empty' | 'error'; message: string }> = []

  logRetrieval('search_start', {
    query: query.query,
    nodeId: query.nodeId,
    paperId: query.paperId,
    searchQueries: query.searchQueries,
    maxResults: query.maxResults,
    requireAbstract: query.requireAbstract,
    providers: enabled.map((provider) => provider.id),
    proxyEnabled: Boolean(getLlmConfig().proxyUrl)
  })

  for (const provider of enabled) {
    try {
      logRetrieval('provider_start', { provider: provider.id, query: query.query })
      const results = await provider.search(query)
      logRetrieval('provider_success', { provider: provider.id, resultCount: results.length })
      allResults.push(...results)
      providerStatus.push({
        provider: provider.id,
        status: results.length ? 'success' : 'empty',
        message: results.length ? `找到 ${results.length} 篇可验证论文` : `${provider.displayName} 暂无结果或未启用`
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logRetrieval('provider_error', { provider: provider.id, message })
      providerStatus.push({ provider: provider.id, status: 'error', message })
    }
  }

  await paperMemoryRepository.saveSearchResults(query.query, allResults)
  const candidates = dedupeAndRankResults(query, allResults)
  logRetrieval('search_done', { rawResultCount: allResults.length, candidateCount: candidates.length, providerStatus })
  return { candidates, providerStatus }
}

function paperToResult(paper: PaperRecord): PaperSearchResult {
  const localExternal = paper.externalIds.find((external) => external.provider === 'local')
  const external = localExternal ?? paper.externalIds[0]
  return {
    id: `local_${hash(paper.id)}`,
    provider: 'local',
    source: 'local_library',
    externalId: external?.externalId ?? `local:${paper.contentHash ?? paper.id}`,
    url: paper.sourceUrl ?? paper.pdfUrl ?? paper.localPdfPath ?? `local:${paper.id}`,
    pdfUrl: paper.pdfUrl,
    title: paper.title,
    authors: paper.authors,
    year: paper.year,
    venue: paper.venue,
    abstract: paper.abstract,
    doi: paper.doi,
    arxivId: paper.arxivId,
    topicTags: [],
    raw: paper,
    fetchedAt: now()
  }
}

function parseArxivFeed(xml: string): PaperSearchResult[] {
  const entries = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)].map((match) => match[1])
  return entries.map((entry): PaperSearchResult => {
    const idUrl = xmlValue(entry, 'id')
    const arxivId = idUrl.split('/abs/')[1]?.trim() ?? idUrl.split('/').at(-1) ?? idUrl
    const pdfUrl = xmlLink(entry, 'pdf')
    return {
      id: `arxiv_${hash(arxivId)}`,
      provider: 'arxiv',
      source: 'arxiv',
      externalId: arxivId,
      url: idUrl,
      pdfUrl,
      title: cleanXmlText(xmlValue(entry, 'title')),
      authors: [...entry.matchAll(/<author\b[^>]*>[\s\S]*?<name\b[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g)].map((match) => cleanXmlText(match[1])),
      year: Number(xmlValue(entry, 'published').slice(0, 4)) || undefined,
      venue: xmlValue(entry, 'arxiv:journal_ref') || undefined,
      abstract: cleanXmlText(xmlValue(entry, 'summary')),
      doi: xmlValue(entry, 'arxiv:doi') || undefined,
      arxivId,
      topicTags: [...entry.matchAll(/<category[^>]*term="([^"]+)"/g)].map((match) => match[1]),
      raw: { entry },
      fetchedAt: now()
    }
  }).filter((paper) => paper.title && paper.url && paper.externalId)
}

function parseOpenAlexWork(work: OpenAlexWork): PaperSearchResult {
  const abstract = work.abstract_inverted_index ? reconstructOpenAlexAbstract(work.abstract_inverted_index) : undefined
  const url = work.primary_location?.landing_page_url ?? work.best_oa_location?.landing_page_url ?? work.id
  return {
    id: `openalex_${hash(work.id)}`,
    provider: 'openalex',
    source: 'openalex',
    externalId: work.id,
    url,
    pdfUrl: work.primary_location?.pdf_url ?? work.best_oa_location?.pdf_url,
    title: work.display_name ?? work.title ?? work.id,
    authors: work.authorships?.map((item) => item.author?.display_name).filter((item): item is string => Boolean(item)) ?? [],
    year: work.publication_year,
    venue: work.primary_location?.source?.display_name,
    abstract,
    doi: work.doi,
    openAlexId: work.id,
    citedByCount: work.cited_by_count,
    topicTags: [...(work.topics ?? []), ...(work.concepts ?? [])].map((item) => item.display_name).filter((item): item is string => Boolean(item)),
    raw: work,
    fetchedAt: now()
  }
}

function parseSemanticScholarPaper(paper: SemanticScholarPaper): PaperSearchResult {
  return {
    id: `s2_${hash(paper.paperId)}`,
    provider: 'semantic_scholar',
    source: 'semantic_scholar',
    externalId: paper.paperId,
    url: paper.url ?? `https://www.semanticscholar.org/paper/${paper.paperId}`,
    title: paper.title ?? paper.paperId,
    authors: paper.authors?.map((author) => author.name).filter((item): item is string => Boolean(item)) ?? [],
    year: paper.year,
    venue: paper.venue,
    abstract: paper.abstract,
    doi: paper.externalIds?.DOI,
    arxivId: paper.externalIds?.ArXiv,
    semanticScholarPaperId: paper.paperId,
    corpusId: paper.corpusId ? String(paper.corpusId) : undefined,
    citedByCount: paper.citationCount,
    topicTags: paper.fieldsOfStudy ?? [],
    raw: paper,
    fetchedAt: now()
  }
}

function xmlValue(xml: string, tag: string): string {
  const escaped = tag.replace(':', '\\:')
  return xml.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`))?.[1]?.trim() ?? ''
}

function xmlLink(xml: string, title: string): string | undefined {
  return xml.match(new RegExp(`<link[^>]*title="${title}"[^>]*href="([^"]+)"[^>]*/?>`))?.[1]
}

function cleanXmlText(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
}

function reconstructOpenAlexAbstract(index: Record<string, number[]>): string {
  const words: Array<{ word: string; pos: number }> = []
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) words.push({ word, pos })
  }
  return words.sort((a, b) => a.pos - b.pos).map((item) => item.word).join(' ')
}

export const __testing = {
  buildArxivSearchQuery,
  paperSearchConfig
}
