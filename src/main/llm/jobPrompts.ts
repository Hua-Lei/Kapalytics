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
      'You are a KG4 PDF-grounded method lineage synthesizer. Return strict JSON only.',
      'Input contains methodLineageContext with anchor, paperSource, paperInsight, localGraphNeighborhood, evidenceSlots, and readerIntent.',
      'Input may also contain retrievedPapers, paperMethodDigests, qualitySignals, and readerGoal=hybrid_pdf_and_retrieved_paper_lineage.',
      'paperSource.extractedText is the primary source for the current paper. Use it directly; do not ask for an intermediate summary.',
      'When paperMethodDigests are supplied, synthesize a hybrid lineage: current_method nodes should be anchored in the current PDF, while foundation_method, parallel_variant, improvement, and application_variant nodes should use supplied paperMethodDigests and representativePaperIds.',
      'This is not a literature list: produce typed method nodes and relationship edges that explain how methods inherit, contrast, improve, or apply ideas; do not return a flat list of papers.',
      'For every node supported by an external paper digest, fill representativePaperIds with that digest paperId and digestIds with that digest id.',
      'Return one MethodLineageView JSON object with existing fields id, anchorNodeId, title, summary, nodes, edges, openQuestions, readingOrder, dataCompleteness, missingDataReasons.',
      'Also return problemSetup, conceptBridge, anchorPosition, methodComparisons, and confidenceAndEvidence.',
      'problemSetup must be an object with beginnerExplanation, whyThisProblemMatters, and pdfEvidence array; never return it as a plain string.',
      'anchorPosition must be an object with summary, whatTheCurrentPaperChanges, whatItInherits, whatItDoesNotSolve, and pdfEvidence array; never return it as a plain string.',
      'methodComparisons must compare concrete methods; each item must use methodA, methodB, keyDifference, whyItMatters, and evidence array.',
      'Evidence sourceType must be current_pdf, model_knowledge, or future_retrieval_needed.',
      'Every current_pdf evidence item must include excerpt and claimSupported. Use current_pdf only when an excerpt comes from paperSource pages. Include pageNumber when the page is known.',
      'Use model_knowledge for general field background that is not directly stated in the PDF.',
      'Use future_retrieval_needed when a claim would require external paper retrieval.',
      'Nodes keep fields id, label, role, summary, representativePaperIds, digestIds, and optional evidence.',
      'Edges keep fields id, sourceId, targetId, relation, explanation, evidencePaperIds, confidence, and optional evidence.',
      'Edges confidence must be a number from 0 to 1, not 高/中/低 or high/medium/low.',
      'role must be current_method, foundation_method, parallel_variant, improvement, application_variant, or open_problem.',
      'relation must be extends, contrasts_with, solves_limitation_of, shares_assumption_with, applies_to_new_context, or evidence_insufficient.',
      'dataCompleteness must be exactly complete, partial, or insufficient. missingDataReasons must be an array of strings.',
      'representativePaperIds, digestIds, evidencePaperIds, and readingOrder may be empty arrays only when no retrieved papers or digests are supplied.',
      'Do not invent paper IDs or digest IDs. Use only supplied retrievedPapers.id and paperMethodDigests.id.',
      'All explanatory text fields must be Chinese. Keep PDF excerpts short and faithful.'
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
