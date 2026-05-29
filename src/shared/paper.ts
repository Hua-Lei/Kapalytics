export type NodeType = 'field' | 'concept' | 'problem' | 'method' | 'formula' | 'experiment' | 'limitation'

export type ExpansionType = 'field_overview' | 'related_papers' | 'method_evolution' | 'comparison'

export interface PaperInsight {
  centralInsight: string
  priorLimitation: string
  methodMechanism: string
  evidenceChain: string[]
  remainingGap: string
}

export interface FormulaExplanation {
  latex: string
  symbols: { symbol: string; meaning: string }[]
  trainingObjective?: string
  positionInMethod?: string
  ablationThought?: string
}

export interface MethodFlowStep {
  id: string
  label: string
  description: string
  input?: string
  output?: string
}

export interface ClaimEvidenceRow {
  experiment: string
  claim: string
  observation: string
  conclusion: string
}

export interface NodeDetail {
  summary: string
  keyPoints?: string[]
  roleInArgument?: string
  formulaExplanation?: FormulaExplanation
  methodFlow?: MethodFlowStep[]
  claimEvidence?: ClaimEvidenceRow[]
  failureConditions?: string[]
}

export interface GraphNode {
  id: string
  type: NodeType
  label: string
  description: string
  x: number
  y: number
  insight?: string
  whyImportant?: string
  roleInPaper?: string
  contrastWithPrior?: string
  evidenceNodeIds?: string[]
  expandable?: boolean
  expansionType?: ExpansionType
  searchQueries?: string[]
  detail?: NodeDetail
}

export interface GraphEdge {
  id: string
  sourceId: string
  targetId: string
  label?: string
  directed: boolean
}

export interface KnowledgeGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface RelatedPaper {
  id: string
  title: string
  authors?: string[]
  year?: number
  venue?: string
  topicTags: string[]
  methodFamily?: string
  branchId?: string
  branchLabel?: string
  summary: string
  relationToCurrentNode?: string
  relationToCurrentPaper: string
  whyCompare?: string
  influenceReason?: string
  url?: string
  source: 'mock' | 'semantic_scholar' | 'arxiv' | 'openalex' | 'local'
}

export type AdaptationStage = 'training_time' | 'test_time' | 'continual_test_time' | 'inference_time'

export type LineageRole = 'predecessor' | 'foundation' | 'variant' | 'current_paper' | 'possible_successor'

export interface RelatedPaperV2 extends RelatedPaper {
  methodFamily: string
  branchLabel: string
  lineageRole?: Exclude<LineageRole, 'current_paper'>
  relationToCurrentNode: string
  whyCompare: string
  solves: string
  remainingGap: string
  updatedObject?: string
  adaptationStage?: AdaptationStage
}

export interface DirectionProblem {
  id: string
  label: string
  whyItMatters: string
}

export interface MethodBranch {
  id: string
  label: string
  solvesProblemIds: string[]
  description: string
  representativePaperIds: string[]
  currentPaperBelongsHere: boolean
  currentPaperRelation?: string
}

export interface CurrentPaperPosition {
  branchId: string
  positionLabel: string
  reason: string
  inheritedFrom: string[]
  improvesOn: string[]
  remainingGap: string
}

export interface DirectionMap {
  nodeId: string
  fieldTitle: string
  fieldDefinition: string
  coreProblems: DirectionProblem[]
  methodBranches: MethodBranch[]
  currentPaperPosition: CurrentPaperPosition | null
  source: RelatedPaper['source']
  insufficientDataReason?: string
}

export interface MethodLineageStep {
  id: string
  role: LineageRole
  label: string
  solves: string
  remainingGap: string
  relationToCurrentPaper: string
  representativePaperIds: string[]
  isCurrentPaper: boolean
  missing?: boolean
}

export interface MethodLineage {
  nodeId: string
  title: string
  steps: MethodLineageStep[]
}

export type SharpComparisonDimension =
  | 'research_problem'
  | 'method_mechanism'
  | 'adaptation_stage'
  | 'updated_object'
  | 'inheritance'
  | 'improvement'
  | 'difference'
  | 'limitation'
  | 'combination'

export interface SharpComparisonRow {
  dimension: SharpComparisonDimension
  label: string
  currentPaper: string
  relatedPaper: string
  sharpInsight: string
}

export interface ComparisonWorkspace {
  nodeId: string
  selectedRelatedPaperId: string | null
  candidates: RelatedPaperV2[]
  comparisonRows: SharpComparisonRow[]
  transferTask?: TransferTask
  insufficientDataReason?: string
}

export interface FieldOverviewCard {
  title: string
  definition: string
  coreProblems: string[]
  methodFamilies: string[]
  relationToCurrentPaper: string
  keyTerms: string[]
}

export interface MethodEvolutionStep {
  id: string
  label: string
  description: string
  representativePaperIds: string[]
  relation: 'predecessor' | 'parallel' | 'successor' | 'variant'
}

export interface PaperComparisonRow {
  dimension: string
  currentPaper: string
  relatedPaper: string
}

export interface TransferTask {
  id: string
  prompt: string
  expectedReasoningPoints: string[]
  relatedPaperIds: string[]
  targetAbility: 'transfer_comparison'
}

export interface NodeExpansionResult {
  nodeId: string
  overview: FieldOverviewCard
  relatedPapers: RelatedPaper[]
  directionMap?: DirectionMap
  methodLineage?: MethodLineage
  comparisonWorkspace?: ComparisonWorkspace
  methodEvolution?: MethodEvolutionStep[]
  comparisonRows?: PaperComparisonRow[]
  transferTask?: TransferTask
}

export type AnalysisStepStatus = 'pending' | 'active' | 'done' | 'error'

export interface SelectedPdf {
  fileUrl: string
  filePath: string
}

export interface AnalysisStep {
  id: string
  label: string
  status: AnalysisStepStatus
}

export interface PaperAnalysisResult {
  insight?: PaperInsight
  graph: KnowledgeGraph
  tasks: Record<string, string>
}

export interface PaperSession {
  pdfUrl: string | null
  graph: KnowledgeGraph
  analysisSteps: AnalysisStep[]
  progressMessage: string
  errorMessage: string
}

export type FormulaSource = 'pdf-text' | 'pdf-row' | 'ocr' | 'manual' | 'llm'

/** PDF 公式候选 — 来自规则提取器，非最终 LaTeX。
 *  latexHint 只是启发式 hint，不是最终可置信 LaTeX。
 *  后续真正可渲染公式可另加字段（如 formulaLatex）。 */
export interface FormulaCandidate {
  id: string
  page: number
  y?: number
  rawText: string
  latexHint?: string
  confidence?: number
  source: FormulaSource
  extractor: string
}

export interface ExtractedPaperPage {
  page: number
  text: string
}

/** PDF 提取的结构化内容 */
export interface ExtractedPaperContent {
  pages: ExtractedPaperPage[]
  formulaCandidates: FormulaCandidate[]
}

export const EMPTY_GRAPH: KnowledgeGraph = { nodes: [], edges: [] }

export const INITIAL_ANALYSIS_STEPS: AnalysisStep[] = [
  { id: 'extract', label: '提取 PDF 全文', status: 'pending' },
  { id: 'analyze', label: 'AI 生成知识图谱和学习任务', status: 'pending' },
  { id: 'reveal', label: '逐步呈现图谱节点', status: 'pending' }
]
