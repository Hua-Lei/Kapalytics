import type { ExtractedPaperContent, PaperAnalysisResult, SelectedPdf } from './paper'
import type { Kg3ExpansionContext, Kg3MemorySnapshot, LLMJob, PaperSearchQuery } from './kg3'
import type { MemoryReuseSuggestion, NodeUnderstandingMemory, NodeUnderstandingMemoryQuery } from './kg4'

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
  kg3: {
    getMemorySnapshot: () => Promise<Kg3MemorySnapshot>
    searchPapers: (query: PaperSearchQuery) => Promise<Kg3ExpansionContext>
    saveCurrentGraph: (payload: { paperId: string; title: string; fileUrl?: string; filePath?: string; data: unknown }) => Promise<{ ok: boolean; paperId: string }>
    fusePaperGraph: (paperId: string) => Promise<Kg3ExpansionContext>
    createLlmJob: (payload: { type: LLMJob['type']; input: unknown; paperId?: string; nodeId?: string; relatedPaperIds?: string[] }) => Promise<LLMJob>
    runLlmJob: (jobId: string) => Promise<LLMJob>
    cancelLlmJob: (jobId: string) => Promise<void>
  }
  kg4: {
    saveNodeUnderstandingMemory: (record: NodeUnderstandingMemory) => Promise<{ ok: boolean }>
    listNodeUnderstandingMemories: (query?: NodeUnderstandingMemoryQuery) => Promise<NodeUnderstandingMemory[]>
    findReusableNodeMemories: (params: {
      nodeId: string
      topicTags?: string[]
      methodFamilyTags?: string[]
      limit?: number
    }) => Promise<MemoryReuseSuggestion[]>
    startExpansion: (params: { nodeId: string; nodeLabel: string; paperId?: string }) => Promise<{ sessionId: string; jobs: Array<{ jobId: string; type: string }> }>
    getJobStatus: (jobId: string) => Promise<{ status: string; progressStep?: string; progressMessage?: string; errorMessage?: string }>
    cancelJob: (jobId: string) => Promise<void>
  }
}
