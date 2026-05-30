import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { PaperContextValue } from './types'
import { usePaperAnalysis } from './usePaperAnalysis'

export const PaperContext = createContext<PaperContextValue | null>(null)

interface PaperProviderProps {
  children: ReactNode
  onAnalysisComplete: () => void
}

export function PaperProvider({ children, onAnalysisComplete }: PaperProviderProps) {
  const {
    analysisSteps, analyzePaper, generating, genError, genProgress,
    graph, paperInsight, pdfUrl, selectPdf, setGraph, setPaperInsight, setPdfUrl
  } = usePaperAnalysis({
    setStages: () => {}, // wired to StageProvider in Phase 2
    onAnalysisComplete,
    setSelectedGraphNodeId: () => {} // wired in Phase 2
  })

  return (
    <PaperContext.Provider value={{
      pdfUrl, graph, paperInsight, analysisSteps, generating, genError, genProgress,
      selectPdf, analyzePaper, setGraph, setPaperInsight, setPdfUrl
    }}>
      {children}
    </PaperContext.Provider>
  )
}
