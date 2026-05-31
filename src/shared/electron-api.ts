import type { ExtractedPaperContent, PaperAnalysisResult, SelectedPdf } from './paper'
import type { Kg3ExpansionContext, Kg3MemorySnapshot, LLMJob, PaperSearchQuery } from './kg3'
import type {
  Kg4ExpansionRecordQuery,
  Kg4NodeExpansionRecord,
  MemoryReuseSuggestion,
  NodeUnderstandingMemory,
  NodeUnderstandingMemoryQuery,
  StartKg4ExpansionParams,
  StartKg4ExpansionResult
} from './kg4'

export interface ExpansionProgressEvent {
  sessionId: string
  jobId: string
  step:
    | 'job_created'
    | 'classifying'
    | 'retrieving'
    | 'analyzing'
    | 'digesting'
    | 'synthesizing'
    | 'generating'
    | 'persisting'
    | 'done'
    | 'failed'
  message: string
  result?: unknown
  error?: string
}

export interface DiagnosisResult {
  errorType: string
  isCorrect: boolean
  feedback: string
  remedialTask: string
}

export interface LlmConfig {
  proxyUrl: string | null
  semanticScholarApiKeyConfigured: boolean
}

export interface LlmConnectionTestResult {
  ok: boolean
  message: string
}

export interface RetrievalConnectionTestResult {
  ok: boolean
  query: string
  candidateCount: number
  providerStatus: Array<{ provider: string; status: 'success' | 'empty' | 'error'; message: string }>
  samplePapers: Array<{ title: string; sources: string[]; year?: number }>
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
    setSemanticScholarApiKey: (key: string) => Promise<void>
    clearSemanticScholarApiKey: () => Promise<void>
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
  retrieval: {
    testSearch: (query: string) => Promise<RetrievalConnectionTestResult>
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
    getExpansionRecord: (params: Kg4ExpansionRecordQuery) => Promise<Kg4NodeExpansionRecord | null>
    saveExpansionRecord: (record: Kg4NodeExpansionRecord) => Promise<{ ok: boolean }>
    startExpansion: (params: StartKg4ExpansionParams) => Promise<StartKg4ExpansionResult>
    onExpansionProgress: (cb: (event: ExpansionProgressEvent) => void) => () => void
    getJobStatus: (jobId: string) => Promise<{ status: string; progressStep?: string; progressMessage?: string; errorMessage?: string }>
    cancelJob: (jobId: string) => Promise<void>
  }
}
