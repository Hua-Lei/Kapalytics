import type { AnalysisStep, KnowledgeGraph, PaperInsight } from '../../../../shared/paper'

export interface PaperState {
  pdfUrl: string | null
  paperId: string | null
  graphPaperId: string | null
  graph: KnowledgeGraph
  paperInsight: PaperInsight | null
  analysisSteps: AnalysisStep[]
  generating: boolean
  genError: string
  genProgress: string
}

export interface PaperActions {
  selectPdf: () => Promise<void>
  analyzePaper: () => Promise<void>
  clearCurrentPaperAnalysis: () => Promise<void>
  setGraph: (graph: KnowledgeGraph) => void
  setPaperInsight: (insight: PaperInsight | null) => void
  setPdfUrl: (url: string | null) => void
}

export type PaperContextValue = PaperState & PaperActions
