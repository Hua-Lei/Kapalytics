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
  'generate_optional_transfer_task'
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
