import type { DedupedPaperCandidate } from '../../shared/kg3'

export interface CompactLineagePaper {
  id: string
  title: string
  year?: number
  sources: string[]
  abstract?: string
}

function shortText(value: string | undefined, maxLength: number): string | undefined {
  const normalized = value?.replace(/\s+/g, ' ').trim()
  if (!normalized) return undefined
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
}

export function compactRetrievedPapersForLineage(papers: DedupedPaperCandidate[]): CompactLineagePaper[] {
  return papers.map((paper) => ({
    id: paper.canonicalId,
    title: paper.title,
    year: paper.year,
    sources: paper.sources,
    abstract: shortText(paper.abstract, 700)
  }))
}
