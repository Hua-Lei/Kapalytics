import type { GraphNode, NodeType } from './paper'
import type { GraphNodeRecord, PaperRecord, DedupedPaperCandidate } from './kg3'

export type ExpansionNodeType =
  | 'related_paper'
  | 'algorithm_idea'
  | 'method_family'
  | 'prerequisite_concept'
  | 'open_problem'

export interface ExpansionGraphNode {
  id: string
  type: ExpansionNodeType
  label: string
  description: string
  sourcePaperIds: string[]
  isTemporary: boolean
  visualStyle?: 'faded' | 'highlighted' | 'normal'
}

export type ExpansionRelation =
  | 'same_problem_different_method'
  | 'extends'
  | 'contrasts_with'
  | 'uses_as_foundation'
  | 'solves_limitation_of'
  | 'shares_assumption_with'
  | 'requires_prerequisite'

export interface ExpansionGraphEdge {
  id: string
  sourceId: string
  targetId: string
  relation: ExpansionRelation
  explanation: string
}

export interface AlgorithmIdeaCard {
  id: string
  paperId: string
  paperTitle: string
  problemSetting: string
  coreIdea: string
  keyAssumption: string
  mechanism: string
  objectiveOrUpdateRule?: string
  updatedObject?: string
  strength: string
  limitation: string
  bestUseCase?: string
  relationToCurrentNode:
    | 'same_problem_different_method'
    | 'predecessor'
    | 'parallel'
    | 'successor'
    | 'foundation'
    | 'variant'
  relationExplanation: string
  evidenceSource: {
    paperId: string
    source: 'arxiv' | 'semantic_scholar' | 'openalex' | 'local_library' | 'mock'
    url?: string
    externalId?: string
  }
  insufficientInformation?: string
}

export type AlgorithmIdeaComparisonDimension =
  | 'research_problem'
  | 'core_idea'
  | 'key_assumption'
  | 'mechanism_flow'
  | 'objective_or_update_rule'
  | 'updated_object'
  | 'strength'
  | 'limitation'
  | 'best_use_case'
  | 'relation_to_current_paper'

export interface AlgorithmIdeaComparisonCell {
  ideaCardId: string
  value: string
  evidencePaperId: string
}

export interface AlgorithmIdeaComparisonRow {
  dimension: AlgorithmIdeaComparisonDimension
  label: string
  currentNodeOrPaper: string
  selectedIdeas: AlgorithmIdeaComparisonCell[]
  contrastInsight: string
}

export interface AlgorithmIdeaComparisonWorkspace {
  id: string
  nodeId: string
  currentPaperId: string
  ideaCards: AlgorithmIdeaCard[]
  selectedIdeaCardIds: string[]
  comparisonRows: AlgorithmIdeaComparisonRow[]
  reflectionQuestions: string[]
  generatedByJobId?: string
  insufficientInformation?: string
}

export interface FieldCognitionView {
  id: string
  nodeId: string
  fieldTitle: string
  coreProblemSummary: string
  methodFamilies: Array<{
    id: string
    label: string
    ideaCardIds: string[]
    representativePaperIds: string[]
    isCurrentPaperRoute: boolean
    routeExplanation: string
  }>
  prerequisiteConcepts: Array<{
    label: string
    whyNeeded: string
  }>
  insufficientInformation?: string
}

export interface ExpansionIntent {
  kind: 'algorithm_method_lineage' | 'generic_related_papers'
  confidence: number
  queryFocus: string
  rationale: string
  fallbackReason?: string
}

export type ExpansionPrimaryType = 'field' | 'problem' | 'concept' | 'method' | 'paper' | 'unknown'

export type ExpansionPath =
  | 'learn_concept'
  | 'track_method_lineage'
  | 'explore_research_area'
  | 'review_related_papers'
  | 'inspect_paper_evidence'

export interface ExpansionNodeClassification {
  primaryType: ExpansionPrimaryType
  facets: string[]
  confidence: number
  rationale: string
  recommendedPath: ExpansionPath
  alternativePaths: ExpansionPath[]
  ambiguity?: {
    competingType: ExpansionPrimaryType
    reason: string
  }
}

