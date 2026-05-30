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

export interface Kg4NodeExpansionRecord {
  id: string
  paperId: string
  nodeId: string
  retrievedPaperIds: string[]
  algorithmIdeaCards: AlgorithmIdeaCard[]
  expansionGraphNodes: ExpansionGraphNode[]
  expansionGraphEdges: ExpansionGraphEdge[]
  fieldCognitionView?: FieldCognitionView
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
  | 'extract_algorithm_ideas'
  | 'build_field_cognition_map'
  | 'generate_expansion_graph'
  | 'compare_algorithm_ideas'
  | 'generate_reflective_feedback'
  | 'generate_remedial_lesson'
  | 'suggest_graph_fusion'
  | 'generate_optional_transfer_task'

export type Kg4NodeLike = Pick<GraphNode, 'id' | 'type' | 'label' | 'description' | 'searchQueries'> & {
  insight?: string
  whyImportant?: string
  roleInPaper?: string
}

export interface StartKg4ExpansionParams {
  nodeId: string
  nodeLabel: string
  paperId?: string
  searchQueries?: string[]
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

export function isKg4NodeExpansionRecord(value: unknown): value is Kg4NodeExpansionRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<Kg4NodeExpansionRecord>
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
