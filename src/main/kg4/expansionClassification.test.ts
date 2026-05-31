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

const malformed = normalizeExpansionClassification(null, { nodeLabel: 'Unknown Thing' })
assert.equal(malformed.primaryType, 'unknown')
assert.equal(malformed.recommendedPath, 'review_related_papers')

console.log('expansionClassification tests passed')