export type PaperBadge =
  | 'top_venue'
  | 'strong_venue'
  | 'highly_cited'
  | 'recent'
  | 'recent_hot'
  | 'survey'
  | 'benchmark'
  | 'open_access'
  | 'local_library'
  | 'unknown_venue'
  | 'needs_review'

export interface PaperQualitySignal {
  paperId: string
  qualityScore: number
  trendScore: number
  badges: PaperBadge[]
  reasons: string[]
  warnings: string[]
}

export interface RelatedPaperRecommendation {
  paperId: string
  title: string
  year?: number
  venue?: string
  sources: string[]
  citationCount?: number
  qualitySignal?: PaperQualitySignal
  whyRecommended: string
  relevanceSummary: string
  bestUrl?: string
  bestPdfUrl?: string
}

export interface ExpansionRetrievalPlan {
  primaryQuery: string
  searchQueries: string[]
  retrievalGoal:
    | 'same_problem_methods'
    | 'generic_related_papers'
    | 'concept_learning_papers'
    | 'research_area_papers'
    | 'paper_evidence'
  maxResults: number
  requireAbstract: boolean
}

export type PaperMethodRelationHint =
  | 'foundation'
  | 'parallel_variant'
  | 'extends'
  | 'improves_limitation'
  | 'application_variant'
  | 'unclear'

export interface PaperMethodDigest {
  id: string
  paperId: string
  paperTitle: string
  methodName?: string
  problemSetting: string
  coreMechanism: string
  claimedImprovement?: string
  limitation?: string
  relationHints: PaperMethodRelationHint[]
  evidenceSummary: string
  confidence: number
  insufficientInformation?: string
}

export type MethodLineageNodeRole =
  | 'current_method'
  | 'foundation_method'
  | 'parallel_variant'
  | 'improvement'
  | 'application_variant'
  | 'open_problem'

export interface MethodLineageNode {
  id: string
  label: string
  role: MethodLineageNodeRole
  summary: string
  representativePaperIds: string[]
  digestIds: string[]
}

export type MethodLineageRelation =
  | 'extends'
  | 'contrasts_with'
  | 'solves_limitation_of'
  | 'shares_assumption_with'
  | 'applies_to_new_context'
  | 'evidence_insufficient'

export interface MethodLineageEdge {
  id: string
  sourceId: string
  targetId: string
  relation: MethodLineageRelation
  explanation: string
  evidencePaperIds: string[]
  confidence: number
}

export interface MethodLineageView {
  id: string
  anchorNodeId: string
  title: string
  summary: string
  nodes: MethodLineageNode[]
  edges: MethodLineageEdge[]
  openQuestions: string[]
  readingOrder: string[]
  dataCompleteness: 'complete' | 'partial' | 'insufficient'
  missingDataReasons: string[]
}

export interface ConceptFormulaEntry {
  latex: string
  explanation: string
  variables: Array<{ symbol: string; meaning: string }>
}

export interface ConceptLearningView {
  id: string
  anchorNodeId: string
  title: string
  quickExplanation: {
    intuition: string
    problemSolved: string
    coreMechanism: string
    whenToUse: string
  }
  formalExplanation: {
    definition: string
    formulas: ConceptFormulaEntry[]
    assumptions: string[]
  }
  misconceptions: Array<{
    misconception: string
    correction: string
  }>
  relationMap: Array<{
    label: string
    relation: 'prerequisite' | 'similar' | 'contrasts_with' | 'used_by' | 'variant'
    explanation: string
  }>
  representativePaperIds: string[]
  recentPaperIds: string[]
  dataCompleteness: 'complete' | 'partial' | 'insufficient'
  missingDataReasons: string[]
}

export interface Kg4NodeExpansionRecord {
  id: string
  paperId: string
  nodeId: string
  retrievedPaperIds: string[]
  algorithmIdeaCards: AlgorithmIdeaCard[]
  expansionGraphNodes: ExpansionGraphNode[]
  expansionGraphEdges: ExpansionGraphEdge[]
  fieldCognitionView?: FieldCognitionView
  expansionIntent?: ExpansionIntent
  expansionClassification?: ExpansionNodeClassification
  qualitySignals?: PaperQualitySignal[]
  relatedPaperRecommendations?: RelatedPaperRecommendation[]
  paperMethodDigests?: PaperMethodDigest[]
  methodLineageView?: MethodLineageView
  conceptLearningView?: ConceptLearningView
  dataCompleteness: 'complete' | 'partial' | 'insufficient'
  missingDataReasons: string[]
  generatedByJobIds: string[]
  createdAt: string
  updatedAt: string
}

