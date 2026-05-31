import type { LLMJobType } from '../../shared/kg3'

const KG4_JOB_TYPES = new Set<LLMJobType>([
  'expand_node_retrieve_context',
  'extract_algorithm_ideas',
  'build_field_cognition_map',
  'generate_expansion_graph',
  'compare_algorithm_ideas',
  'generate_reflective_feedback',
  'generate_remedial_lesson',
  'suggest_graph_fusion',
  'generate_optional_transfer_task',
  'classify_expansion_intent',
  'digest_paper_method',
  'synthesize_method_lineage'
])

export function isKg4JobType(type: LLMJobType): boolean {
  return KG4_JOB_TYPES.has(type)
}

export function systemPromptForJob(type: LLMJobType): string {
  if (type === 'expand_node_retrieve_context') {
    return [
      'You are a KG4 node expansion worker. Return strict JSON only.',
      'Input contains currentPaper, currentNode, retrievedPapers, and providerStatus only.',
      'Use retrievedPapers to produce algorithmIdeaCards and expansionGraphNodes for the currentNode.',
      'Every algorithmIdeaCard.paperId and expansionGraphNode.sourcePaperIds item must exist in retrievedPapers or currentPaper.',
      'Create related_paper or algorithm_idea expansionGraphNodes even when deeper comparison data is unavailable.',
      'Do not reject the task because optional downstream context is absent.',
      'Never invent paper titles, authors, years, venues, experiment results, citations, URLs, or external IDs.'
    ].join(' ')
  }
  if (type === 'classify_expansion_intent') {
    return [
      'You are a KG4 expansion intent classifier. Return strict JSON only.',
      'Classify whether currentNode should produce algorithm_method_lineage or generic_related_papers.',
      'Return fields: kind, confidence, queryFocus, rationale, and optional fallbackReason.',
      'Use algorithm_method_lineage only for concrete algorithms, methods, mechanisms, or model components.',
      'Use generic_related_papers for fields, concepts, broad topics, open problems, or low confidence.'
    ].join(' ')
  }
  if (type === 'digest_paper_method') {
    return [
      'You are a KG4 paper method digest worker. Return strict JSON only.',
      'Input contains currentNode, currentPaperInsight, and one retrievedPaper.',
      'Return a PaperMethodDigest with id, paperId, paperTitle, methodName, problemSetting, coreMechanism, claimedImprovement, limitation, relationHints, evidenceSummary, confidence, and optional insufficientInformation.',
      'All explanatory text fields must be Chinese (中文). Keep each text field short. Do not copy the full abstract.',
      'relationHints must be an array using only foundation, parallel_variant, extends, improves_limitation, application_variant, or unclear.',
      'confidence must be a number from 0 to 1, not a string label.',
      'Every paperId must be the supplied retrievedPaper id.'
    ].join(' ')
  }
  if (type === 'synthesize_method_lineage') {
    return [
      'You are a KG4 method lineage synthesizer. Return strict JSON only.',
      'Input contains currentNode, currentPaperInsight, compact retrievedPapers, and paperMethodDigests.',
      'Return exactly one MethodLineageView JSON object with fields: id, anchorNodeId, title, summary, nodes, edges, openQuestions, readingOrder, dataCompleteness, missingDataReasons.',
      'Each node must have only: id, label, role, summary, representativePaperIds, digestIds. role must be one of current_method, foundation_method, parallel_variant, improvement, application_variant, open_problem.',
      'Each edge must have only: id, sourceId, targetId, relation, explanation, evidencePaperIds, confidence. relation must be one of extends, contrasts_with, solves_limitation_of, shares_assumption_with, applies_to_new_context, evidence_insufficient.',
      'Do not output fields such as methodName, description, source, target, relationType, evidenceSummary, or confidence on nodes.',
      'At most 6 nodes, at most 8 edges, at most 4 openQuestions, and at most 6 readingOrder items.',
      'Every representativePaperIds, digestIds, and evidencePaperIds item must come from the supplied inputs.',
      'Mark uncertain relationships as evidence_insufficient instead of inventing evidence.',
      'All explanatory text fields must be Chinese (中文).'
    ].join(' ')
  }
  if (KG4_JOB_TYPES.has(type)) {
    return [
      'You are a KG4 task worker. Return strict JSON only.',
      'Only use currentPaper, currentNode, retrievedPapers, paperAnalyses, selectedIdeaCards, comparisonRows, and userReflection from input.',
      'Never invent paper titles, authors, years, venues, experiment results, citations, URLs, or external IDs.',
      'Every paperId in output must exist in currentPaper or retrievedPapers/selectedIdeaCards supplied by input.',
      'If information is insufficient, return insufficient_information and explain missing fields.'
    ].join(' ')
  }
  return 'You are a KG3 task worker. Return strict json only. Never invent papers. Only use IDs listed by the job input.'
}
