import { createContext, type ReactNode } from 'react'
import type { PaperContextValue } from './types'
import { usePaperAnalysis } from './usePaperAnalysis'

export const PaperContext = createContext<PaperContextValue | null>(null)

interface PaperProviderProps {
  children: ReactNode
  onAnalysisComplete: () => void
  onPdfSelected: () => void
  setStagesRef: React.MutableRefObject<((tasks: Record<string, string> | null) => void) | null>
}

export function PaperProvider({ children, onAnalysisComplete, onPdfSelected, setStagesRef }: PaperProviderProps) {
  const {
    analysisSteps, analyzePaper, clearCurrentPaperAnalysis, generating, genError, genProgress,
    graph, graphPaperId, paperInsight, pdfUrl, paperId, selectPdf, setGraph, setPaperInsight, setPdfUrl
  } = usePaperAnalysis({
    setStagesRef,
    onAnalysisComplete,
    onPdfSelected,
    setSelectedGraphNodeId: () => {} // wired in Phase 2
  })

  return (
    <PaperContext.Provider value={{
      pdfUrl, paperId, graphPaperId, graph, paperInsight, analysisSteps, generating, genError, genProgress,
      selectPdf, analyzePaper, clearCurrentPaperAnalysis, setGraph, setPaperInsight, setPdfUrl
    }}>
      {children}
    </PaperContext.Provider>
  )
}