export interface NodeReflectionInput {
  id: string
  paperId: string
  nodeId: string
  selectedIdeaCardIds: string[]
  comparisonWorkspaceId?: string
  userReflection: string
  createdAt: string
}

export interface ReflectiveFeedback {
  id: string
  type: 'reflective'
  paperId: string
  nodeId: string
  selectedIdeaCardIds: string[]
  strengths: string[]
  missingDimensions: string[]
  possibleCounterArguments: string[]
  evidenceFromPapers: Array<{ paperId: string; evidence: string }>
  followUpQuestions: string[]
  suggestedUnderstandingNote: string
  generatedByJobId?: string
  createdAt: string
}

export interface RemedialLesson {
  id: string
  type: 'remedial'
  paperId: string
  nodeId: string
  missingPrerequisite: string
  whyItMattersForCurrentNode: string
  shortExplanation: string
  visualExplanation?: string
  example?: string
  formulaOrPseudoCode?: string
  recommendedPapers: string[]
  recommendedArticles: string[]
  checkQuestion: string
  suggestedUnderstandingNote: string
  generatedByJobId?: string
  createdAt: string
}

export type Kg4Feedback = ReflectiveFeedback | RemedialLesson

export interface FeedbackModeDecision {
  mode: 'reflective' | 'remedial'
  reason: string
  prerequisiteGap?: string
  confidence: number
}

export interface NodeUnderstandingMemory {
  id: string
  userId?: string
  nodeId: string
  nodeLabel: string
  nodeType: string
  normalizedNodeLabel: string
  sourcePaperId: string
  relatedPaperIds: string[]
  ideaCardIds: string[]
  methodFamilyTags: string[]
  topicTags: string[]
  userReflection: string
  aiFeedbackType: 'reflective' | 'remedial'
  aiFeedbackSummary: string
  strengths: string[]
  missingDimensions: string[]
  prerequisiteGaps: string[]
  generatedUnderstandingNote: string
  userEditedUnderstandingNote?: string
  feedbackJobId?: string
  comparisonWorkspaceId?: string
  createdAt: string
  updatedAt: string
}

export interface NodeUnderstandingMemoryQuery {
  nodeLabel?: string
  normalizedNodeLabel?: string
  nodeType?: string
  topicTags?: string[]
  methodFamilyTags?: string[]
  sourcePaperId?: string
  relatedPaperIds?: string[]
  limit?: number
}

export interface MemoryReuseSuggestion {
  id: string
  memoryId: string
  currentNodeId: string
  currentPaperId: string
  matchReason: string
  matchedSignals: Array<'normalized_label' | 'topic_tag' | 'method_family' | 'related_paper' | 'node_type'>
  confidence: number
  suggestedReuseText: string
}

export interface GraphFusionSuggestion {
  id: string
  candidateNodeIds: string[]
  suggestedMergedLabel: string
  suggestedType: string
  sources: string[]
  mergeReason: string
  confidence: number
  risks: string[]
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
  updatedAt: string
}

export interface ExtractAlgorithmIdeasInput {
  currentPaper: PaperRecord | null
  currentNode: GraphNodeRecord | GraphNode
  currentPaperInsight?: unknown
  retrievedPapers: DedupedPaperCandidate[]
}

export interface ExtractAlgorithmIdeasOutput {
  ideaCards: AlgorithmIdeaCard[]
  insufficientPaperIds: string[]
}

export interface Kg4ExpansionGraphLayer {
  anchorNodeId: string
  nodes: ExpansionGraphNode[]
  edges: ExpansionGraphEdge[]
}

export interface Kg4WorkbenchState {
  expansion: Kg4NodeExpansionRecord
  comparisonWorkspace: AlgorithmIdeaComparisonWorkspace
  fieldCognitionView?: FieldCognitionView
  feedback?: Kg4Feedback
  reuseSuggestions: MemoryReuseSuggestion[]
}

