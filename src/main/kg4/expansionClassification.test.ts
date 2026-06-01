import assert from 'node:assert/strict'
import { classificationToLegacyIntent, normalizeExpansionClassification } from './expansionClassification'

const concept = normalizeExpansionClassification({
  primaryType: 'concept',
  facets: ['method_component', 'parameter_efficient_finetuning'],
  confidence: 0.91,
  rationale: 'LoRA is a reusable mechanism with a clear mathematical definition.',
  recommendedPath: 'learn_concept',
  alternativePaths: ['track_method_lineage', 'review_related_papers']
}, { nodeLabel: 'LoRA' })

assert.equal(concept.primaryType, 'concept')
assert.equal(concept.recommendedPath, 'learn_concept')
assert.deepEqual(concept.facets, ['method_component', 'parameter_efficient_finetuning'])

const paperSpecificMethod = normalizeExpansionClassification({
  primaryType: 'method',
  facets: ['paper_specific', 'context_distillation'],
  confidence: 0.86,
  rationale: 'The node is a specific method title, not a broad field.',
  recommendedPath: 'track_method_lineage',
  alternativePaths: ['learn_concept', 'inspect_paper_evidence']
}, { nodeLabel: 'Meta-Learned Context Distillation for LLMs' })

assert.equal(paperSpecificMethod.primaryType, 'method')
assert.ok(paperSpecificMethod.facets.includes('paper_specific'))
assert.equal(classificationToLegacyIntent(paperSpecificMethod).kind, 'algorithm_method_lineage')

const lowConfidence = normalizeExpansionClassification({
  primaryType: 'method',
  facets: [],
  confidence: 0.34,
  rationale: 'Weak signal.',
  recommendedPath: 'track_method_lineage',
  alternativePaths: []
}, { nodeLabel: 'Unclear Node' })

assert.equal(lowConfidence.primaryType, 'unknown')
assert.equal(lowConfidence.recommendedPath, 'review_related_papers')
assert.equal(lowConfidence.ambiguity?.competingType, 'method')

const legacyLineage = normalizeExpansionClassification({
  kind: 'algorithm_method_lineage',
  confidence: 0.84,
  queryFocus: 'hypernetwork meta-learning',
  rationale: 'The node describes a concrete algorithmic method.'
}, { nodeLabel: 'Hypernetwork' })

assert.equal(legacyLineage.primaryType, 'method')
assert.equal(legacyLineage.recommendedPath, 'track_method_lineage')
assert.equal(classificationToLegacyIntent(legacyLineage, 'Hypernetwork').queryFocus, 'Hypernetwork')

const lowConfidenceLegacyLineage = normalizeExpansionClassification({
  kind: 'algorithm_method_lineage',
  confidence: 0.34,
  queryFocus: 'uncertain method',
  rationale: 'The legacy classifier was not confident.'
}, { nodeLabel: 'Uncertain Method' })

assert.equal(lowConfidenceLegacyLineage.primaryType, 'unknown')
assert.equal(lowConfidenceLegacyLineage.recommendedPath, 'review_related_papers')
assert.equal(lowConfidenceLegacyLineage.ambiguity?.competingType, 'method')

const borderlineLegacyLineage = normalizeExpansionClassification({
  kind: 'algorithm_method_lineage',
  confidence: 0.55,
  queryFocus: 'borderline method',
  rationale: 'The legacy classifier is below the lineage cutoff.'
}, { nodeLabel: 'Borderline Method' })

assert.equal(borderlineLegacyLineage.primaryType, 'unknown')
assert.equal(borderlineLegacyLineage.recommendedPath, 'review_related_papers')
assert.equal(borderlineLegacyLineage.ambiguity?.competingType, 'method')

const malformedLegacyConfidence = normalizeExpansionClassification({
  kind: 'algorithm_method_lineage',
  confidence: 85,
  queryFocus: 'overconfident method',
  rationale: 'The legacy classifier returned a percentage-like confidence.'
}, { nodeLabel: 'Overconfident Method' })

