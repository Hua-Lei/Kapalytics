import { ProxyAgent } from 'undici'
import { getLlmConfig, getSemanticScholarApiKey } from '../llm/client'

export interface EnrichedMetadata {
  paperId: string
  corpusId?: number
  title?: string
  year?: number
  venue?: string
  publicationVenue?: string
  citationCount?: number
  influentialCitationCount?: number
  referenceCount?: number
  fieldsOfStudy?: string[]
  isOpenAccess?: boolean
}

type FetchInit = RequestInit & { dispatcher?: ProxyAgent }

const BATCH_SIZE = 10
const BATCH_TIMEOUT_MS = 30000

const cache = new Map<string, EnrichedMetadata | null>()

function fetchInit(timeoutMs = BATCH_TIMEOUT_MS): FetchInit {
  const init: FetchInit = { signal: AbortSignal.timeout(timeoutMs) }
  const proxyUrl = getLlmConfig().proxyUrl
  if (proxyUrl) init.dispatcher = new ProxyAgent(proxyUrl)
  return init
}

async function fetchBatch(ids: string[]): Promise<unknown[]> {
  const params = new URLSearchParams({
    fields: 'paperId,corpusId,title,year,venue,publicationVenue,citationCount,influentialCitationCount,referenceCount,fieldsOfStudy,isOpenAccess'
  })
  const url = `https://api.semanticscholar.org/graph/v1/paper/batch?${params.toString()}`
  const init = fetchInit()
  const apiKey = getSemanticScholarApiKey()
  if (apiKey) init.headers = { ...(init.headers as Record<string, string> | undefined), 'x-api-key': apiKey }
  const res = await fetch(url, { ...init, method: 'POST', body: JSON.stringify({ ids }), headers: { ...(init.headers as Record<string, string> | undefined), 'Content-Type': 'application/json' } })
  if (!res.ok) throw new Error(`Semantic Scholar batch API ${res.status}`)
  const json = await res.json() as unknown[]
  return Array.isArray(json) ? json : []
}

function normalizeEnriched(item: unknown): EnrichedMetadata | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null
  const obj = item as Record<string, unknown>
  const paperId = typeof obj.paperId === 'string' && obj.paperId.trim() ? obj.paperId.trim() : null
  if (!paperId) return null
  return {
    paperId,
    corpusId: typeof obj.corpusId === 'number' ? obj.corpusId : undefined,
    title: typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : undefined,
    year: typeof obj.year === 'number' ? obj.year : undefined,
    venue: typeof obj.venue === 'string' && obj.venue.trim() ? obj.venue.trim() : undefined,
    publicationVenue: typeof obj.publicationVenue === 'string' && obj.publicationVenue.trim() ? obj.publicationVenue.trim() : undefined,
    citationCount: typeof obj.citationCount === 'number' ? obj.citationCount : undefined,
    influentialCitationCount: typeof obj.influentialCitationCount === 'number' ? obj.influentialCitationCount : undefined,
    referenceCount: typeof obj.referenceCount === 'number' ? obj.referenceCount : undefined,
    fieldsOfStudy: Array.isArray(obj.fieldsOfStudy) ? obj.fieldsOfStudy.filter((f): f is string => typeof f === 'string') : undefined,
    isOpenAccess: typeof obj.isOpenAccess === 'boolean' ? obj.isOpenAccess : undefined
  }
}

export async function enrichCandidatesWithSemanticScholar(
  candidates: Array<{ canonicalId: string; semanticScholarId?: string }>,
  options: { signal?: AbortSignal } = {}
): Promise<Map<string, EnrichedMetadata>> {
  const result = new Map<string, EnrichedMetadata>()
  const needsFetch: string[] = []

  for (const candidate of candidates) {
    const s2Id = candidate.semanticScholarId
    if (!s2Id) continue
    if (cache.has(s2Id)) {
      const cached = cache.get(s2Id)
      if (cached) result.set(candidate.canonicalId, cached)
      continue
    }
    needsFetch.push(s2Id)
  }

  for (let i = 0; i < needsFetch.length; i += BATCH_SIZE) {
    if (options.signal?.aborted) break
    const batch = needsFetch.slice(i, i + BATCH_SIZE)
    try {
      const items = await fetchBatch(batch)
      for (const item of items) {
        const enriched = normalizeEnriched(item)
        if (enriched) {
          cache.set(enriched.paperId, enriched)
          for (const candidate of candidates) {
            if (candidate.semanticScholarId === enriched.paperId) {
              result.set(candidate.canonicalId, enriched)
              break
            }
          }
        }
      }
    } catch (err) {
      console.warn('[S2 metadata] batch fetch failed', err)
      for (const id of batch) {
        cache.set(id, null)
      }
    }
  }

  return result
}

export function clearMetadataCache(): void {
  cache.clear()
}