export type Kg4LLMTaskType =
  | 'expand_node_retrieve_context'
  | 'classify_expansion_intent'
  | 'digest_paper_method'
  | 'synthesize_method_lineage'
  | 'extract_algorithm_ideas'
  | 'build_field_cognition_map'
  | 'generate_expansion_graph'
  | 'compare_algorithm_ideas'
  | 'generate_reflective_feedback'
  | 'generate_remedial_lesson'
  | 'suggest_graph_fusion'
  | 'generate_optional_transfer_task'
  | 'teach_concept'

export type Kg4NodeLike = Pick<GraphNode, 'id' | 'type' | 'label' | 'description' | 'searchQueries'> & {
  insight?: string
  whyImportant?: string
  roleInPaper?: string
}

export interface StartKg4ExpansionParams {
  sessionId?: string
  nodeId: string
  nodeLabel: string
  paperId?: string
  searchQueries?: string[]
  forceRefresh?: boolean
  paperInsight?: {
    title?: string
    problem?: string
    method?: string
    contribution?: string
  }
}

export interface StartKg4ExpansionResult {
  sessionId: string
  jobs: Array<{ jobId: string; type: string }>
}

export interface Kg4ExpansionRecordQuery {
  paperId: string
  nodeId: string
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}

function hasStringProperties(value: Record<string, unknown>, properties: string[]): boolean {
  return properties.every((property) => typeof value[property] === 'string')
}

function isOneOf<T extends string>(value: unknown, allowedValues: readonly T[]): value is T {
  return typeof value === 'string' && allowedValues.includes(value as T)
}

const algorithmIdeaCardRelations = [
  'same_problem_different_method',
  'predecessor',
  'parallel',
  'successor',
  'foundation',
  'variant'
] as const satisfies readonly AlgorithmIdeaCard['relationToCurrentNode'][]

const evidenceSources = ['arxiv', 'semantic_scholar', 'openalex', 'local_library', 'mock'] as const satisfies readonly AlgorithmIdeaCard['evidenceSource']['source'][]

const expansionNodeTypes = [
  'related_paper',
  'algorithm_idea',
  'method_family',
  'prerequisite_concept',
  'open_problem'
] as const satisfies readonly ExpansionGraphNode['type'][]

const expansionEdgeRelations = [
  'same_problem_different_method',
  'extends',
  'contrasts_with',
  'uses_as_foundation',
  'solves_limitation_of',
  'shares_assumption_with',
  'requires_prerequisite'
] as const satisfies readonly ExpansionGraphEdge['relation'][]

const expansionNodeVisualStyles = ['faded', 'highlighted', 'normal'] as const satisfies readonly NonNullable<ExpansionGraphNode['visualStyle']>[]

const expansionIntentKinds = ['algorithm_method_lineage', 'generic_related_papers'] as const satisfies readonly ExpansionIntent['kind'][]

const expansionPrimaryTypes = ['field', 'problem', 'concept', 'method', 'paper', 'unknown'] as const satisfies readonly ExpansionPrimaryType[]

const expansionPaths = [
  'learn_concept',
  'track_method_lineage',
  'explore_research_area',
  'review_related_papers',
  'inspect_paper_evidence'
] as const satisfies readonly ExpansionPath[]

const paperBadges = [
  'top_venue',
  'strong_venue',
  'highly_cited',
  'recent',
  'recent_hot',
  'survey',
  'benchmark',
  'open_access',
  'local_library',
  'unknown_venue',
  'needs_review'
] as const satisfies readonly PaperBadge[]

const paperMethodRelationHints = [
  'foundation',
  'parallel_variant',
  'extends',
  'improves_limitation',
  'application_variant',
  'unclear'
] as const satisfies readonly PaperMethodRelationHint[]

const methodLineageNodeRoles = [
  'current_method',
  'foundation_method',
  'parallel_variant',
  'improvement',
  'application_variant',
  'open_problem'
] as const satisfies readonly MethodLineageNodeRole[]

const methodLineageRelations = [
  'extends',
  'contrasts_with',
  'solves_limitation_of',
  'shares_assumption_with',
  'applies_to_new_context',
  'evidence_insufficient'
] as const satisfies readonly MethodLineageRelation[]

const conceptRelations = ['prerequisite', 'similar', 'contrasts_with', 'used_by', 'variant'] as const satisfies readonly ConceptLearningView['relationMap'][number]['relation'][]

