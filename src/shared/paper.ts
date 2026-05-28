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

/** PDF 公式候选 — 来自规则提取器，非最终 LaTeX */
export interface FormulaCandidate {
  page: number
  y?: number
  rawText: string
  latexHint?: string
  confidence?: number
}

/** PDF 提取的结构化内容 */
export interface ExtractedPaperContent {
  pages: { page: number; text: string }[]
  formulaCandidates: FormulaCandidate[]
}

/** 将公式候选格式化为 prompt 文本（格式化层，非数据层） */
export function formatFormulaCandidatesForPrompt(candidates: FormulaCandidate[]): string {
  if (candidates.length === 0) return ''
  const lines = ['', '[Formula candidates extracted from PDF - reference hints, not final LaTeX]']
  for (const c of candidates) {
    const hint = c.latexHint ? ` LaTeX hint: ${c.latexHint}` : ''
    lines.push(`Page ${c.page}${c.y !== undefined ? `, y=${Math.round(c.y)}` : ''}: ${c.rawText}${hint}`)
  }
  return lines.join('\n')
}

export const EMPTY_GRAPH: KnowledgeGraph = { nodes: [], edges: [] }

export const INITIAL_ANALYSIS_STEPS: AnalysisStep[] = [
  { id: 'extract', label: '提取 PDF 全文', status: 'pending' },
  { id: 'analyze', label: 'AI 生成知识图谱和学习任务', status: 'pending' },
  { id: 'reveal', label: '逐步呈现图谱节点', status: 'pending' }
]
