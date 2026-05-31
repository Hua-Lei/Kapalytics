import type { DedupedPaperCandidate, PaperSearchResult } from '../../shared/kg3'
import type { PaperBadge, PaperQualitySignal, RelatedPaperRecommendation } from '../../shared/kg4'

const TOP_VENUES = new Set([
  'NEURIPS',
  'NIPS',
  'ICML',
  'ICLR',
  'ACL',
  'EMNLP',
  'NAACL',
  'COLING',
  'CVPR',
  'ICCV',
  'ECCV',
  'SIGIR',
  'WWW',
  'KDD',
  'WSDM',
  'AAAI',
  'IJCAI'
])

const STRONG_VENUES = new Set([
  'AISTATS',
  'UAI',
  'COLT',
  'ICASSP',
  'INTERSPEECH',
  'RECSYS',
  'CIKM'
])

const UNKNOWN_VENUES = new Set(['ARXIV', 'CORR', 'PREPRINT', 'UNKNOWN', ''])

export function annotatePaperQuality(
  candidates: DedupedPaperCandidate[],
  options: { nowYear?: number } = {}
): PaperQualitySignal[] {
  const nowYear = options.nowYear ?? new Date().getFullYear()
  return candidates.map((candidate) => annotateCandidate(candidate, nowYear))
}

export function buildRelatedPaperRecommendations(
  candidates: DedupedPaperCandidate[],
  signals: PaperQualitySignal[]
): RelatedPaperRecommendation[] {
  const signalByPaperId = new Map(signals.map((signal) => [signal.paperId, signal]))

  return candidates
    .map((candidate, index) => {
      const qualitySignal = signalByPaperId.get(candidate.canonicalId)
      const recommendation: RelatedPaperRecommendation = {
        paperId: candidate.canonicalId,
        title: candidate.title,
        year: candidate.year ?? newestYear(candidate.mergedFrom),
        venue: representativeVenue(candidate.mergedFrom),
        sources: [...candidate.sources],
        citationCount: citationCount(candidate.mergedFrom),
        qualitySignal,
        whyRecommended: recommendationReason(qualitySignal),
        relevanceSummary: shortText(candidate.abstract ?? firstAbstract(candidate.mergedFrom), 180) ?? `Related paper: ${candidate.title}`,
        bestUrl: candidate.bestUrl,
        bestPdfUrl: candidate.bestPdfUrl ?? firstPdfUrl(candidate.mergedFrom)
      }

      return {
        index,
        recommendation,
        rank: recommendationRank(candidate, qualitySignal)
      }
    })
    .sort((left, right) => right.rank - left.rank || left.index - right.index)
    .map((item) => item.recommendation)
}

function annotateCandidate(candidate: DedupedPaperCandidate, nowYear: number): PaperQualitySignal {
  const badges: PaperBadge[] = []
  const reasons: string[] = []
  const warnings: string[] = []
  const citations = citationCount(candidate.mergedFrom) ?? 0
  const year = candidate.year ?? newestYear(candidate.mergedFrom)
  const age = year === undefined ? undefined : nowYear - year
  const recent = age !== undefined && age >= 0 && age <= 2
  const venueTier = bestVenueTier(candidate.mergedFrom)
  const unknownVenue = !hasKnownVenue(candidate.mergedFrom)
  const text = searchableText(candidate)

  if (venueTier === 'top') {
    badges.push('top_venue')
    reasons.push('Top venue signal')
  } else if (venueTier === 'strong') {
    badges.push('strong_venue')
    reasons.push('Strong venue signal')
  }

  if (citations >= 500) {
    badges.push('highly_cited')
    reasons.push(`高引用 ${citations}`)
  }

  if (recent) {
    badges.push('recent')
    reasons.push('Recent work')
  }

  if (recent && citations >= 100) {
    badges.push('recent_hot')
    reasons.push('Recent hot paper')
  }

  if (containsSurveySignal(text)) {
    badges.push('survey')
    reasons.push('Survey/review paper')
  }

  if (containsBenchmarkSignal(text)) {
    badges.push('benchmark')
    reasons.push('Benchmark-oriented paper')
  }

  if (candidate.bestPdfUrl || candidate.mergedFrom.some((result) => Boolean(result.pdfUrl))) {
    badges.push('open_access')
    reasons.push('Open access PDF available')
  }

  if (candidate.sources.includes('local_library')) {
    badges.push('local_library')
    reasons.push('Local library match')
  }

  if (unknownVenue) {
    badges.push('unknown_venue')
    warnings.push('Venue is missing, arXiv-only, or unknown')
  }

  if (recent && unknownVenue && citations < 20) {
    badges.push('needs_review')
    warnings.push('Recent low-citation paper needs manual quality review')
  }

  return {
    paperId: candidate.canonicalId,
    qualityScore: clamp(qualityScore({ citations, recent, venueTier, unknownVenue, needsReview: badges.includes('needs_review'), survey: badges.includes('survey'), openAccess: badges.includes('open_access') })),
    trendScore: clamp(trendScore({ citations, recent, age, unknownVenue })),
    badges: unique(badges),
    reasons: unique(reasons),
    warnings: unique(warnings)
  }
}