const conceptViewCompleteness = ['complete', 'partial', 'insufficient'] as const satisfies readonly ConceptLearningView['dataCompleteness'][]

function isAlgorithmIdeaCard(value: unknown): value is AlgorithmIdeaCard {
  if (!isRecordObject(value)) return false
  const evidenceSource = value.evidenceSource
  return (
    hasStringProperties(value, [
      'id',
      'paperId',
      'paperTitle',
      'problemSetting',
      'coreIdea',
      'keyAssumption',
      'mechanism',
      'strength',
      'limitation',
      'relationExplanation'
    ]) &&
    isOneOf(value.relationToCurrentNode, algorithmIdeaCardRelations) &&
    isRecordObject(evidenceSource) &&
    hasStringProperties(evidenceSource, ['paperId']) &&
    isOneOf(evidenceSource.source, evidenceSources) &&
    isOptionalString(value.objectiveOrUpdateRule) &&
    isOptionalString(value.updatedObject) &&
    isOptionalString(value.bestUseCase) &&
    isOptionalString(value.insufficientInformation) &&
    isOptionalString(evidenceSource.url) &&
    isOptionalString(evidenceSource.externalId)
  )
}

function isExpansionGraphNode(value: unknown): value is ExpansionGraphNode {
  return (
    isRecordObject(value) &&
    hasStringProperties(value, ['id', 'label', 'description']) &&
    isOneOf(value.type, expansionNodeTypes) &&
    typeof value.isTemporary === 'boolean' &&
    isStringArray(value.sourcePaperIds) &&
    isOptionalString(value.visualStyle) &&
    (value.visualStyle === undefined || isOneOf(value.visualStyle, expansionNodeVisualStyles))
  )
}

function isExpansionGraphEdge(value: unknown): value is ExpansionGraphEdge {
  return (
    isRecordObject(value) &&
    hasStringProperties(value, ['id', 'sourceId', 'targetId', 'explanation']) &&
    isOneOf(value.relation, expansionEdgeRelations)
  )
}

function isFieldCognitionView(value: unknown): value is FieldCognitionView {
  if (!isRecordObject(value)) return false

  return (
    hasStringProperties(value, ['id', 'nodeId', 'fieldTitle', 'coreProblemSummary']) &&
    Array.isArray(value.methodFamilies) &&
    value.methodFamilies.every(
      (methodFamily) =>
        isRecordObject(methodFamily) &&
        hasStringProperties(methodFamily, ['id', 'label', 'routeExplanation']) &&
        typeof methodFamily.isCurrentPaperRoute === 'boolean' &&
        isStringArray(methodFamily.ideaCardIds) &&
        isStringArray(methodFamily.representativePaperIds)
    ) &&
    Array.isArray(value.prerequisiteConcepts) &&
    value.prerequisiteConcepts.every(
      (prerequisiteConcept) =>
        isRecordObject(prerequisiteConcept) &&
        hasStringProperties(prerequisiteConcept, ['label', 'whyNeeded'])
    ) &&
    isOptionalString(value.insufficientInformation)
  )
}

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function isExpansionNodeClassification(value: unknown): value is ExpansionNodeClassification {
  if (!isRecordObject(value)) return false
  const ambiguity = value.ambiguity
  return (
    isOneOf(value.primaryType, expansionPrimaryTypes) &&
    isStringArray(value.facets) &&
    isNumberInRange(value.confidence, 0, 1) &&
    typeof value.rationale === 'string' &&
    Boolean(value.rationale.trim()) &&
    isOneOf(value.recommendedPath, expansionPaths) &&
    Array.isArray(value.alternativePaths) &&
    value.alternativePaths.every((path) => isOneOf(path, expansionPaths)) &&
    (ambiguity === undefined ||
      (isRecordObject(ambiguity) &&
        isOneOf(ambiguity.competingType, expansionPrimaryTypes) &&
        typeof ambiguity.reason === 'string' &&
        Boolean(ambiguity.reason.trim())))
  )
}