assert.equal(malformedLegacyConfidence.primaryType, 'unknown')
assert.equal(malformedLegacyConfidence.confidence, 0)
assert.equal(malformedLegacyConfidence.recommendedPath, 'review_related_papers')
assert.equal(malformedLegacyConfidence.ambiguity?.competingType, 'method')
assert.equal(classificationToLegacyIntent(malformedLegacyConfidence, 'Overconfident Method').kind, 'generic_related_papers')

const malformedNegativeConfidence = normalizeExpansionClassification({
  primaryType: 'method',
  facets: [],
  confidence: -0.2,
  rationale: 'The classifier returned a negative confidence.',
  recommendedPath: 'track_method_lineage',
  alternativePaths: []
}, { nodeLabel: 'Negative Confidence Method' })

assert.equal(malformedNegativeConfidence.primaryType, 'unknown')
assert.equal(malformedNegativeConfidence.confidence, 0)
assert.equal(malformedNegativeConfidence.recommendedPath, 'review_related_papers')
assert.equal(malformedNegativeConfidence.ambiguity?.competingType, 'method')

const explicitUnknown = normalizeExpansionClassification({
  primaryType: 'unknown',
  facets: [],
  confidence: 0.82,
  rationale: 'The classifier could not identify a stable node type.',
  recommendedPath: 'learn_concept',
  alternativePaths: ['track_method_lineage']
}, { nodeLabel: 'Mystery Node' })

assert.equal(explicitUnknown.primaryType, 'unknown')
assert.equal(explicitUnknown.recommendedPath, 'review_related_papers')

const filteredAlternatives = normalizeExpansionClassification({
  primaryType: 'concept',
  facets: [],
  confidence: 0.88,
  rationale: 'The node is a reusable concept.',
  recommendedPath: 'learn_concept',
  alternativePaths: ['learn_concept', 'track_method_lineage', 'track_method_lineage']
}, { nodeLabel: 'Adapter Layer' })

assert.equal(filteredAlternatives.recommendedPath, 'learn_concept')
assert.deepEqual(filteredAlternatives.alternativePaths, ['track_method_lineage'])

const malformed = normalizeExpansionClassification(null, { nodeLabel: 'Unknown Thing' })
assert.equal(malformed.primaryType, 'unknown')
assert.equal(malformed.recommendedPath, 'review_related_papers')
assert.deepEqual(malformed.alternativePaths, ['learn_concept', 'track_method_lineage', 'explore_research_area'])

const malformedLegacyIntent = classificationToLegacyIntent(malformed, 'Unknown Thing')
assert.equal(malformedLegacyIntent.kind, 'generic_related_papers')
assert.equal(malformedLegacyIntent.queryFocus, 'related papers')
assert.equal(malformedLegacyIntent.fallbackReason, 'Classification is unknown; using related papers.')

const methodEvolutionHint = normalizeExpansionClassification(null, {
  nodeLabel: 'Hypernetwork Adapter',
  nodeType: 'method',
  expansionType: 'method_evolution'
})

assert.equal(methodEvolutionHint.primaryType, 'method')
assert.equal(methodEvolutionHint.recommendedPath, 'track_method_lineage')
assert.equal(classificationToLegacyIntent(methodEvolutionHint, 'Hypernetwork Adapter').kind, 'algorithm_method_lineage')
assert.ok(methodEvolutionHint.alternativePaths.includes('review_related_papers'))

const lowConfidenceMethodWithExpansionHint = normalizeExpansionClassification({
  primaryType: 'method',
  facets: [],
  confidence: 0.34,
  rationale: 'Weak model-side signal.',
  recommendedPath: 'review_related_papers',
  alternativePaths: []
}, {
  nodeLabel: 'Hypernetwork Adapter',
  nodeType: 'method',
  expansionType: 'method_evolution'
})

assert.equal(lowConfidenceMethodWithExpansionHint.primaryType, 'method')
assert.equal(lowConfidenceMethodWithExpansionHint.recommendedPath, 'track_method_lineage')
assert.equal(classificationToLegacyIntent(lowConfidenceMethodWithExpansionHint, 'Hypernetwork Adapter').kind, 'algorithm_method_lineage')

console.log('expansionClassification tests passed')
