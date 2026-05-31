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
      'Keep each text field short. Do not copy the full abstract.',
      'Every paperId must be the supplied retrievedPaper id.'
    ].join(' ')
  }
  if (type === 'synthesize_method_lineage') {
    return [
      'You are a KG4 method lineage synthesizer. Return strict JSON only.',
      'Input contains currentNode, currentPaperInsight, retrievedPapers, and paperMethodDigests.',
      'Return a MethodLineageView with nodes, edges, openQuestions, readingOrder, dataCompleteness, and missingDataReasons.',
      'Lineage nodes represent methods or method roles, not paper cards.',
      'Every representativePaperIds, digestIds, and evidencePaperIds item must come from the supplied inputs.',
      'Mark uncertain relationships as evidence_insufficient instead of inventing evidence.'
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