function isPaperQualitySignal(value: unknown): value is PaperQualitySignal {
  if (!isRecordObject(value)) return false
  return (
    typeof value.paperId === 'string' &&
    Boolean(value.paperId.trim()) &&
    isNumberInRange(value.qualityScore, 0, 1) &&
    isNumberInRange(value.trendScore, 0, 1) &&
    Array.isArray(value.badges) &&
    value.badges.every((badge) => isOneOf(badge, paperBadges)) &&
    isStringArray(value.reasons) &&
    isStringArray(value.warnings)
  )
}

function isRelatedPaperRecommendation(value: unknown): value is RelatedPaperRecommendation {
  if (!isRecordObject(value)) return false
  return (
    typeof value.paperId === 'string' &&
    Boolean(value.paperId.trim()) &&
    typeof value.title === 'string' &&
    Boolean(value.title.trim()) &&
    (value.year === undefined ||
      (typeof value.year === 'number' && Number.isInteger(value.year) && value.year >= 1900 && value.year <= 2100)) &&
    isOptionalString(value.venue) &&
    isStringArray(value.sources) &&
    (value.citationCount === undefined ||
      (typeof value.citationCount === 'number' && Number.isInteger(value.citationCount) && value.citationCount >= 0)) &&
    (value.qualitySignal === undefined || isPaperQualitySignal(value.qualitySignal)) &&
    typeof value.whyRecommended === 'string' &&
    Boolean(value.whyRecommended.trim()) &&
    typeof value.relevanceSummary === 'string' &&
    Boolean(value.relevanceSummary.trim()) &&
    isOptionalString(value.bestUrl) &&
    isOptionalString(value.bestPdfUrl)
  )
}

function isExpansionIntent(value: unknown): value is ExpansionIntent {
  return (
    isRecordObject(value) &&
    isOneOf(value.kind, expansionIntentKinds) &&
    isNumberInRange(value.confidence, 0, 1) &&
    hasStringProperties(value, ['queryFocus', 'rationale']) &&
    isOptionalString(value.fallbackReason)
  )
}

function isPaperMethodDigest(value: unknown): value is PaperMethodDigest {
  return (
    isRecordObject(value) &&
    hasStringProperties(value, ['id', 'paperId', 'paperTitle', 'problemSetting', 'coreMechanism', 'evidenceSummary']) &&
    isOptionalString(value.methodName) &&
    isOptionalString(value.claimedImprovement) &&
    isOptionalString(value.limitation) &&
    isOptionalString(value.insufficientInformation) &&
    Array.isArray(value.relationHints) &&
    value.relationHints.every((hint) => isOneOf(hint, paperMethodRelationHints)) &&
    isNumberInRange(value.confidence, 0, 1)
  )
}

function isMethodLineageNode(value: unknown): value is MethodLineageNode {
  return (
    isRecordObject(value) &&
    hasStringProperties(value, ['id', 'label', 'summary']) &&
    isOneOf(value.role, methodLineageNodeRoles) &&
    isStringArray(value.representativePaperIds) &&
    isStringArray(value.digestIds)
  )
}

function isMethodLineageEdge(value: unknown): value is MethodLineageEdge {
  return (
    isRecordObject(value) &&
    hasStringProperties(value, ['id', 'sourceId', 'targetId', 'explanation']) &&
    isOneOf(value.relation, methodLineageRelations) &&
    isStringArray(value.evidencePaperIds) &&
    isNumberInRange(value.confidence, 0, 1)
  )
}

function isMethodLineageView(value: unknown): value is MethodLineageView {
  return (
    isRecordObject(value) &&
    hasStringProperties(value, ['id', 'anchorNodeId', 'title', 'summary']) &&
    Array.isArray(value.nodes) &&
    value.nodes.every(isMethodLineageNode) &&
    Array.isArray(value.edges) &&
    value.edges.every(isMethodLineageEdge) &&
    isStringArray(value.openQuestions) &&
    isStringArray(value.readingOrder) &&
    (value.dataCompleteness === 'complete' || value.dataCompleteness === 'partial' || value.dataCompleteness === 'insufficient') &&
    isStringArray(value.missingDataReasons)
  )
}

function isConceptFormulaEntry(value: unknown): value is ConceptFormulaEntry {
  if (!isRecordObject(value)) return false
  if (typeof value.latex !== 'string' || !value.latex.trim()) return false
  if (typeof value.explanation !== 'string' || !value.explanation.trim()) return false
  if (!Array.isArray(value.variables)) return false
  return value.variables.every(
    (v: unknown) =>
      isRecordObject(v) &&
      typeof v.symbol === 'string' && Boolean(v.symbol.trim()) &&
      typeof v.meaning === 'string' && Boolean(v.meaning.trim())
  )
}

