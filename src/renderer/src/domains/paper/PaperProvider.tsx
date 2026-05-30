import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { PaperContextValue } from './types'
import { usePaperAnalysis } from './usePaperAnalysis'

export const PaperContext = createContext<PaperContextValue | null>(null)

interface PaperProviderProps {
  children: ReactNode
  onAnalysisComplete: () => void
  setStagesRef: React.MutableRefObject<((tasks: Record<string, string>) => void) | null>
}

export function PaperProvider({ children, onAnalysisComplete, setStagesRef }: PaperProviderProps) {
  const {
    analysisSteps, analyzePaper, generating, genError, genProgress,
    graph, paperInsight, paperTasks, pdfUrl, selectPdf, setGraph, setPaperInsight, setPdfUrl
  } = usePaperAnalysis({
    setStagesRef,
    onAnalysisComplete,
    setSelectedGraphNodeId: () => {} // wired in Phase 2
  })

  return (
    <PaperContext.Provider value={{
      pdfUrl, graph, paperInsight, paperTasks, analysisSteps, generating, genError, genProgress,
      selectPdf, analyzePaper, setGraph, setPaperInsight, setPdfUrl
    }}>
      {children}
    </PaperContext.Provider>
  )
}
