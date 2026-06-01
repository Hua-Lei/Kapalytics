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
  'synthesize_method_lineage',
  'teach_concept',
  'map_research_area'
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
      'You are a KG4 expansion node classifier. Return strict JSON only.',
      'Classify currentNode with primaryType, facets, confidence, rationale, recommendedPath, alternativePaths, and optional ambiguity.',
      'primaryType must be one of field, problem, concept, method, paper, unknown.',
      'recommendedPath and alternativePaths must use learn_concept, track_method_lineage, explore_research_area, review_related_papers, or inspect_paper_evidence.',
      'Use concept for reusable terms with definitions, formulas, or teachable mechanisms such as LoRA or Context Distillation.',
      'Use method for concrete algorithms, training recipes, architecture modules, or paper-specific method names.',
      'Use field for broad research areas and problem for bottlenecks, tasks, or desiderata.',
      'Facets can include paper_specific, method_component, training_strategy, parameter_efficient_finetuning, survey, recent_hot, math_heavy, or application_area when useful.',
      'Do not classify a paper-title-like method as field merely because it contains many words.',
      'All explanatory text fields must be Chinese (中文).'
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
  if (type === 'teach_concept') {
    return [
      'You are a KG4 concept teaching worker. Return strict JSON only.',
      'Input contains currentNode, currentPaperInsight, compact retrievedPapers, and optional qualitySignals.',
      'Return exactly one ConceptLearningView JSON with fields: id, anchorNodeId, title, quickExplanation, formalExplanation, misconceptions, relationMap, representativePaperIds, recentPaperIds, dataCompleteness, missingDataReasons.',
      'quickExplanation must have: intuition, problemSolved, coreMechanism, whenToUse.',
      'formalExplanation must have: definition, formulas, assumptions.',
      'Each formula must have: latex (valid KaTeX body only, no $ delimiters, no Markdown code block), explanation, and variables array (each with symbol and meaning).',
      'In explanatory text fields, wrap inline formulas with $...$; do not leave standalone bare backslash formulas in prose.',
      'misconceptions: list of { misconception, correction } pairs.',
      'relationMap: list of { label, relation (prerequisite|similar|contrasts_with|used_by|variant), explanation } describing how this concept relates to connected ideas.',
      'representativePaperIds: representative, definitional, survey, or classic papers.',
      'recentPaperIds: recent papers (within 2 years) building on or applying this concept.',
      'All explanatory text fields must be Chinese. LaTeX formulas can use standard English math notation.',
      'Every referred paperId must come from supplied retrievedPapers or currentPaperInsight.',
      'Do not invent paper titles or external IDs.'
    ].join(' ')
  }
  if (type === 'map_research_area') {
    return [
      'You are a KG4 research area mapper. Return strict JSON only.',
      'Input contains currentNode, currentPaperInsight, compact retrievedPapers, and optional qualitySignals.',
      'Return ResearchAreaView JSON: id, anchorNodeId, title, overview, keyProblems, methodFamilies, recentHotDirections, recommendedReading.',
      'overview: concise research landscape summary.',
      'keyProblems: list of core research problems or open challenges.',
      'methodFamilies: groups of related methods, each with label/summary/representativePaperIds.',
      'recentHotDirections: emerging trends, each with label/summary/paperIds/confidence.',
      'recommendedReading: curated reading list, each with paperId/reason/role.',
      'role must be survey|foundation|recent_hot|representative|needs_review.',
      'Every paperId must come from supplied papers.',
      'All explanatory text must be Chinese.',
      'Do not invent paper titles or IDs.'
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
