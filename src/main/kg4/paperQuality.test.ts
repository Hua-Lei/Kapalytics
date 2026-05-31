import assert from 'node:assert/strict'
import type { DedupedPaperCandidate, PaperSearchResult } from '../../shared/kg3'
import { isKg4NodeExpansionRecord } from '../../shared/kg4'
import { annotatePaperQuality, buildRelatedPaperRecommendations } from './paperQuality'

function result(overrides: Partial<PaperSearchResult>): PaperSearchResult {
  return {
    id: overrides.id ?? 'r1',
    provider: overrides.provider ?? 'openalex',
    source: overrides.source ?? 'openalex',
    externalId: overrides.externalId ?? 'ext1',
    url: overrides.url ?? 'https://example.test/paper',
    title: overrides.title ?? 'Paper',
    authors: overrides.authors ?? [],
    year: overrides.year,
    venue: overrides.venue,
    abstract: overrides.abstract,
    citedByCount: overrides.citedByCount,
    topicTags: overrides.topicTags ?? [],
    raw: overrides.raw ?? {},
    fetchedAt: overrides.fetchedAt ?? new Date('2026-05-31T00:00:00.000Z').toISOString(),
    pdfUrl: overrides.pdfUrl,
    doi: overrides.doi,
    arxivId: overrides.arxivId,
    semanticScholarPaperId: overrides.semanticScholarPaperId,
    openAlexId: overrides.openAlexId,
    corpusId: overrides.corpusId,
    referenceIds: overrides.referenceIds
  }
}

function candidate(id: string, title: string, mergedFrom: PaperSearchResult[]): DedupedPaperCandidate {
  return {
    canonicalId: id,
    mergedFrom,
    title,
    authors: [],
    year: mergedFrom[0]?.year,
    sources: mergedFrom.map((item) => item.source),
    externalIds: [],
    bestUrl: 'https://example.test/paper',
    bestPdfUrl: mergedFrom.find((item) => item.pdfUrl)?.pdfUrl,
    abstract: mergedFrom[0]?.abstract,
    score: 0.8
  }
}

const topVenue = candidate('paper-top', 'LoRA: Low-Rank Adaptation of Large Language Models', [result({ venue: 'ICLR', year: 2022, citedByCount: 6500, abstract: 'LoRA adapts large language models with low rank updates.' })])
const recentArxiv = candidate('paper-recent', 'A Very New Context Distillation Method', [result({ provider: 'arxiv', source: 'arxiv', venue: undefined, year: 2026, citedByCount: 0, abstract: 'A new context distillation method.' })])
const survey = candidate('paper-survey', 'A Survey of Parameter Efficient Fine-Tuning', [result({ venue: 'arXiv', year: 2024, citedByCount: 80, abstract: 'This survey reviews parameter efficient fine-tuning methods.' })])

const signals = annotatePaperQuality([topVenue, recentArxiv, survey], { nowYear: 2026 })
const topSignal = signals.find((item) => item.paperId === 'paper-top')
assert.ok(topSignal?.badges.includes('top_venue'))
assert.ok(topSignal?.badges.includes('highly_cited'))
assert.ok((topSignal?.qualityScore ?? 0) > 0.8)

const recentSignal = signals.find((item) => item.paperId === 'paper-recent')
assert.ok(recentSignal?.badges.includes('recent'))
assert.ok(recentSignal?.badges.includes('unknown_venue'))
assert.ok(recentSignal?.badges.includes('needs_review'))
assert.ok((recentSignal?.trendScore ?? 0) > (recentSignal?.qualityScore ?? 0))

const surveySignal = signals.find((item) => item.paperId === 'paper-survey')
assert.ok(surveySignal?.badges.includes('survey'))

const fullNameVenueSignals = annotatePaperQuality([
  candidate('paper-icml-full', 'Full ICML Venue Name', [result({ venue: 'International Conference on Machine Learning', year: 2020, citedByCount: 120 })]),
  candidate('paper-neurips-full', 'Full NeurIPS Venue Name', [result({ venue: 'Conference on Neural Information Processing Systems', year: 2020, citedByCount: 120 })]),
  candidate('paper-cvpr-full', 'Full CVPR Venue Name', [result({ venue: 'IEEE/CVF Conference on Computer Vision and Pattern Recognition', year: 2020, citedByCount: 120 })])
], { nowYear: 2026 })
assert.ok(fullNameVenueSignals.every((item) => item.badges.includes('top_venue')))

const invalidMetadata = candidate('paper-invalid-metadata', 'Invalid Metadata Paper', [result({ venue: 'ICLR', year: 1899.5, citedByCount: 12.7, abstract: 'Invalid metadata should not leak into recommendations.' })])
const invalidMetadataRecommendations = buildRelatedPaperRecommendations(
  [invalidMetadata],
  annotatePaperQuality([invalidMetadata], { nowYear: 2026 })
)
assert.equal(invalidMetadataRecommendations[0].year, undefined)
assert.equal(invalidMetadataRecommendations[0].citationCount, undefined)
assert.equal(isKg4NodeExpansionRecord({
  id: 'record-invalid-metadata',
  paperId: 'paper-anchor',
  nodeId: 'node-anchor',
  retrievedPaperIds: [],
  algorithmIdeaCards: [],
  expansionGraphNodes: [],
  expansionGraphEdges: [],
  relatedPaperRecommendations: invalidMetadataRecommendations,
  dataCompleteness: 'partial',
  missingDataReasons: [],
  generatedByJobIds: [],
  createdAt: new Date('2026-05-31T00:00:00.000Z').toISOString(),
  updatedAt: new Date('2026-05-31T00:00:00.000Z').toISOString()
}), true)

const recommendations = buildRelatedPaperRecommendations([topVenue, recentArxiv], signals)
assert.equal(recommendations[0].paperId, 'paper-top')
assert.match(recommendations[0].whyRecommended, /Top venue|高引用|代表性/)
assert.ok(recommendations[0].qualitySignal)

console.log('paperQuality tests passed')
