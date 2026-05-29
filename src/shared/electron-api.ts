import type { ExtractedPaperContent, PaperAnalysisResult, SelectedPdf } from './paper'

export interface DiagnosisResult {
  errorType: string
  isCorrect: boolean
  feedback: string
  remedialTask: string
}

export interface LlmConfig {
  proxyUrl: string | null
}

export interface LlmConnectionTestResult {
  ok: boolean
  message: string
}

export interface ElectronApi {
  platform: string
  selectPdf: () => Promise<SelectedPdf | null>
  readPdfFile: (fileUrl: string) => Promise<ArrayBuffer | null>
  extractPdfText: (fileUrl: string) => Promise<ExtractedPaperContent | null>
  onLlmProgress: (cb: (msg: string) => void) => () => void
  llm: {
    setApiKey: (key: string) => Promise<void>
    clearApiKey: () => Promise<void>
    hasApiKey: () => Promise<boolean>
    getConfig: () => Promise<LlmConfig>
    getProviders: () => Promise<{ name: string; id: string }[]>
    setProxyUrl: (proxyUrl: string | null) => Promise<void>
    setProvider: (id: string) => Promise<void>
    testConnection: () => Promise<LlmConnectionTestResult>
    diagnose: (params: {
      stageId: string
      stageName: string
      taskDescription: string
      userAnswer: string
    }) => Promise<DiagnosisResult>
    analyzePaper: (content: ExtractedPaperContent) => Promise<PaperAnalysisResult>
  }
  storage: {
    save: (data: unknown) => Promise<{ ok: boolean; error?: string }>
    load: () => Promise<unknown>
  }
}
