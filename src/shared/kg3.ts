import type {
  ComparisonWorkspace,
  DirectionMap,
  ExpansionType,
  GraphNode,
  MethodLineage,
  NodeDetail,
  NodeType,
  PaperInsight,
  RelatedPaper,
  SharpComparisonRow,
  TransferTask
} from './paper'
import type { Kg4LLMTaskType, Kg4NodeExpansionRecord, NodeUnderstandingMemory } from './kg4'

export type PaperSource = 'uploaded_pdf' | 'arxiv' | 'semantic_scholar' | 'openalex' | 'local_library'
export type PaperProvider = 'arxiv' | 'semantic_scholar' | 'openalex' | 'doi' | 'corpus_id' | 'local'

export interface PaperExternalId {
  provider: PaperProvider
  externalId: string
  url?: string
}

export interface PaperRecord {
  id: string
  title: string
  authors: string[]
  year?: number
  venue?: string
  abstract?: string
  doi?: string
  arxivId?: string
  externalIds: PaperExternalId[]
  source: PaperSource
  sourceUrl?: string
  pdfUrl?: string
  localPdfPath?: string
  contentHash?: string
  localFileId?: string
  importedAt: string
  lastReadAt?: string
  analysisStatus: 'not_analyzed' | 'analyzing' | 'analyzed' | 'failed'
  graphVersion: string
  createdAt: string
  updatedAt: string
}

export interface PaperInsightRecord extends PaperInsight {
  id: string
  paperId: string
  evidenceChainNodeIds: string[]
  evidenceChainLabels?: string[]
  generatedByJobId?: string
  createdAt: string
  updatedAt: string
}

export interface PaperPageRef {
  page: number
  textSnippet?: string
  boundingBox?: { x: number; y: number; width: number; height: number }
}

export interface GraphNodeRecord {
  id: string
  paperId: string
  nodeType: NodeType
  label: string
  normalizedLabel: string
  description: string
  insight?: string
  whyImportant?: string
  roleInPaper?: string
  contrastWithPrior?: string
  evidenceNodeIds: string[]
  expandable: boolean
  expansionType?: ExpansionType
  searchQueries: string[]
  detailJson?: NodeDetail
  pageRefs?: PaperPageRef[]
  confidence: number
  generatedByJobId?: string
  createdAt: string
  updatedAt: string
}

export interface GraphEdgeRecord {
  id: string
  paperId: string
  sourceNodeId: string
  targetNodeId: string
  relationType: 'motivates' | 'solves' | 'uses' | 'derives' | 'validates' | 'limits' | 'contrasts' | 'extends' | 'related'
  label: string
  directed: boolean
  evidence?: string
  confidence: number
  generatedByJobId?: string
  createdAt: string
  updatedAt: string
}