function qualityScore(input: {
  citations: number
  recent: boolean
  venueTier?: 'top' | 'strong'
  unknownVenue: boolean
  needsReview: boolean
  survey: boolean
  openAccess: boolean
}): number {
  let score = 0.25
  if (input.venueTier === 'top') score += 0.35
  if (input.venueTier === 'strong') score += 0.24
  score += citationQuality(input.citations)
  if (input.survey) score += 0.06
  if (input.openAccess) score += 0.03
  if (input.recent) score += 0.03
  if (input.unknownVenue) score -= 0.12
  if (input.needsReview) score -= 0.14
  return score
}

function trendScore(input: { citations: number; recent: boolean; age?: number; unknownVenue: boolean }): number {
  let score = 0.2
  if (input.recent) score += 0.45
  if (input.age !== undefined && input.age >= 0 && input.age <= 5) score += Math.max(0, (5 - input.age) / 5) * 0.15
  score += citationTrend(input.citations)
  if (input.unknownVenue) score -= 0.05
  return score
}

function citationQuality(citations: number): number {
  if (citations >= 5000) return 0.3
  if (citations >= 1000) return 0.25
  if (citations >= 500) return 0.2
  if (citations >= 100) return 0.12
  if (citations >= 20) return 0.06
  return 0
}

function citationTrend(citations: number): number {
  if (citations >= 1000) return 0.25
  if (citations >= 500) return 0.2
  if (citations >= 100) return 0.16
  if (citations >= 20) return 0.08
  return 0
}

function recommendationRank(candidate: DedupedPaperCandidate, signal: PaperQualitySignal | undefined): number {
  return (signal?.qualityScore ?? 0) * 0.7 + (signal?.trendScore ?? 0) * 0.2 + candidate.score * 0.1
}

function recommendationReason(signal: PaperQualitySignal | undefined): string {
  if (!signal) return '代表性相关论文，等待质量信号补充'

  const parts: string[] = []
  if (signal.badges.includes('top_venue')) parts.push('Top venue，代表性强')
  if (signal.badges.includes('highly_cited')) parts.push('高引用，社区影响力强')
  if (signal.badges.includes('strong_venue')) parts.push('Strong venue，质量信号较好')
  if (signal.badges.includes('survey')) parts.push('Survey/综述，适合作为背景入口')
  if (signal.badges.includes('recent_hot')) parts.push('近期高热度')
  else if (signal.badges.includes('recent')) parts.push('近期工作，适合追踪新方向')
  if (signal.badges.includes('needs_review')) parts.push('需人工复核')

  return parts.length ? parts.slice(0, 3).join('；') : '代表性相关论文'
}

function bestVenueTier(results: PaperSearchResult[]): 'top' | 'strong' | undefined {
  const venueTokens = results.flatMap((result) => venueTokensFor(result.venue))
  if (venueTokens.some((token) => TOP_VENUES.has(token))) return 'top'
  if (venueTokens.some((token) => STRONG_VENUES.has(token))) return 'strong'
  return undefined
}

function hasKnownVenue(results: PaperSearchResult[]): boolean {
  return results.some((result) => {
    const tokens = venueTokensFor(result.venue)
    return tokens.length > 0 && !tokens.every((token) => UNKNOWN_VENUES.has(token))
  })
}

function representativeVenue(results: PaperSearchResult[]): string | undefined {
  return results.find((result) => {
    const tokens = venueTokensFor(result.venue)
    return tokens.length > 0 && !tokens.every((token) => UNKNOWN_VENUES.has(token))
  })?.venue?.trim() ?? results.find((result) => result.venue?.trim())?.venue?.trim()
}

function venueTokensFor(venue: string | undefined): string[] {
  if (!venue?.trim()) return []
  return venue
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function citationCount(results: PaperSearchResult[]): number | undefined {
  const counts = results
    .map((result) => result.citedByCount)
    .filter((count): count is number => typeof count === 'number' && Number.isFinite(count) && count >= 0)
  return counts.length ? Math.max(...counts) : undefined
}

function newestYear(results: PaperSearchResult[]): number | undefined {
  const years = results
    .map((result) => result.year)
    .filter((year): year is number => typeof year === 'number' && Number.isFinite(year))
  return years.length ? Math.max(...years) : undefined
}

function searchableText(candidate: DedupedPaperCandidate): string {
  const mergedText = candidate.mergedFrom.flatMap((result) => [result.title, result.abstract, result.venue, ...result.topicTags])
  return [candidate.title, candidate.abstract, ...mergedText].filter(Boolean).join(' ')
}

function containsSurveySignal(text: string): boolean {
  return /\b(survey|review|reviews)\b|综述/i.test(text)
}

function containsBenchmarkSignal(text: string): boolean {
  return /\b(benchmark|leaderboard|dataset)\b|基准/i.test(text)
}

function firstAbstract(results: PaperSearchResult[]): string | undefined {
  return results.find((result) => result.abstract?.trim())?.abstract
}

function firstPdfUrl(results: PaperSearchResult[]): string | undefined {
  return results.find((result) => result.pdfUrl?.trim())?.pdfUrl
}

function shortText(value: string | undefined, maxLength: number): string | undefined {
  const normalized = value?.replace(/\s+/g, ' ').trim()
  if (!normalized) return undefined
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
}

function unique<T extends string>(items: T[]): T[] {
  return [...new Set(items)]
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}
