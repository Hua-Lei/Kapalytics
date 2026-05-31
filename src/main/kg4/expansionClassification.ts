import type { ExpansionIntent, ExpansionNodeClassification, ExpansionPath, ExpansionPrimaryType } from '../../shared/kg4'

const PRIMARY_TYPES = ['field', 'problem', 'concept', 'method', 'paper', 'unknown'] as const satisfies readonly ExpansionPrimaryType[]
const EXPANSION_PATHS = [
  'learn_concept',
  'track_method_lineage',
  'explore_research_area',
  'review_related_papers',
  'inspect_paper_evidence'
] as const satisfies readonly ExpansionPath[]

type ClassificationInput = Record<string, unknown>

const FALLBACK_RATIONALE = 'Unable to confidently classify expansion target; using related paper review.'

export function normalizeExpansionClassification(
  value: unknown,
  { nodeLabel }: { nodeLabel: string }
): ExpansionNodeClassification {
  if (!isRecord(value)) return fallbackClassification()

  if (value.kind === 'algorithm_method_lineage' || value.kind === 'generic_related_papers') {
    return normalizeLegacyIntent(value, nodeLabel)
  }

  const suggestedPrimaryType = readPrimaryType(value.primaryType)
  const confidence = readConfidence(value.confidence, 0)
  const rationale = readString(value.rationale) ?? FALLBACK_RATIONALE

  if (confidence < 0.5) {
    return {
      primaryType: 'unknown',
      facets: dedupeStrings(value.facets),
      confidence,
      rationale,
      recommendedPath: 'review_related_papers',
      alternativePaths: defaultAlternativePaths('unknown'),
      ambiguity: suggestedPrimaryType && suggestedPrimaryType !== 'unknown'
        ? {
            competingType: suggestedPrimaryType,
            reason: `Low confidence classification for ${nodeLabel}.`
          }
        : undefined
    }
  }

  const primaryType = suggestedPrimaryType ?? 'unknown'
  const recommendedPath = primaryType === 'unknown'
    ? 'review_related_papers'
    : readExpansionPath(value.recommendedPath) ?? defaultRecommendedPath(primaryType)

  return {
    primaryType,
    facets: dedupeStrings(value.facets),
    confidence,
    rationale,
    recommendedPath,
    alternativePaths: normalizeAlternativePaths(value.alternativePaths, primaryType, recommendedPath),
    ambiguity: normalizeAmbiguity(value.ambiguity)
  }
}

export function classificationToLegacyIntent(
  classification: ExpansionNodeClassification,
  nodeLabel = 'method lineage'
): ExpansionIntent {
  if (
    classification.primaryType === 'method' &&
    classification.recommendedPath === 'track_method_lineage' &&
    classification.confidence >= 0.5
  ) {
    return {
      kind: 'algorithm_method_lineage',
      confidence: classification.confidence,
      queryFocus: nodeLabel,
      rationale: classification.rationale
    }
  }

  const intent: ExpansionIntent = {
    kind: 'generic_related_papers',
    confidence: classification.confidence,
    queryFocus: 'related papers',
    rationale: classification.rationale
  }

  if (classification.primaryType === 'unknown') {
    intent.fallbackReason = classification.ambiguity?.reason ?? 'Classification is unknown; using related papers.'
  }

  return intent
}

function normalizeLegacyIntent(value: ClassificationInput, nodeLabel: string): ExpansionNodeClassification {
  const confidence = readConfidence(value.confidence, 0)
  const rationale = readString(value.rationale) ?? FALLBACK_RATIONALE
  const lowConfidenceLineage = value.kind === 'algorithm_method_lineage' && confidence < 0.6

  if (confidence < 0.5 || lowConfidenceLineage) {
    return {
      primaryType: 'unknown',
      facets: [],
      confidence,
      rationale,
      recommendedPath: 'review_related_papers',
      alternativePaths: defaultAlternativePaths('unknown'),
      ambiguity: lowConfidenceLineage
        ? {
            competingType: 'method',
            reason: `Low confidence classification for ${nodeLabel}.`
          }
        : undefined
    }
  }

  if (value.kind === 'algorithm_method_lineage') {
    return {
      primaryType: 'method',
      facets: [],
      confidence,
      rationale,
      recommendedPath: 'track_method_lineage',
      alternativePaths: ['review_related_papers']
    }
  }

  return {
    primaryType: 'unknown',
    facets: [],
    confidence,
    rationale,
    recommendedPath: 'review_related_papers',
    alternativePaths: defaultAlternativePaths('unknown')
  }
}

function fallbackClassification(): ExpansionNodeClassification {
  return {
    primaryType: 'unknown',
    facets: [],
    confidence: 0,
    rationale: FALLBACK_RATIONALE,
    recommendedPath: 'review_related_papers',
    alternativePaths: defaultAlternativePaths('unknown')
  }
}

function normalizeAlternativePaths(value: unknown, primaryType: ExpansionPrimaryType, recommendedPath: ExpansionPath): ExpansionPath[] {
  const paths = Array.isArray(value)
    ? value.filter((path): path is ExpansionPath => readExpansionPath(path) !== undefined)
    : []
  const uniquePaths = [...new Set(paths)].filter((path) => path !== recommendedPath)
  return uniquePaths.length ? uniquePaths : defaultAlternativePaths(primaryType).filter((path) => path !== recommendedPath)
}

function normalizeAmbiguity(value: unknown): ExpansionNodeClassification['ambiguity'] {
  if (!isRecord(value)) return undefined
  const competingType = readPrimaryType(value.competingType)
  const reason = readString(value.reason)
  return competingType && reason ? { competingType, reason } : undefined
}

function defaultRecommendedPath(primaryType: ExpansionPrimaryType): ExpansionPath {
  if (primaryType === 'concept') return 'learn_concept'
  if (primaryType === 'method') return 'track_method_lineage'
  if (primaryType === 'field' || primaryType === 'problem') return 'explore_research_area'
  if (primaryType === 'paper') return 'inspect_paper_evidence'
  return 'review_related_papers'
}

function defaultAlternativePaths(primaryType: ExpansionPrimaryType): ExpansionPath[] {
  if (primaryType === 'concept') return ['review_related_papers']
  if (primaryType === 'method') return ['review_related_papers', 'inspect_paper_evidence']
  if (primaryType === 'field' || primaryType === 'problem') return ['review_related_papers', 'learn_concept']
  if (primaryType === 'paper') return ['review_related_papers']
  return ['learn_concept', 'track_method_lineage', 'explore_research_area']
}

function readPrimaryType(value: unknown): ExpansionPrimaryType | undefined {
  return PRIMARY_TYPES.includes(value as ExpansionPrimaryType) ? value as ExpansionPrimaryType : undefined
}

function readExpansionPath(value: unknown): ExpansionPath | undefined {
  return EXPANSION_PATHS.includes(value as ExpansionPath) ? value as ExpansionPath : undefined
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readConfidence(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
}

function dedupeStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim()))]
    : []
}

function isRecord(value: unknown): value is ClassificationInput {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