export interface ReadingSession {
  id: string
  paperId: string
  startedAt: string
  endedAt?: string
  activeGraphView?: 'argument' | 'mechanism' | 'expansion'
  selectedNodeIds: string[]
  completedStageIds: string[]
  lastActiveStageId?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface LearningTaskRecord {
  id: string
  paperId: string
  sessionId?: string
  nodeId?: string
  taskType: 'stage_task' | 'node_explanation' | 'transfer_comparison' | 'review' | 'fusion_reflection'
  stageId?: string
  prompt: string
  expectedReasoningPoints: string[]
  relatedPaperIds: string[]
  relatedMergedNodeIds: string[]
  status: 'not_started' | 'in_progress' | 'answered' | 'diagnosed' | 'completed'
  generatedByJobId?: string
  createdAt: string
  updatedAt: string
}

export interface DiagnosisRecord {
  id: string
  paperId: string
  sessionId?: string
  taskId: string
  nodeId?: string
  userAnswer: string
  isCorrect: boolean
  errorType: 'concept_confusion' | 'missing_evidence' | 'weak_transfer' | 'method_misread' | 'formula_misread' | 'overgeneralization'
  feedback: string
  remedialTask: string
  masteryDelta: number
  diagnosedByJobId?: string
  createdAt: string
}

export interface NodeExpansionRecord {
  id: string
  paperId: string
  nodeId: string
  directionMapJson?: DirectionMap
  methodLineageJson?: MethodLineage
  comparisonWorkspaceJson?: ComparisonWorkspace
  relatedPaperIds: string[]
  dataCompleteness: 'complete' | 'partial' | 'insufficient'
  missingDataReasons: string[]
  generatedByJobIds: string[]
  createdAt: string
  updatedAt: string
}

export interface PaperSearchResult {
  id: string
  provider: 'arxiv' | 'semantic_scholar' | 'openalex' | 'local'
  source: 'arxiv' | 'semantic_scholar' | 'openalex' | 'local_library'
  externalId: string
  url: string
  pdfUrl?: string
  title: string
  authors: string[]
  year?: number
  venue?: string
  abstract?: string
  doi?: string
  arxivId?: string
  semanticScholarPaperId?: string
  openAlexId?: string
  corpusId?: string
  citedByCount?: number
  referenceIds?: string[]
  topicTags: string[]
  raw: unknown
  fetchedAt: string
}

export interface PaperSearchResultRecord extends PaperSearchResult {
  query: string
  cacheKey: string
  expiresAt?: string
}

export interface UserMasteryRecord {
  id: string
  targetType: 'paper' | 'graph_node' | 'merged_graph_node' | 'ability'
  targetId: string
  masteryScore: number
  confidence: number
  strengths: string[]
  weaknesses: string[]
  lastDiagnosisIds: string[]
  nextRecommendedTaskId?: string
  updatedAt: string
}

export interface NodeDisagreement {
  sourcePaperId: string
  description: string
  whyItDiffers: string
}

export interface MergedNodeMastery {
  masteryScore: number
  weakAbilities: string[]
  lastDiagnosisIds: string[]
}

export interface MergedGraphNode {
  id: string
  canonicalLabel: string
  aliases: string[]
  normalizedLabel: string
  nodeType: NodeType | 'mixed'
  sourceNodeIds: string[]
  sourcePaperIds: string[]
  representativePaperIds: string[]
  consensusSummary: string
  keyInsights: string[]
  disagreements: NodeDisagreement[]
  methodFamilies: string[]
  firstSeenAt: string
  lastSeenAt: string
  userMastery?: MergedNodeMastery
  confidence: number
  createdAt: string
  updatedAt: string
}

export type MergedRelationType =
  | 'is_prerequisite_of'
  | 'motivates'
  | 'solves'
  | 'uses'
  | 'extends'
  | 'contrasts_with'
  | 'validated_by'
  | 'limited_by'
  | 'evolves_to'
  | 'belongs_to_branch'

export interface MergedGraphEdge {
  id: string
  sourceMergedNodeId: string
  targetMergedNodeId: string
  relationType: MergedRelationType
  label: string
  sourceEdgeIds: string[]
  sourcePaperIds: string[]
  evidenceSnippets: string[]
  confidence: number
  createdAt: string
  updatedAt: string
}

export interface MergeSimilaritySignals {
  normalizedLabelScore: number
  typeMatch: boolean
  descriptionOverlapScore: number
  sharedPaperTopics: string[]
  sharedMethodFamily?: string
  llmSemanticScore?: number
}

export interface MergeCandidate {
  id: string
  sourceNodeId: string
  targetMergedNodeId?: string
  targetNodeId?: string
  similaritySignals: MergeSimilaritySignals
  decisionStatus: 'pending' | 'merged' | 'rejected' | 'needs_review'
}

export interface FuseGraphNodesResult {
  decision: 'merge' | 'do_not_merge' | 'needs_review'
  reason: string
  canonicalLabel?: string
  consensusSummary?: string
  disagreements: NodeDisagreement[]
  sourceNodeIds: string[]
  sourcePaperIds: string[]
}

export type LLMJobType =
  | 'analyze_single_paper'
  | 'generate_node_detail'
  | 'expand_node'
  | 'compare_papers'
  | 'generate_transfer_task'
  | 'diagnose_answer'
  | 'fuse_graph_nodes'
  | 'repair_json'
  | 'summarize_retrieved_paper'
  | Kg4LLMTaskType

export type LLMJobStatus = 'queued' | 'running' | 'waiting_for_retrieval' | 'validating' | 'succeeded' | 'failed' | 'cancelled' | 'cache_hit'
export type LLMProgressStep = 'building_context' | 'waiting_for_retrieval' | 'calling_model' | 'parsing_json' | 'validating_schema' | 'saving_memory' | 'done'
export type LLMJobErrorCode = 'no_api_key' | 'rate_limited' | 'timeout' | 'empty_output' | 'invalid_json' | 'schema_validation_failed' | 'hallucinated_paper' | 'insufficient_retrieval_data' | 'cancelled_by_user' | 'unknown'

export interface LLMUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  promptCacheHitTokens?: number
  promptCacheMissTokens?: number
}