function isConceptLearningView(value: unknown): value is ConceptLearningView {
  if (!isRecordObject(value)) return false
  if (
    typeof value.id !== 'string' || !value.id.trim() ||
    typeof value.anchorNodeId !== 'string' || !value.anchorNodeId.trim() ||
    typeof value.title !== 'string' || !value.title.trim()
  ) return false
  const qe = value.quickExplanation
  if (!isRecordObject(qe)) return false
  if (!['intuition', 'problemSolved', 'coreMechanism', 'whenToUse'].every((k) => typeof qe[k] === 'string' && Boolean(qe[k].trim()))) return false
  const fe = value.formalExplanation
  if (!isRecordObject(fe)) return false
  if (typeof fe.definition !== 'string' || !fe.definition.trim()) return false
  if (!Array.isArray(fe.formulas)) return false
  if (!fe.formulas.every(isConceptFormulaEntry)) return false
  if (!isStringArray(fe.assumptions)) return false
  if (!Array.isArray(value.misconceptions) || !value.misconceptions.every((m: unknown) => isRecordObject(m) && typeof m.misconception === 'string' && Boolean(m.misconception.trim()) && typeof m.correction === 'string' && Boolean(m.correction.trim()))) return false
  if (!Array.isArray(value.relationMap) || !value.relationMap.every((r: unknown) => isRecordObject(r) && typeof r.label === 'string' && Boolean(r.label.trim()) && isOneOf(r.relation, conceptRelations) && typeof r.explanation === 'string' && Boolean(r.explanation.trim()))) return false
  if (!isStringArray(value.representativePaperIds)) return false
  if (!isStringArray(value.recentPaperIds)) return false
  if (!isOneOf(value.dataCompleteness, conceptViewCompleteness)) return false
  if (!isStringArray(value.missingDataReasons)) return false
  return true
}

export function isKg4NodeExpansionRecord(value: unknown): value is Kg4NodeExpansionRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<Kg4NodeExpansionRecord>
  if (record.expansionClassification !== undefined && !isExpansionNodeClassification(record.expansionClassification)) return false
  if (record.qualitySignals !== undefined && (!Array.isArray(record.qualitySignals) || !record.qualitySignals.every(isPaperQualitySignal))) return false
  if (
    record.relatedPaperRecommendations !== undefined &&
    (!Array.isArray(record.relatedPaperRecommendations) || !record.relatedPaperRecommendations.every(isRelatedPaperRecommendation))
  ) {
    return false
  }
  return (
    typeof record.id === 'string' &&
    typeof record.paperId === 'string' &&
    typeof record.nodeId === 'string' &&
    isStringArray(record.retrievedPaperIds) &&
    Array.isArray(record.algorithmIdeaCards) &&
    record.algorithmIdeaCards.every(isAlgorithmIdeaCard) &&
    Array.isArray(record.expansionGraphNodes) &&
    record.expansionGraphNodes.every(isExpansionGraphNode) &&
    Array.isArray(record.expansionGraphEdges) &&
    record.expansionGraphEdges.every(isExpansionGraphEdge) &&
    (record.fieldCognitionView === undefined || isFieldCognitionView(record.fieldCognitionView)) &&
    (record.expansionIntent === undefined || isExpansionIntent(record.expansionIntent)) &&
    (record.paperMethodDigests === undefined ||
      (Array.isArray(record.paperMethodDigests) && record.paperMethodDigests.every(isPaperMethodDigest))) &&
    (record.methodLineageView === undefined || isMethodLineageView(record.methodLineageView)) &&
    (record.conceptLearningView === undefined || isConceptLearningView(record.conceptLearningView)) &&
    (record.dataCompleteness === 'complete' || record.dataCompleteness === 'partial' || record.dataCompleteness === 'insufficient') &&
    isStringArray(record.missingDataReasons) &&
    isStringArray(record.generatedByJobIds) &&
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string'
  )
}

export function normalizeKg4NodeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ').trim()
}

export function kg4NodeTypeLabel(type: NodeType | string): string {
  return String(type)
}
