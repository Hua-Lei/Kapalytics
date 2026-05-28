export type NodeType = 'field' | 'concept' | 'problem' | 'method' | 'formula' | 'experiment' | 'limitation'

export interface GraphNode {
  id: string
  type: NodeType
  label: string
  description: string
  x: number
  y: number
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

export const EMPTY_GRAPH: KnowledgeGraph = { nodes: [], edges: [] }

export const INITIAL_ANALYSIS_STEPS: AnalysisStep[] = [
  { id: 'extract', label: '提取 PDF 全文', status: 'pending' },
  { id: 'analyze', label: 'AI 生成知识图谱和学习任务', status: 'pending' },
  { id: 'reveal', label: '逐步呈现图谱节点', status: 'pending' }
]