export interface LLMJob {
  id: string
  type: LLMJobType
  status: LLMJobStatus
  priority: 'low' | 'normal' | 'high' | 'user_blocking'
  inputHash: string
  cacheKey: string
  paperId?: string
  nodeId?: string
  sessionId?: string
  taskId?: string
  relatedPaperIds: string[]
  inputJson?: unknown
  promptVersion: string
  model: 'deepseek-v4-flash' | 'deepseek-v4-pro' | 'deepseek-chat' | 'deepseek-reasoner'
  jsonMode: boolean
  maxTokens: number
  temperature: number
  attempts: number
  maxAttempts: number
  progressStep: LLMProgressStep
  progressMessage: string
  errorCode?: LLMJobErrorCode
  errorMessage?: string
  resultJson?: unknown
  rawOutput?: string
  usage?: LLMUsage
  createdAt: string
  startedAt?: string
  finishedAt?: string
}

export interface PaperSearchQuery {
  query: string
  nodeId?: string
  paperId?: string
  searchQueries?: string[]
  yearFrom?: number
  yearTo?: number
  maxResults: number
  requireAbstract?: boolean
  requirePdf?: boolean
  providerHints?: string[]
}

export interface DedupedPaperCandidate {
  canonicalId: string
  mergedFrom: PaperSearchResult[]
  title: string
  authors: string[]
  year?: number
  sources: PaperSearchResult['source'][]
  externalIds: PaperExternalId[]
  bestUrl: string
  bestPdfUrl?: string
  abstract?: string
  score: number
}

export interface Kg3MemorySnapshot {
  papers: PaperRecord[]
  paperInsights: PaperInsightRecord[]
  graphNodes: GraphNodeRecord[]
  graphEdges: GraphEdgeRecord[]
  readingSessions: ReadingSession[]
  learningTasks: LearningTaskRecord[]
  diagnoses: DiagnosisRecord[]
  nodeExpansions: NodeExpansionRecord[]
  paperSearchResults: PaperSearchResultRecord[]
  mergedGraphNodes: MergedGraphNode[]
  mergedGraphEdges: MergedGraphEdge[]
  userMastery: UserMasteryRecord[]
  llmJobs: LLMJob[]
  nodeUnderstandingMemories: NodeUnderstandingMemory[]
}

export interface PaperMemoryRepository {
  savePaper(record: PaperRecord): Promise<void>
  getPaper(id: string): Promise<PaperRecord | null>
  listPapers(): Promise<PaperRecord[]>
  saveGraphForPaper(paperId: string, nodes: GraphNode[], edges: Array<{ id: string; sourceId: string; targetId: string; label?: string; directed: boolean }>, insight?: PaperInsight): Promise<void>
  saveSearchResults(query: string, results: PaperSearchResult[]): Promise<void>
  saveNodeExpansion(record: NodeExpansionRecord): Promise<void>
  saveKg4ExpansionRecord(record: Kg4NodeExpansionRecord): Promise<void>
  getKg4ExpansionRecord(paperId: string, nodeId: string): Promise<Kg4NodeExpansionRecord | null>
  saveLLMJob(job: LLMJob): Promise<void>
  saveNodeUnderstandingMemory(record: NodeUnderstandingMemory): Promise<void>
  listNodeUnderstandingMemories(query?: import('./kg4').NodeUnderstandingMemoryQuery): Promise<NodeUnderstandingMemory[]>
  findReusableNodeMemories(params: {
    node: GraphNodeRecord
    topicTags: string[]
    methodFamilyTags: string[]
    limit?: number
  }): Promise<import('./kg4').MemoryReuseSuggestion[]>
  getSnapshot(): Promise<Kg3MemorySnapshot>
}

export interface ReferencedPaperValidationResult {
  ok: boolean
  hallucinatedIds: string[]
  hallucinatedTitles: string[]
  errors: string[]
}

export interface PaperSearchProvider {
  id: 'arxiv' | 'semantic_scholar' | 'openalex' | 'local'
  displayName: string
  capabilities: Array<'keyword_search' | 'title_search' | 'id_lookup' | 'references' | 'citations' | 'open_access_pdf' | 'local_fulltext'>
  search(query: PaperSearchQuery): Promise<PaperSearchResult[]>
  getById(id: { provider: PaperSearchProvider['id']; externalId: string }): Promise<PaperSearchResult | null>
}

export interface Kg3ExpansionContext {
  retrievedPapers: DedupedPaperCandidate[]
  mergedNodes: MergedGraphNode[]
  mergeCandidates: MergeCandidate[]
  providerStatus: Array<{ provider: string; status: 'success' | 'empty' | 'error'; message: string }>
}

export interface VerifiedComparisonContext {
  currentNode: Pick<GraphNode, 'id' | 'label' | 'type' | 'description'>
  selectedRelatedPaper: RelatedPaper
  comparisonRows: SharpComparisonRow[]
  transferTask?: TransferTask
}
